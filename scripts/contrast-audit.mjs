// T10 contrast audit (BASELINE.md, "Threshold revision — 2026-10-16").
//
// Every route at 1440, 768 and 390 px, every disclosure open: each visible
// text node is composited over the worst underlay the decorative layers can
// produce beneath it, through every translucent fill between it and the page,
// and its contrast is checked against WCAG 2.1 AA (4.5:1, 3:1 for large text).
// The method is the one recorded under `.ascii-field` in `globals.css`.
//
// Underlay. The documented worst point is the 3.5% fg dot grid under both hero
// glows exactly coincident (each 10%), rgb(29, 56, 53). The character field's
// glyph (`--color-glyph`, muted) sits on that at the alpha cap of the node's
// own column (`alphaCap` in `asciiField.math.ts`: COLUMN_CAP inside <main>'s
// horizontal extent and everywhere below 640 px, eased up to the gutter peak
// outside it). The glyph is composited in every stacking order — above both
// glows, between them, below both — and the worst result is used.
//
// Usage (against a running production server):
//   node scripts/contrast-audit.mjs http://localhost:3201 [--json out.json]
//     [--routes /a,/b]   audit these paths instead of the site's routes (the
//                        known-answer test, `contrast-audit.selftest.mjs`)
// Exits 1 if any node is below AA. CHROME_PATH overrides the Chrome binary.
//
// Dev tooling only. Node stdlib only — drives Chrome over
// --remote-debugging-pipe, so it adds no dependency.

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROUTES = [
  "/",
  "/colophon",
  "/notes/untrusted-llm-output",
  "/work/blotquant",
  "/work/lifespan-extract",
  "/work/media-automation-platform",
  "/work/mira",
];
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

// Runs in the page. Returns every visible text node with its colour, the
// translucent fills beneath it (innermost first), and its horizontal extent.
function collect() {
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
  const main = document.querySelector("main")?.getBoundingClientRect();
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.data.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest("script, style, noscript, template")) continue;
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
    rects = rects.filter(
      (r) => r.bottom + scrollY > 0 && r.right + scrollX > 0,
    );
    if (rects.length === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== "visible") continue;
    let opacity = 1;
    const fills = [];
    // Stops below <body>: the page background is beneath the decorative
    // layers, so it is part of the underlay, not a fill above it.
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e);
      opacity *= Number(s.opacity);
      const bg = rgba(s.backgroundColor);
      if (bg && bg[3] > 0) fills.push(bg);
    }
    if (opacity === 0) continue;
    const svg = el instanceof SVGElement;
    const color = rgba(svg ? cs.fill : cs.color);
    if (!color) continue;
    const size = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight) || 400;
    out.push({
      text: n.data.trim().slice(0, 60),
      selector:
        el.tagName.toLowerCase() +
        (el.className && typeof el.className === "string"
          ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
          : ""),
      color,
      opacity,
      fills,
      svg,
      ariaHidden: !!el.closest('[aria-hidden="true"]'),
      large: size >= 24 || (size >= 18.66 && weight >= 700),
      left: Math.min(...rects.map((r) => r.left)),
      right: Math.max(...rects.map((r) => r.right)),
    });
  }
  return {
    column: main ? { left: main.left, right: main.right } : null,
    viewport: document.documentElement.clientWidth,
    unparsed: [...new Set(unparsed)],
    nodes: out,
  };
}

// Runs in the page: open every disclosure, then scroll the whole document so
// anything that renders on first view has rendered, and return to the top.
async function prepare() {
  for (const b of document.querySelectorAll('button[aria-expanded="false"]'))
    b.click();
  await new Promise((r) => setTimeout(r, 300));
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
  await new Promise((r) => setTimeout(r, 300));
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
    let under = base;
    for (const f of [...node.fills].reverse()) {
      under = over(under, f.slice(0, 3), f[3] * node.opacity);
    }
    const text = over(
      under,
      node.color.slice(0, 3),
      node.color[3] * node.opacity,
    );
    worst = Math.min(worst, ratio(text, under));
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
  const close = async () => {
    const exited = new Promise((r) => proc.once("exit", r));
    proc.kill();
    await exited;
    rmSync(profile, { recursive: true, force: true });
  };
  return { send, once, close };
}

async function auditPage(cdp, url, width) {
  const { targetId } = await cdp.send("Target.createTarget", {
    url: "about:blank",
  });
  const { sessionId } = await cdp.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  const s = (m, p) => cdp.send(m, p, sessionId);
  await s("Page.enable");
  await s("Emulation.setDeviceMetricsOverride", {
    width,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: width < NARROW_PX,
  });
  const loaded = cdp.once("Page.loadEventFired", sessionId);
  await s("Page.navigate", { url });
  await loaded;
  await s("Runtime.evaluate", {
    expression: `(${prepare})()`,
    awaitPromise: true,
  });
  const { result } = await s("Runtime.evaluate", {
    expression: `(${collect})()`,
    returnByValue: true,
  });
  await cdp.send("Target.closeTarget", { targetId });
  return result.value;
}

const args = process.argv.slice(2);
const jsonAt = args.indexOf("--json");
const jsonOut = jsonAt >= 0 ? args.splice(jsonAt, 2)[1] : null;
const routesAt = args.indexOf("--routes");
const routes = routesAt >= 0 ? args.splice(routesAt, 2)[1].split(",") : ROUTES;
const base = (args[0] ?? "http://localhost:3000").replace(/\/$/, "");

const cdp = launch();
const report = { base, views: [] };
try {
  for (const route of routes) {
    for (const width of WIDTHS) {
      const page = await auditPage(cdp, base + route, width);
      const nodes = page.nodes.map((n) => ({
        ...n,
        ...evaluateNode(n, page.column, page.viewport),
      }));
      if (page.unparsed.length > 0) {
        throw new Error(
          `${route} @${width}: unparsed colours ${page.unparsed.join(", ")}`,
        );
      }
      report.views.push({ route, width, nodes });
    }
  }
} finally {
  await cdp.close();
}

const all = report.views.flatMap((v) =>
  v.nodes.map((n) => ({ ...n, route: v.route, width: v.width })),
);
const failing = all.filter((n) => n.ratio < n.min);
const tightest = [...all].sort(
  (a, b) => a.ratio - a.min - (b.ratio - b.min),
)[0];

console.log("| route | 1440 | 768 | 390 |");
console.log("| --- | --- | --- | --- |");
for (const route of routes) {
  const counts = WIDTHS.map(
    (w) =>
      report.views.find((v) => v.route === route && v.width === w).nodes.length,
  );
  console.log(`| ${route} | ${counts.join(" | ")} |`);
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
    `  FAIL ${n.ratio.toFixed(3)}:1 < ${n.min} — ${n.route} @${n.width} ${n.selector} "${n.text}"`,
  );
}
if (jsonOut)
  writeFileSync(
    jsonOut,
    JSON.stringify({ ...report, failing: failing.length }),
  );
if (failing.length > 0) process.exitCode = 1;
