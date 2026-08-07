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
  viewCaseStudy: "View case study",
  pipeline: "Pipeline",
  pipelineHint:
    "Select a stage for what it does, the artifact it writes and how it fails.",
  /* Shell-prompt chrome for the hero's "currently" line. */
  promptSymbol: "$",
  promptCurrently: "currently:",
  pipelineRun: "Pipeline run",
  simulateFailure: "Simulate failure",
  humanApproval: "human approval",
  /* Status wording. "not run" rather than "skipped": on a resume it is the
     upstream stages that get skipped, while these never executed at all. */
  statusComplete: "complete",
  statusFailed: "failed",
  statusNotRun: "not run",
  visited: "visited",
  backToHome: "Back to home",
} as const;
