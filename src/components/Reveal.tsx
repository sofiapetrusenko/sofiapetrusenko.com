"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * One of the site's two client components — ScrollCue is the other:
 * IntersectionObserver is a browser API, so this needs a client boundary. It
 * takes its children as a slot, which keeps everything inside it a server
 * component — only this wrapper ships JS.
 *
 * Reveals once and disconnects. If the user prefers reduced motion the observer
 * is never created, and the CSS hidden state does not exist for them either.
 */
export function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // Never leave content stuck at opacity 0 if the API is missing.
    if (typeof IntersectionObserver === "undefined") {
      element.dataset.reveal = "shown";
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          element.dataset.reveal = "shown";
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-reveal="">
      {children}
    </div>
  );
}
