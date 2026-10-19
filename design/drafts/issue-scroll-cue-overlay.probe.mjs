import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const prof = mkdtempSync(join(tmpdir(), "cue-"));
const p = spawn(
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  [
    "--headless=new",
    "--remote-debugging-pipe",
    `--user-data-dir=${prof}`,
    "--no-first-run",
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] },
);
let id = 0,
  buf = "";
const pend = new Map(),
  ls = [];
p.stdio[4].on("data", (c) => {
  buf += c;
  let i;
  while ((i = buf.indexOf("\0")) >= 0) {
    const m = JSON.parse(buf.slice(0, i));
    buf = buf.slice(i + 1);
    if (m.id && pend.has(m.id)) {
      pend.get(m.id)(m);
      pend.delete(m.id);
    } else ls.forEach((l) => l(m));
  }
});
const send = (method, params = {}, sessionId) =>
  new Promise((r) => {
    const m = { id: ++id, method, params };
    if (sessionId) m.sessionId = sessionId;
    pend.set(m.id, r);
    p.stdio[3].write(JSON.stringify(m) + "\0");
  });
const probe = () => {
  const cue = document.querySelector(".scroll-cue");
  const wrap = cue.getBoundingClientRect();
  const out = {
    visible: cue.dataset.visible,
    wrap: [Math.round(wrap.top), Math.round(wrap.bottom)],
    fadeTop: Math.round(
      document.querySelector(".scroll-cue__fade").getBoundingClientRect().top,
    ),
    blocked: [],
    under: [],
  };
  for (const a of [...document.querySelectorAll("a, button")].filter(
    (a) => !a.closest(".scroll-cue"),
  )) {
    for (const r of a.getClientRects()) {
      if (r.bottom <= wrap.top || r.top >= innerHeight) continue;
      const x = (r.left + r.right) / 2,
        y = (Math.max(r.top, wrap.top) + Math.min(r.bottom, innerHeight)) / 2;
      const hit = document.elementFromPoint(x, y);
      const label =
        a.textContent.trim().slice(0, 30) +
        ` [${Math.round(r.top)}-${Math.round(r.bottom)}]`;
      if (!a.contains(hit))
        out.blocked.push(
          label +
            " -> " +
            (hit?.className?.toString().split(" ")[0] || hit?.tagName),
        );
      else out.under.push(label);
    }
  }
  return out;
};
for (const [width, height] of [
  [1440, 900],
  [1440, 800],
  [1280, 720],
  [768, 900],
  [768, 1024],
  [390, 844],
  [390, 667],
  [375, 667],
]) {
  const t = (await send("Target.createTarget", { url: "about:blank" })).result
    .targetId;
  const s = (
    await send("Target.attachToTarget", { targetId: t, flatten: true })
  ).result.sessionId;
  await send("Page.enable", {}, s);
  await send(
    "Emulation.setDeviceMetricsOverride",
    { width, height, deviceScaleFactor: 1, mobile: width < 640 },
    s,
  );
  const loaded = new Promise((r) =>
    ls.push(
      (m) => m.method === "Page.loadEventFired" && m.sessionId === s && r(),
    ),
  );
  await send("Page.navigate", { url: "http://localhost:3201/" }, s);
  await loaded;
  await new Promise((r) => setTimeout(r, 1500));
  const v = await send(
    "Runtime.evaluate",
    { expression: `(${probe})()`, returnByValue: true },
    s,
  );
  console.log(width + "x" + height, JSON.stringify(v.result.result.value));
}
p.kill();
