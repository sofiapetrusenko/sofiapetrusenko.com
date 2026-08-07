import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { colophon } from "./colophon";

/**
 * The colophon describes this repo's own CI. These tests tie the claims to the
 * workflow file, so the page cannot drift out of date silently — if a check is
 * added or removed, this fails rather than the site quietly lying.
 */
const workflow = readFileSync(
  join(process.cwd(), ".github/workflows/ci.yml"),
  "utf8",
);

/** Every `run: pnpm <script>` in the workflow, minus dependency installation. */
const ciChecks = [...workflow.matchAll(/run:\s*pnpm\s+([\w:]+)/g)]
  .map((match) => match[1] ?? "")
  .filter((script) => script !== "install")
  // `format:check` is the script; "format" is what the colophon calls it.
  .map((script) => script.split(":")[0] ?? script);

describe("colophon claims match the real pipeline", () => {
  it("lists exactly the checks CI actually runs, in order", () => {
    const ciStep = colophon.steps.find((step) => step.id === "ci");
    expect(ciStep?.detail?.split(", ")).toStrictEqual(ciChecks);
  });

  it("counts checks per commit correctly", () => {
    const entry = colophon.numbers.find((n) => n.label === "checks per commit");
    expect(entry?.value).toBe(String(ciChecks.length));
  });

  it("quotes no exact tally that grows with the repo", () => {
    // A bare count of tests or commits rots on the next merge. Floors ("90+"),
    // fixed step counts and policy statements are all fine.
    for (const entry of colophon.numbers) {
      if (/tests|commits|PRs/i.test(entry.label)) {
        expect(
          /^\d+$/.test(entry.value),
          `"${entry.value} ${entry.label}" is an exact tally and will rot`,
        ).toBe(false);
      }
    }
  });

  it("states a principle for every practice the intro promises", () => {
    expect(colophon.principles.length).toBeGreaterThan(0);
    for (const principle of colophon.principles) {
      expect(principle.trim()).not.toBe("");
    }
  });
});
