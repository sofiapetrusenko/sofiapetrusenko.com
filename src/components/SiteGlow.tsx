/**
 * Soft radial tints distributed down every page, in the same form as the hero
 * glow (`PageGlow`): 10% opacity, `closest-side` radial gradients, one surface
 * of colour and no shadows or blur. CSS only — a server component that renders
 * fixed markup, so it ships no JS — and static: they do not drift.
 *
 * Geometry is what keeps the contrast bound: blobs start at 64rem, below the
 * reach of the hero glow and its parallax, and are 36rem apart while at most
 * 26rem tall, so no two tints ever overlap — every point on the page sits under
 * at most one of these or the hero's pair, never both. The arithmetic is under
 * `.site-glow` in `globals.css`.
 */

const HUES = ["accent", "ok", "mix"] as const;
/** Enough to cover the longest page at phone width; the container clips the rest. */
const COUNT = 24;

export function SiteGlow() {
  return (
    <div aria-hidden="true" className="site-glow">
      {Array.from({ length: COUNT }, (_, i) => (
        <span
          key={i}
          className={`site-glow__blob site-glow__blob--${HUES[i % HUES.length]} site-glow__blob--${i % 2 === 0 ? "left" : "right"}`}
          style={{ top: `calc(64rem + ${i} * 36rem)` }}
        />
      ))}
    </div>
  );
}
