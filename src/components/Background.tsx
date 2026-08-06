import { labels, roles } from "@/content";
import { Section } from "./Section";

/**
 * A left hairline rail carries the timeline — the separation is the 1px border
 * and the spacing, with no markers or connectors drawn on top of it.
 */
export function Background() {
  return (
    <Section title={labels.background}>
      <ol className="border-hairline flex flex-col gap-10 border-l pl-6">
        {roles.map((role) => (
          <li key={`${role.org}-${role.period}`}>
            <p className="text-muted font-mono text-xs">{role.period}</p>
            <h3 className="mt-2 font-medium">{role.title}</h3>
            <p className="text-muted mt-1 text-sm">
              {role.org} · {role.location}
            </p>
            <p className="text-muted mt-3 max-w-[68ch] text-sm leading-relaxed">
              {role.summary}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
