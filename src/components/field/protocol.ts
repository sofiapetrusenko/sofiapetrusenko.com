/**
 * Messages between `AsciiField.tsx` (main thread) and `field.worker.ts`.
 * Types only; nothing here survives compilation.
 *
 * The main thread sends only what the worker cannot know: sizes, the column
 * rect, scroll position, throttled pointer input and visibility. Pointer
 * events carry no timestamp — the two threads' `performance.now()` clocks have
 * different origins — so the worker stamps them on arrival.
 */

export type Size = { w: number; h: number; dpr: number };

export type ToWorker =
  | ({
      type: "init";
      canvas: OffscreenCanvas;
      atlas: ImageBitmap;
      scrollY: number;
      left: number;
      right: number;
      hidden: boolean;
    } & Size)
  | ({ type: "resize"; atlas: ImageBitmap | null } & Size)
  | { type: "column"; left: number; right: number }
  | { type: "scroll"; y: number }
  | { type: "pointer"; x: number; pageY: number; strong: boolean }
  | { type: "visibility"; hidden: boolean };

export type FromWorker = { type: "ready" } | { type: "failed"; reason: string };
