import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { getProject, labels, projects } from "@/content";
import { LinkList } from "@/components/LinkList";
import { Reveal } from "@/components/Reveal";
import { SectionLabel } from "@/components/Section";
import { StackList } from "@/components/StackList";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};

  return { title: project.name, description: project.tagline };
}

/** A labelled prose block. Rendered only when there is something to show. */
function Field({ label, body }: { label: string; body: string }) {
  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      <p className="max-w-[68ch] text-lg leading-relaxed">{body}</p>
    </section>
  );
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-24 sm:px-8 sm:py-32">
      <main className="flex flex-col gap-24 sm:gap-28">
        <header>
          <p className="text-muted font-mono text-xs tracking-wider">
            {project.year}
          </p>
          <h1 className="mt-4 text-[clamp(2.25rem,7vw,3.5rem)] leading-[0.98] font-semibold tracking-[-0.02em] text-balance">
            {project.name}
          </h1>
          <p className="text-muted mt-6 max-w-[68ch] text-[clamp(1.125rem,2.5vw,1.375rem)] leading-snug text-balance">
            {project.tagline}
          </p>
        </header>

        <Reveal>
          <Field label={labels.problem} body={project.problem} />
        </Reveal>
        <Reveal>
          <Field label={labels.approach} body={project.approach} />
        </Reveal>

        <Reveal>
          <section>
            <SectionLabel>{labels.stack}</SectionLabel>
            <StackList stack={project.stack} />
          </section>
        </Reveal>

        {project.links.length > 0 && (
          <Reveal>
            <section>
              <SectionLabel>{labels.links}</SectionLabel>
              <LinkList links={project.links} />
            </section>
          </Reveal>
        )}
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
