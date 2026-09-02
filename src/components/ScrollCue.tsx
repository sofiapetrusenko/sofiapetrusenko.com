"use client";

import { useEffect, useState } from "react";

/**
 * One of the site's **two chrome-level client boundaries** — CardSpotlight is
 * the other: this one needs the viewport height and the scroll offset, and
 * neither is knowable on the server. Reveal was the second until its
 * IntersectionObserver became a CSS scroll-driven animation, and W4's spotlight
 * took the vacated slot.
 *
 * Charter 12 makes the count normative, so it is stated exactly: `use client`
 * appears in **nine** components. These two, which are part of the page shell on
 * every route that renders them, and seven interactive case-study widgets —
 * BlotquantInspector, Disclosure, GoldRecordInspector, LifespanFunnel,
 * PipelineDiagram, RefusalGrid, SweepExplorer — every one of which is rendered
 * only by `/work/[slug]` and is the content of a case study rather than site
 * chrome. Both numbers are asserted in `Reveal.test.tsx` so neither can drift
 * again; "two" on its own was wrong by seven and had been since before D1.
 *
 * A fade and a chevron pinned to the bottom of the viewport, so a tall screen
 * that shows nothing but the hero still says the page continues. The chevron is
 * a real anchor to the first section, not a decoration with a scroll handler:
 * it works before hydration and is reachable by keyboard.
 *
 * Shown only when the page actually overflows and only while the reader is
 * still at the top. Both start false, so the server renders it hidden and the
 * first effect run reveals it — there is nothing to flash.
 */
export function ScrollCue() {
  const [overflows, setOverflows] = useState(false);
  const [atTop, setAtTop] = useState(false);

  useEffect(() => {
    // 80px of slack: a page that scrolls by less than a chevron's worth of
    // space does not need one.
    const measure = () =>
      setOverflows(
        document.documentElement.scrollHeight > window.innerHeight + 80,
      );

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    let frame = 0;

    // Passive, and coalesced to one read per frame: the listener runs on every
    // scroll event and does nothing but compare a number.
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setAtTop(window.scrollY <= 24);
      });
    };

    // Read once on mount too, so a restored scroll position starts correct.
    // Through the same handler, so the first read lands in the frame callback
    // rather than synchronously in the effect body.
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      className="scroll-cue fixed inset-x-0 bottom-0 z-10 flex justify-center"
      data-visible={overflows && atTop ? "true" : "false"}
    >
      <div
        aria-hidden="true"
        className="scroll-cue__fade pointer-events-none absolute inset-x-0 bottom-0"
      />
      <a
        href="#selected-work"
        className="text-muted hover:text-fg pointer-events-auto relative mb-7 block p-2 transition-colors duration-150 ease-out"
      >
        <span className="sr-only">Skip to selected work</span>
        <svg
          aria-hidden="true"
          className="scroll-cue__chevron"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9.5 6 6 6-6" />
        </svg>
      </a>
    </div>
  );
}
