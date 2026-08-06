import { labels, projects } from "@/content";
import { ProjectCard } from "./ProjectCard";
import { Section } from "./Section";

export function SelectedWork() {
  return (
    <Section title={labels.selectedWork}>
      <ul className="flex flex-col gap-6">
        {projects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </ul>
    </Section>
  );
}
