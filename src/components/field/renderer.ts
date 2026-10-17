/**
 * The character field's renderer: everything that turns field state into
 * pixels, with no DOM, no event wiring and no clock of its own. It runs in two
 * places and is identical in both:
 *
 *  - `field.worker.ts`, on an OffscreenCanvas — the normal, animated path, so
 *    none of this costs the main thread anything;
 *  - `AsciiField.tsx`'s static fallback (reduced motion, no OffscreenCanvas,
 *    or a worker that fails), loaded with a dynamic import so it never sits in
 *    the main bundle, and drawn exactly once per change.
 *
 * All brightness decisions are `asciiField.math.ts`, unchanged.
 */

import {
  ALPHA_LEVELS,
  COLUMN_CAP,
  GLYPHS,
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
import { NARROW_PX, cellSize, type Cell } from "./cells";

/** Share of each cell's ceiling the ambient field may use; ripples add the rest. */
const AMBIENT = 0.6;
/** Lowest bucket painted. Bucket 0 is "nothing"; from 1 up every level is drawn. */
export const FIRST_DRAWN = 1;
const MAX_RIPPLES = 12;
const MUTATE_BASE = 0.002;
const MUTATE_WAVE = 0.06;
export const STRONG = 1;
export const WEAK = 0.32;
const LEVELS = ALPHA_LEVELS.length;

export type Context2D =
  CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * How a glyph reaches the canvas. `text` is a plain `fillText` with the page's
 * font (main thread, where that font is loaded). `atlas` copies the glyph out of
 * a sprite sheet the main thread rendered in that same font (`buildAtlas` in
 * `cells.ts`), because a worker cannot see the document's web fonts. Same cell
 * centre, same alpha, same pixels.
 */
export type Painter =
  | { kind: "text"; font: string; color: string }
  | { kind: "atlas"; image: CanvasImageSource; dpr: number };

/** Origin in page CSS px, so it stays anchored to the content under a scroll. */
type Ripple = { x: number; y: number; start: number; amp: number };
const NO_RIPPLES: readonly Ripple[] = [];

export class FieldRenderer {
  private cols = 0;
  private rows = 0;
  private cell: Cell = cellSize(0);
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private glyphs = new Uint8Array(0);
  private bucket = new Uint8Array(0);
  private order = new Uint32Array(0);
  private readonly counts = new Uint32Array(LEVELS);
  private readonly offsets = new Uint32Array(LEVELS);
  /** Per cell column: 0 over the column, 1 left gutter, 2 right gutter. */
  private side = new Uint8Array(0);
  /** Per cell column: px from the column edge to the cell's nearest edge. */
  private out = new Float32Array(0);
  private leftGutter: GutterProfile = gutterProfile(0);
  private rightGutter: GutterProfile = gutterProfile(0);
  private colLeft = 0;
  private colRight = 0;
  private readonly ripples: Ripple[] = [];
  private painter: Painter | null = null;
  /** Field clock, seconds: advanced only by `tick`, so a pause never jumps. */
  t = 0;
  scrollY = 0;

  constructor(private readonly g: Context2D) {}

  get ready(): boolean {
    return this.painter !== null && this.cols > 0;
  }

  /** Size the backing store (DPR already capped by the caller) and the grid. */
  resize(w: number, h: number, dpr: number): void {
    if (w === 0 || h === 0) return;
    this.cssW = w;
    this.cssH = h;
    this.dpr = dpr;
    this.g.canvas.width = Math.round(w * dpr);
    this.g.canvas.height = Math.round(h * dpr);
    this.cell = cellSize(w);
    const cols = Math.ceil(w / this.cell.w);
    const rows = Math.ceil(h / this.cell.h);
    if (cols !== this.cols || rows !== this.rows) {
      this.cols = cols;
      this.rows = rows;
      const n = cols * rows;
      this.glyphs = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        this.glyphs[i] = (Math.random() * GLYPHS.length) | 0;
      }
      this.bucket = new Uint8Array(n);
      this.order = new Uint32Array(n);
    }
    this.layoutColumn();
    this.applyContextState();
  }

  setPainter(p: Painter): void {
    this.painter = p;
    this.applyContextState();
  }

  /** The content column's viewport x-extent; no column means "column everywhere". */
  setColumn(left: number, right: number): void {
    this.colLeft = left;
    this.colRight = right;
    this.layoutColumn();
  }

  addRipple(x: number, pageY: number, amp: number, now: number): void {
    const ripples = this.ripples;
    if (ripples.length >= MAX_RIPPLES) {
      // A steady drag fills the cap in ~1.1s; never let it cut a click's
      // ripple short. The oldest weak one makes way; if all twelve are
      // strong, a weak arrival is dropped and a strong one replaces the oldest.
      const weak = ripples.findIndex((r) => r.amp < STRONG);
      if (weak !== -1) ripples.splice(weak, 1);
      else if (amp < STRONG) return;
      else ripples.shift();
    }
    ripples.push({ x, y: pageY, start: now, amp });
  }

  /** Advance the clock by `dtMs` (clamped, so a resume does not leap) and draw. */
  tick(now: number, dtMs: number): void {
    this.t += Math.min(dtMs, 100) / 1000;
    const ripples = this.ripples;
    for (let k = ripples.length - 1; k >= 0; k--) {
      if (now - ripples[k]!.start > RIPPLE.lifetime * 1000)
        ripples.splice(k, 1);
    }
    this.draw(now, true);
  }

  /** One frame with no ripples and no letter swaps: the reduced-motion field. */
  drawStatic(now: number): void {
    this.draw(now, false);
  }

  /** Re-apply state a backing-store resize or a restored context resets. */
  applyContextState(): void {
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const p = this.painter;
    if (p?.kind === "text") {
      g.fillStyle = p.color;
      g.font = `${this.cell.font}px ${p.font}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
    }
  }

  private layoutColumn(): void {
    const cols = this.cols;
    if (this.side.length !== cols) {
      this.side = new Uint8Array(cols);
      this.out = new Float32Array(cols);
    }
    const { colLeft: left, colRight: right, cell } = this;
    const whole = this.cssW < NARROW_PX || !(right > left);
    this.leftGutter = gutterProfile(left);
    this.rightGutter = gutterProfile(this.cssW - right);
    for (let col = 0; col < cols; col++) {
      // Measured from the cell's edge nearest the column, so any cell whose
      // box touches the column counts as column.
      const x0 = col * cell.w;
      const x1 = x0 + cell.w;
      if (whole || (x1 > left && x0 < right)) {
        this.side[col] = 0;
        this.out[col] = 0;
      } else if (x1 <= left) {
        this.side[col] = 1;
        this.out[col] = left - x1;
      } else {
        this.side[col] = 2;
        this.out[col] = x0 - right;
      }
    }
  }

  private draw(now: number, animate: boolean): void {
    const p = this.painter;
    if (!p || this.cols === 0) return;
    const { g, cell, cols, rows, glyphs, bucket, order, counts, offsets } =
      this;
    const { side, out, leftGutter, rightGutter, t, cssW } = this;
    const cellAspect = cell.h / cell.w;
    const live = animate ? this.ripples : NO_RIPPLES;
    const scrollY = this.scrollY;
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
          const pm = wave > 0.2 ? MUTATE_WAVE : MUTATE_BASE;
          if (Math.random() < pm) {
            glyphs[i] = (Math.random() * GLYPHS.length) | 0;
          }
        }
        const value = clamp01(
          AMBIENT * fieldValue(pageX, pageY, t, cssW) + (1 - AMBIENT) * wave,
        );
        // value ≤ 1, so alpha ≤ the cell's ceiling, ripple peak included.
        const b = bucketIndex(value * cap);
        bucket[i] = b;
        counts[b]!++;
      }
    }

    // Counting sort by bucket, so each alpha level is one run of draws.
    let acc = 0;
    for (let b = 0; b < LEVELS; b++) {
      offsets[b] = acc;
      acc += counts[b]!;
    }
    const n = cols * rows;
    for (let i = 0; i < n; i++) order[offsets[bucket[i]!]!++] = i;

    g.clearRect(0, 0, this.cssW, this.cssH);
    // offsets[b] now points at the end of run b, so run b is
    // [offsets[b-1], offsets[b]).
    const sw = cell.w * (p.kind === "atlas" ? p.dpr : 1);
    const sh = cell.h * (p.kind === "atlas" ? p.dpr : 1);
    let start = offsets[FIRST_DRAWN - 1]!;
    for (let b = FIRST_DRAWN; b < LEVELS; b++) {
      const end = offsets[b]!;
      if (end > start) {
        g.globalAlpha = ALPHA_LEVELS[b]!;
        for (let j = start; j < end; j++) {
          const i = order[j]!;
          const col = i % cols;
          const r = (i / cols) | 0;
          if (p.kind === "atlas") {
            g.drawImage(
              p.image,
              glyphs[i]! * sw,
              0,
              sw,
              sh,
              col * cell.w,
              r * cell.h,
              cell.w,
              cell.h,
            );
          } else {
            g.fillText(
              GLYPHS[glyphs[i]!]!,
              (col + 0.5) * cell.w,
              (r + 0.5) * cell.h,
            );
          }
        }
      }
      start = end;
    }
    g.globalAlpha = 1;
  }
}
