/**
 * The faint tint behind a page title. One per page, anchored to the top of the
 * nearest positioned ancestor — put it inside the page header, not per section.
 *
 * Geometry, colour and the contrast reasoning live in `globals.css` under
 * `.page-glow`. It reuses the same two tokens and the same 10% opacity the home
 * page has always used; nothing here is brighter than that, and it paints
 * behind everything with no pointer target of its own.
 */
export function PageGlow({
  /**
   * Slowly drift the two glows. Off everywhere but the home page hero: movement
   * suits a landing page and competes with a chart someone is reading numbers
   * off. The animation is declared under `prefers-reduced-motion:
   * no-preference`, so asking for less motion leaves the glow static rather
   * than removing it.
   */
  drift = false,
}: {
  drift?: boolean;
} = {}) {
  return (
    <div
      aria-hidden="true"
      className={drift ? "page-glow page-glow--drift" : "page-glow"}
    />
  );
}
