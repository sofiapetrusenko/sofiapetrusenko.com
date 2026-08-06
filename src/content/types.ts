/**
 * Content layer types.
 *
 * Data only — these describe the shape of the site's content, never how it is
 * rendered. Every field is required: a missing field is a compile error, which
 * is the point. Arrays are `readonly` so content cannot be mutated at runtime.
 */

export type Link = {
  label: string;
  href: string;
};

export type Project = {
  /** url-safe id */
  slug: string;
  name: string;
  /** one line, what it is */
  tagline: string;
  /** 1-2 sentences: what problem it solves */
  problem: string;
  /** 2-3 sentences: how it's architected */
  approach: string;
  stack: readonly string[];
  /** repo, live demo, writeup */
  links: readonly Link[];
  year: string;
};

export type Role = {
  org: string;
  title: string;
  location: string;
  period: string;
  summary: string;
};

export type PipelineStage = {
  /** url-safe id, matching the platform's own stage name where it has one */
  id: string;
  name: string;
  /** compact label for the horizontal diagram, where space is tight */
  short: string;
  /** the human gate is the one stage with no automatic path */
  kind: "automated" | "gate";
  /** what the stage does */
  does: string;
  /** the artifact it writes for the next stage to read */
  artifact: string;
  /** how it fails, and what that failure costs */
  failure: string;
};

export type Profile = {
  name: string;
  headline: string;
  /** 2-3 sentences */
  summary: string;
  location: string;
  email: string;
  links: readonly Link[];
};
