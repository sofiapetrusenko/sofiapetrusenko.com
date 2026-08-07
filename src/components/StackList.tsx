import { stackCategory, type StackCategory } from "@/content";

/**
 * Chip tint encodes what kind of thing the entry is, not decoration. Text stays
 * foreground in every category so the category never costs legibility, and an
 * unclassified entry falls back to the neutral hairline chip.
 */
const CATEGORY_COLOR: Readonly<Record<StackCategory, string>> = {
  language: "var(--color-accent)",
  infra: "var(--color-ok)",
  media: "var(--color-gate)",
};

/** Wraps rather than scrolls, so long stacks stay readable at 360px. */
export function StackList({ stack }: { stack: readonly string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {stack.map((entry) => {
        const category = stackCategory(entry);
        const color = category === null ? null : CATEGORY_COLOR[category];

        return (
          <li
            key={entry}
            className="text-fg rounded-sm border px-2.5 py-1 font-mono text-xs transition-colors duration-150 ease-out"
            style={
              color === null
                ? { borderColor: "var(--color-hairline)" }
                : {
                    borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
                    backgroundColor: `color-mix(in srgb, ${color} 7%, transparent)`,
                  }
            }
          >
            {entry}
          </li>
        );
      })}
    </ul>
  );
}
