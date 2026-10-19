**Title:** fix(contrast): danger #fca5a5, fg selected-stage labels, committed T10 audit

## What
Fixes the two colour pairs that #17 shipped below WCAG AA (58 text nodes on main), and replaces #17's uncommitted contrast check with a committed, self-tested audit.

- **CHARTER A11:** `--color-danger` changes `#f87171` → `#fca5a5`. Against the T10 worst underlay it is now 6.20:1 as text (was 4.25) and 4.66:1 on its own 15% stage fill (was 3.54).
- **CHARTER A12:** a selected pipeline stage's label is `--color-fg`, not accent, in `PipelineDiagram` and `LifespanFunnel`. On the 12% accent fill it is now 7.71:1 (was 4.40). The 2px accent border and the fill still show the selection.
- **T10 is committed code**, `scripts/contrast-audit.mjs`, with a known-answer self-test (`node --test scripts/contrast-audit.selftest.mjs`; fixture in `scripts/fixtures/`, never built). The audit:
  - opens every disclosure, and every tab and switch (each on a fresh load);
  - checks that each state actually holds;
  - waits for finite animations to finish;
  - hit-tests what is painted beneath every line box of every text node;
  - detects paint *above* text: a node under an overlay that paints fails, unless it is in the exclusion list in BASELINE.md. That list has one entry, which a follow-up issue tracks. An entry that matches nothing in a route the run audited fails the run;
  - fails the run on any unmeasured node, an unreadable fill (gradient, `url()`, painting pseudo-element), a wrong HTTP status or an uncaught page exception.

  What paint-above detection does not read is listed in BASELINE: borders, shadows, SVG strokes, filters and blend modes, among others.
- **`scripts/lh-summary.mjs`:** rejects any run with a failed request, including one whose `network-requests` audit is missing. An exemption has to be passed per path with `--tolerate-404`; the script holds no URL list.

Rulings by Sofia, 2026-10-17 and 2026-10-19:
- A11 and A12 were ratified on 2026-10-17.
- Superseding notes on A9's #17 figures and on A11's "least lightening" were ratified on 2026-10-19; A9 and A11 themselves are unedited.
- A warm-up-run protocol is recorded for the next PR. It is not applied here.

#17's T10 claim is corrected in #23.

Closes #23.

No runtime dependencies; the scripts use the Node stdlib only.

## Status: ready
- [x] Visual approved: `design/shots/danger-contrast/before-after.png` (danger) and `design/shots/accent-contrast/before-after.png` (selected stages, fg vs 8% fill)
- [x] CHARTER A11 and A12 ratified by Sofia
- [x] Failed-request rule for this PR recorded before any run: `/favicon.ico` 404 tolerated on both sides (no favicon on either), nothing else
- [x] Self-test stable before gating: 20/20, then 10/10 with every CPU core saturated, then 20/20 after each round of review changes. Full logs are in `design/reports/danger-contrast/evidence/`.
- [x] Passes T1–T10 on the staged code
- [x] Review loop: closed at the 5-cycle cap. Behavioural REQUIRED findings per cycle were 3, 0, 3, 1, 0, and cycle 5 had no REQUIRED of any kind. Two consecutive clean cycles did not happen (cycle 4 had one). Every REQUIRED finding was fixed; RECOMMENDED findings are listed separately for Sofia.

### Measurements

Protocol per `design/BASELINE.md`, § "Threshold revision — 2026-10-16" and § "`fix/danger-contrast` — measurement":
- main (`39fb47c`, separate worktree, :3200) and branch (:3201), both from fresh `rm -rf .next && pnpm build`;
- before any run, the build ID each server actually served was matched against `.next/BUILD_ID`;
- Lighthouse 12.8.2, interleaved main/branch, mobile ×7 and desktop ×5 per side;
- 0 of 24 runs rejected; each run had exactly 1 tolerated request (`/favicon.ico` 404).

T2 = lowest of the 7 main mobile scores, written to BASELINE before any branch report was read.
- Last main mobile fetchTime `2026-10-17T22:36:44.252Z`; first branch mobile fetchTime `2026-10-17T22:34:13.002Z` (interleaved).
- Reports: `design/reports/danger-contrast/{main,branch}/` (`.json.gz`), plus `first-load-js.json` and `contrast-audit.{json,txt}` on each side.

| # | Metric | Threshold | Main | Branch | Result |
| --- | --- | --- | --- | --- | --- |
| T1 | Perf, desktop (median n=5) | ≥ 100 | 100 (100/100/100/100/100) | 100 (100/100/100/100/100) | ✅ |
| T2 | Perf, mobile (median n=7) | ≥ 94 (lowest main) | 96 (94/96/96/96/96/96/96) | **96** (96/96/95/96/95/96/97) | ✅ |
| T3 | CLS, desktop | ≤ 0.0000 | 0.0000 | 0.0000 | ✅ |
| T4 | CLS, mobile | ≤ 0.0000 | 0.0000 | 0.0000 | ✅ |
| T5 | A11y, desktop | ≥ 100 | 100 | 100 | ✅ |
| T6 | A11y, mobile | ≥ 100 | 100 | 100 | ✅ |
| T7 | First Load JS `/` (gzip) | ≤ 177.36 kB | 176.70 kB | **176.70 kB** | ✅ |
| T8 | First Load JS `/work/[slug]` (gzip) | ≤ 314.09 kB | 313.01 kB | **313.01 kB** | ✅ |
| T9 | First Load JS shared (gzip) | ≤ 167.16 kB | 165.16 kB | 165.16 kB | ✅ |
| T10 | Contrast, all routes + 404 @ 1440/768/390, all 47 states | 0 below AA, 0 unmeasured, 0 covered | **58 below AA**; 0 covered; 1 excluded | **0 of 2,930**, tightest 4.570:1; 0 covered; 1 excluded | ✅ |

Notes on T2 and T10:
- **T2:** it was set by main's cold first run (94; TBT 204 ms, `main/lh-mobile-1.json.gz`). Main's other six runs scored 96.
- **T10:**
  - Taken with the final audit, `scripts/contrast-audit.mjs` at sha256 `e3e10ae5…c731`, unchanged since: 0 partially sampled, 0 unmeasured and 0 covered on either side.
  - Excluded on both sides: "Selected work" on `/` at 768 px, under the scroll-cue fade at page load. T10 scores it 4.589:1 on what is beneath it; with the fade it is 2.797:1 (`evidence/scroll-cue-fade-composite.json`). It is on main too, and is tracked in #21.
  - The branch was rebuilt after comment-only CSS edits; its `.next/static` is byte-identical to the Lighthouse-measured build apart from the build-ID directory.
  - Main's 58 are 24 danger nodes (21 at 4.252, 3 at 3.537) and 34 selected-stage labels at 4.402.

Secondary, mobile medians (not criteria): LCP main 2520 ms / branch 2519 ms; TBT main 115 ms / branch 113 ms. Environment differs from the recorded baseline (Chrome 155, host benchmarkIndex 1420–1886); both sides ran on the same host, interleaved.

## Follow-ups (separate PRs)
- #18 — add a favicon and remove the BASELINE favicon exemption (PR B; WIP on `feat/favicon`)
- #21: the scroll-cue fade lies over "Selected work" at 768 px, and its wrapper takes clicks from links beneath it at some viewports. Removing BASELINE's one paint-above exclusion depends on this fix.
- Pressed toggles at 4.570:1, accent on a 10% accent fill: they pass AA by 0.07 (54 nodes on `/work/blotquant` and `/work/lifespan-extract`): #22.
- Warm-up run: from the next PR, one discarded warm-up run per side (BASELINE, "Protocol — warm-up run"). Its form factors and report location are ruled in #24.
- #24: audit and protocol tidy-up, the non-blocking items left when this PR's review loop closed.
- Stop the field worker while hidden under forced-colors
- Cap the wait for the load event before field start

🤖 Generated with [Claude Code](https://claude.com/claude-code)
