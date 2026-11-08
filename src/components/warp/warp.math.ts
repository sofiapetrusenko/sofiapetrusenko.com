/**
 * The pure half of the hero warp: everything `warp.worker.ts` needs to decide
 * where a glyph is, how bright, and whether it may be drawn at all, with no
 * canvas, DOM or clock in sight. Kept apart so it can be unit tested.
 *
 * Units: page and viewport positions are CSS px. World coordinates are the
 * camera's: `x`, `y` across the view, `z` the distance ahead, in (0, 1]. A
 * glyph at depth `z` projects to `centre + (x / z) * focal`.
 *
 * The scroll mapping mirrors the stylesheet exactly. The hero scene's
 * `contain` view-timeline range runs from the scene's top meeting the viewport
 * top to its bottom meeting the viewport bottom, which is `heroProgress`
 * below, and every `animation-range` in `.hero-*` is a fraction of it:
 * `LETTERS`, `LIFT` and `CALM` here are those same fractions.
 */

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Smoothstep on [0, 1]. */
export function ease(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

/** Linear progress of `p` through the range [from, to]. */
export function through(p: number, from: number, to: number): number {
  return clamp01((p - from) / (to - from));
}

/**
 * Where the name's letters leave: `.hero-letter`'s range before its per-letter
 * delay, which adds up to 0.12 to both ends.
 */
export const LETTERS = { from: 0.1, to: 0.38, maxDelay: 0.12 } as const;
/** Where the headline and everything under it rise into the name's place: `.hero-lift`. */
export const LIFT = { from: 0.25, to: 0.55 } as const;
/** Where the field drops out of warp and fades, handing back to the site field. */
export const CALM = { from: 0.62, to: 1 } as const;
/** The name stops shielding the field once its letters are well on their way. */
export const NAME_QUIET_UNTIL = 0.2;

/** The lift as a multiple of the name's font size: two lines at 0.92 leading, 90% of it. */
export const LIFT_EM = 2 * 0.92 * 0.9;

/**
 * Progress through the hero scene, 0 at rest to 1 when it releases. A scene no
 * taller than the viewport has no scroll to map, and reads as finished, so
 * the warp never starts where the stylesheet did not stretch the scene.
 */
export function heroProgress(
  scrollY: number,
  sceneTop: number,
  sceneHeight: number,
  viewportHeight: number,
): number {
  const span = sceneHeight - viewportHeight;
  return span > 0 ? clamp01((scrollY - sceneTop) / span) : 1;
}

/**
 * Viewport y of the sticky stage's top: in flow until it reaches its sticky
 * offset `stick`, held there while the scene lasts, then carried off with the
 * scene's end.
 */
export function stageTop(
  scrollY: number,
  sceneTop: number,
  sceneHeight: number,
  stageHeight: number,
  stick = 0,
): number {
  return Math.min(
    Math.max(sceneTop - scrollY, stick),
    sceneTop + sceneHeight - stageHeight - scrollY,
  );
}

/** 0 inside the hero, 1 once it has been scrolled past. */
export function calmAt(p: number): number {
  return ease(through(p, CALM.from, CALM.to));
}

/**
 * Camera speed, depth units per second. A slow idle drift (half of it gone once
 * calm), plus the reader's scroll velocity in viewports per second, which the
 * dissolve multiplies: scrolling through the name is the jump to warp.
 */
export function cameraSpeed(p: number, scrollVelocity: number): number {
  const jump = 1 + 2.8 * Math.exp(-(((p - 0.38) / 0.16) ** 2));
  return 0.06 - 0.03 * calmAt(p) + scrollVelocity * 0.55 * jump;
}

/** Above this speed each glyph also draws its trail. */
export const STREAK_SPEED = 0.16;

/**
 * Alpha from depth alone: far glyphs faint, mid-depth brightest, and the
 * nearest fade out before they grow large enough to crowd the page.
 */
export function depthAlpha(z: number): number {
  return clamp01((1 - z) / 0.55) * clamp01((z - 0.05) / 0.18);
}

/** The brightest any glyph is drawn, at full warp. */
export const PEAK_ALPHA = 0.62;
/** On-screen glyph size in CSS px for depth `z`; word pieces a little smaller. */
export function glyphSize(z: number, piece: boolean): number {
  return Math.min(48, (piece ? 4.4 : 5.5) / z);
}

export type Rect = { x: number; y: number; w: number; h: number };

/** Padding around every shielded text box, CSS px: absorbs a frame of lag. */
export const QUIET_PAD = 12;

/**
 * The text boxes the field must leave empty, in viewport px, at progress `p`.
 * `name` and `lift` are stage-local layout boxes measured at rest; the lift
 * boxes rise by the same amount the stylesheet moves them, and the name box
 * stops counting once its letters have left.
 */
export function quietRects(
  p: number,
  stageX: number,
  stageY: number,
  name: Rect | null,
  lift: readonly Rect[],
  liftPx: number,
): Rect[] {
  const out: Rect[] = [];
  const pad = (r: Rect, dy: number): Rect => ({
    x: stageX + r.x - QUIET_PAD,
    y: stageY + r.y - dy - QUIET_PAD,
    w: r.w + 2 * QUIET_PAD,
    h: r.h + 2 * QUIET_PAD,
  });
  if (name && p < NAME_QUIET_UNTIL) out.push(pad(name, 0));
  const dy = liftPx * through(p, LIFT.from, LIFT.to);
  for (const r of lift) out.push(pad(r, dy));
  return out;
}

/** Whether point (`x`, `y`) falls inside any of `rects`. */
export function inAny(x: number, y: number, rects: readonly Rect[]): boolean {
  for (const r of rects) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
  }
  return false;
}

/**
 * Glyphs: single characters, plus subword pieces of the site's own vocabulary,
 * cut the way a tokenizer would cut them.
 */
export const CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const PIECES = [
  "auto",
  "phagy",
  "prote",
  "ostasis",
  "sen",
  "escence",
  "long",
  "evity",
  "age",
  "ing",
  "LLM",
  "infer",
  "ence",
  "rout",
  "token",
  "▁model",
  "▁the",
  "orch",
  "estr",
  "ation",
  "yeast",
  "mTOR",
  "ATG",
  "{}",
  "=>",
  "0x1f",
  "λ",
  "Σ",
  "∂",
  "→",
  "≈",
  "</s>",
  "[CLS]",
] as const;

/** Every atlas entry, characters first, then pieces. */
export const ENTRIES: readonly string[] = [...CHARS, ...PIECES];
/** Share of glyphs that are word pieces rather than single characters. */
export const PIECE_SHARE = 0.14;

/** Colour slots, in atlas row order. */
export const TONES = ["muted", "fg", "accent", "ok"] as const;
export type Tone = (typeof TONES)[number];

/** Tone for a uniform draw `r` in [0, 1): mostly muted, a few lit. */
export function toneFor(r: number): Tone {
  return r < 0.1 ? "accent" : r < 0.17 ? "ok" : r < 0.25 ? "fg" : "muted";
}
