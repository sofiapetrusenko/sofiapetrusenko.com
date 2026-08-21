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

/**
 * One extra prose block on a case-study page, rendered in order after
 * `approach`. Projects documented in depth carry a few of these — verification,
 * process, status; the ones that need only problem and approach carry none.
 *
 * `label` is the heading, so it lives here rather than in `labels`: these
 * headings vary per project, while everything in `labels` is site chrome that
 * does not.
 */
export type ProjectSection = {
  /** url-safe id, unique within the project */
  id: string;
  label: string;
  body: string;
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
  /** extra case-study sections, in render order; `[]` for a short entry */
  sections: readonly ProjectSection[];
  stack: readonly string[];
  /** repo, live demo, writeup */
  links: readonly Link[];
  year: string;
};

export type Role = {
  org: string;
  title: string;
  location: string;
  /** country alone, so the geography scans down the timeline */
  country: string;
  /** drives the timeline node colour */
  kind: "engineering" | "research";
  period: string;
  summary: string;
};

/**
 * Degrees, shown as compact timeline entries after the roles. No `period`:
 * the legacy index.html this is taken from carries no dates for either degree,
 * and inventing them is not an option.
 */
export type Education = {
  id: string;
  degree: string;
  institution: string;
  country: string;
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

export type Note = {
  /** url-safe id */
  slug: string;
  title: string;
  /** one line, shown on the home page card */
  teaser: string;
  /** ISO yyyy-mm-dd, rendered verbatim in mono */
  date: string;
  readingMinutes: number;
  /** markdown; see `parseMarkdown` for the supported subset */
  body: string;
};

/** One node in the colophon's process strip. */
export type ProcessStep = {
  id: string;
  label: string;
  /** optional second line, e.g. what the CI step actually runs */
  detail?: string;
};

export type Colophon = {
  intro: string;
  steps: readonly ProcessStep[];
  numbers: readonly { value: string; label: string }[];
  principles: readonly string[];
};

export type Profile = {
  name: string;
  headline: string;
  /** 2-3 sentences */
  summary: string;
  location: string;
  /** current focus, one line, rendered after a shell-style prompt */
  now: string;
  email: string;
  links: readonly Link[];
};
