/**
 * The pure half of the hero character field: everything `AsciiField.tsx` needs
 * to decide how bright a cell is, with no canvas, DOM or clock in sight. Kept
 * apart so it can be unit tested and so the component is left with nothing but
 * scheduling and drawing.
 *
 * Units: positions are in cells, measured in cell *widths* on both axes once
 * `aspect` (cell height / cell width) has been applied to the vertical one, so
 * a ripple is a circle on screen rather than an ellipse stretched by the cell
 * shape. Time is in seconds.
 */

export const GLYPHS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Ambient brightness in [0, 1] at a normalised position (`u`, `v` in [0, 1]
 * across the field) and time `t`. A soft blob drifts on two incommensurate
 * sines so it never visibly loops, over a low-frequency sine lattice that keeps
 * the rest of the field from going flat. `aspect` is the field's width/height,
 * so the blob stays round however the hero is shaped.
 */
export function fieldValue(
  u: number,
  v: number,
  t: number,
  aspect: number,
): number {
  const cx = 0.5 + 0.32 * Math.sin(t * 0.11);
  const cy = 0.42 + 0.26 * Math.sin(t * 0.083 + 1.3);
  const dx = (u - cx) * aspect;
  const dy = v - cy;
  const blob = Math.exp(-(dx * dx + dy * dy) / 0.14);
  const noise =
    0.5 +
    0.5 * Math.sin(u * 6.3 + t * 0.35) * Math.sin(v * 4.7 - t * 0.27 + 0.8);
  return clamp01(0.62 * blob + 0.38 * noise);
}

export type RippleParams = {
  /** Wavefront speed, cell widths per second. */
  speed: number;
  /** Half-thickness of the wavefront, cell widths. */
  width: number;
  /** Exponential decay rate, per second. */
  decay: number;
  /** Age, seconds, after which the ripple contributes nothing. */
  lifetime: number;
};

export const RIPPLE: RippleParams = {
  speed: 26,
  width: 2.6,
  decay: 1.5,
  lifetime: 2.2,
};

/**
 * One ripple's contribution at a cell `dx`, `dy` cells away from its origin,
 * `age` seconds after it started: amp · exp(-((d - v·t)/w)²) · exp(-k·t).
 * `aspect` is cell height / cell width; `dy` is scaled by it so distance is
 * isotropic on screen.
 *
 * Returns 0 outright — without the two `exp` calls — when the cell is more than
 * three widths from the wavefront, where the Gaussian is below 1.3e-4 anyway.
 * That early-out is what keeps twelve ripples over a few thousand cells cheap.
 */
export function rippleContribution(
  dx: number,
  dy: number,
  age: number,
  aspect: number,
  amp = 1,
  p: RippleParams = RIPPLE,
): number {
  if (age < 0 || age >= p.lifetime) return 0;
  const sy = dy * aspect;
  const d = Math.sqrt(dx * dx + sy * sy);
  const off = (d - p.speed * age) / p.width;
  if (off > 3 || off < -3) return 0;
  return amp * Math.exp(-off * off) * Math.exp(-p.decay * age);
}

/**
 * Quantise a brightness in [0, 1] to one of `levels` buckets. Bucket 0 is
 * "not drawn"; the renderer sets `globalAlpha` once per remaining bucket.
 * Out-of-range and NaN input clamp rather than index out of bounds.
 */
export function bucketIndex(value: number, levels: number): number {
  if (!(value > 0)) return 0;
  const i = Math.floor(value * levels);
  return i >= levels ? levels - 1 : i;
}

/** The alpha a bucket is painted at: linear up to `maxAlpha` at the top one. */
export function bucketAlpha(
  index: number,
  levels: number,
  maxAlpha: number,
): number {
  return (maxAlpha * index) / (levels - 1);
}
