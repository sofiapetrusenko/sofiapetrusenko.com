#!/usr/bin/env node
/**
 * Generates the case-study metric files the site renders.
 *
 * Every figure on the two case-study pages comes from here. Nothing is typed by
 * hand: the numbers are read out of the origin repositories' own artifacts —
 * the sweep record, the README tables, the gold JSON, the phase PR body — and
 * the test counts are measured by actually collecting the suites.
 *
 * The script fails loudly rather than emitting a partial file. A missing clone,
 * an unparseable table or a disagreement between two sources that should agree
 * is an error, because the alternative is a plausible-looking number nobody can
 * trace.
 *
 * Usage:
 *   git clone --depth 50 https://github.com/sofiapetrusenko/blotquant /tmp/blotquant
 *   git clone --depth 50 https://github.com/sofiapetrusenko/lifespan-extract /tmp/lifespan-extract
 *   node scripts/extract-case-study-data.mjs
 *
 * Clone locations override with BLOTQUANT_DIR / LIFESPAN_DIR.
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(SITE_ROOT, "src/content/data");

const BLOTQUANT = process.env.BLOTQUANT_DIR ?? "/tmp/blotquant";
const LIFESPAN = process.env.LIFESPAN_DIR ?? "/tmp/lifespan-extract";

/* ── helpers ─────────────────────────────────────────────────────────────── */

function fail(message) {
  console.error(`extract-case-study-data: ${message}`);
  process.exit(1);
}

function requireDir(path, name) {
  if (!existsSync(path))
    fail(`${name} clone not found at ${path}. See the header of this file.`);
  return path;
}

const read = (repo, relative) => {
  const path = join(repo, relative);
  if (!existsSync(path)) fail(`missing ${relative} in ${repo}`);
  return readFileSync(path, "utf8");
};

const readJson = (repo, relative) => JSON.parse(read(repo, relative));

const gitHead = (repo) =>
  execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();

/** The interpreter the repo's own venv provides, so collection sees its deps. */
function python(repo) {
  const venv = join(repo, ".venv/bin/python");
  return existsSync(venv) ? venv : "python3";
}

/**
 * Test count by collection, never by reading a number out of a README.
 *
 * Two output shapes are accepted because the two repos configure `-q`
 * differently: one prints a "N tests collected" summary, the other (already
 * quiet via addopts) prints per-file counts instead. Anything else is an error
 * rather than a guess.
 */
function collectTests(repo) {
  const command = "pytest --collect-only -q";
  let output;
  try {
    output = execFileSync(
      python(repo),
      ["-m", "pytest", "--collect-only", "-q"],
      {
        cwd: repo,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 32 * 1024 * 1024,
      },
    );
  } catch (error) {
    // Collection errors still exit non-zero; the stdout is what matters.
    output = error.stdout ?? "";
  }

  const summary = output.match(/(\d+)\s+tests?\s+collected/);
  if (summary) return { collected: Number(summary[1]), command };

  // Stop at the warnings banner: its entries look like `path.py:12` and would
  // otherwise be counted as a one-test file.
  const counted = output.split(/^=+ warnings summary/m)[0];
  // The space after the colon is what separates a per-file count from a
  // `file.py:line` location.
  const perFile = [...counted.matchAll(/^(\S+\.py): (\d+)$/gm)];
  if (perFile.length > 0) {
    const collected = perFile.reduce(
      (total, match) => total + Number(match[2]),
      0,
    );
    return { collected, command };
  }

  fail(`could not read a test count from \`${command}\` in ${repo}`);
}

/** Stands in for an escaped pipe while a row is split on its real ones. */
const PIPE_SENTINEL = "\u0000";

/**
 * Rows of the first GitHub-flavoured table following `heading`, as cell arrays.
 * Bold markers and escaped pipes are stripped; nothing else is interpreted.
 */
function markdownTable(markdown, heading) {
  const start = markdown.indexOf(heading);
  if (start === -1) fail(`heading not found: ${heading}`);

  const lines = markdown.slice(start).split("\n");
  const rows = [];
  let seenTable = false;

  for (const line of lines.slice(1)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      if (seenTable) break;
      continue;
    }
    seenTable = true;
    // Split on unescaped pipes only: the tables escape a literal | as \|.
    const cells = trimmed
      .replace(/\\\|/g, PIPE_SENTINEL)
      .split("|")
      .slice(1, -1)
      .map((cell) =>
        cell.split(PIPE_SENTINEL).join("|").replace(/\*\*/g, "").trim(),
      );
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
    rows.push(cells);
  }

  if (rows.length < 2) fail(`no table rows under: ${heading}`);
  return rows;
}

const number = (text) => {
  const value = Number(String(text).replace(/[%*\s]/g, ""));
  if (!Number.isFinite(value)) fail(`not a number: ${text}`);
  return value;
};

/** `279 / 25 / 73` → {tp, fp, fn}. */
function tpFpFn(text) {
  const parts = String(text)
    .split("/")
    .map((part) => number(part));
  if (parts.length !== 3) fail(`expected tp/fp/fn, got: ${text}`);
  return { tp: parts[0], fp: parts[1], fn: parts[2] };
}

/**
 * Minimal reader for the config files here: nested maps of scalars, two-space
 * indented, no lists, no anchors, no multi-line strings. Enough for
 * `configs/*.yaml`, and it keeps this script dependency-free.
 */
function readSimpleYaml(text) {
  const root = {};
  const stack = [{ indent: -1, node: root }];

  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*$/, "").trimEnd();
    if (line.trim() === "") continue;

    const indent = line.length - line.trimStart().length;
    const match = line.trim().match(/^([\w.]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, rest] = match;

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent)
      stack.pop();
    const parent = stack[stack.length - 1].node;

    if (rest === "") {
      const child = {};
      parent[key] = child;
      stack.push({ indent, node: child });
    } else {
      const scalar = rest.replace(/^["']|["']$/g, "");
      parent[key] =
        scalar === "true"
          ? true
          : scalar === "false"
            ? false
            : /^-?[\d.]+$/.test(scalar)
              ? Number(scalar)
              : scalar;
    }
  }
  return root;
}

const at = (object, path) =>
  path
    .split(".")
    .reduce((node, key) => (node == null ? undefined : node[key]), object);

/* ── blotquant ───────────────────────────────────────────────────────────── */

/**
 * Where a sweep's shipped value lives in the config. The sweep keys are already
 * dotted paths relative to a section, so this is a lookup with a short list of
 * prefixes rather than a mapping table that would go stale.
 */
function shippedValueFor(sweepKey, configs) {
  const candidates = [
    `detection.${sweepKey}`,
    `detection.${sweepKey.replace(/^lane\./, "lane.").replace(/^band\./, "band.")}`,
    sweepKey,
  ];

  for (const config of configs) {
    for (const candidate of candidates) {
      const value = at(config, candidate);
      if (typeof value === "number" || typeof value === "string") return value;
    }
  }
  return null;
}

function buildBlotquant() {
  const repo = requireDir(BLOTQUANT, "blotquant");
  const readme = read(repo, "README.md");
  const sweepRecord = readJson(repo, "evals/dev_sweeps.json");

  const defaultConfig = readSimpleYaml(read(repo, "configs/default.yaml"));
  const rollingBall = readSimpleYaml(read(repo, "configs/rolling_ball.yaml"));

  /* Detection table. */
  const detection = markdownTable(readme, "### Detection")
    .slice(1)
    .map((cells) => ({
      subject: cells[0],
      precision: number(cells[1]),
      recall: number(cells[2]),
      f1: number(cells[3]),
      ...tpFpFn(cells[4]),
    }));
  if (detection.length !== 2)
    fail(`expected 2 detection rows, got ${detection.length}`);

  /* Intensity recovery table. */
  const intensity = markdownTable(readme, "### Intensity recovery")
    .slice(1)
    .map((cells) => ({
      subset: cells[0].replace(/`/g, ""),
      bands: number(cells[1]),
      mean_absolute_percent: number(cells[2]),
      median_absolute_percent: number(cells[3]),
    }));
  if (intensity.length !== 3)
    fail(`expected 3 intensity rows, got ${intensity.length}`);

  /* The same three subsets are recorded machine-readably in the sweep file.
     They must agree; a disagreement means one of the two has gone stale. */
  const subsets = sweepRecord.sweeps.matched_band_subsets?.values ?? [];
  const byBands = new Map(
    subsets.filter((row) => row.bands).map((row) => [row.bands, row]),
  );
  for (const row of intensity) {
    const twin = byBands.get(row.bands);
    if (!twin)
      fail(
        `intensity row of ${row.bands} bands has no match in matched_band_subsets`,
      );
    if (twin.mean_absolute_percent !== row.mean_absolute_percent) {
      fail(
        `README and dev_sweeps.json disagree for ${row.bands} bands: ` +
          `${row.mean_absolute_percent} vs ${twin.mean_absolute_percent}`,
      );
    }
  }

  /* Sweeps. A sweep is chartable when every row carries both F1 series and its
     label is a number the chart can place on an axis. */
  const sweeps = Object.entries(sweepRecord.sweeps).map(([key, sweep]) => {
    const values = (sweep.values ?? []).map((row) => ({
      label: row.label,
      value: /^-?[\d.]+$/.test(String(row.label)) ? Number(row.label) : null,
      lane_f1: row.lane_f1 ?? null,
      band_f1: row.band_f1 ?? null,
      mean_absolute_percent: row.mean_absolute_percent ?? null,
      median_absolute_percent: row.median_absolute_percent ?? null,
      clean_mean_absolute_percent: row.clean_mean_absolute_percent ?? null,
      band_true_positives: row.band_true_positives ?? null,
      band_false_positives: row.band_false_positives ?? null,
      band_false_negatives: row.band_false_negatives ?? null,
      lane_true_positives: row.lane_true_positives ?? null,
      lane_false_positives: row.lane_false_positives ?? null,
      lane_false_negatives: row.lane_false_negatives ?? null,
    }));

    const chartable =
      values.length > 1 &&
      values.every(
        (row) =>
          row.value !== null && row.lane_f1 !== null && row.band_f1 !== null,
      );

    return {
      key,
      parameter: sweep.parameter,
      note: sweep.note,
      shipped_value: chartable
        ? shippedValueFor(key, [defaultConfig, rollingBall])
        : null,
      chartable,
      values,
    };
  });

  const chartableCount = sweeps.filter((sweep) => sweep.chartable).length;
  if (chartableCount === 0) fail("no chartable sweeps found");
  for (const sweep of sweeps) {
    if (sweep.chartable && sweep.shipped_value === null) {
      fail(`no shipped value resolved for sweep ${sweep.key}`);
    }
  }

  /* The first real-data run, from the phase PR body and the ruling beside it. */
  const phase = read(repo, "docs/pr/phase-3b0.md");
  const outcome = phase.match(
    /\*\*(\d+) of (\d+) crops produced a result document; (\d+) failed\.\*\*/,
  );
  if (!outcome)
    fail("could not read the real-data run outcome from docs/pr/phase-3b0.md");

  const reason = phase.match(
    /Every crop is a[^.]*\.\s*The refusal is correct/s,
  );
  if (!reason)
    fail("could not read the refusal reason from docs/pr/phase-3b0.md");

  const measurable = phase.match(
    /\*\*The measurable set is (\d+) of (\d+)\.\*\*/,
  );
  if (!measurable)
    fail("could not read the measurable set from docs/pr/phase-3b0.md");

  const cropLog = read(repo, "data/real/crops/crop_log.csv")
    .trim()
    .split("\n")
    .slice(1);
  const crops = cropLog.map((line) => line.split(",")[0].replace(/\.png$/, ""));

  const amendment = read(
    repo,
    "data/real/AMENDMENT_2026-08-19_channel_collapse.md",
  );
  const channelGroups = markdownTable(amendment, "max(|R−G|, |R−B|, |G−B|)")
    .slice(1)
    .map((cells) => ({
      group: cells[0],
      crops: number(cells[1]),
      divergence: cells[2],
    }));

  const groupTotal = channelGroups.reduce((total, row) => total + row.crops, 0);
  if (groupTotal !== crops.length) {
    fail(
      `channel groups sum to ${groupTotal}, but there are ${crops.length} crops`,
    );
  }

  return {
    source_commit: gitHead(repo),
    generated_at: new Date().toISOString(),
    header: {
      split: sweepRecord.split,
      iou_threshold: sweepRecord.iou_threshold,
      images: sweepRecord.images,
      truth_lanes: sweepRecord.truth_lanes,
      truth_bands: sweepRecord.truth_bands,
    },
    shipped_config_digests: sweepRecord.shipped,
    detection,
    intensity_recovery: intensity,
    sweeps,
    tests: collectTests(repo),
    real_data_run: {
      crops: crops.length,
      produced: Number(outcome[1]),
      failed: Number(outcome[3]),
      // One reason for all of them, so it is recorded once rather than per cell.
      reason_uniform: true,
      reason: reason[0]
        .replace(/\s*The refusal is correct$/, "")
        .replace(/\s+/g, " ")
        .trim(),
      crop_ids: crops,
      channel_groups: channelGroups,
      measurable: Number(measurable[1]),
    },
  };
}

/* ── lifespan-extract ────────────────────────────────────────────────────── */

/** Every claim wrapper in a record: a node with `value` and `source_quote`. */
function* iterClaims(node, path = []) {
  if (Array.isArray(node)) {
    for (const [index, item] of node.entries())
      yield* iterClaims(item, [...path, String(index)]);
    return;
  }
  if (node === null || typeof node !== "object") return;

  if ("value" in node && "source_quote" in node) {
    yield { path: path.join("."), claim: node };
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "value" || key === "source_quote") continue;
    yield* iterClaims(value, [...path, key]);
  }
}

/** Module-level string constants out of a Python file, via `ast`. */
function pythonConstants(repo, relative, names) {
  const script = `
import ast, json, sys
tree = ast.parse(open(sys.argv[1]).read())
wanted = set(sys.argv[2:])
out = {}
for node in tree.body:
    if isinstance(node, ast.Assign) and len(node.targets) == 1:
        target = node.targets[0]
        if isinstance(target, ast.Name) and target.id in wanted:
            try:
                out[target.id] = ast.literal_eval(node.value)
            except ValueError:
                pass
print(json.dumps(out))
`;
  const output = execFileSync(
    python(repo),
    ["-c", script, join(repo, relative), ...names],
    {
      encoding: "utf8",
    },
  );
  const constants = JSON.parse(output);
  for (const name of names) {
    if (!(name in constants)) fail(`constant ${name} not found in ${relative}`);
  }
  return constants;
}

function buildLifespan() {
  const repo = requireDir(LIFESPAN, "lifespan-extract");

  const goldFiles = readdirSync(join(repo, "data/gold"))
    .filter((name) => name.endsWith(".json"))
    .sort();
  if (goldFiles.length === 0) fail("no gold records found");

  const documents = goldFiles.map((name) => ({
    id: name.replace(/\.json$/, ""),
    body: readJson(repo, join("data/gold", name)),
  }));

  const schemaVersions = new Set(
    documents.map((entry) => entry.body.schema_version),
  );
  if (schemaVersions.size !== 1)
    fail(`mixed schema versions: ${[...schemaVersions].join(", ")}`);

  const directions = new Map();
  const organisms = new Map();
  let records = 0;

  for (const { body } of documents) {
    for (const experiment of body.experiments ?? []) {
      records += 1;
      const direction =
        experiment.lifespan_effect?.direction?.value ?? "unrecorded";
      directions.set(direction, (directions.get(direction) ?? 0) + 1);
      const organism = experiment.organism?.value ?? "unrecorded";
      organisms.set(organism, (organisms.get(organism) ?? 0) + 1);
    }
  }

  const tally = (map) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count }));

  /* Records for the inspector: one per direction, so the set is not uniform.
     Within a direction, prefer the record that carries the most `not_reported`
     fields — the schema's stated-absence case is the one worth showing — then
     prefer a paper not already picked, then fall back to the id. Deterministic
     at every step, so the same clone always yields the same set. */
  const candidates = [];
  for (const { id, body } of documents) {
    for (const [index, experiment] of (body.experiments ?? []).entries()) {
      const claims = [...iterClaims(experiment)];
      candidates.push({
        file: id,
        index,
        paper: body.paper,
        experiment,
        direction: experiment.lifespan_effect?.direction?.value ?? "unrecorded",
        notReported: claims.filter(
          (entry) => entry.claim.value === "not_reported",
        ).length,
      });
    }
  }

  const chosen = [];
  const usedPapers = new Set();
  for (const direction of [
    ...new Set(candidates.map((entry) => entry.direction)),
  ].sort()) {
    const best = candidates
      .filter((entry) => entry.direction === direction)
      .sort(
        (a, b) =>
          b.notReported - a.notReported ||
          Number(usedPapers.has(a.file)) - Number(usedPapers.has(b.file)) ||
          a.experiment.experiment_id.localeCompare(b.experiment.experiment_id),
      )[0];
    usedPapers.add(best.file);
    chosen.push(best);
  }

  const sample = chosen.map(({ file, index, paper, experiment }) => {
    const claims = [...iterClaims(experiment)].map(({ path, claim }) => ({
      field: path,
      value: claim.value,
      // `not_reported` is a stated absence; null is a field with no value at
      // all. The schema keeps them apart, so the page does too.
      state:
        claim.value === "not_reported"
          ? "not_reported"
          : claim.value === null
            ? "null"
            : "populated",
      source_quote: claim.source_quote,
      extracted_from: claim.extracted_from ?? null,
      confidence: claim.confidence ?? null,
    }));

    return {
      id: experiment.experiment_id,
      file: `data/gold/${file}.json`,
      index,
      direction: experiment.lifespan_effect?.direction?.value ?? null,
      paper: {
        title: paper?.title ?? null,
        year: paper?.year ?? null,
        pmid: paper?.pmid ?? null,
        doi: paper?.doi ?? null,
      },
      claims,
      counts: {
        total: claims.length,
        populated: claims.filter((claim) => claim.state === "populated").length,
        not_reported: claims.filter((claim) => claim.state === "not_reported")
          .length,
        null: claims.filter((claim) => claim.state === "null").length,
        quoted: claims.filter((claim) => claim.source_quote).length,
      },
    };
  });

  /* The quote checker's own fixtures, so the match can be shown rather than
     asserted. This text is the test file's, not a paper's. */
  const fixtures = pythonConstants(repo, "tests/test_check_gold.py", [
    "ABSTRACT",
    "FULL_TEXT",
  ]);

  const negatives = readJson(repo, "data/classifier_set/negatives.json");
  const perCategory = new Map(
    negatives.categories.map((category) => [category.name, 0]),
  );
  for (const entry of negatives.entries) {
    if (!perCategory.has(entry.category)) perCategory.set(entry.category, 0);
    perCategory.set(entry.category, perCategory.get(entry.category) + 1);
  }

  return {
    source_commit: gitHead(repo),
    generated_at: new Date().toISOString(),
    gold: {
      papers: documents.length,
      records,
      directions: tally(directions),
      organisms: tally(organisms),
      schema_version: [...schemaVersions][0],
    },
    negatives: {
      total: negatives.entries.length,
      set_version: negatives.set_version,
      categories: negatives.categories.map((category) => ({
        name: category.name,
        description: category.description,
        count: perCategory.get(category.name) ?? 0,
      })),
    },
    sample_records: sample,
    checker_fixtures: {
      source: "tests/test_check_gold.py",
      abstract: fixtures.ABSTRACT,
      full_text: fixtures.FULL_TEXT,
    },
    tests: collectTests(repo),
  };
}

/* ── main ────────────────────────────────────────────────────────────────── */

mkdirSync(OUT_DIR, { recursive: true });

const outputs = [
  ["blotquant-metrics.json", buildBlotquant()],
  ["lifespan-metrics.json", buildLifespan()],
];

for (const [name, data] of outputs) {
  writeFileSync(join(OUT_DIR, name), `${JSON.stringify(data, null, 2)}\n`);
  console.log(
    `wrote src/content/data/${name} (${data.source_commit.slice(0, 9)})`,
  );
}
