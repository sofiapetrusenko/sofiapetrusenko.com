import type { Note } from "./types";

/**
 * Newest first. The home section and the /notes routes both derive from this
 * array, so an empty array simply removes the section and the routes.
 *
 * `body` is markdown. Supported: headings, paragraphs, fenced code and inline
 * `code` — see `parseMarkdown`. Lists, bold and links are not supported yet and
 * would render as literal text.
 */
export const notes = [
  {
    slug: "untrusted-llm-output",
    title: "Treating LLM output as untrusted input",
    teaser:
      "A JSON repair heuristic, born from one unescaped Spanish quote in production.",
    date: "2026-08-07",
    // Placeholder alongside the placeholder body — set this from the real text
    // when it lands.
    readingMinutes: 4,
    body: "Draft in progress.",
  },
] satisfies readonly Note[];

/** Undefined for an unknown slug — callers decide whether that is a 404. */
export function getNote(slug: string): Note | undefined {
  return notes.find((note) => note.slug === slug);
}
