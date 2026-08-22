"use client";

import { useCallback, useRef, useState } from "react";
import { lifespanMetrics } from "@/content";

/**
 * The lifespan-extract pipeline as it stands, with the committed gold set
 * underneath it.
 *
 * Two rules govern the data here. Every stage is marked `built` or `planned`
 * against what is actually merged — extraction is designed and not written, and
 * the diagram says so rather than implying a working pipeline. And every count
 * is one I counted out of `data/gold/` and `data/classifier_set/`, not a model
 * run: nothing has been extracted by the model yet, so there is no run to
 * chart. Each excerpt is quoted verbatim from the file named in its caption.
 *
 * Static by design — a case study, not a dashboard — so the data is hardcoded.
 */

const metrics = lifespanMetrics;

const TOKEN = {
  accent: "var(--color-accent)",
  ok: "var(--color-ok)",
  gate: "var(--color-gate)",
  fg: "var(--color-fg)",
  muted: "var(--color-muted)",
  hairline: "var(--color-hairline)",
  hairlineBright: "var(--color-hairline-bright)",
  surface: "var(--color-surface)",
} as const;

type State = "built" | "planned";

type Stage = {
  id: string;
  short: string;
  name: string;
  state: State;
  does: string;
  /** Verbatim excerpt, with the file it came from. Omitted where none is clean. */
  excerpt?: { text: string; caption: string };
};

const STAGES: readonly Stage[] = [
  {
    id: "fetch",
    short: "fetch",
    name: "fetch",
    state: "built",
    does: "PubMed E-utilities and bioRxiv clients pull abstracts and preprint metadata, retrying with backoff on rate limits. Preprint and published versions of the same work are deduplicated by DOI, and re-running the command does not duplicate rows. Remote XML is parsed with defusedxml rather than the standard library, because the payload is untrusted input.",
    excerpt: {
      text: "iter 1 | REQUIRED: 4 | ingest/{pubmed,biorxiv,db,http,cli,dedup,models,errors}.py + 99 tests; reviewer flagged PubmedBookArticle silent drop, cross-run preprint->publication duplicate, unvalidated `published` DOI, dead self-throttle",
      caption: "LOOP_LOG.md — the ingestion phase's first review cycle",
    },
  },
  {
    id: "screen",
    short: "screen",
    name: "screen",
    state: "planned",
    does: `A cheap-model gate answers one question — does this paper report lifespan-intervention data? — so the expensive extraction call only sees papers worth extracting. A paper screened out is a correct answer, not a miss, which is why the negative set is built to be hard: ${metrics.negatives.total} papers across ${metrics.negatives.categories.length} categories that all look like lifespan studies to a keyword classifier and are not.`,
    excerpt: {
      text: "Lifespan or survival is measured, but nothing is administered - observational, GWAS/QTL, natural variation.",
      caption:
        "data/classifier_set/negatives.json — one of the five hard-negative categories",
    },
  },
  {
    id: "extract",
    short: "extract",
    name: "extract",
    state: "planned",
    does: "One structured record per organism and intervention, so a multi-organism paper yields several. Every field carries a verbatim source quote, a confidence, and whether it was read from the abstract or the full text. Model output is untrusted input: a JSON repair heuristic and a single retry, then a loud failure with a windowed excerpt rather than a silent fallback. A field the paper does not state must come back empty, including where the likely answer is obvious — the gold set already holds that line, leaving out any value reachable only by the labeller's arithmetic, because a gold record carrying a fabricated number would penalise a model that correctly extracts nothing.",
    excerpt: {
      text: '"value": "not_reported",\n"source_quote": null,\n"confidence": "high",\n"extracted_from": "abstract"',
      caption: "data/gold/colman2009.json — a strain the paper never states",
    },
  },
  {
    id: "verify",
    short: "verify",
    name: "verify",
    state: "built",
    does: "A deterministic checker — no model calls, no judgement — confirms that every source quote appears character-for-character in the text it claims to come from, resolving PMID to PMCID for full-text quotes. Runs of whitespace are collapsed on both sides because PMC's markup wraps lines the PDF does not; case and punctuation are compared as they are.",
    excerpt: {
      text: "A paper that is not in the PMC open-access subset makes its full-text quotes unverifiable, reported as a warning. Not a failure: a quote we cannot check is not a quote we know to be wrong.",
      caption: "scripts/check_gold.py — the module docstring",
    },
  },
  {
    id: "record",
    short: "record",
    name: "record",
    state: "built",
    does: "Records land in a schema-validated store that the model cannot reach. A PreToolUse hook blocks agent writes to the gold directory at the filesystem level while allowing reads, so a disagreement between the pipeline and the standard can never be settled by moving the standard.",
    excerpt: {
      text: "Conservative where it cannot be sure. A line that cannot be tokenised, or that reaches for `eval`, a subshell or an inline interpreter while naming a protected path, is blocked unparsed -- being wrong in the allow direction costs ground truth, being wrong in the block direction costs one round trip.",
      caption: ".claude/hooks/protect_paths.py — the module docstring",
    },
  },
];

/**
 * Counted out of the committed files by `scripts/extract-case-study-data.mjs`,
 * not reported by a run and not typed here. The direction colours are the only
 * thing this component adds: green for a lifespan increase, amber for the one
 * decrease, neutral for no effect.
 */
const DIRECTION_COLOR: Readonly<Record<string, string>> = {
  increase: TOKEN.ok,
  no_effect: TOKEN.muted,
  decrease: TOKEN.gate,
};

const GOLD = {
  papers: metrics.gold.papers,
  records: metrics.gold.records,
  directions: metrics.gold.directions.map((row) => ({
    ...row,
    color: DIRECTION_COLOR[row.label] ?? TOKEN.accent,
  })),
  organisms: metrics.gold.organisms,
} as const;

const GEOMETRY = { nodeW: 74, nodeH: 34, pitch: 86, top: 8, vbH: 62 } as const;

function Diagram({
  selected,
  onSelect,
}: {
  selected: number;
  onSelect: (index: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const vbW = (STAGES.length - 1) * GEOMETRY.pitch + GEOMETRY.nodeW;

  const boxAt = (index: number) => ({
    x: index * GEOMETRY.pitch,
    y: GEOMETRY.top,
    width: GEOMETRY.nodeW,
    height: GEOMETRY.nodeH,
  });

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = Math.min(STAGES.length - 1, Math.max(0, index + delta));
    onSelect(next);
    buttonRefs.current[next]?.focus();
  }

  return (
    <div className="relative min-w-[38rem]">
      <svg
        viewBox={`0 0 ${vbW} ${GEOMETRY.vbH}`}
        className="block w-full"
        aria-hidden
      >
        {STAGES.slice(0, -1).map((stage, index) => {
          const from = boxAt(index);
          const to = boxAt(index + 1);
          return (
            <line
              key={`edge-${stage.id}`}
              x1={from.x + from.width}
              y1={from.y + from.height / 2}
              x2={to.x}
              y2={to.y + to.height / 2}
              stroke={TOKEN.hairline}
              strokeWidth={1}
            />
          );
        })}

        {STAGES.map((stage, index) => {
          const box = boxAt(index);
          const isSelected = index === selected;
          const isHovered = index === hovered;
          const planned = stage.state === "planned";
          const stroke = isSelected
            ? TOKEN.accent
            : planned
              ? TOKEN.hairlineBright
              : TOKEN.hairline;

          return (
            <g key={stage.id}>
              <rect
                {...box}
                rx={3}
                fill={isSelected ? TOKEN.accent : TOKEN.surface}
                fillOpacity={
                  isSelected ? 0.12 : isHovered ? 1 : planned ? 0 : 1
                }
                stroke={stroke}
                strokeWidth={isSelected ? 2 : 1}
                /* Dashed = not built yet. Said again in words below the row. */
                strokeDasharray={planned ? "4 3" : undefined}
                className="pipe-box"
              />
              <text
                x={box.x + box.width / 2}
                y={box.y + box.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={
                  isSelected ? TOKEN.accent : planned ? TOKEN.muted : TOKEN.fg
                }
                fontSize={11}
                className="pipe-label"
              >
                {stage.short}
              </text>
              {planned && (
                <text
                  x={box.x + box.width / 2}
                  y={box.y + box.height + 11}
                  textAnchor="middle"
                  fill={TOKEN.muted}
                  fontSize={9}
                >
                  planned
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div
        className="absolute inset-0"
        role="group"
        aria-label="Pipeline stages"
        onMouseLeave={() => setHovered(null)}
      >
        {STAGES.map((stage, index) => {
          const box = boxAt(index);
          return (
            <button
              key={stage.id}
              type="button"
              ref={(element) => {
                buttonRefs.current[index] = element;
              }}
              onClick={() => onSelect(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              onMouseEnter={() => setHovered(index)}
              tabIndex={index === selected ? 0 : -1}
              aria-pressed={index === selected}
              className="absolute cursor-pointer rounded-[3px] border-0 bg-transparent p-0"
              style={{
                left: `${(box.x / vbW) * 100}%`,
                top: `${(box.y / GEOMETRY.vbH) * 100}%`,
                width: `${(box.width / vbW) * 100}%`,
                height: `${(box.height / GEOMETRY.vbH) * 100}%`,
              }}
            >
              <span className="sr-only">
                {stage.name}, {stage.state}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Bars({
  title,
  total,
  rows,
}: {
  title: string;
  total: number;
  rows: readonly { label: string; count: number; color?: string }[];
}) {
  return (
    <div>
      <p className="text-muted mb-3 font-mono text-[0.6875rem] tracking-[0.22em] uppercase">
        {title}
      </p>
      {rows.map((row) => (
        <div key={row.label} className="mb-2 flex items-center gap-3">
          <span
            className="text-muted shrink-0 font-mono text-[0.6875rem]"
            style={{ width: "6.5rem" }}
          >
            {row.label}
          </span>
          <span
            className="h-1.5 flex-1 overflow-hidden rounded-sm"
            style={{ backgroundColor: "var(--color-bg)" }}
          >
            <span
              className="block h-full"
              style={{
                width: `${(row.count / total) * 100}%`,
                backgroundColor: row.color ?? TOKEN.accent,
                opacity: 0.85,
              }}
            />
          </span>
          <span className="w-6 shrink-0 text-right font-mono text-[0.6875rem]">
            {row.count}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LifespanFunnel() {
  const [selected, setSelected] = useState(0);
  const select = useCallback((index: number) => setSelected(index), []);
  const stage = STAGES[selected];

  return (
    <div>
      <div className="border-hairline border">
        <div className="overflow-x-auto p-4 sm:p-6">
          <Diagram selected={selected} onSelect={select} />
        </div>

        <div className="border-hairline grid gap-6 border-t p-4 sm:grid-cols-2 sm:p-6">
          <Bars
            title={`direction, ${GOLD.records} gold records`}
            total={GOLD.records}
            rows={GOLD.directions}
          />
          <Bars
            title={`organism, ${GOLD.records} gold records`}
            total={GOLD.records}
            rows={GOLD.organisms}
          />
        </div>

        <p className="border-hairline text-muted border-t px-4 py-3 font-mono text-[0.6875rem] leading-relaxed sm:px-6">
          {GOLD.papers} hand-labeled papers, {GOLD.records} intervention
          records, counted from <span className="text-fg">data/gold/</span>.
          These are labels, not extractions — the model has not run against them
          yet.
        </p>
      </div>

      {stage && (
        <div
          aria-live="polite"
          className="mt-6 border-l-2 pl-5 sm:pl-6"
          style={{
            borderColor: stage.state === "planned" ? TOKEN.muted : TOKEN.accent,
          }}
        >
          <div key={stage.id} className="panel-swap">
            <h3 className="text-xl font-medium tracking-tight">
              {stage.name}
              <span
                className="ml-3 font-mono text-xs tracking-wider"
                style={{
                  color: stage.state === "planned" ? TOKEN.muted : TOKEN.ok,
                }}
              >
                {stage.state}
              </span>
            </h3>
            <p className="mt-3 max-w-[68ch] leading-relaxed">{stage.does}</p>

            {stage.excerpt && (
              <figure className="mt-5">
                <pre className="border-hairline bg-surface max-w-[68ch] overflow-x-auto border p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                  {stage.excerpt.text}
                </pre>
                <figcaption className="text-muted mt-2 font-mono text-[0.6875rem]">
                  {stage.excerpt.caption}
                </figcaption>
              </figure>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
