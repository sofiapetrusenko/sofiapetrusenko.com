/**
 * The hero warp, entirely off the main thread: a 3D field of glyphs the camera
 * flies through as the reader scrolls the hero scene. Draws into the
 * OffscreenCanvas `WarpField.tsx` transferred to it, from messages carrying
 * size, the hero's layout, scroll and visibility. Every decision about where a
 * glyph is and whether it may be drawn is `warp.math.ts`.
 *
 * It paints only while the scene is on screen. Once the hero has been scrolled
 * past (progress 1) it clears the canvas and stops its loop until a scroll
 * brings the scene back; it also stops while the page is hidden.
 *
 * Text is never drawn over: every glyph and trail is clipped out of the boxes
 * `quietRects` returns, so no hero text gains a composite beneath it.
 */

import {
  ENTRIES,
  PEAK_ALPHA,
  PIECES,
  PIECE_SHARE,
  STREAK_SPEED,
  TONES,
  calmAt,
  cameraSpeed,
  depthAlpha,
  glyphSize,
  heroProgress,
  quietRects,
  stageTop,
  toneFor,
} from "./warp.math";
import type { Atlas, FromWorker, Layout, ToWorker } from "./protocol";

type WorkerScope = {
  postMessage(message: FromWorker): void;
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null;
  requestAnimationFrame?: (cb: (now: number) => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
};
const scope = self as unknown as WorkerScope;
const post = (m: FromWorker) => scope.postMessage(m);

const hasRaf = typeof scope.requestAnimationFrame === "function";
const schedule = (cb: (now: number) => void): number =>
  hasRaf
    ? scope.requestAnimationFrame!(cb)
    : (setTimeout(() => cb(performance.now()), 1000 / 60) as unknown as number);
const unschedule = (h: number) =>
  hasRaf ? scope.cancelAnimationFrame!(h) : clearTimeout(h);

const CHAR_COUNT = ENTRIES.length - PIECES.length;

let g: OffscreenCanvasRenderingContext2D | null = null;
let canvas: OffscreenCanvas | null = null;
let atlas: Atlas | null = null;
let colors: string[] = [];
let bg = "#0d0d0f";
let layout: Layout | null = null;
let W = 0;
let H = 0;
let dpr = 1;
let focal = 1;
let scrollY = 0;
let frameScroll = 0;
let velocity = 0;
let hidden = false;
let handle = 0;
let last = 0;
let cleared = true;

/* Particles as parallel typed arrays: a few thousand objects would churn GC. */
let N = 0;
let px = new Float32Array(0);
let py = new Float32Array(0);
let pz = new Float32Array(0);
let entry = new Uint16Array(0);
let tone = new Uint8Array(0);

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function spawn(i: number, z: number) {
  // Inside the camera's view cone, a little beyond it, so nearly every glyph
  // spends its life on screen.
  const sx = (W / 2 / focal) * 1.15;
  const sy = (H / 2 / focal) * 1.15;
  px[i] = rnd(-sx, sx);
  py[i] = rnd(-sy, sy);
  pz[i] = z;
  entry[i] =
    Math.random() < PIECE_SHARE
      ? CHAR_COUNT + ((Math.random() * PIECES.length) | 0)
      : (Math.random() * CHAR_COUNT) | 0;
  tone[i] = TONES.indexOf(toneFor(Math.random()));
}

function populate() {
  N = W < 640 ? 1200 : 1700;
  px = new Float32Array(N);
  py = new Float32Array(N);
  pz = new Float32Array(N);
  entry = new Uint16Array(N);
  tone = new Uint8Array(N);
  for (let i = 0; i < N; i++) spawn(i, rnd(0.05, 1));
}

function resize(w: number, h: number, d: number) {
  W = w;
  H = h;
  dpr = d;
  focal = Math.min(W, H) * 0.55;
  if (!canvas || !g) return;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  populate();
}

function progress(): number {
  if (!layout) return 1;
  return heroProgress(scrollY, layout.sceneTop, layout.sceneHeight, H);
}

function clear() {
  if (!g || cleared) return;
  g.clearRect(0, 0, W, H);
  cleared = true;
}

function draw(dt: number) {
  if (!g || !atlas || !layout) return;
  const p = progress();
  const calm = calmAt(p);

  // Scroll velocity in viewports per second, smoothed.
  const target = (scrollY - frameScroll) / Math.max(dt, 0.001) / H;
  frameScroll = scrollY;
  velocity += (target - velocity) * 0.12;

  if (calm >= 1) {
    clear();
    return;
  }
  cleared = false;

  const v = cameraSpeed(p, velocity);
  const fade = 1 - calm;
  const streak = Math.abs(v) > STREAK_SPEED;

  g.clearRect(0, 0, W, H);
  // Cover the site field and the dot grid while the scene runs; as the warp
  // fades, they show through again, which is the hand-off back to the page.
  g.globalAlpha = fade;
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // Clip every text box out of everything drawn below.
  const sy = stageTop(
    scrollY,
    layout.sceneTop,
    layout.sceneHeight,
    layout.stageHeight,
    layout.stick,
  );
  const quiet = quietRects(
    p,
    layout.stageX,
    sy,
    layout.name,
    layout.lift,
    layout.liftPx,
  );
  g.save();
  g.beginPath();
  g.rect(0, 0, W, H);
  for (const r of quiet) g.rect(r.x, r.y, r.w, r.h);
  g.clip("evenodd");

  const cx = W / 2;
  const cy = H / 2;
  const scale = atlas.dpr;
  const img = atlas.image;
  // Thin the field as it calms, so the last frames are sparse rather than dim.
  const shown = Math.round(N * (1 - 0.6 * calm));

  for (let i = 0; i < N; i++) {
    const z0 = pz[i]!;
    const z = z0 - v * dt;
    if (z < 0.03) {
      spawn(i, rnd(0.85, 1));
      continue;
    }
    if (z > 1.05) {
      spawn(i, rnd(0.03, 0.15));
      continue;
    }
    pz[i] = z;
    if (i >= shown) continue;

    const x = cx + (px[i]! / z) * focal;
    const y = cy + (py[i]! / z) * focal;
    if (x < -80 || x > W + 80 || y < -80 || y > H + 80) continue;

    const alpha = Math.min(0.85, depthAlpha(z) * PEAK_ALPHA) * fade;
    if (alpha < 0.015) continue;

    const t = tone[i]!;
    const e = entry[i]!;
    const size = glyphSize(z, e >= CHAR_COUNT);
    const k = size / atlas.font;

    if (streak) {
      g.globalAlpha = alpha * 0.45;
      g.strokeStyle = colors[t]!;
      g.lineWidth = Math.max(0.5, size * 0.06);
      g.beginPath();
      g.moveTo(cx + (px[i]! / z0) * focal, cy + (py[i]! / z0) * focal);
      g.lineTo(x, y);
      g.stroke();
    }

    const s = atlas.slots[t]![e]!;
    const dw = s.w * k;
    const dh = atlas.row * k;
    g.globalAlpha = alpha;
    g.drawImage(
      img,
      s.x * scale,
      s.y * scale,
      s.w * scale,
      atlas.row * scale,
      x - dw / 2,
      y - dh / 2,
      dw,
      dh,
    );
  }
  g.restore();
  g.globalAlpha = 1;
}

function frame(now: number) {
  handle = 0;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  draw(dt);
  // Keep going while the scene is on screen; a scroll back into it restarts.
  if (!hidden && progress() < 1) handle = schedule(frame);
}

function sync() {
  const run = !!g && !hidden && progress() < 1;
  if (run && !handle) {
    last = performance.now();
    frameScroll = scrollY;
    handle = schedule(frame);
  } else if (!run && handle) {
    unschedule(handle);
    handle = 0;
    if (progress() >= 1) clear();
  }
}

scope.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  try {
    switch (m.type) {
      case "init": {
        canvas = m.canvas;
        g = canvas.getContext("2d");
        if (!g) {
          post({ type: "failed", reason: "no 2d context on OffscreenCanvas" });
          return;
        }
        atlas = m.atlas;
        colors = m.colors;
        bg = m.bg;
        layout = m.layout;
        scrollY = frameScroll = m.scrollY;
        hidden = m.hidden;
        resize(m.w, m.h, m.dpr);
        post({ type: "ready" });
        sync();
        return;
      }
      case "resize":
        resize(m.w, m.h, m.dpr);
        cleared = false;
        sync();
        return;
      case "layout":
        layout = m.layout;
        sync();
        return;
      case "scroll":
        scrollY = m.y;
        sync();
        return;
      case "visibility":
        hidden = m.hidden;
        sync();
        return;
    }
  } catch (err) {
    post({ type: "failed", reason: String(err) });
  }
};
