/**
 * The pure half of the site-wide character field: everything `AsciiField.tsx`
 * needs to decide how bright a cell is, with no canvas, DOM or clock in sight.
 * Kept apart so it can be unit tested and so the component is left with
 * nothing but scheduling and drawing.
 *
 * Units: the ambient field and the column mask take *page* CSS pixels (the
 * viewport position plus `scrollY`), so bright regions travel with the content
 * while the glyph grid itself stays fixed to the viewport. Ripples take cell
 * offsets measured in cell *widths* on both axes once `aspect` (cell height /
 * cell width) is applied to the vertical one, so a ring is a circle on screen.
 * Time is in seconds.
 */

export const GLYPHS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Vertical distance between blob centres down the page, CSS px. */
export const FIELD_PERIOD = 960;
/** Blob radius (the 1/e distance), CSS px. */
const BLOB_RADIUS = 380;

/**
 * Ambient brightness in [0, 1] at page position (`x`, `y`) and time `t`, for a
 * viewport `width` wide. One soft blob per `FIELD_PERIOD` of page height,
 * alternating sides and drifting on incommensurate sines so it never visibly
 * loops, over a low-frequency sine lattice that keeps the rest of the field
 * from going flat. The blobs of the neighbouring periods are summed in too, so
 * nothing is discontinuous at a period boundary.
 */
export function fieldValue(
  x: number,
  y: number,
  t: number,
  width: number,
): number {
  const k = Math.floor(y / FIELD_PERIOD);
  let blob = 0;
  for (let j = k - 1; j <= k + 1; j++) {
    const side = j % 2 === 0 ? 0.28 : 0.72;
    const cx = width * (side + 0.16 * Math.sin(t * 0.11 + j * 1.7));
    const cy =
      FIELD_PERIOD * (j + 0.5 + 0.22 * Math.sin(t * 0.083 + 1.3 + j * 0.9));
    const dx = (x - cx) / BLOB_RADIUS;
    const dy = (y - cy) / BLOB_RADIUS;
    blob += Math.exp(-(dx * dx + dy * dy));
  }
  const noise =
    0.5 +
    0.5 *
      Math.sin(x * 0.0061 + t * 0.35) *
      Math.sin(y * 0.0047 - t * 0.27 + 0.8);
  return clamp01(0.62 * Math.min(blob, 1) + 0.38 * noise);
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
 * Absolute glyph alpha ceilings. `COLUMN_CAP` is the most any glyph may reach
 * anywhere text can sit — ambient and ripple peak together — and is the number
 * the contrast bound in `globals.css` (`.ascii-field`) is derived for.
 * `GUTTER_CAP` applies only outside the content column, where there is no text.
 */
export const COLUMN_CAP = 0.04;
export const GUTTER_CAP = 0.6;

/** The feather spans this share of the gutter, measured out from the column… */
export const FEATHER_SHARE = 0.7;
/** …but never less than this, CSS px, so a narrow gutter still fades softly. */
export const MIN_FEATHER = 160;
/**
 * Gutter width at which the peak reaches `GUTTER_CAP`. Narrower gutters get a
 * proportionally lower peak, so a 1024px window's 160px gutter is a soft
 * margin rather than a thin bright strip. 368px is the gutter beside the
 * 704px column at 1440px.
 */
export const GUTTER_REF = 368;
/** How far the edge wanders outward, CSS px. */
export const EDGE_WOBBLE = 50;

export type GutterProfile = { feather: number; peak: number };

/** Feather width and peak ceiling for a gutter `width` px wide. */
export function gutterProfile(width: number): GutterProfile {
  return {
    feather: Math.max(MIN_FEATHER, FEATHER_SHARE * width),
    peak: COLUMN_CAP + (GUTTER_CAP - COLUMN_CAP) * clamp01(width / GUTTER_REF),
  };
}

/**
 * How far, in [0, `EDGE_WOBBLE`] px, the start of the feather is pushed out
 * from the column edge at page height `y` and time `t`. Two low-frequency
 * sines along y (wavelengths ~1.5k and ~4.8k px), drifting slowly in time, with
 * a phase per `side` (0 left, 1 right) so the two edges don't mirror each other.
 *
 * Never negative, deliberately: the wobble only moves the edge *away* from the
 * column, so it can never raise the ceiling over the column — the contrast
 * bound depends on that, not on where the wobble happens to be in a frame.
 */
export function edgeOffset(y: number, t: number, side: 0 | 1): number {
  const p = side * 2.1;
  const n =
    0.6 * Math.sin(y * 0.0041 + t * 0.13 + p) +
    0.4 * Math.sin(y * 0.0013 - t * 0.07 + 2 * p);
  return EDGE_WOBBLE * (0.5 + 0.5 * n);
}

/**
 * Alpha ceiling for a cell `out` px outside the content column (≤ 0 means
 * inside, or touching it), after any edge offset has been subtracted:
 * `COLUMN_CAP` inside, rising on a smoothstep — ease-in-out, no hard wall —
 * across `profile.feather` to `profile.peak`. Horizontal only by design: the
 * column is fixed horizontally whatever the scroll does, so the ceiling under
 * any text cannot lag a frame behind a fast scroll the way a vertical band
 * would.
 */
export function alphaCap(out: number, profile: GutterProfile): number {
  if (!(out > 0)) return COLUMN_CAP;
  const s = clamp01(out / profile.feather);
  const smooth = s * s * (3 - 2 * s);
  return COLUMN_CAP + (profile.peak - COLUMN_CAP) * smooth;
}

/**
 * The alpha each bucket is painted at, ascending. Bucket 0 is "not drawn".
 * Four steps up to `COLUMN_CAP` give the column its texture — the ambient field
 * reaches the middle ones, ripples the top — and five more reach the gutters'
 * peak. `COLUMN_CAP` is itself a level, so a column cell at its
 * ceiling is painted at exactly the bound, never above it.
 */
export const ALPHA_LEVELS: readonly number[] = [
  0,
  COLUMN_CAP * 0.3,
  COLUMN_CAP * 0.5,
  COLUMN_CAP * 0.75,
  COLUMN_CAP,
  0.08,
  0.15,
  0.25,
  0.4,
  GUTTER_CAP,
];

/**
 * Bucket for an absolute alpha: the highest level that does not exceed it.
 * Rounding down is the safety property — quantising can dim a glyph, never
 * brighten it past its ceiling. NaN and negatives land in bucket 0.
 */
export function bucketIndex(
  alpha: number,
  levels: readonly number[] = ALPHA_LEVELS,
): number {
  if (!(alpha > 0)) return 0;
  let i = levels.length - 1;
  while (i > 0 && levels[i]! > alpha) i--;
  return i;
}
