import type { Colophon } from "./types";

/**
 * How the site itself is built.
 *
 * Every figure below is deliberately rot-proof: a floor ("90+"), a fixed count
 * of CI steps that changes only when ci.yml does, or a policy statement. No
 * exact tally of anything that grows every commit — a page about rigour cannot
 * carry a number that quietly goes out of date. Deriving a live test count
 * would mean the build depending on test-run output, which is not worth it;
 * counting `it(` in source would look authoritative while being wrong for
 * parameterised and skipped tests.
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
    { value: "90+", label: "tests" },
    { value: "5", label: "checks per commit" },
    { value: "every change", label: "via PR with green CI" },
  ],
  principles: [
    "No green CI, no merge.",
    "Content lives in typed modules, never in components.",
    "Colour encodes meaning.",
    "Model output is untrusted input.",
  ],
} satisfies Colophon;
