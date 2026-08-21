/**
 * Typed access to the generated metric files.
 *
 * Nothing here is written by hand. `scripts/extract-case-study-data.mjs` emits
 * both JSON files from the origin repositories, and every figure the case-study
 * pages render comes through this module — a component that wants a number
 * imports it from here rather than containing one.
 */

import blotquantJson from "./data/blotquant-metrics.json";
import lifespanJson from "./data/lifespan-metrics.json";

export type SweepValue = {
  label: string;
  value: number | null;
  lane_f1: number | null;
  band_f1: number | null;
  mean_absolute_percent: number | null;
  median_absolute_percent: number | null;
  clean_mean_absolute_percent: number | null;
  band_true_positives: number | null;
  band_false_positives: number | null;
  band_false_negatives: number | null;
  lane_true_positives: number | null;
  lane_false_positives: number | null;
  lane_false_negatives: number | null;
};

export type Sweep = {
  key: string;
  parameter: string;
  note: string;
  shipped_value: number | string | null;
  chartable: boolean;
  values: readonly SweepValue[];
};

export type BlotquantMetrics = {
  source_commit: string;
  header: {
    split: string;
    iou_threshold: number;
    images: number;
    truth_lanes: number;
    truth_bands: number;
  };
  detection: readonly {
    subject: string;
    precision: number;
    recall: number;
    f1: number;
    tp: number;
    fp: number;
    fn: number;
  }[];
  intensity_recovery: readonly {
    subset: string;
    bands: number;
    mean_absolute_percent: number;
    median_absolute_percent: number;
  }[];
  sweeps: readonly Sweep[];
  tests: { collected: number; command: string };
  real_data_run: {
    crops: number;
    produced: number;
    failed: number;
    reason_uniform: boolean;
    reason: string;
    crop_ids: readonly string[];
    channel_groups: readonly {
      group: string;
      crops: number;
      divergence: string;
    }[];
    measurable: number;
  };
};

export type GoldClaim = {
  field: string;
  value: string | number | boolean | null;
  state: "populated" | "not_reported" | "null";
  source_quote: string | null;
  extracted_from: string | null;
  confidence: string | null;
};

export type GoldRecord = {
  id: string;
  file: string;
  index: number;
  direction: string | null;
  paper: {
    title: string | null;
    year: number | null;
    pmid: string | null;
    doi: string | null;
  };
  claims: readonly GoldClaim[];
  counts: {
    total: number;
    populated: number;
    not_reported: number;
    null: number;
    quoted: number;
  };
};

export type LifespanMetrics = {
  source_commit: string;
  gold: {
    papers: number;
    records: number;
    directions: readonly { label: string; count: number }[];
    organisms: readonly { label: string; count: number }[];
    schema_version: string;
  };
  negatives: {
    total: number;
    set_version: string;
    categories: readonly { name: string; description: string; count: number }[];
  };
  sample_records: readonly GoldRecord[];
  checker_fixtures: { source: string; abstract: string; full_text: string };
  tests: { collected: number; command: string };
};

export const blotquantMetrics = blotquantJson as BlotquantMetrics;
export const lifespanMetrics = lifespanJson as LifespanMetrics;

/** Short form for citing the clone a figure was read from. */
export const shortCommit = (commit: string): string => commit.slice(0, 9);

/** The sweeps the explorer can plot: numeric parameter, both F1 series present. */
export const chartableSweeps = (metrics: BlotquantMetrics): readonly Sweep[] =>
  metrics.sweeps.filter((sweep) => sweep.chartable);

/** Named lookup, so a page can cite one figure without indexing by position. */
export function detectionRow(
  metrics: BlotquantMetrics,
  subject: "band" | "lane",
) {
  const row = metrics.detection.find((entry) =>
    entry.subject.startsWith(subject),
  );
  if (!row)
    throw new Error(`no ${subject} detection row in blotquant-metrics.json`);
  return row;
}

/** The three intensity subsets, in the order the README records them. */
export const intensitySubset = (metrics: BlotquantMetrics, index: number) => {
  const row = metrics.intensity_recovery[index];
  if (!row)
    throw new Error(
      `no intensity_recovery[${index}] in blotquant-metrics.json`,
    );
  return row;
};
