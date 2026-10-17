/**
 * The animated character field, entirely off the main thread. Draws into the
 * OffscreenCanvas `AsciiField.tsx` transferred to it, on its own animation
 * loop, from messages carrying sizes, the column rect, scroll, pointer and
 * visibility. Every brightness decision is `asciiField.math.ts`, unchanged;
 * every pixel decision is `FieldRenderer`, shared with the static fallback.
 *
 * Guards kept from the main-thread version: 30 fps cap, DPR ≤ 2 (enforced by
 * the sender), loop stopped while the page is hidden.
 */

import { FieldRenderer, STRONG, WEAK } from "./renderer";
import type { FromWorker, ToWorker } from "./protocol";

/**
 * The few worker-scope members used here, typed locally: pulling in the
 * `webworker` lib beside `dom` in one tsconfig makes the two collide.
 */
type WorkerScope = {
  postMessage(message: FromWorker): void;
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null;
  requestAnimationFrame?: (cb: (now: number) => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
};
const scope = self as unknown as WorkerScope;
const FRAME_MS = 1000 / 30;

let renderer: FieldRenderer | null = null;
let canvas: OffscreenCanvas | null = null;
let hidden = false;
let last = 0;
let handle = 0;

const post = (m: FromWorker) => scope.postMessage(m);

// requestAnimationFrame exists in dedicated workers in current Chromium,
// Firefox and Safari; a timer keeps the loop alive anywhere it does not.
const hasRaf = typeof scope.requestAnimationFrame === "function";
const schedule = (cb: (now: number) => void): number =>
  hasRaf
    ? scope.requestAnimationFrame!(cb)
    : (setTimeout(() => cb(performance.now()), FRAME_MS) as unknown as number);
const unschedule = (h: number) =>
  hasRaf ? scope.cancelAnimationFrame!(h) : clearTimeout(h);

function frame(now: number) {
  handle = schedule(frame);
  if (now - last < FRAME_MS - 1) return;
  const dt = now - last;
  last = now;
  renderer?.tick(now, dt);
}

function sync() {
  const run = renderer?.ready === true && !hidden;
  if (run && !handle) {
    last = performance.now();
    handle = schedule(frame);
  } else if (!run && handle) {
    unschedule(handle);
    handle = 0;
  }
}

scope.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  try {
    switch (m.type) {
      case "init": {
        canvas = m.canvas;
        const g = canvas.getContext("2d");
        if (!g) {
          post({ type: "failed", reason: "no 2d context on OffscreenCanvas" });
          return;
        }
        renderer = new FieldRenderer(g);
        renderer.scrollY = m.scrollY;
        renderer.setColumn(m.left, m.right);
        renderer.resize(m.w, m.h, m.dpr);
        renderer.setPainter({ kind: "atlas", image: m.atlas, dpr: m.dpr });
        hidden = m.hidden;
        // A restored context comes back with default state; reapply it.
        canvas.addEventListener?.("contextrestored", () => {
          renderer?.applyContextState();
          renderer?.drawStatic(performance.now());
        });
        renderer.drawStatic(performance.now());
        post({ type: "ready" });
        sync();
        return;
      }
      case "resize":
        renderer?.resize(m.w, m.h, m.dpr);
        if (m.atlas)
          renderer?.setPainter({ kind: "atlas", image: m.atlas, dpr: m.dpr });
        return;
      case "column":
        renderer?.setColumn(m.left, m.right);
        return;
      case "scroll":
        if (renderer) renderer.scrollY = m.y;
        return;
      case "pointer":
        renderer?.addRipple(
          m.x,
          m.pageY,
          m.strong ? STRONG : WEAK,
          performance.now(),
        );
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
