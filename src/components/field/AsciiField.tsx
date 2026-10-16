"use client";

import { useEffect, useRef } from "react";
import {
  GLYPHS,
  RIPPLE,
  bucketAlpha,
  bucketIndex,
  clamp01,
  fieldValue,
  rippleContribution,
} from "./asciiField.math";

/**
 * Character field behind the home hero: a fixed grid of monospace glyphs whose
 * alpha follows a drifting blob, with ripples from the pointer. Glyphs never
 * move; only their brightness and, occasionally, which letter they are.
 *
 * Decorative only. The canvas is `aria-hidden` and `pointer-events: none`;
 * pointer input is read off the hero `<header>` (this component's parent), so
 * every link and button in the hero stays the hit target it always was.
 *
 * Perf guards: 30 fps cap, DPR capped at 2, 8 alpha buckets of which the top
 * six are painted, so `globalAlpha` changes at most six times a frame rather
 * than once per cell; the loop starts only after the browser goes idle, and it
 * stops whenever the hero is off-screen or the tab is hidden.
 * `prefers-reduced-motion: reduce` gets one static frame, no loop and no
 * pointer listeners — only what keeps that frame correct (resize, DPR, font
 * load, context restore).
 *
 * Contrast is held in CSS, not here: see `.ascii-field` in `globals.css`.
 */

export const LEVELS = 8;
/** Peak glyph alpha. The CSS mask scales it to 20% (4% absolute) under the hero text. */
export const MAX_ALPHA = 0.2;
/** Share of the brightness budget the ambient field may use; ripples add the rest. */
const AMBIENT = 0.55;
const FRAME_MS = 1000 / 30;
const MAX_RIPPLES = 12;
const MOVE_THROTTLE_MS = 90;
const MUTATE_BASE = 0.002;
const MUTATE_WAVE = 0.06;
const STRONG = 1;
const WEAK = 0.32;
/**
 * Lowest bucket painted. Bucket 1 is 0.2/7 ≈ 2.9% canvas alpha: under 0.6%
 * once the scrim applies, so invisible under the text and only faint in the
 * bleed above it. It is the most populated bucket, so skipping it removes
 * most of each frame's fillText calls for a slightly thinner bleed.
 */
export const FIRST_DRAWN = 2;

/** Origin in CSS px, so a resize that changes the cell size keeps it in place. */
type Ripple = { x: number; y: number; start: number; amp: number };
const NO_RIPPLES: readonly Ripple[] = [];

function cellSize(width: number) {
  return width < 640 ? { w: 12, h: 20, font: 13 } : { w: 9, h: 16, font: 11.5 };
}

export function AsciiField() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const host = wrap?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!wrap || !canvas || !host || !ctx) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let teardown = setup(motionQuery.matches);
    const onMotionChange = () => {
      teardown();
      teardown = setup(motionQuery.matches);
    };
    motionQuery.addEventListener("change", onMotionChange);

    return () => {
      motionQuery.removeEventListener("change", onMotionChange);
      teardown();
    };

    function setup(reduced: boolean): () => void {
      // Narrowed above; restated so the closures below keep the narrowing.
      const c = canvas!;
      const g = ctx!;

      let cols = 0;
      let rows = 0;
      let cell = cellSize(0);
      let glyphs = new Uint8Array(0);
      let bucket = new Uint8Array(0);
      let order = new Uint32Array(0);
      const counts = new Uint32Array(LEVELS);
      const offsets = new Uint32Array(LEVELS);

      const ripples: Ripple[] = [];
      /** Field clock: advances only while the loop runs, so a pause never jumps. */
      let t = 0;
      let last = 0;
      let raf = 0;
      let visible = true;
      let started = false;
      let lastMove = 0;
      let cssW = 0;
      let cssH = 0;

      const color = () =>
        // No token, no glyphs: `currentColor` would inherit fg, which the
        // contrast bound in globals.css was not derived for.
        getComputedStyle(c).getPropertyValue("--color-glyph").trim() ||
        "transparent";
      const font = getComputedStyle(c).fontFamily || "monospace";

      /** Resizing the backing store resets context state, so it is set here. */
      function applyContextState() {
        g.setTransform(dpr(), 0, 0, dpr(), 0, 0);
        g.fillStyle = color();
        g.font = `${cell.font}px ${font}`;
        g.textAlign = "center";
        g.textBaseline = "middle";
      }
      const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

      function resize() {
        const w = wrap!.clientWidth;
        const h = wrap!.clientHeight;
        if (w === 0 || h === 0) return;
        // The observer's first callback repeats the mount-time call.
        if (w === cssW && h === cssH && c.width === Math.round(w * dpr()))
          return;
        cssW = w;
        cssH = h;
        c.width = Math.round(w * dpr());
        c.height = Math.round(h * dpr());
        cell = cellSize(w);
        applyContextState();
        const nextCols = Math.ceil(w / cell.w);
        const nextRows = Math.ceil(h / cell.h);
        if (nextCols !== cols || nextRows !== rows) {
          cols = nextCols;
          rows = nextRows;
          const n = cols * rows;
          glyphs = new Uint8Array(n);
          for (let i = 0; i < n; i++) {
            glyphs[i] = (Math.random() * GLYPHS.length) | 0;
          }
          bucket = new Uint8Array(n);
          order = new Uint32Array(n);
        }
        draw(performance.now(), started && !reduced);
      }

      function draw(now: number, animate: boolean) {
        const aspect = (cols * cell.w) / Math.max(rows * cell.h, 1);
        const cellAspect = cell.h / cell.w;
        const live = animate ? ripples : NO_RIPPLES;
        counts.fill(0);

        for (let r = 0; r < rows; r++) {
          const v = (r + 0.5) / rows;
          for (let col = 0; col < cols; col++) {
            const i = r * cols + col;
            let wave = 0;
            for (let k = 0; k < live.length; k++) {
              const rp = live[k]!;
              wave += rippleContribution(
                col + 0.5 - rp.x / cell.w,
                r + 0.5 - rp.y / cell.h,
                (now - rp.start) / 1000,
                cellAspect,
                rp.amp,
              );
            }
            if (animate) {
              const p = wave > 0.2 ? MUTATE_WAVE : MUTATE_BASE;
              if (Math.random() < p) {
                glyphs[i] = (Math.random() * GLYPHS.length) | 0;
              }
            }
            const value =
              AMBIENT * fieldValue((col + 0.5) / cols, v, t, aspect) +
              (1 - AMBIENT) * wave;
            const b = bucketIndex(clamp01(value), LEVELS);
            bucket[i] = b;
            counts[b]!++;
          }
        }

        // Counting sort by bucket, so each alpha level is one run of fillText.
        let acc = 0;
        for (let b = 0; b < LEVELS; b++) {
          offsets[b] = acc;
          acc += counts[b]!;
        }
        const n = cols * rows;
        for (let i = 0; i < n; i++) order[offsets[bucket[i]!]!++] = i;

        g.clearRect(0, 0, cssW, cssH);
        // Buckets below FIRST_DRAWN are skipped; offsets[b] now points at the
        // end of run b, so run b is [offsets[b-1], offsets[b]).
        let start = offsets[FIRST_DRAWN - 1]!;
        for (let b = FIRST_DRAWN; b < LEVELS; b++) {
          const end = offsets[b]!;
          if (end > start) {
            g.globalAlpha = bucketAlpha(b, LEVELS, MAX_ALPHA);
            for (let j = start; j < end; j++) {
              const i = order[j]!;
              const col = i % cols;
              const r = (i / cols) | 0;
              g.fillText(
                GLYPHS[glyphs[i]!]!,
                (col + 0.5) * cell.w,
                (r + 0.5) * cell.h,
              );
            }
          }
          start = end;
        }
        g.globalAlpha = 1;
      }

      function frame(now: number) {
        raf = requestAnimationFrame(frame);
        if (now - last < FRAME_MS - 1) return;
        // Clamp the step so the first frame after a resume does not leap.
        t += Math.min(now - last, 100) / 1000;
        last = now;
        for (let k = ripples.length - 1; k >= 0; k--) {
          if (now - ripples[k]!.start > RIPPLE.lifetime * 1000)
            ripples.splice(k, 1);
        }
        draw(now, true);
      }

      function sync() {
        const run = started && visible && !document.hidden;
        if (run && !raf) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        } else if (!run && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      }

      function addRipple(e: PointerEvent, amp: number) {
        const rect = c.getBoundingClientRect();
        if (ripples.length >= MAX_RIPPLES) {
          // A steady drag fills the cap in ~1.1s; never let it cut a click's
          // ripple short. The oldest weak one makes way; if all twelve are
          // strong, a weak arrival is dropped and a strong one replaces the oldest.
          const weak = ripples.findIndex((r) => r.amp < STRONG);
          if (weak !== -1) ripples.splice(weak, 1);
          else if (amp < STRONG) return;
          else ripples.shift();
        }
        ripples.push({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          start: performance.now(),
          amp,
        });
      }
      const onDown = (e: PointerEvent) => addRipple(e, STRONG);
      const onMove = (e: PointerEvent) => {
        if (e.timeStamp - lastMove < MOVE_THROTTLE_MS) return;
        lastMove = e.timeStamp;
        addRipple(e, WEAK);
      };

      const ro =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(resize);
      ro?.observe(wrap!);
      resize();
      wrap!.dataset.ready = "";

      // The web font may land after the first frame, and `fonts.ready` can
      // resolve before it has even been requested — so ask for it by name.
      // Matters most under reduced motion, where nothing else repaints.
      let alive = true;
      const repaint = () => {
        if (!alive) return;
        applyContextState();
        draw(performance.now(), started && !reduced);
      };
      document.fonts?.load(`${cell.font}px ${font}`).then(repaint, () => {});
      // A restored context comes back with default state (identity transform,
      // black fill), which would silently draw the field into a corner.
      c.addEventListener("contextrestored", repaint);

      // DPR can change with no size change (window dragged to another
      // screen), which ResizeObserver does not report.
      let dprQuery: MediaQueryList | null = null;
      const onDprChange = () => {
        dprQuery?.removeEventListener("change", onDprChange);
        resize();
        watchDpr();
      };
      const watchDpr = () => {
        dprQuery = window.matchMedia(
          `(resolution: ${window.devicePixelRatio || 1}dppx)`,
        );
        dprQuery?.addEventListener("change", onDprChange);
      };
      watchDpr();

      if (reduced) {
        return () => {
          alive = false;
          ro?.disconnect();
          dprQuery?.removeEventListener("change", onDprChange);
          c.removeEventListener("contextrestored", repaint);
        };
      }

      const io =
        typeof IntersectionObserver === "undefined"
          ? null
          : new IntersectionObserver((entries) => {
              // Latest entry wins if several queue up during a busy frame.
              visible = entries[entries.length - 1]?.isIntersecting ?? true;
              sync();
            });
      io?.observe(wrap!);
      document.addEventListener("visibilitychange", sync);
      host!.addEventListener("pointerdown", onDown);
      host!.addEventListener("pointermove", onMove);

      // Keep the animation out of the load path: start once the main thread
      // is idle, so the hero's first paint and LCP are what they were before.
      const begin = () => {
        started = true;
        sync();
      };
      const usedIdle = typeof window.requestIdleCallback === "function";
      const idle = usedIdle
        ? window.requestIdleCallback(begin, { timeout: 2000 })
        : window.setTimeout(begin, 600);

      return () => {
        alive = false;
        if (usedIdle) window.cancelIdleCallback(idle);
        else window.clearTimeout(idle);
        cancelAnimationFrame(raf);
        raf = 0;
        ro?.disconnect();
        io?.disconnect();
        document.removeEventListener("visibilitychange", sync);
        host!.removeEventListener("pointerdown", onDown);
        host!.removeEventListener("pointermove", onMove);
        dprQuery?.removeEventListener("change", onDprChange);
        c.removeEventListener("contextrestored", repaint);
      };
    }
  }, []);

  return (
    <div ref={wrapRef} aria-hidden="true" className="ascii-field">
      <canvas ref={canvasRef} className="ascii-field__canvas font-mono" />
    </div>
  );
}
