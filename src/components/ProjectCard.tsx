import NextLink from "next/link";
import type { Project } from "@/content";
import { StackList } from "./StackList";

/**
 * The whole card is a hit target via a stretched pseudo-element on the title
 * link, which keeps it to a single link in the accessibility tree. It points at
 * the detail page — repo links live on the detail page itself.
 */
export function ProjectCard({ project }: { project: Project }) {
  return (
    <li className="border-hairline hover:border-muted relative border p-6 transition-colors">
      <h3 className="text-lg font-medium">
        <NextLink
          href={`/work/${project.slug}`}
          className="text-accent after:absolute after:inset-0"
        >
          {project.name}
        </NextLink>
      </h3>
      <p className="mt-2 max-w-[68ch] leading-relaxed">{project.tagline}</p>
      <p className="text-muted mt-3 font-mono text-xs">{project.year}</p>
      <div className="mt-5">
        <StackList stack={project.stack} />
      </div>
    </li>
  );
}
