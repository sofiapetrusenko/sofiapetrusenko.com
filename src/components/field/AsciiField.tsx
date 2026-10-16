"use client";

import { useEffect, useRef } from "react";
import {
  ALPHA_LEVELS,
  GLYPHS,
  COLUMN_CAP,
  RIPPLE,
  alphaCap,
  bucketIndex,
  clamp01,
  edgeOffset,
  fieldValue,
  gutterProfile,
  rippleContribution,
  type GutterProfile,
} from "./asciiField.math";

/**
 * Site-wide character field: one viewport-sized canvas behind every page, a
 * fixed grid of monospace glyphs whose alpha follows a drifting field sampled
 * in *page* coordinates — so the bright regions scroll with the content while
 * the grid stays put — with ripples from the pointer, also page-anchored.
 * Glyphs never move; only their brightness and, occasionally, which letter
 * they are.
 *
 * Decorative only. The canvas is `aria-hidden` and `pointer-events: none`, and
 * pointer input is read off `window`, so every link and button on the site
 * stays the hit target it always was.
 *
 * Brightness is capped per cell by `alphaCap`: `COLUMN_CAP` over the content
 * column read live from `<main>` and everywhere below 640px; outside it, an
 * ease-in-out rise across ~70% of each gutter, whose start wanders outward
 * along y and over time (`edgeOffset`) so the edge is organic, to a peak
 * scaled by how wide that gutter is. The contrast bound for that cap is in
 * `globals.css` under `.ascii-field`.
 *
 * Perf guards: 30 fps cap, DPR capped at 2, ten alpha levels so `globalAlpha`
 * changes at most nine times a frame rather than once per cell, a coarser
 * grid below 640px, nothing at all — not even the first frame — runs until
 * the browser goes idle, the column rect is re-read twice a second rather than
 * every frame, and the loop stops whenever the tab is hidden.
 * `prefers-reduced-motion: reduce` gets one static frame, no loop and no pointer listeners — only what keeps that frame
 * correct (resize, DPR, font load, context restore, and a once-a-second check
 * that the content column has not moved after a client-side navigation).
 *
 * A client boundary because it needs a canvas context, `requestAnimationFrame`
 * and observers; a leaf, so it takes no children and drags nothing across.
 */

/** Share of each cell's ceiling the ambient field may use; ripples add the rest. */
const AMBIENT = 0.6;
/**
 * Lowest bucket painted. Bucket 0 is "nothing"; from 1 up every level is drawn.
 */
export const FIRST_DRAWN = 1;
const FRAME_MS = 1000 / 30;
const MAX_RIPPLES = 12;
const MOVE_THROTTLE_MS = 90;
const MUTATE_BASE = 0.002;
const MUTATE_WAVE = 0.06;
const STRONG = 1;
const WEAK = 0.32;
const NARROW_PX = 640;
const COLUMN_READ_MS = 500;
const LEVELS = ALPHA_LEVELS.length;

/** Origin in page CSS px, so it stays anchored to the content under a scroll. */
type Ripple = { x: number; y: number; start: number; amp: number };
const NO_RIPPLES: readonly Ripple[] = [];

function cellSize(width: number) {
  return width < NARROW_PX
    ? { w: 16, h: 28, font: 15 }
    : { w: 9, h: 16, font: 11.5 };
}

export function AsciiField() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!wrap || !canvas || !ctx) return;

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
      /** Per cell column: 0 over the column, 1 left gutter, 2 right gutter. */
      let side = new Uint8Array(0);
      /** Per cell column: px from the column edge to the cell's nearest edge. */
      let out = new Float32Array(0);
      let leftGutter: GutterProfile = gutterProfile(0);
      let rightGutter: GutterProfile = gutterProfile(0);
      const counts = new Uint32Array(LEVELS);
      const offsets = new Uint32Array(LEVELS);

      const ripples: Ripple[] = [];
      /** Field clock: advances only while the loop runs, so a pause never jumps. */
      let t = 0;
      let last = 0;
      let raf = 0;
      let started = false;
      let lastMove = 0;
      let cssW = 0;
      let cssH = 0;
      let colLeft = 0;
      let colRight = 0;
      let lastColumnRead = 0;

      const color = () =>
        // No token, no glyphs: `currentColor` would inherit fg, which the
        // contrast bound in globals.css was not derived for.
        getComputedStyle(c).getPropertyValue("--color-glyph").trim() ||
        "transparent";
      const font = getComputedStyle(c).fontFamily || "monospace";
      const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

      /** Resizing the backing store resets context state, so it is set here. */
      function applyContextState() {
        g.setTransform(dpr(), 0, 0, dpr(), 0, 0);
        g.fillStyle = color();
        g.font = `${cell.font}px ${font}`;
        g.textAlign = "center";
        g.textBaseline = "middle";
      }

      /**
       * Re-read the content column; recompute the per-column geometry only if
       * it moved. Taken before any canvas work, while layout is clean. Below
       * 640px, or with no `<main>` (a 404), every cell counts as column.
       */
      function readColumn(): boolean {
        const r = document.querySelector("main")?.getBoundingClientRect();
        const left = r ? r.left : 0;
        const right = r ? r.right : 0;
        if (left === colLeft && right === colRight && side.length === cols)
          return false;
        colLeft = left;
        colRight = right;
        if (side.length !== cols) {
          side = new Uint8Array(cols);
          out = new Float32Array(cols);
        }
        const whole = cssW < NARROW_PX || !(right > left);
        leftGutter = gutterProfile(left);
        rightGutter = gutterProfile(cssW - right);
        for (let col = 0; col < cols; col++) {
          // Measured from the cell's edge nearest the column, so any cell
          // whose box touches the column counts as column.
          const x0 = col * cell.w;
          const x1 = x0 + cell.w;
          if (whole || (x1 > left && x0 < right)) {
            side[col] = 0;
            out[col] = 0;
          } else if (x1 <= left) {
            side[col] = 1;
            out[col] = left - x1;
          } else {
            side[col] = 2;
            out[col] = x0 - right;
          }
        }
        return true;
      }

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
        colLeft = colRight = Number.NaN; // force the ceilings to recompute
        readColumn();
        draw(performance.now(), started && !reduced);
      }

      function draw(now: number, animate: boolean) {
        const cellAspect = cell.h / cell.w;
        const live = animate ? ripples : NO_RIPPLES;
        const scrollY = window.scrollY;
        counts.fill(0);

        for (let r = 0; r < rows; r++) {
          const pageY = (r + 0.5) * cell.h + scrollY;
          // Page-anchored like the field, so the wobble scrolls with content.
          const offL = edgeOffset(pageY, t, 0);
          const offR = edgeOffset(pageY, t, 1);
          for (let col = 0; col < cols; col++) {
            const sd = side[col]!;
            const cap =
              sd === 0
                ? COLUMN_CAP
                : sd === 1
                  ? alphaCap(out[col]! - offL, leftGutter)
                  : alphaCap(out[col]! - offR, rightGutter);
            const i = r * cols + col;
            const pageX = (col + 0.5) * cell.w;
            let wave = 0;
            for (let k = 0; k < live.length; k++) {
              const rp = live[k]!;
              wave += rippleContribution(
                (pageX - rp.x) / cell.w,
                (pageY - rp.y) / cell.h,
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
            const value = clamp01(
              AMBIENT * fieldValue(pageX, pageY, t, cssW) +
                (1 - AMBIENT) * wave,
            );
            // value ≤ 1, so alpha ≤ the cell's ceiling, ripple peak included.
            const b = bucketIndex(value * cap);
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
        // offsets[b] now points at the end of run b, so run b is
        // [offsets[b-1], offsets[b]).
        let start = offsets[FIRST_DRAWN - 1]!;
        for (let b = FIRST_DRAWN; b < LEVELS; b++) {
          const end = offsets[b]!;
          if (end > start) {
            g.globalAlpha = ALPHA_LEVELS[b]!;
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
        // The column only moves on a resize or a navigation; a rect read
        // twice a second follows both without forcing layout every frame.
        if (now - lastColumnRead > COLUMN_READ_MS) {
          lastColumnRead = now;
          readColumn();
        }
        draw(now, true);
      }

      function sync() {
        const run = started && !document.hidden;
        if (run && !raf) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        } else if (!run && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      }

      function addRipple(e: PointerEvent, amp: number) {
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
          x: e.clientX,
          y: e.clientY + window.scrollY,
          start: performance.now(),
          amp,
        });
      }
      const onDown = (e: PointerEvent) => addRipple(e, STRONG);
      const onMove = (e: PointerEvent) => {
        // Touch moves are scrolls; on a phone only a tap ripples.
        if (e.pointerType === "touch") return;
        if (e.timeStamp - lastMove < MOVE_THROTTLE_MS) return;
        lastMove = e.timeStamp;
        addRipple(e, WEAK);
      };

      // Everything below — observers, the first frame, the loop — waits for
      // the browser to go idle, so none of it lands in the hydration task:
      // first paint and LCP are what they were before, and the canvas fades in
      // (`[data-ready]`) only once it has something on it.
      let alive = true;
      let ro: ResizeObserver | null = null;
      let poll = 0;
      let dprQuery: MediaQueryList | null = null;
      const repaint = () => {
        if (!alive) return;
        applyContextState();
        draw(performance.now(), started && !reduced);
      };
      // DPR can change with no size change (window dragged to another
      // screen), which ResizeObserver does not report.
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

      const begin = () => {
        ro =
          typeof ResizeObserver === "undefined"
            ? null
            : new ResizeObserver(resize);
        ro?.observe(wrap!);
        resize();
        wrap!.dataset.ready = "";

        // The web font may land after the first frame, and `fonts.ready` can
        // resolve before it has even been requested — so ask for it by name.
        // Matters most under reduced motion, where nothing else repaints.
        document.fonts?.load(`${cell.font}px ${font}`).then(repaint, () => {});
        // A restored context comes back with default state (identity
        // transform, black fill), which would silently draw into a corner.
        c.addEventListener("contextrestored", repaint);
        watchDpr();

        if (reduced) {
          // A client-side navigation can move or remove `<main>` with no
          // resize; the static frame follows it, and is otherwise left alone.
          poll = window.setInterval(() => {
            if (readColumn()) repaint();
          }, 1000);
          return;
        }

        document.addEventListener("visibilitychange", sync);
        window.addEventListener("pointerdown", onDown, { passive: true });
        window.addEventListener("pointermove", onMove, { passive: true });
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
        window.clearInterval(poll);
        cancelAnimationFrame(raf);
        raf = 0;
        ro?.disconnect();
        document.removeEventListener("visibilitychange", sync);
        window.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onMove);
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
