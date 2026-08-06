import { projects } from "./projects";
import type { Project } from "./types";

export type { Link, Profile, Project, Role } from "./types";

export { profile } from "./profile";
export { projects } from "./projects";
export { roles } from "./roles";
export { labels } from "./labels";

/** Undefined for an unknown slug — callers decide whether that is a 404. */
export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}
