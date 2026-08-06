import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { getProject, labels, projects } from "@/content";
import { LinkList } from "@/components/LinkList";
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
      <h2 className="text-muted mb-3 font-mono text-xs tracking-widest uppercase">
        {label}
      </h2>
      <p className="max-w-[68ch] leading-relaxed">{body}</p>
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
    <div className="mx-auto max-w-3xl px-6 py-16 sm:px-8 sm:py-24">
      <main className="flex flex-col gap-16">
        <header>
          <p className="text-muted font-mono text-xs">{project.year}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {project.name}
          </h1>
          <p className="mt-4 max-w-[68ch] text-lg text-balance">
            {project.tagline}
          </p>
        </header>

        <Field label={labels.problem} body={project.problem} />
        <Field label={labels.approach} body={project.approach} />

        <section>
          <h2 className="text-muted mb-3 font-mono text-xs tracking-widest uppercase">
            {labels.stack}
          </h2>
          <StackList stack={project.stack} />
        </section>

        {project.links.length > 0 && (
          <section>
            <h2 className="text-muted mb-3 font-mono text-xs tracking-widest uppercase">
              {labels.links}
            </h2>
            <LinkList links={project.links} />
          </section>
        )}
      </main>

      <footer className="border-hairline mt-20 border-t pt-8">
        <NextLink
          href="/"
          className="text-accent decoration-accent/40 hover:decoration-accent font-mono text-sm underline underline-offset-4"
        >
          {labels.backToHome}
        </NextLink>
      </footer>
    </div>
  );
}
