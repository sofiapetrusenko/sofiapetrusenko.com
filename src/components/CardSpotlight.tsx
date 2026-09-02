"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The project card list, with a light that follows the pointer along the border
 * of the card under it. The appearance is entirely CSS (`.spotlight-card` in
 * `globals.css`); this file does one thing, which is to tell the stylesheet
 * where the pointer is.
 *
 * One of the site's two chrome-level client boundaries — ScrollCue is the
 * other, and `ScrollCue.tsx` carries the full count charter 12 requires: nine
 * `use client` components, these two plus seven case-study widgets under
 * `/work/[slug]`. A server
 * component cannot do this: the pointer position exists only in the browser,
 * only after the page is interactive, and changes many times a second, so there
 * is no value the server could render and nothing it could put in the HTML. It
 * takes its children as a slot, so ProjectCard and everything inside it stays a
 * server component and only this wrapper ships JS. It renders the <ul> the
 * cards were already in rather than a <div> around it, so the boundary costs no
 * DOM node either.
 *
 * Nothing here is content or affordance (rule 11): without JS, before
 * hydration, and on every touch device, the list is the same <ul> of the same
 * server-rendered cards, with the hover treatment ProjectCard has always
 * carried. The two custom properties are the whole of what this component does.
 *
 * Gated on `(hover: hover) and (pointer: fine)` in JS as well as in CSS. The
 * stylesheet gate alone would leave a phone running a pointermove handler every
 * frame of every scroll-drag to write properties no rule reads; this way a
 * touch device attaches no listener at all. `change` is watched because the
 * answer is not fixed for the life of the page — a tablet with a mouse plugged
 * in flips it — and rebinding costs one listener against a media query that
 * fires approximately never.
 *
 * Keyboard (rule 10): a tabbed-to card gets the global :focus-visible ring and
 * the card's existing hover affordances, and no spotlight. This is a deliberate
 * asymmetry rather than an oversight. `.link-underline`'s precedent is that a
 * hover affordance must also fire on :focus-visible, and it applies to anything
 * a keyboard user could otherwise be denied — but a spotlight is a *position*,
 * and a keyboard user has no pointer to position it with. Firing it at some
 * invented coordinate would light a part of the border that means nothing.
 * Keyboard users are given nothing less than they have today; they are simply
 * not given a readout of a device they are not using.
 */
export function CardSpotlight({ children }: { children: ReactNode }) {
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = list.current;
    if (!el) return;

    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let release: (() => void) | undefined;

    const bind = () => {
      if (release) return;

      // Card border-box origins in *document* coordinates, keyed by the card
      // element. Measured lazily — nothing is read until a pointer actually
      // moves over the list, which is also well after webfonts have settled —
      // and then reused, so no frame ever reads geometry.
      let origins: WeakMap<Element, readonly [number, number]> | null = null;
      let frame = 0;
      let card: Element | null = null;
      let pageX = 0;
      let pageY = 0;

      const measure = () => {
        const map = new WeakMap<Element, readonly [number, number]>();
        for (const child of Array.from(el.children)) {
          const box = child.getBoundingClientRect();
          map.set(child, [box.left + window.scrollX, box.top + window.scrollY]);
        }
        return map;
      };

      // Document coordinates, not viewport coordinates, is what keeps this
      // correct while the reader scrolls: `pageX`/`pageY` already carry the
      // scroll offset, and an origin measured as `rect.left + scrollX` carries
      // the same one, so the difference is scroll-invariant and scrolling
      // invalidates nothing. Only a relayout can move a card within the
      // document, and `resize` is the event that follows the ones a reader can
      // cause.
      const paint = () => {
        frame = 0;
        origins ??= measure();
        const origin = card ? origins.get(card) : undefined;
        if (!origin) return;

        // Written once, to the list, rather than to each of the cards: custom
        // properties inherit, and only the hovered card's rule reads them (the
        // others are at opacity 0), so one write lights exactly one card. The
        // values are relative to that card's own border box, which is the box
        // the gradient is painted in.
        el.style.setProperty("--spotlight-x", `${pageX - origin[0]}px`);
        el.style.setProperty("--spotlight-y", `${pageY - origin[1]}px`);
      };

      // Passive, and coalesced to one write per frame — the same shape
      // ScrollCue uses for scroll. The handler itself only stores three numbers
      // and walks up to the card; everything that touches the DOM happens in
      // the frame callback.
      const onMove = (event: PointerEvent) => {
        card = (event.target as Element | null)?.closest("li") ?? null;
        pageX = event.pageX;
        pageY = event.pageY;
        if (frame) return;
        frame = window.requestAnimationFrame(paint);
      };

      // Dropped, not recomputed: measuring here would read layout during a
      // resize, and the next frame that needs it will rebuild it anyway.
      const invalidate = () => {
        origins = null;
      };

      // No pointerleave counterpart, deliberately: the last position stays
      // written and is simply never read, because the rule that reads it is
      // `:hover` and there is nothing hovered.
      el.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("resize", invalidate, { passive: true });

      release = () => {
        el.removeEventListener("pointermove", onMove);
        window.removeEventListener("resize", invalidate);
        if (frame) window.cancelAnimationFrame(frame);
      };
    };

    const unbind = () => {
      release?.();
      release = undefined;
    };

    const retest = () => (pointer.matches ? bind() : unbind());

    retest();
    pointer.addEventListener("change", retest);
    return () => {
      pointer.removeEventListener("change", retest);
      unbind();
    };
  }, []);

  return (
    <ul ref={list} className="flex flex-col gap-5">
      {children}
    </ul>
  );
}
