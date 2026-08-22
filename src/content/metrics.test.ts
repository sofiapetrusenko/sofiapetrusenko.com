import { describe, expect, it } from "vitest";
import {
  blotquantMetrics,
  chartableSweeps,
  detectionRow,
  intensitySubset,
  lifespanMetrics,
  shortCommit,
} from "./index";

/**
 * These files are generated, so the checks here are not about typos — they are
 * about the generator's invariants surviving a regeneration. Each one is a
 * claim the site makes on the strength of the data, and would render as a wrong
 * number rather than an error if it broke.
 */

describe("blotquant metrics", () => {
  it("records the commit it was read from", () => {
    expect(blotquantMetrics.source_commit).toMatch(/^[0-9a-f]{40}$/);
    expect(shortCommit(blotquantMetrics.source_commit)).toHaveLength(9);
  });

  it("gives every chartable sweep a shipped value that is one of its points", () => {
    const sweeps = chartableSweeps(blotquantMetrics);
    expect(sweeps.length).toBeGreaterThan(0);

    for (const sweep of sweeps) {
      expect(sweep.shipped_value, sweep.key).not.toBeNull();
      const labels = sweep.values.map((row) => String(row.value));
      // The reference line has to land on a measured point, or it is marking a
      // value nobody ran.
      expect(labels, sweep.key).toContain(String(sweep.shipped_value));
    }
  });

  it("gives every chartable sweep both F1 series at every point", () => {
    for (const sweep of chartableSweeps(blotquantMetrics)) {
      for (const row of sweep.values) {
        expect(row.value, `${sweep.key} ${row.label}`).not.toBeNull();
        expect(row.lane_f1, `${sweep.key} ${row.label}`).not.toBeNull();
        expect(row.band_f1, `${sweep.key} ${row.label}`).not.toBeNull();
      }
    }
  });

  it("keeps the detection rows the page reads by name", () => {
    expect(detectionRow(blotquantMetrics, "band").f1).toBeGreaterThan(0);
    expect(detectionRow(blotquantMetrics, "lane").f1).toBeGreaterThan(0);
  });

  it("orders the intensity subsets from every band to the cleanest", () => {
    const rows = blotquantMetrics.intensity_recovery;
    expect(rows).toHaveLength(3);

    // The page's whole point: the clean subset is smaller and more accurate
    // than the headline one. If a regeneration reversed the order, the caption
    // would claim the opposite of what the bars show.
    const first = intensitySubset(blotquantMetrics, 0);
    const last = intensitySubset(blotquantMetrics, rows.length - 1);
    expect(last.bands).toBeLessThan(first.bands);
    expect(last.mean_absolute_percent).toBeLessThan(
      first.mean_absolute_percent,
    );
  });

  it("keeps the real-data run's crops, groups and outcome consistent", () => {
    const run = blotquantMetrics.real_data_run;

    expect(run.crop_ids).toHaveLength(run.crops);
    expect(run.produced + run.failed).toBe(run.crops);
    expect(run.reason.trim()).not.toBe("");

    const grouped = run.channel_groups.reduce(
      (total, group) => total + group.crops,
      0,
    );
    expect(grouped).toBe(run.crops);
    expect(run.measurable).toBeLessThanOrEqual(run.crops);
  });

  it("measures the test count rather than carrying one over", () => {
    expect(blotquantMetrics.tests.collected).toBeGreaterThan(0);
    expect(blotquantMetrics.tests.command).toContain("--collect-only");
  });
});

describe("lifespan metrics", () => {
  it("records the commit it was read from", () => {
    expect(lifespanMetrics.source_commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it("splits the gold records without losing any", () => {
    const { records, directions, organisms } = lifespanMetrics.gold;
    const sum = (rows: readonly { count: number }[]) =>
      rows.reduce((total, row) => total + row.count, 0);

    expect(sum(directions)).toBe(records);
    expect(sum(organisms)).toBe(records);
  });

  it("counts the hard negatives per category to the stated total", () => {
    const { total, categories } = lifespanMetrics.negatives;
    expect(categories.reduce((sum, entry) => sum + entry.count, 0)).toBe(total);
  });

  it("picks sample records covering more than one direction", () => {
    const records = lifespanMetrics.sample_records;
    expect(records.length).toBeGreaterThan(1);

    const directions = new Set(records.map((record) => record.direction));
    expect(directions.size).toBe(records.length);
  });

  it("shows at least one stated absence, which is the schema distinction", () => {
    const notReported = lifespanMetrics.sample_records.reduce(
      (total, record) => total + record.counts.not_reported,
      0,
    );
    expect(notReported).toBeGreaterThan(0);
  });

  it("tallies each sample record's claims to its own total", () => {
    for (const record of lifespanMetrics.sample_records) {
      const {
        total,
        populated,
        not_reported: notReported,
        null: nulls,
      } = record.counts;
      expect(populated + notReported + nulls, record.id).toBe(total);
      expect(record.claims, record.id).toHaveLength(total);
    }
  });

  it("carries the checker fixtures the inspector matches against", () => {
    const { abstract, full_text: fullText } = lifespanMetrics.checker_fixtures;
    expect(abstract.length).toBeGreaterThan(0);
    // The full-text fixture is wrapped the way PMC wraps; the whitespace-
    // collapsing demo depends on those newlines being there.
    expect(fullText).toContain("\n");
  });
});
