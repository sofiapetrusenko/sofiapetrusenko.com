import { labels, projects } from "@/content";
import { ProjectCard } from "./ProjectCard";
import { Section } from "./Section";

export function SelectedWork() {
  return (
    <Section id="selected-work" title={labels.selectedWork}>
      <ul className="flex flex-col gap-5">
        {projects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </ul>
    </Section>
  );
}
