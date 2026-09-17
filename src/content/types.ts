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
  /**
   * Scannable lead for a prose block, keyed by block id — `problem`,
   * `approach`, or a section's own id. Where one exists the page shows it
   * first and puts the long-form prose behind a toggle; where it does not, the
   * prose renders directly. `{}` for a project short enough to read whole.
   *
   * The value is `string | undefined` because most ids have no summary: the
   * lookup is by block id, and a missing one is the ordinary case rather than
   * an error.
   */
  summaries: Readonly<Record<string, string | undefined>>;
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
  /**
   * Optional: a short contract entry is a dated line and nothing more, so the
   * timeline renders it without a prose block rather than padding one out.
   */
  summary?: string;
  /**
   * Optional: org name withheld; timeline renders a redaction bar instead of
   * the org text.
   *
   * The bar is decoration, not redaction: `org` still ships in the HTML, in the
   * visually hidden span the bar stands in front of. So `org` must stay a
   * public-safe placeholder for as long as this is `true` — putting the real
   * name here and leaving the flag set publishes it.
   */
  undisclosed?: boolean;
};

/**
 * Degrees, shown as compact timeline entries in their own Education section.
 */
export type Education = {
  id: string;
  degree: string;
  institution: string;
  country: string;
  /** years attended, same mono treatment as a role's period */
  period: string;
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
  /** one-line call to action shown above the contact links */
  availability: string;
  email: string;
  links: readonly Link[];
  /**
   * Same-origin path to a file in `public/`, so it is kept out of `links` —
   * everything in there is asserted absolute http(s) or mailto:.
   */
  cv: Link;
};
