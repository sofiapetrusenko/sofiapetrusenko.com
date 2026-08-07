import { projects } from "./projects";
import type { Project } from "./types";

export type {
  Colophon,
  Education,
  Link,
  Note,
  PipelineStage,
  ProcessStep,
  Profile,
  Project,
  Role,
} from "./types";

export { notes, getNote } from "./notes";
export { colophon } from "./colophon";

export { profile } from "./profile";
export { projects } from "./projects";
export { roles, isCurrentRole } from "./roles";
export { education } from "./education";
export { labels } from "./labels";
export { pipelineStages } from "./pipeline";
export { stackCategory, type StackCategory } from "./stack";

/** Undefined for an unknown slug — callers decide whether that is a 404. */
export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}
