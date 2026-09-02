// Measures the scroll reveal instead of grepping the stylesheet for it.
//
// The `[data-reveal]` effect is a CSS scroll-driven animation. jsdom implements
// neither `animation-timeline` nor scrolling, so a unit test can only assert
// that the stylesheet's text says what the comment beside it says — which is
// how two geometric bugs shipped past 182 passing tests in D1 cycle 1. This
// script asserts the geometry, in a real browser, against the built site.
//
// It checks four invariants:
//
//   I1  nothing is ever permanently stranded — at maximum scroll every
//       [data-reveal] carries no visible transform and is fully opaque, at
//       every viewport height. (The failure it exists to catch: a range end
//       expressed as a fraction of the viewport, against travel set by the
//       document.) "No visible transform" and not literally `transform: none`,
//       because a filling animation's computed value is the interpolated one:
//       interpolating toward the `none` keyframe resolves `none` to the from-
//       list's identity, so Chrome reports `matrix(1, 0, 0, 1, 0, 0)` here and
//       never the keyword. Both are accepted; anything else is a failure.
//   I2  nothing above the fold starts hidden — at scroll 0 every [data-reveal]
//       with at least 15% of itself showing is at opacity 1 on the first frame.
//       15% is not a taste number: it is the `threshold` of the
//       IntersectionObserver this animation replaced, so it is the point the
//       new effect must not regress against.
//   I3  the effect still exists — a block scrolled to from below starts
//       displaced and settles. Asserted, not merely reported: the transform at
//       the moment of entry must not already be the identity, and the scrolled
//       distance to settle must be the range the stylesheet claims,
//       `min(block height, viewport)`.
//   I4  nothing paints illegibly at first paint — at scroll 0 every
//       [data-reveal] is at an *effective* opacity (its own, times every
//       ancestor's) that is either exactly 0, which axe treats as hidden, or
//       high enough that `--color-muted` composited over `--color-bg` still
//       clears 4.5:1. This is D1 cycle 2's REQUIRED 1 turned into a check: the
//       fade it was about put a wrapper at opacity 0.5324 at scroll 0, which
//       composites muted text to 2.92:1 and cost the registered desktop
//       accessibility threshold. Unlike I2 it looks at *every* wrapper, not
//       only the ones ≥15% visible, because the band the regression lived in
//       was 0 < visible < 15%.
//
// and, because charter 3 is the rule those hang off, the reduced-motion path in
// the same run: with the preference emulated, every wrapper is opaque, carries
// no transform and is running no animation at either end of the page.
//
// Vacuity is the thing this script had to be fixed for (D1 cycle 2 REQUIRED 3):
// pointed at a port with nothing listening it used to print "All assertions
// passed" and exit 0, because every assertion looped over an empty NodeList.
// So: navigation failure is fatal, the wrapper count per route is asserted
// against a table rather than assumed non-empty, an empty result set fails
// every invariant that would otherwise have nothing to iterate, and the run
// ends by checking that each invariant was actually exercised the number of
// times the case list implies.
//
// Usage:
//   pnpm build && pnpm start          # in another shell
//   node scripts/verify-reveal.mjs    # optionally: --base=http://localhost:3000
//
// Exits non-zero if any assertion fails, if navigation fails, or if any
// invariant ran fewer times than the case list requires.
//
// Dev tooling only. Node stdlib only — adds no dependency. `WebSocket` is the
// one thing it needs that Node 20 keeps behind a flag, so the script re-execs
// itself with `--experimental-websocket` rather than pulling in a ws client.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (typeof WebSocket === "undefined") {
  const r = spawnSync(
    process.execPath,
    ["--experimental-websocket", ...process.argv.slice(1)],
    { stdio: "inherit" },
  );
  process.exit(r.status ?? 1);
}

const arg = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ??
  fallback;

const BASE = arg("base", "http://localhost:3000");

// The observer this animation replaced fired at threshold: 0.15. Everything I2
// asserts is measured against that number and nothing else.
const OBSERVER_THRESHOLD = 0.15;

// WCAG AA for body text. I4's floor.
const AA = 4.5;

// The magnitudes the charter states (rule 2b, A5/A6) and that nothing else in
// this repository pins: a 12px rise, a 3deg lean, projected at 600px. I5 below
// asserts them against the *rendered* matrix, because cycle 3 showed every
// other check here passes with the rise cut to 0.4px or the tilt deleted
// outright. A guard that cannot fail is not a guard.
const RISE_PX = 12;
const TILT_DEG = 3;
const PERSPECTIVE_PX = 600;

// The length cap on the range end, from `globals.css`. The range is
// `entry 0% → entry min(100%, 135px)`, so the travel is min(h, V, 135) px: the
// percentage is what keeps the animation completable at every viewport height
// (charter 16 / A5), and the cap is what keeps a block taller than the viewport
// from spending a full viewport of scrolling on a 12px rise.
const RANGE_CAP = 135;

const CHROME =
  process.env.CHROME_PATH ??
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].find((p) => existsSync(p));

if (!CHROME) {
  console.error("No Chrome found. Set CHROME_PATH.");
  process.exit(1);
}

/** How many `[data-reveal]` wrappers each route renders. Asserted exactly, not
 *  as "more than zero": an empty NodeList is what made every assertion in this
 *  script vacuous, and a *shrunken* one would hide a dropped `<Reveal>` just as
 *  well. The numbers are the routes' own — `/` wraps five sections,
 *  `/colophon` three, and a case study wraps one per content block plus its
 *  three fixed sections — so a page edit that changes one is expected to change
 *  this table in the same diff. */
const EXPECTED_WRAPPERS = {
  "/": 5,
  "/colophon": 3,
  "/work/blotquant": 8,
  "/work/lifespan-extract": 8,
  "/work/media-automation-platform": 5,
  "/work/mira": 3,
};

/** Pages and viewports under test. All four `/work/[slug]` routes are covered:
 *  they do not share a shape — 8, 8, 5 and 3 wrappers, and the two short ones
 *  are where the shortest blocks on the site live. 1350x940 and 412x823 are the
 *  viewports the registered Lighthouse protocol audits at, desktop and mobile,
 *  so the accessibility threshold I4 exists to protect is measured at the size
 *  it is scored at. 1400 and 2400 are the heights D1 cycle 1 found stranding
 *  at; 1512x900 is the size every figure in the stylesheet's comment is quoted
 *  at. `/colophon` is included at 2400 because its document goes shorter than
 *  the viewport there, which makes the timeline inactive — a case the effect
 *  has to be correct in rather than lucky in. */
const CASES = [
  {
    path: "/",
    sizes: [
      [1350, 940],
      [1512, 900],
      [1512, 1400],
      [1512, 2400],
      [412, 823],
      [390, 844],
    ],
  },
  {
    path: "/work/blotquant",
    sizes: [
      [1350, 940],
      [1512, 900],
      [1512, 1400],
      [1512, 2400],
      [412, 823],
    ],
  },
  {
    path: "/work/lifespan-extract",
    sizes: [
      [1350, 940],
      [1512, 900],
      [1512, 2400],
      [412, 823],
    ],
  },
  {
    path: "/work/media-automation-platform",
    sizes: [
      [1350, 940],
      [1512, 900],
      [412, 823],
    ],
  },
  {
    path: "/work/mira",
    sizes: [
      [1350, 940],
      [1512, 900],
      [1512, 2400],
      [412, 823],
    ],
  },
  {
    path: "/colophon",
    sizes: [
      [1350, 940],
      [1512, 900],
      [1512, 2400],
      [412, 823],
    ],
  },
];

// ------------------------------------------------------------------ contrast

/** WCAG 2.1 relative luminance of an "r, g, b" triple. */
function luminance([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/** Source-over compositing of `fg` at alpha `a` onto `bg`, which is what an
 *  ancestor `opacity` does to the text inside it. */
const composite = (fg, bg, a) => fg.map((c, i) => a * c + (1 - a) * bg[i]);

/** The palette tokens are authored as hex in `globals.css`; a custom property's
 *  computed value is its literal token text, so both forms are accepted rather
 *  than assumed. Read from the page, never retyped here — charter 13. */
function parseColor(s) {
  const hex = s.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const nums = s.match(/[\d.]+/g);
  if (!nums || nums.length < 3) throw new Error(`unparseable colour: ${s}`);
  return nums.slice(0, 3).map(Number);
}

// ---------------------------------------------------------------- CDP client

const port = 9222 + (process.pid % 900);
const profile = mkdtempSync(join(tmpdir(), "reveal-verify-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--hide-scrollbars",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function browserWs() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      return (await res.json()).webSocketDebuggerUrl;
    } catch {
      await sleep(100);
    }
  }
  throw new Error("Chrome did not open a debugging port");
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    const waiters = new Map();
    let next = 0;

    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        if (!p) return;
        if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
        else p.resolve(msg.result);
      } else if (waiters.has(msg.method)) {
        for (const r of waiters.get(msg.method)) r(msg.params);
        waiters.delete(msg.method);
      }
    });
    ws.addEventListener("error", reject);
    ws.addEventListener("open", () =>
      resolve({
        send(method, params = {}, sessionId) {
          const id = ++next;
          return new Promise((res, rej) => {
            pending.set(id, { resolve: res, reject: rej });
            ws.send(JSON.stringify({ id, method, params, sessionId }));
          });
        },
        once(method) {
          return new Promise((res) => {
            if (!waiters.has(method)) waiters.set(method, []);
            waiters.get(method).push(res);
          });
        },
        close: () => ws.close(),
      }),
    );
  });
}

// ------------------------------------------------------------- in-page probe

/** Runs in the page. Returns one row per [data-reveal]: how much of it is
 *  showing, and what the compositor actually resolved for it. `effective` is
 *  the product of the element's own opacity and every ancestor's, which is what
 *  the text inside it is actually painted at — an ancestor fade would be as
 *  illegible as one on the wrapper itself. */
const PROBE = `(() => {
  const cs = getComputedStyle(document.documentElement);
  const out = [];
  for (const el of document.querySelectorAll("[data-reveal]")) {
    const r = el.getBoundingClientRect();
    const shown = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    const own = getComputedStyle(el);
    let effective = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      effective *= Number(getComputedStyle(n).opacity);
    }
    out.push({
      top: r.top + scrollY,
      height: r.height,
      visible: r.height ? shown / r.height : 0,
      opacity: Number(own.opacity),
      effective,
      transform: own.transform,
      animationName: own.animationName,
    });
  }
  return {
    href: location.href,
    docHeight: document.documentElement.scrollHeight,
    viewport: innerHeight,
    muted: cs.getPropertyValue("--color-muted").trim(),
    bg: cs.getPropertyValue("--color-bg").trim(),
    rows: out,
  };
})()`;

async function evaluate(cdp, session, expression) {
  const { result, exceptionDetails } = await cdp.send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    session,
  );
  if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails));
  return result.value;
}

/** Two rAFs, so the scroll-driven animation has been re-sampled and committed
 *  before anything is read back. */
const SETTLE = `new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`;

async function scrollTo(cdp, session, y) {
  await evaluate(cdp, session, `(scrollTo(0, ${y}), 1)`);
  await evaluate(cdp, session, SETTLE);
}

/** The case-study pages mount chart embeds that finish laying out after `load`,
 *  so the document keeps growing for a few frames. Every figure below is a
 *  geometry read; taking one mid-growth produces a number that is about the
 *  measurement and not about the effect. Wait for scrollHeight to hold still. */
async function settleLayout(cdp, session) {
  let last = -1;
  for (let i = 0; i < 40; i++) {
    await evaluate(cdp, session, SETTLE);
    const h = await evaluate(
      cdp,
      session,
      `document.documentElement.scrollHeight`,
    );
    if (h === last) return h;
    last = h;
  }
  return last;
}

/** Scrolls to the true bottom and confirms it. `scrollTo` clamps to whatever
 *  the maximum is at the moment it runs, so a document that grew in between
 *  would leave the reader short of the bottom — and I1 is an assertion about
 *  the bottom specifically. */
async function scrollToBottom(cdp, session) {
  for (let i = 0; i < 10; i++) {
    await scrollTo(cdp, session, 1e7);
    const atMax = await evaluate(
      cdp,
      session,
      `document.documentElement.scrollHeight - (scrollY + innerHeight) <= 1`,
    );
    if (atMax) return true;
  }
  return false;
}

/** Navigates and refuses to continue on anything that is not a real load of the
 *  page asked for. `Page.loadEventFired` fires for Chrome's own error page too,
 *  so the load event alone proves nothing — this is the check whose absence let
 *  the script report a pass against a port with nothing listening. */
async function navigate(cdp, session, url) {
  const loaded = cdp.once("Page.loadEventFired");
  const res = await cdp.send("Page.navigate", { url }, session);
  if (res.errorText)
    throw new Error(`navigation to ${url} failed: ${res.errorText}`);
  await loaded;
  const href = await evaluate(cdp, session, `location.href`);
  if (!href.startsWith(url)) {
    throw new Error(`navigation to ${url} landed on ${href}`);
  }
  const title = await evaluate(cdp, session, `document.title`);
  if (!title)
    throw new Error(`navigation to ${url} produced an empty document`);
}

// ------------------------------------------------------------------ the runs

const failures = [];
const notes = [];
const fmt = (n, d = 3) => n.toFixed(d);
const settledTransform = (t) =>
  t === "none" || /^matrix\(1, 0, 0, 1, 0, 0\)$/.test(t);

/** Every assertion increments its own counter, and the run refuses to succeed
 *  unless each one reached the number of observations the case list implies.
 *  An assertion that never ran is the failure mode this script shipped with. */
// The column-major matrix a browser computes for
// `perspective(600px) rotateX(-3deg) translateY(12px)`. Deriving it here rather
// than string-matching the declaration means the assertion is against what was
// actually painted, so a change in either number fails even if the CSS text
// still looks plausible.
function expectedEntryMatrix(
  rise = RISE_PX,
  tiltDeg = TILT_DEG,
  d = PERSPECTIVE_PX,
) {
  const t = (-tiltDeg * Math.PI) / 180;
  const c = Math.cos(t);
  const s2 = Math.sin(t);
  // rotateX(t) * translateY(rise), then perspective(d) applied on the left.
  // Column-major m[col][row]; only the entries the reveal can move are checked.
  const m = [
    [1, 0, 0, 0],
    [0, c, s2, 0],
    [0, -s2, c, 0],
    [0, rise * c, rise * s2, 1],
  ];
  // perspective(d): m34 = -1/d, applied as a left-multiply, which scales the
  // w component by the z of each column.
  for (let col = 0; col < 4; col++) m[col][3] += -m[col][2] / d;
  return m.flat();
}

function parseMatrix(str) {
  // Only the parenthesised argument list — the "3" in `matrix3d` is a digit and
  // would otherwise be parsed as a 17th component.
  const inner = /\(([^)]*)\)/.exec(str)?.[1] ?? "";
  const nums = (inner.match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || []).map(Number);
  if (nums.length === 16) return nums;
  if (nums.length === 6) {
    const [a, b, c, d, e, f] = nums;
    return [a, b, 0, 0, c, d, 0, 0, 0, 0, 1, 0, e, f, 0, 1];
  }
  return null;
}

const ran = { I1: 0, I2: 0, I3: 0, I4: 0, I5: 0, RM: 0, wrappers: 0 };

const cdp = await connect(await browserWs());
const { targetId } = await cdp.send("Target.createTarget", {
  url: "about:blank",
});
const { sessionId } = await cdp.send("Target.attachToTarget", {
  targetId,
  flatten: true,
});
await cdp.send("Page.enable", {}, sessionId);

/** Derived from the case list up front, not accumulated inside the loop: an
 *  expectation that is only built as the loop runs is zero when the loop never
 *  runs, which is the exact shape of the vacuity being fixed here. */
const expectedWrapperObservations = CASES.reduce(
  (n, c) => n + c.sizes.length * EXPECTED_WRAPPERS[c.path],
  0,
);
const expectedI4 = expectedWrapperObservations;

/** I2 and I3/I5 are per-page rather than per-wrapper, and a page can legitimately
 *  skip I3 at a viewport where the last wrapper starts above the fold. The floor
 *  is therefore one measurement per *route with reveals* — every route must be
 *  exercised at least once, at some viewport — rather than the literal `1` these
 *  floors used to carry, which a run that collapsed to a single observation
 *  would still have satisfied. Derived from the case list, never from the loop. */
const routesWithReveals = new Set(
  CASES.filter((c) => EXPECTED_WRAPPERS[c.path] > 0).map((c) => c.path),
).size;
const expectedI2 = routesWithReveals;
const expectedI3 = routesWithReveals;

try {
  for (const { path, sizes } of CASES) {
    const expected = EXPECTED_WRAPPERS[path];
    if (expected == null)
      throw new Error(`no wrapper count registered for ${path}`);

    for (const [width, height] of sizes) {
      await cdp.send(
        "Emulation.setDeviceMetricsOverride",
        { width, height, deviceScaleFactor: 1, mobile: false },
        sessionId,
      );
      await navigate(cdp, sessionId, BASE + path);
      await settleLayout(cdp, sessionId);

      const label = `${path} ${width}x${height}`;
      const first = await evaluate(cdp, sessionId, PROBE);

      // The count. Everything below iterates this set, so an empty or short one
      // has to fail here rather than pass silently further down.
      if (first.rows.length !== expected) {
        failures.push(
          `  FAIL ${label}: ${first.rows.length} [data-reveal] wrappers, expected ${expected}`,
        );
        continue;
      }
      ran.wrappers += first.rows.length;

      // The animation is declared at all. A dropped stylesheet chunk, a renamed
      // attribute or a guard that stopped matching all land here.
      const unanimated = first.rows.filter(
        (r) => r.animationName !== "reveal-rise",
      );
      if (unanimated.length) {
        failures.push(
          `  FAIL ${label}: ${unanimated.length}/${first.rows.length} wrappers have animation-name ${unanimated[0].animationName}, expected reveal-rise`,
        );
      }

      const muted = parseColor(first.muted);
      const bg = parseColor(first.bg);

      // I4 — first paint legibility, at every wrapper regardless of how much of
      // it is showing. Either nothing is painted (axe treats opacity 0 as
      // hidden) or what is painted clears AA.
      first.rows.forEach((row, i) => {
        const a = row.effective;
        const r = ratio(composite(muted, bg, a), bg);
        const ok = a === 0 || r >= AA;
        const line = `I4 ${label} wrapper #${i}: effective opacity ${fmt(a)}, muted at ${fmt(r, 2)}:1`;
        ran.I4++;
        if (ok) notes.push(`  ok   ${line}`);
        else failures.push(`  FAIL ${line}  (needs 0 or >= ${AA}:1)`);
      });

      // I2 — first paint. Nothing that the old observer would have revealed
      // may be painted faint on the frame the reader first sees.
      first.rows.forEach((row, i) => {
        if (row.visible < OBSERVER_THRESHOLD) return;
        ran.I2++;
        const ok = row.opacity >= 0.999;
        const line = `I2 ${label} wrapper #${i}: ${fmt(row.visible * 100, 1)}% visible, opacity ${fmt(row.opacity)}`;
        if (ok) notes.push(`  ok   ${line}`);
        else failures.push(`  FAIL ${line}  (expected 1)`);
      });

      // I1 — maximum scroll. Every wrapper is behind the reader by then; none
      // of them may still be mid-reveal, at any viewport height.
      const bottomed = await scrollToBottom(cdp, sessionId);
      if (!bottomed) failures.push(`  FAIL ${label}: never reached the bottom`);
      const end = await evaluate(cdp, sessionId, PROBE);
      ran.I1++;
      if (end.rows.length !== expected) {
        failures.push(
          `  FAIL I1 ${label}: ${end.rows.length} wrappers at maximum scroll, expected ${expected}`,
        );
      } else {
        const stuck = end.rows.filter(
          (r) => r.opacity < 0.999 || !settledTransform(r.transform),
        );
        const last = end.rows.at(-1);
        const line = `I1 ${label}: ${end.rows.length} wrappers settled, last opacity ${fmt(last.opacity)}, transform ${last.transform}`;
        if (stuck.length === 0) notes.push(`  ok   ${line}`);
        else
          failures.push(
            `  FAIL ${line}  (${stuck.length}/${end.rows.length} wrappers unfinished, first: opacity ${fmt(stuck[0].opacity)} transform ${stuck[0].transform})`,
          );
      }

      // I3 — the effect survives, and runs the range the stylesheet claims.
      // Measured on the last wrapper, from the frame its top edge reaches the
      // viewport bottom to the frame its transform is the identity.
      const last = end.rows.at(-1);
      const range = Math.min(last.height, height, RANGE_CAP);
      if (last.top - height >= 0) {
        ran.I3++;
        await scrollTo(cdp, sessionId, last.top - height);
        const atEntry = (await evaluate(cdp, sessionId, PROBE)).rows.at(-1);

        // I5 — the magnitudes, not merely "something moved". Cycle 3 showed
        // every other check here passes with the rise cut to 0.4px or the tilt
        // deleted, so the numbers rule 2b and A5/A6 state were pinned by
        // nothing that runs.
        //
        // Sampled 20px BEFORE the range starts wherever the document allows it:
        // `animation-fill-mode: both` holds the 0% keyframe there, so the
        // matrix is the declared one exactly rather than an interpolated one.
        // Where the page is too short for that, fall back to tan(tilt)/rise,
        // which is invariant along the range (both terms carry the same
        // (1-progress) factor), so it still pins the two magnitudes against
        // each other.
        {
          ran.I5++;
          const pre = last.top - height - 20;
          const exact = pre >= 0;
          if (exact) {
            await scrollTo(cdp, sessionId, pre);
          }
          const sample = exact
            ? (await evaluate(cdp, sessionId, PROBE)).rows.at(-1)
            : atEntry;
          const got = parseMatrix(sample.transform);
          const want = expectedEntryMatrix();
          const wantRatio = Math.tan((TILT_DEG * Math.PI) / 180) / RISE_PX;
          const I5 = `I5 ${label}: ${exact ? "pre-entry" : "ratio"} matrix vs perspective(${PERSPECTIVE_PX}px) rotateX(-${TILT_DEG}deg) translateY(${RISE_PX}px)`;
          if (!got) {
            failures.push(
              `  FAIL ${I5}  (unparseable transform ${sample.transform})`,
            );
          } else if (exact) {
            const worst = got.reduce(
              (acc, v, i) =>
                Math.abs(v - want[i]) > acc.d
                  ? { d: Math.abs(v - want[i]), i, v }
                  : acc,
              { d: 0, i: -1, v: 0 },
            );
            if (worst.d > 0.02) {
              failures.push(
                `  FAIL ${I5}  (m[${worst.i}] = ${fmt(worst.v, 4)}, expected ${fmt(want[worst.i], 4)}, off by ${fmt(worst.d, 4)})`,
              );
            } else {
              notes.push(`  ok   ${I5} — max element delta ${fmt(worst.d, 4)}`);
            }
          } else {
            const ratio = got[13] === 0 ? Infinity : got[9] / got[13];
            if (Math.abs(ratio - wantRatio) > wantRatio * 0.05) {
              failures.push(
                `  FAIL ${I5}  (tan(tilt)/rise = ${fmt(ratio, 6)}, expected ${fmt(wantRatio, 6)})`,
              );
            } else {
              notes.push(`  ok   ${I5} — tan(tilt)/rise ${fmt(ratio, 6)}`);
            }
          }
          if (exact) await scrollTo(cdp, sessionId, last.top - height);
        }

        let lo = 0;
        let hi = Math.min(range * 1.5, last.top + last.height);
        for (let i = 0; i < 14; i++) {
          const mid = (lo + hi) / 2;
          await scrollTo(cdp, sessionId, last.top - height + mid);
          const row = (await evaluate(cdp, sessionId, PROBE)).rows.at(-1);
          if (settledTransform(row.transform)) hi = mid;
          else lo = mid;
        }
        // 2px of slack for the binary search and for sub-pixel layout; the
        // quantity under test is a range end of `min(100%, 135px)` of `entry`,
        // so the answer is min(h, V, 135) or the stylesheet does not say what
        // it says.
        const line = `I3 ${label}: last wrapper enters at transform ${atEntry.transform}, settles after ${fmt(hi, 0)}px (declared min(h, V, ${RANGE_CAP}) = ${fmt(range, 0)}px, ${fmt((hi / 675) * 1000, 0)}ms at 675px/s)`;
        if (settledTransform(atEntry.transform)) {
          failures.push(
            `  FAIL ${line}  (no displacement at entry — the effect is gone)`,
          );
        } else if (Math.abs(hi - range) > 2 + range * 0.02) {
          failures.push(`  FAIL ${line}  (settles off its declared range)`);
        } else {
          notes.push(`  i3   ${line}`);
        }
      } else {
        notes.push(
          `  i3   ${label}: skipped, the last wrapper starts above the fold`,
        );
      }
    }
  }

  // Charter 3: reduced motion removes the motion, never the content. Same
  // measurement, with the preference emulated — every wrapper must be opaque,
  // untransformed and running no animation, at the top of the page and at the
  // bottom.
  await cdp.send(
    "Emulation.setEmulatedMedia",
    { features: [{ name: "prefers-reduced-motion", value: "reduce" }] },
    sessionId,
  );
  for (const { path } of CASES) {
    const expected = EXPECTED_WRAPPERS[path];
    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      { width: 1512, height: 900, deviceScaleFactor: 1, mobile: false },
      sessionId,
    );
    await navigate(cdp, sessionId, BASE + path);
    await settleLayout(cdp, sessionId);

    const reduced = async () =>
      evaluate(
        cdp,
        sessionId,
        `[...document.querySelectorAll("[data-reveal]")].map(el => {
          const cs = getComputedStyle(el);
          return [Number(cs.opacity), cs.animationName, el.getAnimations().length, cs.transform];
        })`,
      );
    const top = await reduced();
    await scrollToBottom(cdp, sessionId);
    const bottom = await reduced();
    ran.RM++;
    const line = `RM ${path} 1512x900: ${top.length} wrappers, opacity 1, transform none, animation-name none, 0 animations`;
    if (top.length !== expected || bottom.length !== expected) {
      failures.push(
        `  FAIL RM ${path}: ${top.length}/${bottom.length} wrappers, expected ${expected}`,
      );
      continue;
    }
    const bad = [...top, ...bottom].filter(
      ([o, n, count, t]) =>
        o < 0.999 || n !== "none" || count !== 0 || t !== "none",
    );
    if (bad.length === 0) notes.push(`  ok   ${line}`);
    else failures.push(`  FAIL ${line} — ${JSON.stringify(bad[0])}`);
  }
  await cdp.send("Emulation.setEmulatedMedia", { features: [] }, sessionId);
} catch (err) {
  failures.push(`  FAIL ${err.message}`);
} finally {
  cdp.close();
  chrome.kill();
  // Best-effort: Chrome flushes its profile asynchronously after SIGTERM, so a
  // leftover temp directory must never mask the measurements below.
  await sleep(250);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
  } catch {
    /* ignore */
  }
}

// Coverage. Reporting a pass is only meaningful if the assertions ran; this is
// the check that makes "measured nothing" a failure rather than a silent pass.
const cases = CASES.reduce((n, c) => n + c.sizes.length, 0);
const coverage = [
  ["cases", ran.I1, cases],
  ["wrapper observations", ran.wrappers, expectedWrapperObservations],
  ["I4 checks", ran.I4, expectedI4],
  ["I2 checks", ran.I2, expectedI2],
  ["I3 measurements", ran.I3, expectedI3],
  ["I5 magnitude checks", ran.I5, expectedI3],
  ["reduced-motion pages", ran.RM, CASES.length],
];
for (const [what, got, want] of coverage) {
  if (got < want)
    failures.push(`  FAIL coverage: ${got} ${what}, expected ${want}`);
}

console.log(notes.join("\n"));
console.log(
  `\nCoverage: ${ran.I1}/${cases} page×viewport cases, ${ran.wrappers} wrapper observations, ` +
    `I1 ${ran.I1}, I2 ${ran.I2}, I3 ${ran.I3}, I4 ${ran.I4}, I5 ${ran.I5}, RM ${ran.RM}.`,
);
if (failures.length) {
  console.log(`\n${failures.length} failure(s):`);
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log(
  `All I1/I2/I3/I4/I5 assertions passed (${notes.length} observations).`,
);
