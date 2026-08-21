import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import {
  blotquantMetrics,
  detectionRow,
  getProject,
  intensitySubset,
  labels,
  lifespanMetrics,
  pipelineStages,
  projects,
  type Project,
} from "@/content";
import { BlotquantInspector } from "@/components/BlotquantInspector";
import { Disclosure } from "@/components/Disclosure";
import { GoldRecordInspector } from "@/components/GoldRecordInspector";
import { LifespanFunnel } from "@/components/LifespanFunnel";
import { LinkList } from "@/components/LinkList";
import { PipelineDiagram } from "@/components/PipelineDiagram";
import { QcEffectChart } from "@/components/QcEffectChart";
import { RefusalGrid } from "@/components/RefusalGrid";
import { Reveal } from "@/components/Reveal";
import { SectionLabel } from "@/components/Section";
import { StackList } from "@/components/StackList";
import { StatStrip, type Stat } from "@/components/StatStrip";
import { SweepExplorer } from "@/components/SweepExplorer";
import { SweepFindings } from "@/components/SweepFindings";

/** Only this project has a pipeline to show. */
const PIPELINE_SLUG = "media-automation-platform";

const SLUG = {
  blotquant: "blotquant",
  lifespanExtract: "lifespan-extract",
} as const;

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

/**
 * The measured figures under each title. Every value is read from the generated
 * metric files, so a number here can be traced to a JSON key and, through it,
 * to a file in the origin repository.
 */
function statsFor(slug: string): readonly Stat[] {
  if (slug === SLUG.blotquant) {
    const band = detectionRow(blotquantMetrics, "band");
    const clean = intensitySubset(
      blotquantMetrics,
      blotquantMetrics.intensity_recovery.length - 1,
    );
    const run = blotquantMetrics.real_data_run;

    return [
      { value: String(band.f1), label: "band detection F1" },
      {
        value: `${clean.mean_absolute_percent}%`,
        label: "mean error, clean bands",
      },
      { value: String(blotquantMetrics.tests.collected), label: "tests in CI" },
      {
        value: `${run.produced} of ${run.crops}`,
        label: "real crops measured",
        flagged: true,
      },
    ];
  }

  if (slug === SLUG.lifespanExtract) {
    return [
      { value: String(lifespanMetrics.gold.records), label: "gold records" },
      { value: String(lifespanMetrics.gold.papers), label: "papers labeled" },
      {
        value: String(lifespanMetrics.negatives.total),
        label: "hard negatives",
      },
      { value: String(lifespanMetrics.tests.collected), label: "tests in CI" },
      { value: lifespanMetrics.gold.schema_version, label: "schema version" },
    ];
  }

  return [];
}

/**
 * One prose block. Where the content layer carries a summary for this block the
 * long-form text goes behind a toggle; otherwise it renders as it always has.
 *
 * The prose itself is unchanged either way — collapsing hides it, and never
 * shortens or rewrites it.
 */
function Field({
  id,
  label,
  body,
  summary,
  defaultOpen,
}: {
  id: string;
  label: string;
  body: string;
  summary?: string;
  defaultOpen?: boolean;
}) {
  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      {summary === undefined ? (
        <p className="max-w-[68ch] text-lg leading-relaxed">{body}</p>
      ) : (
        <Disclosure key={id} summary={summary} defaultOpen={defaultOpen}>
          <p>{body}</p>
        </Disclosure>
      )}
    </section>
  );
}

/** An embed, with the section chrome around it. */
function Embed({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      <p className="text-muted mb-6 max-w-[68ch] text-sm">{hint}</p>
      {children}
    </section>
  );
}

/** Problem and approach, then the project's own sections, as one list. */
function blocksOf(project: Project) {
  return [
    { id: "problem", label: labels.problem, body: project.problem },
    { id: "approach", label: labels.approach, body: project.approach },
    ...project.sections,
  ];
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const stats = statsFor(project.slug);
  const blocks = blocksOf(project);
  const repository = project.links.find(
    (link) => link.label === labels.repository,
  );

  // The first block that has a summary opens by default; the rest start closed.
  const firstDisclosed = blocks.find(
    (block) => project.summaries[block.id] !== undefined,
  )?.id;

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

          {/* Repository next to the title, where a reader looks for it first.
              The links block at the foot keeps it too. */}
          {repository && (
            <p className="mt-6">
              <a
                href={repository.href}
                className="link-underline text-accent font-mono text-sm"
                target="_blank"
                rel="noreferrer"
              >
                {repository.href.replace(/^https:\/\//, "")}
              </a>
            </p>
          )}

          {stats.length > 0 && <StatStrip stats={stats} />}
        </header>

        {blocks.map((block, index) => {
          const field = (
            <Field
              id={block.id}
              label={block.label}
              body={block.body}
              summary={project.summaries[block.id]}
              defaultOpen={block.id === firstDisclosed}
            />
          );

          // Embeds sit directly after the block they illustrate.
          const after =
            block.id === "approach" && project.slug === SLUG.blotquant ? (
              <Embed label={labels.inspector} hint={labels.inspectorHint}>
                <BlotquantInspector />
              </Embed>
            ) : block.id === "approach" &&
              project.slug === SLUG.lifespanExtract ? (
              <Embed label={labels.funnel} hint={labels.funnelHint}>
                <LifespanFunnel />
              </Embed>
            ) : block.id === "verification" &&
              project.slug === SLUG.blotquant ? (
              <>
                <Embed label={labels.qcEffect} hint={labels.qcEffectHint}>
                  <QcEffectChart />
                </Embed>
                <Embed label={labels.sweeps} hint={labels.sweepsHint}>
                  <div className="mb-8">
                    <SweepFindings />
                  </div>
                  <SweepExplorer />
                </Embed>
              </>
            ) : block.id === "verification" &&
              project.slug === SLUG.lifespanExtract ? (
              <Embed label={labels.goldRecords} hint={labels.goldRecordsHint}>
                <GoldRecordInspector />
              </Embed>
            ) : block.id === "external-validation" &&
              project.slug === SLUG.blotquant ? (
              <Embed label={labels.realRun} hint={labels.realRunHint}>
                <RefusalGrid />
              </Embed>
            ) : null;

          return (
            <Reveal key={block.id ?? index}>
              <div className="flex flex-col gap-24 sm:gap-28">
                {field}
                {after}
              </div>
            </Reveal>
          );
        })}

        {project.slug === PIPELINE_SLUG && (
          <Reveal>
            <section>
              <SectionLabel>{labels.pipeline}</SectionLabel>
              <p className="text-muted mb-6 max-w-[68ch] text-sm">
                {labels.pipelineHint}
              </p>
              <PipelineDiagram stages={pipelineStages} />
            </section>
          </Reveal>
        )}

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
