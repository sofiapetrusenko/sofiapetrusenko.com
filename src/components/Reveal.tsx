import type { ReactNode } from "react";

/**
 * Scroll reveal wrapper. A server component: the reveal is a CSS scroll-driven
 * animation on `[data-reveal]` (see `globals.css`), so there is no browser API
 * to call and nothing here needs a client boundary. This file used to be a
 * client component; the two chrome-level boundaries that remain are ScrollCue
 * and CardSpotlight. Site-wide the count charter 12 makes normative is **nine**
 * `use client` components — those two plus the seven interactive case-study
 * widgets rendered only by `/work/[slug]`. `ScrollCue.tsx` names them; the last
 * two tests in `Reveal.test.tsx` assert both numbers, because "two client
 * components" was written here at baseline, was wrong by seven, and survived
 * 182 passing tests.
 *
 * The attribute is kept rather than swapped for a class because it no longer
 * carries state: the observer used to flip it to "shown", and nothing writes it
 * now. What is left is a pure presentation hook with no utility-class meaning
 * of its own, under the name the charter's rules 3 and 16 already cite. The
 * selector in `globals.css` matches exactly this bare attribute.
 *
 * One element, and deliberately still one. The reveal is a 3D transform, and the
 * obvious way to give a rotation its perspective is a `perspective` property on
 * a parent — which here would mean a second, empty node inside every Reveal.
 * `globals.css` uses `perspective()` as a transform function on this element
 * instead, so the depth costs no DOM. Anything added around these children is a
 * node on every section of every page; it has to earn that.
 *
 * It takes its children as a slot, so nothing inside it is dragged across any
 * boundary and the wrapper adds no JS of its own. Without JavaScript — and in
 * any browser without `animation-timeline`, and for a reader who asked for less
 * motion — the children simply render where they were laid out. There is no
 * hidden state left to fall back from: D1 cycle 2 removed the fade, and what
 * the guards in `globals.css` now guard is a 12px rise and a 3deg lean, not
 * whether anything is painted. `globals.css` carries the proof that a
 * scroll-driven opacity could not have stayed.
 */
export function Reveal({ children }: { children: ReactNode }) {
  return <div data-reveal="">{children}</div>;
}
