/**
 * Which stages re-run after a failure.
 *
 * The platform's stages are idempotent and resumable: each one checks for its
 * artifact before regenerating, so a resumed run skips everything upstream of
 * the failure and re-runs only the stage that actually failed. Stages after it
 * never ran at all, so they are pending rather than re-run.
 *
 * Pure, and deliberately separate from the diagram component so the rule can be
 * tested without rendering anything.
 */

export type StageStatus = "complete" | "failed" | "pending";

export type ResumePlan = {
  /** one status per stage, in run order */
  statuses: StageStatus[];
  /** indices that execute again on resume — at most one */
  rerun: number[];
  /** indices skipped on resume because their artifact already exists */
  skipped: number[];
};

/**
 * `failedIndex` of null — or any index outside the pipeline — describes a clean
 * run: every stage complete, nothing to re-run.
 */
export function resumePlan(
  stageCount: number,
  failedIndex: number | null,
): ResumePlan {
  const count = Math.max(0, Math.trunc(stageCount));
  const indices = Array.from({ length: count }, (_, index) => index);

  const failed =
    failedIndex !== null &&
    Number.isInteger(failedIndex) &&
    failedIndex >= 0 &&
    failedIndex < count
      ? failedIndex
      : null;

  if (failed === null) {
    return {
      statuses: indices.map(() => "complete"),
      rerun: [],
      skipped: indices,
    };
  }

  return {
    statuses: indices.map((index) => {
      if (index < failed) return "complete";
      if (index === failed) return "failed";
      return "pending";
    }),
    rerun: [failed],
    skipped: indices.filter((index) => index < failed),
  };
}
