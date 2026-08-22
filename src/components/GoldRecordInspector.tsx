"use client";

import { useMemo, useState } from "react";
import {
  labels,
  lifespanMetrics,
  shortCommit,
  type GoldClaim,
} from "@/content";

/**
 * A hand-labeled gold record, and the deterministic quote check working on it.
 *
 * Two tabs, because the two things need different evidence:
 *
 * - **Records** shows real entries from `data/gold/`. Each claim carries its
 *   quote and where it was read from, and the three field states are drawn
 *   apart: a populated value, a stated `not_reported`, and a plain null. The
 *   schema keeps those separate on purpose — "the paper does not say" is not
 *   the same as "nothing here" — so the page does too. No surrounding source
 *   text is shown: the abstracts are not committed to that repository, and the
 *   rule is to show the quote without a window rather than fetch one.
 *
 * - **Checker** runs the match live against the quote checker's own fixtures
 *   from `tests/test_check_gold.py`, which are the repository's text rather
 *   than a publisher's. Here the window can be shown, capped anyway, with the
 *   matching span highlighted — including the full-text case, where the fixture
 *   is deliberately wrapped the way PMC wraps and the published PDF does not.
 */

const metrics = lifespanMetrics;
const WINDOW_CHARS = 200;

/** The checker's rule: collapse runs of whitespace, and change nothing else. */
const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

type Match = { found: boolean; before: string; hit: string; after: string };

/**
 * Locate a quote in its source the way the checker does — on the collapsed
 * text — and return a bounded window around it for display.
 */
function locate(source: string, quote: string): Match {
  const haystack = collapse(source);
  const needle = collapse(quote);
  const index = haystack.indexOf(needle);

  if (index === -1) {
    return {
      found: false,
      before: haystack.slice(0, WINDOW_CHARS),
      hit: "",
      after: "",
    };
  }

  const room = Math.max(0, WINDOW_CHARS - needle.length);
  const start = Math.max(0, index - Math.floor(room / 2));
  const end = Math.min(
    haystack.length,
    index + needle.length + Math.ceil(room / 2),
  );

  return {
    found: true,
    before: (start > 0 ? "…" : "") + haystack.slice(start, index),
    hit: haystack.slice(index, index + needle.length),
    after:
      haystack.slice(index + needle.length, end) +
      (end < haystack.length ? "…" : ""),
  };
}

const STATE_COLOR: Record<GoldClaim["state"], string> = {
  populated: "var(--color-fg)",
  not_reported: "var(--color-gate)",
  null: "var(--color-muted)",
};

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="cursor-pointer rounded-sm border px-2.5 py-1 font-mono text-[0.6875rem] transition-colors duration-150 ease-out motion-reduce:transition-none"
      style={{
        color: active ? "var(--color-accent)" : "var(--color-muted)",
        borderColor: active
          ? "color-mix(in srgb, var(--color-accent) 45%, transparent)"
          : "var(--color-hairline)",
        backgroundColor: active
          ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
          : "transparent",
      }}
    >
      {children}
    </button>
  );
}

/** A quote against its source, with the matching span marked. */
function QuoteMatch({ source, quote }: { source: string; quote: string }) {
  const match = useMemo(() => locate(source, quote), [source, quote]);

  return (
    <div>
      <p
        className="font-mono text-[0.6875rem] tracking-[0.14em] uppercase"
        style={{
          color: match.found ? "var(--color-ok)" : "var(--color-danger)",
        }}
      >
        {match.found ? labels.quoteVerbatim : labels.quoteAbsent}
      </p>
      <p className="border-hairline bg-surface mt-2 border p-3 font-mono text-xs leading-relaxed">
        {match.found ? (
          <>
            <span className="text-muted">{match.before}</span>
            <mark
              className="rounded-[2px] px-0.5"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--color-ok) 22%, transparent)",
                color: "var(--color-fg)",
              }}
            >
              {match.hit}
            </mark>
            <span className="text-muted">{match.after}</span>
          </>
        ) : (
          <span className="text-muted">{match.before}…</span>
        )}
      </p>
      {!match.found && (
        <p
          className="mt-2 font-mono text-[0.6875rem]"
          style={{ color: "var(--color-danger)" }}
        >
          &ldquo;{quote}&rdquo; — {labels.quoteAbsentDetail}
        </p>
      )}
    </div>
  );
}

function Records() {
  const [index, setIndex] = useState(0);
  const record = metrics.sample_records[index];
  if (!record) return null;

  return (
    <div>
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label={labels.recordSelector}
      >
        {metrics.sample_records.map((entry, entryIndex) => (
          <Tab
            key={entry.id}
            active={entryIndex === index}
            onClick={() => setIndex(entryIndex)}
          >
            {entry.direction ?? entry.id}
          </Tab>
        ))}
      </div>

      <div className="border-hairline mt-5 border">
        <header className="border-hairline border-b px-4 py-3 sm:px-6">
          <p className="font-mono text-xs break-all">{record.id}</p>
          <p className="text-muted mt-1.5 text-sm leading-snug">
            {record.paper.title}
          </p>
          <p className="text-muted mt-1.5 font-mono text-[0.6875rem]">
            {record.paper.year} ·{" "}
            {record.paper.pmid && (
              <a
                className="link-underline text-accent"
                href={`https://pubmed.ncbi.nlm.nih.gov/${record.paper.pmid}/`}
                target="_blank"
                rel="noreferrer"
              >
                PMID {record.paper.pmid}
              </a>
            )}{" "}
            · {record.file}
          </p>
        </header>

        <ul className="flex flex-col">
          {record.claims.map((claim) => (
            <li
              key={claim.field}
              className="border-hairline flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b px-4 py-2.5 last:border-b-0 sm:px-6"
            >
              <span className="text-muted w-full font-mono text-[0.6875rem] sm:w-56 sm:shrink-0">
                {claim.field}
              </span>
              <span
                className="font-mono text-xs"
                style={{
                  color: STATE_COLOR[claim.state],
                  fontStyle: claim.state === "populated" ? undefined : "italic",
                }}
              >
                {claim.state === "null" ? "—" : String(claim.value)}
              </span>
              {claim.source_quote && (
                <span className="text-muted w-full font-mono text-[0.6875rem] leading-relaxed">
                  <span style={{ color: "var(--color-ok)" }}>
                    {claim.extracted_from}
                  </span>{" "}
                  · &ldquo;{claim.source_quote}&rdquo;
                </span>
              )}
            </li>
          ))}
        </ul>

        <p className="border-hairline text-muted border-t px-4 py-3 font-mono text-[0.6875rem] leading-relaxed sm:px-6">
          <span style={{ color: "var(--color-fg)" }}>
            {record.counts.populated}
          </span>{" "}
          populated ·{" "}
          <span style={{ color: "var(--color-gate)" }}>
            {record.counts.not_reported}
          </span>{" "}
          not_reported · <span>{record.counts.null}</span> null ·{" "}
          <span style={{ color: "var(--color-fg)" }}>
            {record.counts.quoted}
          </span>{" "}
          quoted
        </p>
      </div>

      <p className="prose-hover mt-3 text-sm leading-relaxed">
        {labels.noWindowNote}
      </p>
    </div>
  );
}

function Checker() {
  const { abstract, full_text: fullText, source } = metrics.checker_fixtures;

  // Three cases the checker distinguishes, run live against the fixtures: a
  // clean abstract match, a full-text match that only succeeds because runs of
  // whitespace collapse, and a quote the source never contained.
  const cases = [
    {
      id: "abstract",
      title: "a quote read from the abstract",
      source: abstract,
      quote: "extends median and maximal lifespan",
    },
    {
      id: "full-text",
      title: "a full-text quote, across the source's own line wrapping",
      source: fullText,
      quote: "Median survival increased by 14% in males",
    },
    {
      id: "absent",
      title: "a quote the source never contained",
      source: abstract,
      quote: "a sentence the paper never contained",
    },
  ];

  return (
    <div>
      <ul className="flex flex-col gap-6">
        {cases.map((entry) => (
          <li key={entry.id}>
            <p className="text-muted mb-2 text-sm">{entry.title}</p>
            <QuoteMatch source={entry.source} quote={entry.quote} />
          </li>
        ))}
      </ul>

      <p className="text-muted mt-5 font-mono text-[0.6875rem] leading-relaxed">
        {labels.checkerFixtureNote} {source} ·{" "}
        {shortCommit(metrics.source_commit)}
      </p>
    </div>
  );
}

export function GoldRecordInspector() {
  const [tab, setTab] = useState<"records" | "checker">("records");

  return (
    <div>
      <div
        className="mb-5 flex flex-wrap gap-1.5"
        role="group"
        aria-label={labels.inspectorTabs}
      >
        <Tab active={tab === "records"} onClick={() => setTab("records")}>
          {labels.tabRecords}
        </Tab>
        <Tab active={tab === "checker"} onClick={() => setTab("checker")}>
          {labels.tabChecker}
        </Tab>
      </div>

      {tab === "records" ? <Records /> : <Checker />}
    </div>
  );
}
