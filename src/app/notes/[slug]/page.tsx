import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { getNote, labels, notes } from "@/content";
import { Markdown } from "@/components/Markdown";
import { parseMarkdown } from "@/components/markdown-parser";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return notes.map((note) => ({ slug: note.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const note = getNote(slug);
  if (!note) return {};

  return { title: note.title, description: note.teaser };
}

export default async function NotePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const note = getNote(slug);
  if (!note) notFound();

  // Parsed at build time: these routes are prerendered by generateStaticParams.
  const blocks = parseMarkdown(note.body);

  return (
    <div className="mx-auto max-w-3xl px-6 py-24 sm:px-8 sm:py-32">
      <main>
        <header>
          <p className="text-muted font-mono text-xs tracking-wider">
            <time dateTime={note.date}>{note.date}</time> ·{" "}
            {note.readingMinutes} {labels.readingTimeSuffix}
          </p>
          <h1 className="mt-4 max-w-[68ch] text-[clamp(2rem,6vw,3rem)] leading-[1.05] font-semibold tracking-[-0.02em] text-balance">
            {note.title}
          </h1>
          <p className="text-muted mt-5 max-w-[68ch] text-lg leading-snug">
            {note.teaser}
          </p>
        </header>

        <div className="border-hairline mt-12 border-t pt-10">
          <Markdown blocks={blocks} />
        </div>
      </main>

      <footer className="border-hairline mt-32 border-t pt-10 sm:mt-40">
        <NextLink
          href="/"
          className="link-underline text-accent font-mono text-sm"
        >
          {labels.backToHome}
        </NextLink>
      </footer>
    </div>
  );
}
