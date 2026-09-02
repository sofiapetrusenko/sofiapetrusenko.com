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
