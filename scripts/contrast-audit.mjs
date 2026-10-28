// T10 contrast audit (BASELINE.md, "Threshold revision — 2026-10-16").
//
// Every route at 1440, 768 and 390 px, in every state: each visible
// text node is composited over the worst underlay the decorative layers can
// produce beneath it, through every translucent fill between it and the page,
// and its contrast is checked against WCAG 2.1 AA (4.5:1, 3:1 for large text).
// The method is the one recorded under `.ascii-field` in `globals.css`.
//
// States. Every disclosure (`aria-expanded="false"`) is opened in every state.
// On top of that base, each tab (`role="tab"`, or a `button[aria-pressed]`)
// that is not already active and each `role="switch"` is activated, one at a
// time, on a fresh load of the page — so no state depends on another control
// restoring itself. A text node seen in several states is counted once, at its
// worst state.
//
// Underlay. The documented worst point is the 3.5% fg dot grid under both hero
// glows exactly coincident (each 10%), rgb(29, 56, 53). The character field's
// glyph (`--color-glyph`, muted) sits on that at the alpha cap of the node's
// own column (`alphaCap` in `asciiField.math.ts`: COLUMN_CAP inside <main>'s
// horizontal extent and everywhere below 640 px, eased up to the gutter peak
// outside it). The glyph is composited in every stacking order — above both
// glows, between them, below both — and the worst result is used.
//
// Settling. Before any text is sampled, every finite animation on the document
// timeline has run to its end (bounded at 5 s; a timeout fails the run).
// Scroll-driven and infinite animations are not waited for. A node none of
// whose points could be hit-tested is unmeasured, and fails the audit.
//
// Paint above. What is painted on top of a node's text is never composited:
// a node under an element that paints one of the kinds `paintsAbove` reads is
// reported as covered, and fails the audit, unless it is an entry in the
// exclusion list recorded in design/BASELINE.md ("T10 paint-above
// exclusions"). An entry that matches no node in a view the run audited fails
// the run too, so the list cannot go stale. Not detected, and listed in
// BASELINE.md: borders, outlines and box-shadows; SVG strokes; the glyphs and
// text-shadow of an overlapping element; filter, backdrop-filter and blend
// modes; pseudo-elements painting only content text or borders; and anything
// away from the sample points.
//
// Usage (against a running production server):
//   node scripts/contrast-audit.mjs http://localhost:3201 [--json out.json]
//     [--routes /a,/b]   audit these paths instead of the site's routes (the
//                        known-answer test, `contrast-audit.selftest.mjs`)
//     [--exclusions f]   read the paint-above exclusions from this file
//                        instead of design/BASELINE.md (the known-answer test)
// Exits 1 if any node is below AA, unmeasured or covered. CHROME_PATH overrides the Chrome binary.
//
// Dev tooling only. Node stdlib only — drives Chrome over
// --remote-debugging-pipe, so it adds no dependency.

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The last entry is any unknown path: the 404 page is audited too.
// Audited on purpose: it must answer 404. Every other route must answer 200.
const NOT_FOUND_ROUTE = "/this-page-does-not-exist";
const ROUTES = [
  "/",
  "/colophon",
  "/work/blotquant",
  "/work/lifespan-extract",
  "/work/media-automation-platform",
  "/work/mira",
  NOT_FOUND_ROUTE,
];
const CONTROLS = '[role="tab"], button[aria-pressed], [role="switch"]';
const WIDTHS = [1440, 768, 390];
const HEIGHT = 900;

// Mirrors src/app/globals.css and src/components/field/asciiField.math.ts.
const BG = [13, 13, 15];
const FG = [232, 232, 234];
const MUTED = [161, 161, 170];
const ACCENT = [56, 189, 248];
const OK = [74, 222, 128];
const DOT_ALPHA = 0.035;
const GLOW_ALPHA = 0.1;
const COLUMN_CAP = 0.04;
const GUTTER_CAP = 0.6;
const FEATHER_SHARE = 0.7;
const MIN_FEATHER = 160;
const GUTTER_REF = 368;
const NARROW_PX = 640;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const over = (under, color, a) => under.map((u, i) => u + (color[i] - u) * a);

function alphaCap(out, gutter) {
  if (!(out > 0)) return COLUMN_CAP;
  const feather = Math.max(MIN_FEATHER, FEATHER_SHARE * gutter);
  const peak =
    COLUMN_CAP + (GUTTER_CAP - COLUMN_CAP) * clamp01(gutter / GUTTER_REF);
  const s = clamp01(out / feather);
  return COLUMN_CAP + (peak - COLUMN_CAP) * s * s * (3 - 2 * s);
}

/** The worst-case underlays for a glyph at alpha `cap`, one per stacking order. */
function underlays(cap) {
  const dot = over(BG, FG, DOT_ALPHA);
  const glyph = (c) => over(c, MUTED, cap);
  const a = (c) => over(c, ACCENT, GLOW_ALPHA);
  const o = (c) => over(c, OK, GLOW_ALPHA);
  return [glyph(o(a(dot))), o(glyph(a(dot))), o(a(glyph(dot)))];
}

const lin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (x, y) => {
  const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};

// Runs in the page. Returns every visible text node with its colour, what is
// painted beneath it at each sample point (bottom-up), what paints above it,
// and its horizontal extent.
//
// What is beneath a node is hit-tested, not inferred from its ancestors: at up
// to three points across each of its line boxes, `elementsFromPoint` gives the
// paint stack, and every element below the text's own element — ancestors, and
// non-ancestors such as an SVG <rect> drawn under an SVG <text> — contributes
// its fill. Pointer events are forced on while sampling so `pointer-events:
// none` layers are still seen; nothing else about the page changes.
async function collect() {
  const frame = () =>
    new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  let timedOut = false;
  // Every finite animation on the document timeline runs to its end, so text
  // is sampled where and as it rests, not mid-swap. Scroll-driven animations
  // (the reveal) have no end to wait for; infinite ones never end. Reduced
  // motion is not emulated: that is a different page state.
  const ANIMATION_TIMEOUT = 5000;
  const settled = async () => {
    const finite = document
      .getAnimations()
      .filter(
        (a) =>
          a.timeline instanceof DocumentTimeline &&
          a.playState === "running" &&
          a.effect?.getComputedTiming().endTime !== Infinity,
      );
    if (finite.length === 0) return;
    const done = await Promise.race([
      Promise.all(finite.map((a) => a.finished.catch(() => {}))).then(
        () => true,
      ),
      new Promise((r) => setTimeout(() => r(false), ANIMATION_TIMEOUT)),
    ]);
    if (!done) timedOut = true;
    await frame();
  };
  await settled();

  // Computed colours arrive as rgb()/rgba(), or as color(srgb r g b / a) for
  // `color-mix(in srgb, …)` fills. Anything else is recorded, never skipped.
  const unparsed = [];
  const rgba = (s) => {
    if (s === "transparent") return [0, 0, 0, 0];
    let m = s.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      const p = m[1]
        .split(/[\s,/]+/)
        .filter(Boolean)
        .map(Number);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    }
    m = s.match(/^color\(srgb ([^)]+)\)$/);
    if (m) {
      const p = m[1]
        .split(/[\s/]+/)
        .filter(Boolean)
        .map(Number);
      return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1];
    }
    unparsed.push(s);
    return null;
  };
  const groupOpacity = (el) => {
    let o = 1;
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      o *= Number(getComputedStyle(e).opacity);
    }
    return o;
  };
  const SHAPES = new Set(["rect", "circle", "ellipse", "path", "polygon"]);
  const describe = (e) =>
    e.tagName.toLowerCase() +
    (e.className && typeof e.className === "string"
      ? "." + e.className.trim().split(/\s+/).slice(0, 3).join(".")
      : "");
  // Layers whose paint is already in the registered worst underlay, so their
  // gradients are not read again here: the dot grid (layout.tsx), the site
  // glows and the hero glows (`.page-glow`'s two pseudo-elements). Named one by
  // one; anything else with a background-image or a painting pseudo-element
  // fails the run.
  const MODELLED =
    'body > div.pointer-events-none.fixed.inset-0[aria-hidden="true"], .site-glow__blob';
  // Pseudo-elements that paint, but never beneath their element's text:
  // `.link-underline::after` is a 1px bar 3px below the text box, and
  // `.spotlight-card::before` is masked to the card's 1px border ring.
  const PSEUDO_MODELLED = [
    [".page-glow", "::before"],
    [".page-glow", "::after"],
  ];
  const PSEUDO_CLEAR = [
    [".link-underline", "::after"],
    [".spotlight-card", "::before"],
  ];
  // The colour an element paints over its box at a point, with its effective
  // alpha (colour alpha × fill-opacity × every ancestor's opacity), or null.
  const paint = (e) => {
    const s = getComputedStyle(e);
    let c;
    if (e instanceof SVGElement) {
      if (!SHAPES.has(e.tagName.toLowerCase()) || s.fill === "none")
        return null;
      if (s.fill.startsWith("url(")) {
        unparsed.push(`${e.tagName} fill ${s.fill}`);
        return null;
      }
      c = rgba(s.fill);
      if (c) c[3] *= Number(s.fillOpacity);
    } else {
      c = rgba(s.backgroundColor);
      // A gradient or image paints a colour the audit cannot read off one
      // property: recorded, so the run fails, unless it is a modelled layer.
      if (s.backgroundImage !== "none" && !e.matches(MODELLED)) {
        unparsed.push(`${describe(e)} background-image ${s.backgroundImage}`);
      }
    }
    if (c) c[3] *= groupOpacity(e);
    return c;
  };
  // Pseudo-elements are never returned by elementsFromPoint, so one that
  // paints behind text would be missed: any that paints at all is recorded.
  const pseudoPaint = (e) => {
    for (const which of ["::before", "::after"]) {
      const s = getComputedStyle(e, which);
      if (s.content === "none" || s.content === "normal") continue;
      const bg = rgba(s.backgroundColor);
      if ((bg && bg[3] > 0) || s.backgroundImage !== "none") {
        const named = [...PSEUDO_MODELLED, ...PSEUDO_CLEAR].some(
          ([sel, w]) => w === which && e.matches(sel),
        );
        if (!named) {
          unparsed.push(`${describe(e)}${which} paints a background`);
        }
      }
    }
  };
  // What an element on top of the text paints, or null: a fill, a gradient
  // or image, an SVG shape, replaced content, or a painting pseudo-element.
  // None of it is composited; the node is reported as covered instead.
  const REPLACED = new Set([
    "canvas",
    "img",
    "video",
    "iframe",
    "object",
    "embed",
  ]);
  // SVG elements that paint a fill: the basic shapes, and text. `<use>` and
  // `<image>` draw content the hit-test does not descend into, so they count
  // as painting whatever they hold.
  const SVG_FILLED = new Set([
    ...SHAPES,
    "polyline",
    "text",
    "tspan",
    "textPath",
  ]);
  const SVG_CONTENT = new Set(["use", "image"]);
  const paintsAbove = (e) => {
    if (groupOpacity(e) === 0) return null;
    const s = getComputedStyle(e);
    const tag = e.tagName.toLowerCase();
    if (e instanceof SVGElement && SVG_CONTENT.has(tag)) return tag;
    if (e instanceof SVGElement && SVG_FILLED.has(e.tagName)) {
      if (s.fill === "none" || Number(s.fillOpacity) === 0) return null;
      if (s.fill.startsWith("url(")) return "fill " + s.fill;
      const c = rgba(s.fill);
      return c && c[3] > 0 ? "fill" : null;
    }
    // Any other SVG element paints only through CSS backgrounds, which only
    // the outer <svg> and <foreignObject> have; for the rest they read as none.
    if (REPLACED.has(tag)) return tag;
    const bg = rgba(s.backgroundColor);
    if (bg && bg[3] > 0) return "background-color";
    if (s.backgroundImage !== "none") return "background-image";
    for (const which of ["::before", "::after"]) {
      const p = getComputedStyle(e, which);
      if (p.content === "none" || p.content === "normal") continue;
      const pb = rgba(p.backgroundColor);
      if (!((pb && pb[3] > 0) || p.backgroundImage !== "none")) continue;
      if (PSEUDO_CLEAR.some(([sel, w]) => w === which && e.matches(sel)))
        continue;
      return which + " background";
    }
    return null;
  };
  // The text node's line boxes as they are painted right now, in client
  // coordinates. Read live: the scroll-driven reveal moves content as it
  // scrolls, so a box measured at one scroll offset is wrong at another.
  const visibleRects = (n, el) => {
    const range = document.createRange();
    range.selectNodeContents(n);
    // A text range's rects ignore ancestor clipping, so clip them by hand:
    // overflow, `clip` and `clip-path` (the sr-only pattern) all hide text.
    let rects = [...range.getClientRects()].map((r) => ({
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
    }));
    for (let e = el; e && rects.length; e = e.parentElement) {
      const s = getComputedStyle(e);
      const clips =
        s.overflowX !== "visible" ||
        s.overflowY !== "visible" ||
        s.clip !== "auto" ||
        s.clipPath !== "none";
      if (!clips) continue;
      const b = e.getBoundingClientRect();
      rects = rects.map((r) => ({
        left: Math.max(r.left, b.left),
        right: Math.min(r.right, b.right),
        top: Math.max(r.top, b.top),
        bottom: Math.min(r.bottom, b.bottom),
      }));
      rects = rects.filter((r) => r.right - r.left > 1 && r.bottom - r.top > 1);
    }
    // Text placed outside the document (e.g. a chart's measurement span at
    // top: -20000px) can never be seen.
    return rects.filter((r) => r.bottom + scrollY > 0 && r.right + scrollX > 0);
  };
  const main = document.querySelector("main")?.getBoundingClientRect();
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.data.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest("script, style, noscript, template")) continue;
    const rects = visibleRects(n, el);
    if (rects.length === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== "visible") continue;
    const opacity = groupOpacity(el);
    if (opacity === 0) continue;
    const svg = el instanceof SVGElement;
    const color = rgba(svg ? cs.fill : cs.color);
    if (!color) continue;
    if (svg) color[3] *= Number(cs.fillOpacity);
    const size = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight) || 400;
    // Stable across fresh loads of the same page: the element's child-index
    // path, the text node's index among its siblings, and the text itself (a
    // panel that swaps its content in place is a different node per state).
    let key = String([...el.childNodes].indexOf(n));
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      key = [...e.parentElement.children].indexOf(e) + "/" + key;
    }
    out.push({
      key: key + "|" + n.data.trim(),
      text: n.data.trim().slice(0, 60),
      selector: describe(el),
      color,
      opacity,
      svg,
      ariaHidden: !!el.closest('[aria-hidden="true"]'),
      large: size >= 24 || (size >= 18.66 && weight >= 700),
      left: Math.min(...rects.map((r) => r.left)),
      right: Math.max(...rects.map((r) => r.right)),
      // Resolved into `samples` below.
      docY: rects[0].top + scrollY,
      n,
      el,
    });
  }

  const force = document.createElement("style");
  force.textContent =
    "*, *::before, *::after { pointer-events: auto !important; }";
  document.head.append(force);
  const points = (rects) =>
    rects.flatMap((r) =>
      [0.25, 0.5, 0.75].map((f) => ({
        x: r.left + (r.right - r.left) * f,
        y: (r.top + r.bottom) / 2,
      })),
    );
  // Inside the layout viewport, with a pixel's margin: a point on its last
  // row hit-tests as empty.
  const inView = (p) => {
    const { clientWidth: w, clientHeight: h } = document.documentElement;
    return p.x >= 1 && p.x < w - 1 && p.y >= 1 && p.y < h - 1;
  };
  for (const node of [...out].sort((a, b) => a.docY - b.docY)) {
    node.samples = [];
    node.unsampled = 0;
    const above = new Map();
    let pts = points(visibleRects(node.n, node.el));
    // The scroll-driven reveal moves text as the page scrolls, so one scroll
    // can leave it off-centre or out of view: re-measure until it holds still.
    for (let tries = 0; tries < 4 && !pts.every(inView); tries++) {
      const y = pts.length
        ? (pts[0].y + pts.at(-1).y) / 2 + scrollY
        : node.docY;
      scrollTo(0, Math.max(0, y - innerHeight / 2));
      await frame();
      await settled();
      pts = points(visibleRects(node.n, node.el));
    }
    for (const { x, y } of pts) {
      const stack = inView({ x, y }) ? document.elementsFromPoint(x, y) : [];
      const at = stack.indexOf(node.el);
      if (at < 0) {
        node.unsampled++;
        continue;
      }
      // Bottom-up, stopping below <body>: the page background is beneath the
      // decorative layers, so it is part of the underlay.
      const beneath = stack
        .slice(at)
        .filter((e) => e !== document.body && e !== document.documentElement);
      beneath.forEach(pseudoPaint);
      for (const e of stack.slice(0, at)) {
        const paints = paintsAbove(e);
        if (paints)
          above.set(describe(e) + "|" + paints, {
            element: describe(e),
            paints,
          });
      }
      node.samples.push(
        beneath
          .map(paint)
          .filter((f) => f && f[3] > 0)
          .reverse(),
      );
    }
    node.above = [...above.values()];
  }
  force.remove();
  scrollTo(0, 0);
  for (const node of out) {
    // A node no point of which could be hit-tested has no measured underlay.
    // There is no fallback: it is reported as unmeasured and fails the audit.
    node.unmeasured = node.samples.length === 0;
    delete node.el;
    delete node.n;
    delete node.docY;
  }
  return {
    column: main ? { left: main.left, right: main.right } : null,
    viewport: document.documentElement.clientWidth,
    unparsed: [...new Set(unparsed)],
    timedOut,
    nodes: out,
  };
}

// Runs in the page: open every disclosure, activate control `index` (if any)
// and open any disclosure it revealed, then scroll the whole document so
// anything that renders on first view has rendered, and return to the top.
// Returns the controls on the page — whether each is already active — and the
// label of the state reached.
async function prepare(selector, index) {
  const settle = () => new Promise((r) => setTimeout(r, 300));
  const openAll = () => {
    for (const b of document.querySelectorAll('button[aria-expanded="false"]'))
      b.click();
  };
  const active = (c) =>
    c.getAttribute("role") !== "switch" &&
    (c.getAttribute("aria-pressed") === "true" ||
      c.getAttribute("aria-selected") === "true");
  openAll();
  await settle();
  let state = "base";
  if (index >= 0) {
    const c = document.querySelectorAll(selector)[index];
    state = `${c.getAttribute("role") ?? "pressed"} "${c.textContent.trim().slice(0, 40)}"`;
    // A click before the page has hydrated does nothing, so the state is
    // checked, and the click repeated, until it holds. One that never does
    // fails the run rather than audit the base state under this state's name.
    const holds = () =>
      c.getAttribute("role") === "switch"
        ? c.getAttribute("aria-checked") === "true"
        : active(c);
    const start = performance.now();
    while (!holds()) {
      if (performance.now() - start > 5000) {
        throw new Error(`control did not activate: ${state}`);
      }
      c.click();
      await settle();
    }
    openAll();
    await settle();
  }
  for (
    let y = 0;
    y < document.documentElement.scrollHeight;
    y += innerHeight / 2
  ) {
    scrollTo(0, y);
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
  }
  scrollTo(0, 0);
  await document.fonts.ready;
  await settle();
  return {
    state,
    controls: [...document.querySelectorAll(selector)].map(active),
  };
}

function evaluateNode(node, column, viewport) {
  let cap = COLUMN_CAP;
  if (viewport >= NARROW_PX && column) {
    const outLeft = column.left - node.left;
    const outRight = node.right - column.right;
    cap = Math.max(
      alphaCap(outLeft, column.left),
      alphaCap(outRight, viewport - column.right),
    );
  }
  let worst = Infinity;
  for (const base of underlays(cap)) {
    for (const fills of node.samples) {
      let under = base;
      for (const f of fills) under = over(under, f.slice(0, 3), f[3]);
      const text = over(
        under,
        node.color.slice(0, 3),
        node.color[3] * node.opacity,
      );
      worst = Math.min(worst, ratio(text, under));
    }
  }
  return { ratio: worst, cap, min: node.large ? 3 : 4.5 };
}

// Minimal CDP client over --remote-debugging-pipe (fd 3 in, fd 4 out).
function launch() {
  const bin =
    process.env.CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const profile = mkdtempSync(join(tmpdir(), "contrast-audit-"));
  const proc = spawn(
    bin,
    [
      "--headless=new",
      "--remote-debugging-pipe",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] },
  );
  const [toChrome, fromChrome] = [proc.stdio[3], proc.stdio[4]];
  let id = 0;
  let buf = "";
  const pending = new Map();
  const listeners = [];
  fromChrome.on("data", (chunk) => {
    buf += chunk.toString("utf8");
    let i;
    while ((i = buf.indexOf("\0")) >= 0) {
      const msg = JSON.parse(buf.slice(0, i));
      buf = buf.slice(i + 1);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else {
        for (const l of listeners) l(msg);
      }
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const msg = { id: ++id, method, params };
      if (sessionId) msg.sessionId = sessionId;
      pending.set(msg.id, { resolve, reject });
      toChrome.write(JSON.stringify(msg) + "\0");
    });
  const once = (method, sessionId) =>
    new Promise((resolve) => {
      const l = (msg) => {
        if (msg.method === method && msg.sessionId === sessionId) {
          listeners.splice(listeners.indexOf(l), 1);
          resolve(msg.params);
        }
      };
      listeners.push(l);
    });
  const on = (method, sessionId, fn) => {
    const l = (msg) => {
      if (msg.method === method && msg.sessionId === sessionId) fn(msg.params);
    };
    listeners.push(l);
    return () => listeners.splice(listeners.indexOf(l), 1);
  };
  const close = async () => {
    const exited = new Promise((r) => proc.once("exit", r));
    proc.kill();
    await exited;
    rmSync(profile, { recursive: true, force: true });
  };
  return { send, once, on, close };
}

async function loadState(cdp, url, width, index) {
  const { targetId } = await cdp.send("Target.createTarget", {
    url: "about:blank",
  });
  const { sessionId } = await cdp.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  const s = (m, p) => cdp.send(m, p, sessionId);
  await s("Page.enable");
  // The page audited must be the page meant: a failed navigation, an
  // unexpected HTTP status or any uncaught exception in the page (a crashed
  // render shows an error screen) fails the run rather than audit that screen
  // under the route's name.
  const thrown = [];
  const off = cdp.on("Runtime.exceptionThrown", sessionId, (p) =>
    thrown.push(
      p.exceptionDetails.exception?.description ?? p.exceptionDetails.text,
    ),
  );
  await s("Runtime.enable");
  await s("Emulation.setDeviceMetricsOverride", {
    width,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: width < NARROW_PX,
  });
  const loaded = cdp.once("Page.loadEventFired", sessionId);
  const nav = await s("Page.navigate", { url });
  if (nav.errorText)
    throw new Error(`${url}: navigation failed, ${nav.errorText}`);
  await loaded;
  // An exception in the page is a failed run, never an empty result.
  const run = async (expression) => {
    const r = await s("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error(
        `${url} @${width}: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`,
      );
    }
    return r.result.value;
  };
  const status = await run(
    `performance.getEntriesByType("navigation")[0].responseStatus`,
  );
  const expected = new URL(url).pathname === NOT_FOUND_ROUTE ? 404 : 200;
  if (status !== expected) {
    throw new Error(`${url}: HTTP ${status}, expected ${expected}`);
  }
  const prepared = await run(
    `(${prepare})(${JSON.stringify(CONTROLS)}, ${index})`,
  );
  const collected = await run(`(${collect})()`);
  off();
  await cdp.send("Target.closeTarget", { targetId });
  if (thrown.length > 0) {
    throw new Error(
      `${url} @${width} [${prepared.state}]: uncaught exception in the page: ${thrown[0]}`,
    );
  }
  return { ...prepared, ...collected };
}

/**
 * The base state, then one fresh load per inactive control. Nodes are merged
 * by key, keeping each node's worst state.
 */
async function auditView(cdp, url, width) {
  const pages = [await loadState(cdp, url, width, -1)];
  pages[0].controls.forEach((isActive, i) => {
    if (!isActive) pages.push(i);
  });
  for (let p = 1; p < pages.length; p++) {
    pages[p] = await loadState(cdp, url, width, pages[p]);
  }
  const byKey = new Map();
  // Paint above a node in any state is kept, whichever state scores worst.
  const aboveByKey = new Map();
  for (const page of pages) {
    if (page.unparsed.length > 0) {
      throw new Error(
        `${url} @${width} [${page.state}]: unparsed colours ${page.unparsed.join(", ")}`,
      );
    }
    if (page.timedOut) {
      throw new Error(
        `${url} @${width} [${page.state}]: animations still running after 5 s`,
      );
    }
    for (const n of page.nodes) {
      const prior = aboveByKey.get(n.key) ?? [];
      for (const a of n.above) {
        if (
          !prior.some((p) => p.element === a.element && p.paints === a.paints)
        )
          prior.push({ ...a, state: page.state });
      }
      aboveByKey.set(n.key, prior);
      const node = {
        ...n,
        state: page.state,
        ...evaluateNode(n, page.column, page.viewport),
      };
      // An unmeasured state outranks any measured one: it is a failure of
      // the audit, not a ratio.
      const seen = byKey.get(n.key);
      if (
        !seen ||
        (node.unmeasured && !seen.unmeasured) ||
        (node.unmeasured === seen.unmeasured &&
          node.ratio - node.min < seen.ratio - seen.min)
      ) {
        byKey.set(n.key, node);
      }
    }
  }
  const nodes = [...byKey.values()].map((n) => ({
    ...n,
    above: aboveByKey.get(n.key),
  }));
  return { states: pages.length, nodes };
}

// The paint-above exclusion list: the one table between the two markers in
// `file`. Each row names a route, a width, the node's selector and text, the
// one element allowed to paint above it, and the issue that tracks it.
const EXCLUSIONS_BEGIN = "<!-- T10 paint-above exclusions: begin -->";
const EXCLUSIONS_END = "<!-- T10 paint-above exclusions: end -->";
function readExclusions(file) {
  const text = readFileSync(file, "utf8");
  const begin = text.split(EXCLUSIONS_BEGIN);
  if (begin.length !== 2 || begin[1].split(EXCLUSIONS_END).length !== 2) {
    throw new Error(`${file}: expected one paint-above exclusion table`);
  }
  const rows = begin[1]
    .split(EXCLUSIONS_END)[0]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|"))
    .slice(2);
  const unquote = (c) =>
    c
      .trim()
      .replace(/^`(.*)`$/, "$1")
      .replace(/^"(.*)"$/, "$1");
  return rows.map((l) => {
    const cells = l.slice(1, -1).split("|").map(unquote);
    const [route, width, selector, text, element, issue] = cells;
    if (cells.length !== 6 || !WIDTHS.includes(Number(width)) || !issue) {
      throw new Error(`${file}: malformed paint-above exclusion: ${l}`);
    }
    return { route, width: Number(width), selector, text, element, issue };
  });
}

const args = process.argv.slice(2);
const jsonAt = args.indexOf("--json");
const jsonOut = jsonAt >= 0 ? args.splice(jsonAt, 2)[1] : null;
const routesAt = args.indexOf("--routes");
const routes = routesAt >= 0 ? args.splice(routesAt, 2)[1].split(",") : ROUTES;
const exclusionsAt = args.indexOf("--exclusions");
const exclusionsFile =
  exclusionsAt >= 0
    ? args.splice(exclusionsAt, 2)[1]
    : join(dirname(fileURLToPath(import.meta.url)), "../design/BASELINE.md");
const exclusions = readExclusions(exclusionsFile);
const base = (args[0] ?? "http://localhost:3000").replace(/\/$/, "");

const cdp = launch();
const report = { base, views: [] };
try {
  for (const route of routes) {
    for (const width of WIDTHS) {
      const { states, nodes } = await auditView(cdp, base + route, width);
      report.views.push({ route, width, states, nodes });
    }
  }
} finally {
  await cdp.close();
}

const all = report.views.flatMap((v) =>
  v.nodes.map((n) => ({ ...n, route: v.route, width: v.width })),
);
const failing = all.filter((n) => n.ratio < n.min);
const unmeasured = all.filter((n) => n.unmeasured);
// Measured, but some sample points hit nothing: scored on fewer points.
const partial = all.filter((n) => !n.unmeasured && n.unsampled > 0);
// Covered: something paints above the text. Excluded only by an entry naming
// this exact node, view and element; anything else above it still covers it.
const exclusionFor = (n) =>
  exclusions.find(
    (x) =>
      x.route === n.route &&
      x.width === n.width &&
      x.selector === n.selector &&
      x.text === n.text &&
      n.above.every((a) => a.element === x.element),
  );
const excluded = all.filter((n) => n.above.length > 0 && exclusionFor(n));
const covered = all.filter((n) => n.above.length > 0 && !exclusionFor(n));
const stale = exclusions.filter(
  (x) =>
    routes.includes(x.route) && !excluded.some((n) => exclusionFor(n) === x),
);
if (stale.length > 0) {
  throw new Error(
    `paint-above exclusion matched nothing: ${stale
      .map((x) => `${x.route} @${x.width} ${x.selector} "${x.text}"`)
      .join("; ")}`,
  );
}
const tightest = all
  .filter((n) => !n.unmeasured)
  .sort((a, b) => a.ratio - a.min - (b.ratio - b.min))[0];

console.log("| route | 1440 | 768 | 390 | states (per width) |");
console.log("| --- | --- | --- | --- | --- |");
for (const route of routes) {
  const counts = WIDTHS.map(
    (w) =>
      report.views.find((v) => v.route === route && v.width === w).nodes.length,
  );
  const states = WIDTHS.map(
    (w) => report.views.find((v) => v.route === route && v.width === w).states,
  );
  console.log(`| ${route} | ${counts.join(" | ")} | ${states.join("/")} |`);
}
console.log(`\ntext nodes: ${all.length}`);
console.log(`below AA:   ${failing.length}`);
if (tightest) {
  console.log(
    `tightest:   ${tightest.ratio.toFixed(3)}:1 (min ${tightest.min}) — ` +
      `${tightest.route} @${tightest.width} ${tightest.selector} "${tightest.text}"`,
  );
}
for (const n of failing) {
  console.log(
    `  FAIL ${n.ratio.toFixed(3)}:1 < ${n.min} — ${n.route} @${n.width} [${n.state}] ${n.selector} "${n.text}"`,
  );
}
console.log(`partially sampled: ${partial.length}`);
for (const n of partial) {
  console.log(
    `  PARTIAL ${n.unsampled} point(s) unsampled — ${n.route} @${n.width} [${n.state}] ${n.selector} "${n.text}"`,
  );
}
console.log(`covered (paint above text): ${covered.length}`);
for (const n of covered) {
  const by = n.above.map((a) => `${a.element} (${a.paints}) [${a.state}]`);
  console.log(
    `  COVERED — ${n.route} @${n.width} ${n.selector} "${n.text}" under ${by.join(", ")}`,
  );
}
console.log(`excluded (BASELINE.md): ${excluded.length}`);
for (const n of excluded) {
  console.log(
    `  EXCLUDED — ${n.route} @${n.width} ${n.selector} "${n.text}" under ${n.above[0].element}: ${exclusionFor(n).issue}`,
  );
}
console.log(`unmeasured: ${unmeasured.length}`);
for (const n of unmeasured) {
  console.log(
    `  AUDIT FAIL no point hit-tested — ${n.route} @${n.width} [${n.state}] ${n.selector} "${n.text}"`,
  );
}
if (jsonOut)
  writeFileSync(
    jsonOut,
    JSON.stringify({
      ...report,
      failing: failing.length,
      unmeasured: unmeasured.length,
      partial: partial.length,
      covered: covered.length,
      excluded: excluded.length,
      coveredNodes: covered.map(({ route, width, selector, text }) => ({
        route,
        width,
        selector,
        text,
      })),
      excludedNodes: excluded.map(({ route, width, selector, text }) => ({
        route,
        width,
        selector,
        text,
      })),
    }),
  );
if (failing.length > 0 || unmeasured.length > 0 || covered.length > 0)
  process.exitCode = 1;
