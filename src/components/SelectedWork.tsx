import { labels, projects } from "@/content";
import { CardSpotlight } from "./CardSpotlight";
import { ProjectCard } from "./ProjectCard";
import { Section } from "./Section";

/**
 * A server component still: CardSpotlight is the <ul> itself and takes the
 * cards as children, so the cards cross no boundary and render on the server.
 */
export function SelectedWork() {
  return (
    <Section id="selected-work" title={labels.selectedWork}>
      <CardSpotlight>
        {projects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </CardSpotlight>
    </Section>
  );
}
