/**
 * The faint tint behind a page title. One per page, anchored to the top of the
 * nearest positioned ancestor — put it inside the page header, not per section.
 *
 * Geometry, colour and the contrast reasoning live in `globals.css` under
 * `.page-glow`. It reuses the same two tokens and the same 10% opacity the home
 * page has always used; nothing here is brighter than that, and it paints
 * behind everything with no pointer target of its own.
 */
export function PageGlow() {
  return <div aria-hidden="true" className="page-glow" />;
}
