/**
 * UI chrome: section headings and link text. Lives here so components hold no
 * copy at all — every string the page renders comes from the content layer.
 */
export const labels = {
  selectedWork: "Selected work",
  background: "Background",
  contact: "Contact",
  stack: "Stack",
  problem: "Problem",
  approach: "Approach",
  links: "Links",
  pipeline: "Pipeline",
  pipelineHint:
    "Select a stage for what it does, the artifact it writes and how it fails.",
  backToHome: "Back to home",
} as const;
