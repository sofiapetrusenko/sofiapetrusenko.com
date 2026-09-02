import NextLink from "next/link";
import { labels, type Project } from "@/content";
import { StackList } from "./StackList";

/**
 * The whole card is the hit target via a stretched pseudo-element on the title
 * link, which keeps it to a single link in the accessibility tree. Three
 * affordances say so before the pointer arrives: the accent title, the explicit
 * "view case study" line, and the pointer cursor.
 *
 * `spotlight-card` is a hook and nothing more: the rule it names lives entirely
 * inside a pointer gate and an @supports in `globals.css`, so on a touch device
 * and in a browser without `mask-composite` this class styles nothing and the
 * card below is exactly what it has always been.
 *
 * The <h3> once carried the outgoing half of a shared-element morph into the
 * <h1> on /work/[slug], named `project-title-${slug}`. **Removed in D1.** The
 * pair never formed at runtime: React called `document.startViewTransition`, so
 * a root crossfade ran, but `view-transition-name` stayed `none` on this <h3>
 * for the whole transition and no `::view-transition-group(project-title-*)`
 * ever animated. The names were therefore dead attributes that read like a
 * working feature. Measured, not inferred — see design/LOOP_LOG.md, "W5
 * partially reverted", for the runtime evidence and the cause.
 *
 * The root crossfade is kept: it works, costs nothing, needs no markup here,
 * and degrades to plain navigation without browser support. Its reduced-motion
 * and pointer-events rules stay in `globals.css`.
 *
 * Charter 9 is unaffected and is now simpler: with no wrapper at all, the <h3>
 * is the link's direct parent, nothing sets `view-transition-name` on it, so it
 * never becomes a containing block and the link's stretched
 * `after:absolute after:inset-0` still resolves against the `relative` <li> —
 * one link in the a11y tree, whole card still the hit target.
 */
export function ProjectCard({ project }: { project: Project }) {
  return (
    <li className="group border-hairline hover:border-hairline-bright hover:bg-surface spotlight-card relative cursor-pointer border p-7 transition-colors duration-[175ms] ease-out sm:p-8">
      {/* Accent left rule on hover — same language as the project page panel. */}
      <span
        aria-hidden="true"
        className="bg-accent absolute inset-y-0 left-0 w-0.5 origin-top scale-y-0 transition-transform duration-[175ms] ease-out group-hover:scale-y-100"
      />

      <h3 className="text-accent text-2xl leading-tight font-medium tracking-tight">
        <NextLink
          href={`/work/${project.slug}`}
          className="after:absolute after:inset-0"
        >
          {project.name}
        </NextLink>
      </h3>
      <p className="text-muted mt-3 max-w-[68ch] leading-relaxed">
        {project.tagline}
      </p>
      <p className="text-muted mt-4 font-mono text-xs tracking-wider">
        {project.year}
      </p>
      <div className="mt-6">
        <StackList stack={project.stack} />
      </div>

      <p className="text-accent mt-6 flex items-center justify-end gap-2 font-mono text-xs">
        {labels.viewCaseStudy}
        <span
          aria-hidden="true"
          className="transition-transform duration-[175ms] ease-out group-hover:translate-x-1"
        >
          →
        </span>
      </p>
    </li>
  );
}
