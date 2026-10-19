// Evidence for the one T10 paint-above exclusion (design/BASELINE.md, "T10
// paint-above exclusions"): "Selected work" on / at 768x900, under the scroll
// cue's fade at page load. Reads the heading's three sample points (25/50/75%
// of its line box, at the midline, as contrast-audit.mjs samples), the fade's
// box and computed gradient, then composites the fade over the text and over
// the T10 worst underlay. Constants are copied from contrast-audit.mjs.
//   pnpm start -p 3201 &
//   node design/reports/danger-contrast/evidence/scroll-cue-fade-composite.mjs > scroll-cue-fade-composite.json
// Dev evidence only. Node stdlib; drives Chrome over --remote-debugging-pipe.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL_ = process.argv[2] ?? "http://localhost:3201/";
const [WIDTH, HEIGHT] = [768, 900];
const BG = [13, 13, 15], FG = [232, 232, 234], MUTED = [161, 161, 170];
const ACCENT = [56, 189, 248], OK = [74, 222, 128];
const DOT_ALPHA = 0.035, GLOW_ALPHA = 0.1, COLUMN_CAP = 0.04;
const over = (u, c, a) => u.map((x, i) => x + (c[i] - x) * a);
const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (x, y) => { const [h, l] = [lum(x), lum(y)].sort((p, q) => q - p); return (h + 0.05) / (l + 0.05); };
const dot = over(BG, FG, DOT_ALPHA);
const glyph = (c) => over(c, MUTED, COLUMN_CAP);
const a = (c) => over(c, ACCENT, GLOW_ALPHA);
const o = (c) => over(c, OK, GLOW_ALPHA);
const UNDERLAYS = [glyph(o(a(dot))), o(glyph(a(dot))), o(a(glyph(dot)))];

const profile = mkdtempSync(join(tmpdir(), "fade-"));
const chrome = spawn(process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--remote-debugging-pipe", `--user-data-dir=${profile}`, "--no-first-run", "about:blank"],
  { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });
let id = 0, buf = "";
const pending = new Map(), listeners = [];
chrome.stdio[4].on("data", (c) => {
  buf += c;
  let i;
  while ((i = buf.indexOf("\0")) >= 0) {
    const m = JSON.parse(buf.slice(0, i));
    buf = buf.slice(i + 1);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else listeners.forEach((l) => l(m));
  }
});
const send = (method, params = {}, sessionId) => new Promise((r) => {
  const m = { id: ++id, method, params };
  if (sessionId) m.sessionId = sessionId;
  pending.set(m.id, r);
  chrome.stdio[3].write(JSON.stringify(m) + "\0");
});

const probe = () => {
  const h = [...document.querySelectorAll("h2")].find((e) => e.textContent.trim() === "Selected work");
  const range = document.createRange();
  range.selectNodeContents([...h.childNodes].find((n) => n.nodeType === 3 && n.data.trim()));
  const r = range.getClientRects()[0];
  const fade = document.querySelector(".scroll-cue__fade");
  const f = fade.getBoundingClientRect();
  const cue = document.querySelector(".scroll-cue");
  return {
    scrollY,
    color: getComputedStyle(h).color,
    lineBox: { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
    points: [0.25, 0.5, 0.75].map((t) => ({ x: r.left + (r.right - r.left) * t, y: (r.top + r.bottom) / 2 })),
    fade: { top: f.top, bottom: f.bottom, backgroundImage: getComputedStyle(fade).backgroundImage },
    cue: { visible: cue.dataset.visible, opacity: getComputedStyle(cue).opacity },
  };
};

try {
  const { targetId } = (await send("Target.createTarget", { url: "about:blank" })).result;
  const { sessionId: s } = (await send("Target.attachToTarget", { targetId, flatten: true })).result;
  await send("Page.enable", {}, s);
  await send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false }, s);
  const loaded = new Promise((r) => listeners.push((m) => m.method === "Page.loadEventFired" && m.sessionId === s && r()));
  await send("Page.navigate", { url: URL_ }, s);
  await loaded;
  await new Promise((r) => setTimeout(r, 1500));
  const page = (await send("Runtime.evaluate", { expression: `(${probe})()`, returnByValue: true }, s)).result.result.value;
  const expected = "linear-gradient(to top, rgb(13, 13, 15) 0%, rgba(0, 0, 0, 0) 100%)";
  if (page.fade.backgroundImage !== expected) throw new Error(`unexpected fade: ${page.fade.backgroundImage}`);
  const text = page.color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
  // `to top`: --color-bg at the bottom edge, transparent at the top, linear
  // between (premultiplied interpolation, so the colour stays bg).
  const samples = page.points.map(({ x, y }) => {
    const alpha = (y - page.fade.top) / (page.fade.bottom - page.fade.top);
    const worst = Math.min(...UNDERLAYS.map((u) => ratio(over(text, BG, alpha), over(u, BG, alpha))));
    return { x, y, fadeAlpha: alpha, worstUnderlay: worst, plainBg: ratio(over(text, BG, alpha), BG) };
  });
  const without = Math.min(...UNDERLAYS.map((u) => ratio(text, u)));
  console.log(JSON.stringify({ url: URL_, viewport: [WIDTH, HEIGHT], page, withoutFade: without, samples }, null, 2));
} finally {
  chrome.kill();
  await new Promise((r) => chrome.once("exit", r));
  rmSync(profile, { recursive: true, force: true });
}
