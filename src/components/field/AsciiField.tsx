import { useEffect, useRef } from "react";
import { buildAtlas, cellSize } from "./cells";
import type { FromWorker, Size, ToWorker } from "./protocol";

/**
 * Site-wide character field — the main-thread shim. The field itself (a fixed
 * grid of glyphs whose alpha follows a page-anchored drifting field, capped by
 * a feathered column mask, with pointer ripples) is drawn by
 * `field.worker.ts` on an OffscreenCanvas. This file only:
 *
 *  - transfers the canvas and hands over a glyph atlas rendered in the page's
 *    font (`buildAtlas`), since a worker cannot see document web fonts;
 *  - forwards what the worker cannot know: viewport size and DPR (capped at 2),
 *    the `<main>` column rect on resize or layout change, `scrollY`
 *    (coalesced to one message a frame), pointer input (moves throttled to
 *    90ms; touch moves are scrolls and ignored, so a phone ripples once per
 *    touch — a tap, or the start of a scroll), and
 *    page visibility.
 *
 * Animated on every screen, phones included (every touch ripples once where
 * it lands, a scroll's first contact included). The fallback —
 * reduced motion, no OffscreenCanvas, or a worker that errors or does not
 * report ready — is one static frame drawn on the main thread by the same
 * `FieldRenderer`, loaded with a dynamic import so it is never in the main
 * bundle, and redrawn only when size, column or font change. There is no
 * main-thread animation loop in any case.
 *
 * Nothing runs until the load event has fired and the browser is then idle
 * (`requestIdleCallback`, 2s timeout), so none of it lands in hydration or
 * competes with page load. The shim is itself a lazy chunk, mounted by
 * `LazyAsciiField` with `ssr: false`, so none of it is in First Load JS.
 * Decorative only: `aria-hidden`, `pointer-events: none`, and pointer input is
 * read off `window`, so every link and button stays the hit target it was.
 * The contrast bound for the column cap is in `globals.css` (`.ascii-field`).
 *
 * Client code, but not a boundary of its own: `LazyAsciiField` is the
 * boundary, and is the only importer. A leaf, so it takes no children.
 */

const MOVE_THROTTLE_MS = 90;
/** The idle callback's deadline once the page has loaded. */
const IDLE_TIMEOUT_MS = 2000;
/** A worker that has not drawn its first frame by now is treated as failed. */
const READY_TIMEOUT_MS = 4000;

export function AsciiField() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animate = () => !motionQuery.matches && canAnimateOffThread();
    let teardown = whenIdle(animate());
    // Re-decide when reduced motion is toggled.
    const onChange = () => {
      teardown();
      teardown = whenIdle(animate());
    };
    motionQuery.addEventListener("change", onChange);
    return () => {
      motionQuery.removeEventListener("change", onChange);
      teardown();
    };

    /** Start once the page has loaded and the main thread is then idle. */
    function whenIdle(animated: boolean): () => void {
      let stop: (() => void) | null = null;
      let idle: number | null = null;
      const usedIdle = typeof window.requestIdleCallback === "function";
      const begin = () => {
        idle = null;
        stop = animated ? startWorker() : startStatic();
      };
      const afterLoad = () => {
        idle = usedIdle
          ? window.requestIdleCallback(begin, { timeout: IDLE_TIMEOUT_MS })
          : window.setTimeout(begin, 600);
      };
      if (document.readyState === "complete") afterLoad();
      else window.addEventListener("load", afterLoad, { once: true });
      return () => {
        window.removeEventListener("load", afterLoad);
        if (idle !== null) {
          if (usedIdle) window.cancelIdleCallback(idle);
          else window.clearTimeout(idle);
        }
        stop?.();
        delete wrap!.dataset.ready;
      };
    }

    /** A new canvas each time: one transferred to a worker is gone for good. */
    function freshCanvas(): HTMLCanvasElement {
      wrap!.querySelector("canvas")?.remove();
      const c = document.createElement("canvas");
      c.className = "ascii-field__canvas font-mono";
      wrap!.append(c);
      return c;
    }

    function size(): Size {
      return {
        w: wrap!.clientWidth,
        h: wrap!.clientHeight,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      };
    }

    /** No `<main>` (a 404) gives 0/0, which the renderer reads as "column everywhere". */
    function column() {
      const r = document.querySelector("main")?.getBoundingClientRect();
      return { left: r ? r.left : 0, right: r ? r.right : 0 };
    }

    function style(c: HTMLCanvasElement) {
      const cs = getComputedStyle(c);
      return {
        // No token, no glyphs: `currentColor` would inherit fg, which the
        // contrast bound in globals.css was not derived for.
        color: cs.getPropertyValue("--color-glyph").trim() || "transparent",
        font: cs.fontFamily || "monospace",
      };
    }

    /**
     * Calls `onChange` (at most once a frame) when the viewport size, DPR or
     * page layout may have changed: the viewport-sized wrapper resizing, the
     * body resizing, nodes added or removed (a client-side navigation), or a
     * DPR change with no size change, which ResizeObserver does not report.
     */
    function watchLayout(onChange: () => void): () => void {
      let frame = 0;
      const fire = () => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          onChange();
        });
      };
      const ro =
        typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fire);
      ro?.observe(wrap!);
      ro?.observe(document.body);
      const mo =
        typeof MutationObserver === "undefined"
          ? null
          : new MutationObserver(fire);
      mo?.observe(document.body, { childList: true, subtree: true });
      let dprQuery: MediaQueryList | null = null;
      const onDpr = () => {
        dprQuery?.removeEventListener("change", onDpr);
        watchDpr();
        fire();
      };
      const watchDpr = () => {
        dprQuery = window.matchMedia(
          `(resolution: ${window.devicePixelRatio || 1}dppx)`,
        );
        dprQuery?.addEventListener("change", onDpr);
      };
      watchDpr();
      return () => {
        if (frame) cancelAnimationFrame(frame);
        ro?.disconnect();
        mo?.disconnect();
        dprQuery?.removeEventListener("change", onDpr);
      };
    }

    function startWorker(): () => void {
      const c = freshCanvas();
      let worker: Worker;
      try {
        worker = new Worker(new URL("./field.worker.ts", import.meta.url));
      } catch {
        return startStatic();
      }
      const offscreen = c.transferControlToOffscreen();
      const send = (m: ToWorker, transfer: Transferable[] = []) =>
        worker.postMessage(m, transfer);

      let alive = true;
      let fallback: (() => void) | null = null;
      let unwatch: (() => void) | null = null;
      const fail = () => {
        if (!alive || fallback) return;
        stopWorker();
        fallback = startStatic();
      };
      const readyTimer = window.setTimeout(fail, READY_TIMEOUT_MS);
      worker.onerror = fail;
      worker.onmessageerror = fail;
      worker.onmessage = (e: MessageEvent<FromWorker>) => {
        if (e.data.type === "ready") {
          window.clearTimeout(readyTimer);
          wrap!.dataset.ready = "";
        } else fail();
      };

      let sz = size();
      let col = column();
      let atlasKey = "";
      let resizeSeq = 0;
      const keyOf = (s: Size) => {
        const cell = cellSize(s.w);
        return `${cell.w}x${cell.h}@${s.dpr}`;
      };
      const atlasFor = async (s: Size) => {
        const { font, color } = style(c);
        await document.fonts?.load(`${cellSize(s.w).font}px ${font}`);
        return buildAtlas(cellSize(s.w), s.dpr, font, color);
      };

      (async () => {
        const atlas = await atlasFor(sz);
        if (!alive) return;
        atlasKey = keyOf(sz);
        send(
          {
            type: "init",
            canvas: offscreen,
            atlas,
            ...sz,
            scrollY: window.scrollY,
            ...col,
            hidden: document.hidden,
          },
          [offscreen, atlas],
        );
        unwatch = watchLayout(onLayout);
      })().catch(fail);

      async function onLayout() {
        const next = size();
        if (next.w !== sz.w || next.h !== sz.h || next.dpr !== sz.dpr) {
          sz = next;
          const seq = ++resizeSeq;
          const key = keyOf(next);
          if (key === atlasKey) {
            send({ type: "resize", ...next, atlas: null });
          } else {
            const atlas = await atlasFor(next).catch(() => null);
            // A newer resize overtook this one while the atlas was built.
            if (!alive || seq !== resizeSeq || !atlas) return;
            atlasKey = key;
            send({ type: "resize", ...next, atlas }, [atlas]);
          }
        }
        const nextCol = column();
        if (nextCol.left !== col.left || nextCol.right !== col.right) {
          col = nextCol;
          send({ type: "column", ...col });
        }
      }

      let scrollFrame = 0;
      const onScroll = () => {
        if (scrollFrame) return;
        scrollFrame = requestAnimationFrame(() => {
          scrollFrame = 0;
          send({ type: "scroll", y: window.scrollY });
        });
      };
      let lastMove = 0;
      const onDown = (e: PointerEvent) =>
        send({
          type: "pointer",
          x: e.clientX,
          pageY: e.clientY + window.scrollY,
          strong: true,
        });
      const onMove = (e: PointerEvent) => {
        // Touch moves are scrolls; on a phone only the touch itself ripples.
        if (e.pointerType === "touch") return;
        if (e.timeStamp - lastMove < MOVE_THROTTLE_MS) return;
        lastMove = e.timeStamp;
        send({
          type: "pointer",
          x: e.clientX,
          pageY: e.clientY + window.scrollY,
          strong: false,
        });
      };
      const onVisibility = () =>
        send({ type: "visibility", hidden: document.hidden });

      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("pointerdown", onDown, { passive: true });
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);

      function stopWorker() {
        window.clearTimeout(readyTimer);
        worker.terminate();
        unwatch?.();
        unwatch = null;
        if (scrollFrame) cancelAnimationFrame(scrollFrame);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onMove);
        document.removeEventListener("visibilitychange", onVisibility);
      }

      return () => {
        alive = false;
        stopWorker();
        fallback?.();
      };
    }

    /** One frame on the main thread, redrawn only when the page changes shape. */
    function startStatic(): () => void {
      const c = freshCanvas();
      const g = c.getContext("2d");
      if (!g) return () => {};
      let alive = true;
      let redraw: (() => void) | null = null;
      let unwatch: (() => void) | null = null;

      // A renderer chunk that fails to load leaves the field unshown, not an
      // unhandled rejection: it is decoration.
      import("./renderer").then(
        ({ FieldRenderer }) => {
          if (!alive) return;
          const r = new FieldRenderer(g);
          let sz = size();
          const paint = () => {
            const { font, color } = style(c);
            r.setPainter({ kind: "text", font, color });
            const col = column();
            r.setColumn(col.left, col.right);
            r.scrollY = window.scrollY;
            r.drawStatic(performance.now());
          };
          r.resize(sz.w, sz.h, sz.dpr);
          paint();
          wrap!.dataset.ready = "";
          redraw = () => {
            if (!alive) return;
            const next = size();
            if (next.w !== sz.w || next.h !== sz.h || next.dpr !== sz.dpr) {
              sz = next;
              r.resize(sz.w, sz.h, sz.dpr);
            }
            paint();
          };
          unwatch = watchLayout(redraw);
          document.fonts
            ?.load(`${cellSize(sz.w).font}px ${style(c).font}`)
            .then(
              () => redraw?.(),
              () => {},
            );
          // A restored context comes back with default state; repaint fully.
          c.addEventListener("contextrestored", () => {
            r.applyContextState();
            redraw?.();
          });
        },
        () => {},
      );

      return () => {
        alive = false;
        unwatch?.();
      };
    }
  }, []);

  return <div ref={wrapRef} aria-hidden="true" className="ascii-field" />;
}

/** Whether the field can animate off the main thread in this browser. */
function canAnimateOffThread(): boolean {
  return (
    typeof Worker === "function" &&
    typeof OffscreenCanvas === "function" &&
    typeof HTMLCanvasElement.prototype.transferControlToOffscreen ===
      "function" &&
    typeof createImageBitmap === "function"
  );
}
