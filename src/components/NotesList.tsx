import NextLink from "next/link";
import { labels, notes, type Note } from "@/content";
import { Section } from "./Section";

/** Same card language as the project cards, one step quieter. */
function NoteCard({ note }: { note: Note }) {
  return (
    <li className="group border-hairline hover:border-hairline-bright hover:bg-surface relative cursor-pointer border p-6 transition-colors duration-[175ms] ease-out sm:p-7">
      <span
        aria-hidden="true"
        className="bg-accent absolute inset-y-0 left-0 w-0.5 origin-top scale-y-0 transition-transform duration-[175ms] ease-out group-hover:scale-y-100"
      />

      <h3 className="text-accent text-lg leading-snug font-medium tracking-tight">
        <NextLink
          href={`/notes/${note.slug}`}
          className="after:absolute after:inset-0"
        >
          {note.title}
        </NextLink>
      </h3>
      <p className="text-muted mt-2 max-w-[68ch] text-sm leading-relaxed">
        {note.teaser}
      </p>
      <p className="text-muted mt-4 font-mono text-xs tracking-wider">
        <time dateTime={note.date}>{note.date}</time> · {note.readingMinutes}{" "}
        {labels.readingTimeSuffix}
      </p>
    </li>
  );
}

/** Renders nothing at all when there are no notes yet. */
export function NotesList() {
  if (notes.length === 0) return null;

  return (
    <Section title={labels.notes}>
      <ul className="flex flex-col gap-5">
        {notes.map((note) => (
          <NoteCard key={note.slug} note={note} />
        ))}
      </ul>
    </Section>
  );
}
