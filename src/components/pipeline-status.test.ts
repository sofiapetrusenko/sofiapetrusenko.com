import { describe, expect, it } from "vitest";
import { resumePlan } from "./pipeline-status";

describe("resumePlan", () => {
  it("treats a run with no failure as fully complete", () => {
    const plan = resumePlan(9, null);

    expect(plan.statuses).toStrictEqual(Array(9).fill("complete"));
    expect(plan.rerun).toStrictEqual([]);
    expect(plan.skipped).toHaveLength(9);
  });

  it("re-runs only the failed stage", () => {
    const plan = resumePlan(9, 5);

    // This is the whole point of idempotent stages: one stage re-runs, not six.
    expect(plan.rerun).toStrictEqual([5]);
  });

  it("marks upstream complete, the failure failed, and downstream pending", () => {
    const plan = resumePlan(9, 5);

    expect(plan.statuses).toStrictEqual([
      "complete",
      "complete",
      "complete",
      "complete",
      "complete",
      "failed",
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("skips exactly the stages upstream of the failure", () => {
    expect(resumePlan(9, 5).skipped).toStrictEqual([0, 1, 2, 3, 4]);
  });

  it("re-runs nothing upstream when the first stage fails", () => {
    const plan = resumePlan(9, 0);

    expect(plan.skipped).toStrictEqual([]);
    expect(plan.rerun).toStrictEqual([0]);
    expect(plan.statuses[0]).toBe("failed");
    expect(plan.statuses[1]).toBe("pending");
  });

  it("leaves nothing pending when the last stage fails", () => {
    const plan = resumePlan(9, 8);

    expect(plan.statuses.filter((s) => s === "pending")).toHaveLength(0);
    expect(plan.rerun).toStrictEqual([8]);
  });

  it("treats an out-of-range index as a clean run", () => {
    for (const index of [-1, 9, 100, 1.5]) {
      expect(resumePlan(9, index).rerun).toStrictEqual([]);
    }
  });

  it("handles an empty pipeline", () => {
    expect(resumePlan(0, 0)).toStrictEqual({
      statuses: [],
      rerun: [],
      skipped: [],
    });
  });
});
