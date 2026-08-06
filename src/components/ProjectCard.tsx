import NextLink from "next/link";
import type { Project } from "@/content";
import { StackList } from "./StackList";

/**
 * Hover moves three things at once — border, surface and title — so the whole
 * card reads as one target. The stretched pseudo-element keeps it a single link
 * in the accessibility tree.
 */
export function ProjectCard({ project }: { project: Project }) {
  return (
    <li className="group border-hairline hover:border-hairline-bright hover:bg-surface relative border p-7 transition-colors duration-[175ms] ease-out sm:p-8">
      <h3 className="text-2xl leading-tight font-medium tracking-tight">
        <NextLink
          href={`/work/${project.slug}`}
          className="group-hover:text-accent transition-colors duration-[175ms] ease-out after:absolute after:inset-0"
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
    </li>
  );
}
