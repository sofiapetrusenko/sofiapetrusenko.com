import { education, isCurrentRole, labels, roles } from "@/content";
import { Section } from "./Section";

/**
 * Node colour encodes what kind of entry it is: accent for engineering, a
 * low-tinted ok for research, neutral for a degree. The rail is a 2px border on
 * the list; each node is centred on it with a negative translate.
 */
const NODE_COLOR = {
  engineering: "var(--color-accent)",
  research: "color-mix(in srgb, var(--color-ok) 55%, transparent)",
  education: "var(--color-muted)",
} as const;

function Node({
  kind,
  pulsing = false,
}: {
  kind: keyof typeof NODE_COLOR;
  pulsing?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className="absolute top-1 left-0 block -translate-x-1/2"
    >
      {/* Ring animates opacity only, so nothing reflows while it breathes. */}
      {pulsing && (
        <span
          className="timeline-pulse absolute -inset-1.5 rounded-full border-2"
          style={{ borderColor: NODE_COLOR[kind] }}
        />
      )}
      <span
        className="block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: NODE_COLOR[kind] }}
      />
    </span>
  );
}

/** Period on the left, country on the right, both mono, one line. */
function MetaRow({ period, country }: { period?: string; country: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-muted font-mono text-xs tracking-wider">
        {period ?? ""}
      </p>
      <p className="border-hairline text-muted shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[0.625rem] tracking-wider">
        {country}
      </p>
    </div>
  );
}

export function Background() {
  return (
    <Section title={labels.background}>
      {/*
        Padding sits on each item, not the list: the nodes are positioned from
        the item's left edge, so that edge has to be the rail itself.
      */}
      <ol className="border-hairline flex flex-col gap-11 border-l-2">
        {roles.map((role) => (
          <li
            key={`${role.org}-${role.period}`}
            className="relative pl-6 sm:pl-8"
          >
            <Node kind={role.kind} pulsing={isCurrentRole(role)} />
            <MetaRow period={role.period} country={role.country} />
            <h3 className="mt-2 text-lg font-medium tracking-tight">
              {role.title}
            </h3>
            <p className="text-muted mt-1 text-sm">{role.org}</p>
            <p className="text-muted mt-3 max-w-[68ch] text-sm leading-relaxed">
              {role.summary}
            </p>
          </li>
        ))}

        {/* Degrees: same rail, compact type, no summaries. */}
        {education.map((entry) => (
          <li key={entry.id} className="relative pl-6 sm:pl-8">
            <Node kind="education" />
            <MetaRow country={entry.country} />
            <h3 className="mt-2 text-sm font-medium tracking-tight">
              {entry.degree}
            </h3>
            <p className="text-muted mt-1 text-sm">{entry.institution}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
