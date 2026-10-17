# D1 Baseline

Measured on `main` @ `91abd50` **before any D1 code change**, from a local
production build. Every figure below was read out of the report files listed
in each section by `scripts/lh-summary.mjs` / `scripts/measure-first-load-js.mjs`
— none was retyped from memory.

## Environment

| | |
| --- | --- |
| Commit | `91abd502ced7a0f67972fb0d9d9d5dd37acd0dda` (`main`) |
| Next.js | 16.3.0 (Turbopack) |
| Node | v20.20.2 |
| pnpm | 9.15.0 |
| OS | macOS 26.6.2 (darwin) |
| Lighthouse | 12.8.2 |
| Chrome | HeadlessChrome/152.0.0.0 |
| Host benchmarkIndex | 2944.5 |
| Server under test | `pnpm build && pnpm start` → `http://localhost:3000` |

Reports: `design/reports/baseline/`

## First Load JS

**Deviation from the kickoff, recorded here rather than silently:** Next.js 16
**removed** the `size` and `First Load JS` columns from `next build` output.
Source: `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`,
section "Performance Improvements" — *"Next.js 16 removes the `size` and
`First Load JS` metrics from the next build output. We found these to be
inaccurate in server-driven architectures using React Server Components."*
The raw build log is kept verbatim at `design/reports/baseline/next-build.txt`
and contains no size columns.

To keep the registered JS budget enforceable, `scripts/measure-first-load-js.mjs`
reconstructs the equivalent figure from the build artifacts: for each
prerendered route it collects every `<script src="/_next/static/…">` in the
emitted HTML and sums those chunk files' on-disk and gzipped bytes. This is the
same quantity the old column reported (the JS a first visit to that route must
download), measured from the artifacts instead of from the reporter.

Source of record: `design/reports/baseline/first-load-js.json` (buildId
`MSivMb7vuJA3qROK6iKNM`).

> **Unit annotation (added 2026-09-02, authorised by Sofia).** Every "kB" figure
> in this file — the table below and thresholds T7–T9 — is actually **KiB**
> (bytes ÷ 1024), mislabelled by `scripts/measure-first-load-js.mjs`; `/` is
> 175.36 KiB = 179.57 kB. **No number is altered**: the label is wrong, the
> values are right and reproduce exactly from the cited report
> (`"gzip": 179572` ÷ 1024 = 175.36), and the same label is applied identically
> to both sides of every comparison, so no threshold, margin, or verdict is
> affected. Correcting a unit label is not a threshold change, so the freeze
> below does not block this note.

| Route | Raw | Gzip |
| --- | --- | --- |
| `/` | 569.40 kB | **175.36 kB** |
| `/colophon` | 568.09 kB | 174.84 kB |
| `/notes/untrusted-llm-output` | 567.57 kB | 174.62 kB |
| `/work/blotquant` | 1069.11 kB | **312.09 kB** |
| `/work/lifespan-extract` | 1069.11 kB | 312.09 kB |
| `/work/media-automation-platform` | 1069.11 kB | 312.09 kB |
| `/work/mira` | 1069.11 kB | 312.09 kB |
| `/_not-found` | 558.90 kB | 171.10 kB |
| `/_global-error` | 551.18 kB | 168.72 kB |
| **shared by all routes** | 537.14 kB | **165.16 kB** |

## Lighthouse — desktop

`npx lighthouse@12 http://localhost:3000 --preset=desktop --output=json`

| report | form | perf | a11y | bp | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- | --- | --- |
| lh-desktop-1.json | desktop | 99 | 100 | 96 | 864 ms | 0.0000 | 0 ms |
| lh-desktop-2.json | desktop | 100 | 100 | 96 | 545 ms | 0.0000 | 0 ms |
| lh-desktop-3.json | desktop | 100 | 100 | 96 | 543 ms | 0.0000 | 0 ms |
| **median (n=3)** | desktop | **100** | **100** | **96** | **545 ms** | **0.0000** | 0 ms |

## Lighthouse — mobile

`npx lighthouse@12 http://localhost:3000 --output=json` (default mobile emulation)

| report | form | perf | a11y | bp | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- | --- | --- |
| lh-mobile-1.json | mobile | 98 | 100 | 96 | 2482 ms | 0.0000 | 37 ms |
| lh-mobile-2.json | mobile | 98 | 100 | 96 | 2475 ms | 0.0000 | 28 ms |
| lh-mobile-3.json | mobile | 98 | 100 | 96 | 2474 ms | 0.0000 | 34 ms |
| **median (n=3)** | mobile | **98** | **100** | **96** | **2475 ms** | **0.0000** | 34 ms |

## Thresholds (registered before implementation)

Frozen as of this commit. If a later change needs a different threshold, STOP
and report to Sofia — do not edit this section.

**Measurement protocol (part of the threshold, not advice).** Every comparison
re-runs the identical procedure on the branch: `pnpm build`, `pnpm start`,
three Lighthouse runs per form factor at the flags recorded above, and the
**median of the three** is the figure compared. Single runs are noisy (see the
desktop 99/100/100 spread); the median is the registered statistic. Branch
reports land in `design/reports/branch/` and are cited by path in the report.

| # | Metric | Threshold | Baseline value | Source |
| --- | --- | --- | --- | --- |
| T1 | Lighthouse performance, desktop (median n=3) | **>= 100** | 100 | `lh-desktop-{1,2,3}.json` |
| T2 | Lighthouse performance, mobile (median n=3) | **>= 98** | 98 | `lh-mobile-{1,2,3}.json` |
| T3 | CLS, desktop (median n=3) | **<= 0.0000** | 0.0000 | `lh-desktop-{1,2,3}.json` |
| T4 | CLS, mobile (median n=3) | **<= 0.0000** | 0.0000 | `lh-mobile-{1,2,3}.json` |
| T5 | Accessibility score, desktop (median n=3) | **>= 100** | 100 | `lh-desktop-{1,2,3}.json` |
| T6 | Accessibility score, mobile (median n=3) | **>= 100** | 100 | `lh-mobile-{1,2,3}.json` |
| T7 | First Load JS, `/` (gzip) | **<= 177.36 kB** (175.36 + 2 kB) | 175.36 kB | `first-load-js.json` |
| T8 | First Load JS, each `/work/[slug]` (gzip) | **<= 314.09 kB** (312.09 + 2 kB) | 312.09 kB | `first-load-js.json` |
| T9 | First Load JS, shared by all routes (gzip) | **<= 167.16 kB** (165.16 + 2 kB) | 165.16 kB | `first-load-js.json` |

Notes on the JS thresholds:

- The +2 kB budget is the **whole** D1 JS allowance (the W4 spotlight shim), and
  it is charged once — T7/T8/T9 are not three separate 2 kB budgets. The shim
  is expected to land on `/` (the project card list), so T7 is the binding one;
  T9 must not move at all unless the shim is hoisted into the shared chunk.
- Gzip is the registered figure because that is what the removed Next column
  reported. Raw bytes are recorded above as secondary evidence only.
- W1 removes an `IntersectionObserver` client component, so the branch is
  expected to come in **under** baseline on T7/T9, not merely within budget.

Kill criterion (registered now, restated here so it sits with the numbers): any
effect that cannot meet its threshold after the review-loop cap is REMOVED from
the branch, not shipped degraded.

## Threshold revision — 2026-10-16 (field v2)

2026-10-16 — Thresholds revised by Sofia. Reason: site concept changed (CHARTER
rule 0 revoked the same day; site-wide animated field + glows are now
intended). The previous T2 (≥98) equalled the baseline with zero slack on a
noisy metric. Field worker port 84a8c57 failed previous T2/T7/T8; reports kept
in design/reports/field-v1/.

New T2 rule, fixed before measurement: run main ×7 (mobile); T2 threshold = the
LOWEST of those 7 Performance scores. Branch passes if its median of 7 mobile
runs ≥ that value. Main runs are taken before any branch run is evaluated, and
main and branch runs are interleaved.

The table above stays as written for the record. Where it and this section
disagree, this section binds.

- **T1, T3–T9:** unchanged.
- **T2:** replaced by the rule above. Desktop is measured n=5, interleaved, for
  T1/T3/T5; mobile n=7, interleaved, for T2/T4/T6.
- **T10 (new):** contrast audit across all routes at 1440, 768 and 390 px —
  **0 text nodes below WCAG AA**.
- **Failed-request exemption (ratified by Sofia, 2026-10-17):** /favicon.ico
  404 is exempt from the failed-request rule while the site has no favicon
  (absent on both main and branch). The exemption is removed when a favicon
  ships.

**Computed T2 (from the main runs, written before any branch median is
computed): T2 = 95.** Main `e206870` (`origin/main`), mobile ×7, Performance
95, 95, 96, 96, 95, 96, 95 — lowest 95. Reports:
`design/reports/field-v2/pre-review/main/lh-mobile-{1..7}.json`; last main mobile run
fetchTime `2026-10-16T22:14:37.448Z`. Branch passes T2 if its median of 7 mobile
runs is ≥ 95.

**Re-measurement on the final code (after the review loop), same rule, same
procedure: T2 = 96.** The review loop changed shipped code, so Step 2 was
re-run in full, main and branch interleaved again. Main `e206870`, mobile ×7,
Performance 96, 96, 96, 96, 96, 96, 96 — lowest 96. Reports:
`design/reports/field-v2/main/lh-mobile-{1..7}.json`; last main mobile run
fetchTime `2026-10-16T22:50:50.035Z`. Written before any branch report of this
run was read. **This value binds for the staged code**; the first run's 95 and
its reports (`design/reports/field-v2/pre-review/`) are kept for the record and
measured code that is no longer staged.

## Failed-request check — committed (2026-10-17)

**Ruling (Sofia, 2026-10-17).** The failed-request rule is enforced by
committed code: `scripts/lh-summary.mjs` counts failed requests (status ≥ 400,
or no status) per report, lists every run that has one as rejected, prints
`n/a` for any median taken over a rejected run, and exits non-zero. Until now
the rule was applied by uncommitted, ad-hoc filters; in #17 the favicon
exemption above was applied that way and was never in committed code.

**No URL is exempt** unless a ruling recorded in this file names it, for a
stated side of a stated PR. Such a ruling is applied only on the command line
(`--tolerate-404 <path>`, repeatable); the script holds no URL list, and a
tolerated request is still counted in its own column. The favicon exemption
above is the only such ruling today, and lapses when a favicon ships (#18).

## `fix/danger-contrast` — failed-request rule

**Ruling (Sofia, 2026-10-17, recorded before any run of this PR):** neither
main nor this branch ships a favicon, so a `/favicon.ico` 404 is tolerated on
**both** sides, via `--tolerate-404 /favicon.ico`, under the existing favicon
exemption (which lapses when #18 ships). Any other failed request rejects the
run on either side.

## Report storage — 2026-10-17

**Ruling (Sofia, 2026-10-17):** from `fix/danger-contrast` on, Lighthouse
reports are stored gzip-compressed as `.json.gz` in `design/reports/<name>/`.
Reports already in `design/reports/` stay as they are. `scripts/lh-summary.mjs`
reads both forms. This changes storage only; the measurement protocol and
thresholds above are unchanged.

## T10 method — 2026-10-17

**Ruling (Sofia, 2026-10-17).** T10 is measured by the committed audit
`scripts/contrast-audit.mjs` (`node scripts/contrast-audit.mjs <base-url>`),
which exits non-zero if any node is below AA.

- **What is counted:** visible, unclipped, on-page text nodes — SVG text
  included, `aria-hidden` text included — on all 7 routes (`/`, `/colophon`,
  `/notes/untrusted-llm-output`, the four `/work/[slug]` pages) and the 404
  page, at 1440, 768 and 390 px. Text clipped away by an ancestor (`overflow`,
  `clip`, `clip-path`, i.e. `sr-only`) or placed outside the document is not
  visible and is not counted.
- **States:** every disclosure (`aria-expanded`) is open in every state. On top
  of that, every tab not already active (`role="tab"`, or `button[aria-pressed]`)
  and every `role="switch"` is activated, one at a time, each on a fresh load.
  A node seen in several states is counted once, at its worst state.
- **What each node is checked against:** the worst-case underlay recorded under
  `.ascii-field` in `globals.css` (dot grid + both hero glows coincident,
  rgb(29, 56, 53)) with the field glyph at the alpha cap of the node's own
  column, in every stacking order; every translucent ancestor fill (including
  `color-mix()` fills) and ancestor opacity is composited in. AA = 4.5:1, 3:1
  for large text.
- **What is beneath a node is hit-tested, not inferred:** at up to three
  points across each line box, `document.elementsFromPoint` gives the paint
  stack, and every element painted below the text — ancestors and
  non-ancestors alike, sibling SVG `<rect>`s included — is composited, with its
  `fill-opacity` and every ancestor's `opacity`. Line boxes are re-measured at
  the scroll offset where they are sampled, because the scroll-driven reveal
  moves content. A node none of whose points can be hit-tested falls back to
  its ancestors' fills and is counted as a fallback in the report.
- **Reference on main @ `39fb47c`:** 2,930 text nodes across 47 page states at
  each width, **58 below AA**, in two groups:
  - **24 `--color-danger` nodes:** 21 as text at 4.252:1 (the
    `/work/lifespan-extract` quote-checker tab and the
    `/work/media-automation-platform` failure simulation) and 3 as the failed
    stage's SVG label on its own 15% fill at 3.537:1.
  - **34 selected-stage labels:** `--color-accent` text on the selected
    stage's 12% accent fill, at 4.402:1, on both pipeline diagrams.
- **#17's T10 claim was overstated.** Its "0 of 1,782" came from an
  uncommitted, ad-hoc method that did not open tab panels or switches; with
  them open, and with what is painted beneath each node hit-tested, the code
  it shipped has the 58 failures above.
- **Known-answer validation:** `node --test scripts/contrast-audit.selftest.mjs`
  runs the audit on the test-only fixture `scripts/fixtures/contrast-audit.html`
  (never built or shipped), which seeds cases that must fail (4.39:1, 4.498:1,
  ancestor opacity, a hidden `aria-pressed` tab panel, a hidden `role="tab"`
  panel, a switch's on state, a gutter node at 1440 px, and fg over a 60%
  white fill painted by a sibling SVG `<rect>` and by a non-ancestor `<div>`),
  cases that must
  pass (4.55:1, large text at 3.10:1, a `color-mix()` fill, SVG `fill`, the
  disclosure, tabs and switch themselves) and cases that must be excluded
  (`sr-only`, off-page). The audit must report exactly the seeded failures.

