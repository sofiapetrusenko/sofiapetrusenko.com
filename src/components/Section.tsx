import type { ReactNode } from "react";

/**
 * Small, wide-tracked, muted — reads as a waypoint, not as content. Shared so
 * every label on the site sits at exactly the same step in the hierarchy.
 */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-muted mb-10 flex items-center gap-3 font-mono text-[0.6875rem] tracking-[0.22em] uppercase">
      <span aria-hidden="true" className="bg-accent block h-px w-4" />
      {children}
    </h2>
  );
}

/**
 * `id` is optional and only set where something links to the section — the
 * scroll cue's chevron. `scroll-mt-8` costs nothing without an anchor and keeps
 * a jump from landing flush against the top of the viewport.
 */
export function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="border-hairline scroll-mt-8 border-t pt-10">
      <SectionLabel>{title}</SectionLabel>
      {children}
    </section>
  );
}
