import NextLink from "next/link";
import { labels, type Project } from "@/content";
import { StackList } from "./StackList";

/**
 * The whole card is the hit target via a stretched pseudo-element on the title
 * link, which keeps it to a single link in the accessibility tree. Three
 * affordances say so before the pointer arrives: the accent title, the explicit
 * "view case study" line, and the pointer cursor.
 */
export function ProjectCard({ project }: { project: Project }) {
  return (
    <li className="group border-hairline hover:border-hairline-bright hover:bg-surface relative cursor-pointer border p-7 transition-colors duration-[175ms] ease-out sm:p-8">
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
