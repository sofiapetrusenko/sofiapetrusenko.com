import { describe, expect, it } from "vitest";
import { projects } from "./projects";
import { stackCategory } from "./stack";

describe("stackCategory", () => {
  it("classifies every entry used by every project", () => {
    const unclassified = projects
      .flatMap((project) => project.stack)
      .filter((entry) => stackCategory(entry) === null);

    // A miss is not a crash, just a neutral chip — but it means a real entry
    // is silently uncoloured, which is what this test exists to catch.
    expect(unclassified).toStrictEqual([]);
  });

  it("returns null for an entry it does not know", () => {
    expect(stackCategory("Fortran")).toBeNull();
  });

  it("uses all three categories", () => {
    const used = new Set(
      projects
        .flatMap((project) => project.stack)
        .map(stackCategory)
        .filter((category) => category !== null),
    );
    expect([...used].sort()).toStrictEqual(["infra", "language", "media"]);
  });
});
