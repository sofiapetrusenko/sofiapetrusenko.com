import type { ReactNode } from "react";

/**
 * A titled section. The heading is a mono label rather than large display type:
 * the content is the signal, the section name is only a waypoint.
 */
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-hairline border-t pt-8">
      <h2 className="text-muted mb-8 font-mono text-xs tracking-widest uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}
