import type { ReactNode } from "react";

/**
 * Small, wide-tracked, muted — reads as a waypoint, not as content. Shared so
 * every label on the site sits at exactly the same step in the hierarchy.
 */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-muted mb-10 font-mono text-[0.6875rem] tracking-[0.22em] uppercase">
      {children}
    </h2>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-hairline border-t pt-10">
      <SectionLabel>{title}</SectionLabel>
      {children}
    </section>
  );
}
