/**
 * Messages between `WarpField.tsx` (main thread) and `warp.worker.ts`.
 * Types only; nothing here survives compilation.
 *
 * The main thread sends what the worker cannot know: viewport size, the hero's
 * layout (measured at rest, untransformed), scroll position and visibility.
 * Everything that changes during the scene is derived in the worker from the
 * scroll position, with the same fractions the stylesheet animates by.
 */

import type { Rect } from "./warp.math";

export type Size = { w: number; h: number; dpr: number };

/** Where one entry sits in the atlas, in CSS px of the atlas's own scale. */
export type AtlasSlot = { x: number; y: number; w: number };

export type Atlas = {
  image: ImageBitmap;
  /** Font size the atlas was drawn at, CSS px. */
  font: number;
  /** Row height, CSS px. */
  row: number;
  /** One table per tone, in `TONES` order; each in `ENTRIES` order. */
  slots: AtlasSlot[][];
  dpr: number;
};

export type Layout = {
  /** The scene, in page px. */
  sceneTop: number;
  sceneHeight: number;
  /** The sticky stage: its height, sticky offset and left edge in the viewport. */
  stageHeight: number;
  /** The stage's sticky offset from the viewport top, px. */
  stick: number;
  stageX: number;
  /** Stage-local text boxes at rest. */
  name: Rect | null;
  lift: Rect[];
  /** How far the lift boxes rise, px. */
  liftPx: number;
};

export type ToWorker =
  | ({
      type: "init";
      canvas: OffscreenCanvas;
      atlas: Atlas;
      /** Trail colours, in `TONES` order. */
      colors: string[];
      bg: string;
      scrollY: number;
      hidden: boolean;
      layout: Layout;
    } & Size)
  | ({ type: "resize" } & Size)
  | { type: "layout"; layout: Layout }
  | { type: "scroll"; y: number }
  | { type: "visibility"; hidden: boolean };

export type FromWorker = { type: "ready" } | { type: "failed"; reason: string };
