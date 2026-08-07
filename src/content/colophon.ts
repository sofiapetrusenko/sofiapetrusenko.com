import type { Colophon } from "./types";

/**
 * How the site itself is built. The numbers are a snapshot, not a live count —
 * they need updating by hand when the repo moves on.
 */
export const colophon = {
  intro:
    "This site was built through spec-driven agentic development: I write specifications, an AI agent implements them, and every change lands through a pull request with CI green before merge.",
  steps: [
    { id: "spec", label: "spec" },
    { id: "agent", label: "agent" },
    { id: "pull-request", label: "pull request" },
    { id: "ci", label: "CI", detail: "lint, typecheck, test, build, format" },
    { id: "preview", label: "preview" },
    { id: "merge", label: "merge" },
  ],
  numbers: [
    { value: "8+", label: "merged PRs" },
    { value: "58", label: "tests" },
    { value: "5", label: "checks per commit" },
    { value: "100%", label: "via PR" },
  ],
  principles: [
    "No green CI, no merge.",
    "Content lives in typed modules, never in components.",
    "Colour encodes meaning.",
    "Model output is untrusted input.",
  ],
} satisfies Colophon;
