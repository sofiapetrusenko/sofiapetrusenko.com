# D1 Review Loop

One section per cycle. The reviewer runs in a fresh context with no implementer
history: it sees the diff, `design/CHARTER.md`, `design/BASELINE.md` and its
rubric, and nothing else. Its contract is `.claude/agents/design-reviewer.md`.

Stopping rule: two consecutive cycles with zero behavioural REQUIRED findings,
or the 5-cycle cap, whichever comes first. The implementer fixes REQUIRED only;
RECOMMENDED accumulates for Sofia and never blocks.

---

## Cycle 1 — D1 presentation layer (W1–W5)

Reviewed: working tree over `91abd50` (nothing committed). 9 modified + 8
untracked files; 764 insertions / 117 deletions, of which `src/app/globals.css`
is 535/11.

**Measurement integrity note, from the reviewer, unprompted.** Its first
Lighthouse pass was discarded as invalid: a stale `next-server` (29 min old,
from a build predating the run) held port 3000, so `pnpm start` failed with
`EADDRINUSE` and Lighthouse measured the *old* server, whose HTML referenced a
CSS chunk that the new build had replaced. Every page loaded unstyled, giving a
deterministic 6/6 `target-size` failure and accessibility 95. It killed the
stale process, confirmed the CSS chunk served 200/34233 bytes, and re-ran all
six. The reports in `design/reports/branch/` are the valid second pass. Had it
reported that first pass, cycle 1 would have opened with a fabricated
accessibility regression.

### REQUIRED

**1. The last `[data-reveal]` on `/` and on every `/work/[slug]` never finishes
revealing above a ~1210px viewport, and sits under AA above ~2000px.**
Charter rule 3 (corollary) and rule 7.

Computed `opacity` of the last wrapper **at maximum scroll**, width 1512,
Chrome 152 over CDP against the branch build:

| viewport height | `/` (Contact) | `/work/blotquant` |
| --- | --- | --- |
| 1200 | 1.000 | — |
| 1250 | 0.963 | 0.954 |
| 1300 | 0.915 | — |
| 1400 | 0.829 | 0.821 |
| 1600 | 0.690 | — |
| 1800 | 0.581 | — |
| 2000 | 0.495 | 0.489 |
| 2400 | 0.365 | 0.360 |

At 1400px the block also still carries its tilt
(`matrix3d(1, 0, 0, 0, 0, 0.99996, -0.0089408, …)`). `/colophon` reads 1.000 at
every height — but only because its document goes shorter than the viewport, so
the timeline is inactive. It is safe by accident, not by the argument given.

`globals.css` asserts the opposite: *"The one way a scroll-driven range can
strand a block faint is a last block with less than 36vh of scrolling left
beneath it. The last wrapper on each page clears it: `/` ends on Contact …
~478px of travel against the 288px the range needs **at an 800px viewport**."*
The condition is `documentHeight − blockTop ≥ 0.36·V`, so the fixed 478px of
travel stops covering it once `0.36·V > 478` — measured to fail from V ≈ 1210px.
Rule 3's corollary exists so no user agent can strand content invisible; here a
**fully supporting** browser at `no-preference` leaves a content section
permanently below full opacity with no scroll left to finish it.

Rule 7 requires the worst case *including the value that would break it*: the
comment names the value that breaks the tilt (5deg) but never the viewport
height that breaks the range, and its AA derivation ("body text passes 4.5:1 at
about opacity 0.5, so the first half of the range is under AA, **as any fade-in
is**") is stated as transient — at V ≥ 2000px it is permanent, so body text in
that section is under 4.5:1 for the life of the page.

Not an exotic viewport: browser zoom-out scales CSS-px viewport height as
1/zoom — 67% of a 900px window is 1343px, 50% is 1800px, 33% is 2700px — before
any tall or rotated display.

**2. "Nothing above the fold starts hidden" is false — content inside the first
viewport paints at opacity 0–0.9 on load, where the code it replaced showed it.**
Charter rule 3 (corollary).

Computed `opacity` at scroll 0, for wrappers whose top is inside the viewport:

| page / viewport | wrapper | share of it visible | opacity |
| --- | --- | --- | --- |
| `/colophon` 1512×900 | #1 | **100%** | **0.722** |
| `/colophon` 1512×900 | #2 | 18.3% | 0 |
| `/work/blotquant` 1512×900 | #0 | 93.7% | 0.891 |
| `/work/blotquant` 390×844 | #0 | 37.2% | 0.592 |
| `/work/blotquant` 1512×1400 | #1 | — | 0.657 |
| `/` 1512×900 | #0 | 2.1% | 0 |

`entry` progress is measured from the element's **top edge** crossing the
viewport bottom, so a block that is fully visible but whose top is 251px above
the viewport bottom sits at `entry ≈ 251px` — inside the 8vh→36vh (72→324px)
window, not past it. *Visible* and *fully entered* are different quantities.

This is a regression, not merely an inaccurate comment: the
`IntersectionObserver` W1 removed fired at `threshold: 0.15`, and all four cases
above (100%, 18.3%, 93.7%, 37.2% visible) exceed that, so the baseline revealed
them on the first observer callback. Unlike finding 1 this state *is*
recoverable — 287px of the 512px of available scroll un-hides the `/colophon`
case — so it is first-paint blankness rather than permanent stranding.

**3. Charter 12's count is written into two new places and is wrong by seven.**
Charter rule 12.

`grep -rn "use client" src/` returns **nine** files: `LifespanFunnel`,
`SweepExplorer`, `Disclosure`, `RefusalGrid`, `ScrollCue`,
`GoldRecordInspector`, `PipelineDiagram`, `BlotquantInspector` — all eight
present at `91abd50` — plus the new `CardSpotlight`. The diff adds "One of the
site's two client components" to `ScrollCue.tsx:6` and `CardSpotlight.tsx:10`,
and "the two that remain are ScrollCue and CardSpotlight" to `Reveal.tsx:9`.

Rule 12's other two obligations are met and met well: `CardSpotlight` states why
a server component cannot do the job, and takes children as a slot by *becoming*
the existing `<ul>`, so it adds no DOM node. The count is the part that is
false. Honest qualifier from the reviewer: the wording is inherited —
`Reveal.tsx` carried the same "two client components" line at baseline — so this
diff propagates the error rather than inventing it. But it is the diff that adds
a boundary and restates the count twice.

### RECOMMENDED (never blocks — accumulates for Sofia)

1. **`CardSpotlight` caches card origins measured *through* W2's transform.**
   `SelectedWork` is inside a `<Reveal>`, so a card's `getBoundingClientRect()`
   includes the reveal's `perspective(600px) rotateX(-3deg) translateY(12px)`
   while it is in range. Measured A/B: priming the cache mid-reveal leaves the
   origin **5.99px off in y and 0.87px in x, permanently**. The stated invariant
   — "Only a relayout can move a card within the document, and `resize` is the
   event that follows the ones a reader can cause" — is wrong: W1/W2's own
   transform moves the rect and fires nothing. Priming mid-reveal is the
   *common* path (scrolling down with the pointer over the list). Cosmetic
   against a 192px gradient radius, but the reasoning is not sound.
2. **`will-change: transform` contradicts the argument three paragraphs below
   it.** `globals.css` argues `transform: none` at the `to` keyframe is
   load-bearing because "an identity transform … would leave every wrapper
   holding a stacking context and a containing block for the life of the page.
   `none` leaves nothing." `will-change: transform`, in the same rule block,
   does exactly that unconditionally. Verified harmless (stripping it moves 0
   of 206 / 690 / 61 elements). The effect is fine; the justification is not.
3. **Promoted-layer count rose from 2 to 7 (`/`) and 8 (`/work/blotquant`)**,
   held for the page's life. No threshold moved. Rule 5's "`will-change` is
   scoped to the variant that actually animates" is read loosely: a wrapper the
   reader has scrolled past will never animate again and stays promoted.
4. **`vi.mock("react", …)` is unscoped** — it substitutes a spread object for
   the React module namespace across all 24 test files, not only the two that
   render a `ViewTransition`. The guard is correct
   (`if ("ViewTransition" in actual) return actual;` retires the shim the day
   the real export lands) and nothing is currently hidden by it.
5. **`pnpm format:check` fails on this branch.** Non-report offenders:
   `.claude/agents/*.md`, `design/BASELINE.md`, `design/CHARTER.md`,
   `scripts/measure-first-load-js.mjs`. Twelve Lighthouse JSONs also fail and
   want a `.prettierignore` entry for `design/reports/`. Every *modified
   tracked* source file is clean.
6. **Every new test asserts that the stylesheet's text matches the comment
   beside it; none measures geometry.** That is exactly why REQUIRED 1 and 2
   passed 182/182. A test that scrolls to maximum at a tall viewport and asserts
   the last wrapper's computed opacity is 1 would have caught REQUIRED 1 on the
   first run.
7. **Threshold-adjacent, in `scripts/measure-first-load-js.mjs`:** `sizes()`
   swallows a read failure and returns `{raw: 0, gzip: 0, missing: true}`, and
   `missing` never reaches the emitted report — an unresolvable chunk would
   silently *shrink* a route's total and flatter the branch. Not exercised here
   (all 11 referenced chunk paths verified present), so T7–T9 are honest. It
   should surface the flag rather than hide it. `scripts/lh-summary.mjs` reads
   every figure straight from the report and its median is the correct
   lower-middle for n=3; no complaint.
8. Lightning CSS emits `animation-timeline: scroll(root)` for the source's
   `scroll(root block)` while keeping the `@supports` condition verbatim.
   Behaviourally identical, but `PageGlow.test.tsx` reads the *source*, not the
   shipped chunk, so it cannot notice if a future minifier ever weakens one side
   and not the other.

### Behaviour matrix

Verified against the **emitted** chunk plus live measurement in Chrome 152 over
CDP — not from the authors' comments.

| W-step | reduced motion | touch | no JS | unsupported browser |
| --- | --- | --- | --- | --- |
| W1 reveal | ✅ every wrapper `opacity:1`, `animation-name:none`, `will-change:auto` | ✅ no pointer gate; scroll-driven | ✅ server component, reveal is pure CSS; `<noscript>` removal correct | ✅ exactly one `data-reveal` in the emitted chunk, inside `@supports` → Firefox declares nothing |
| W2 tilt | ✅ same `animation-name` | ✅ n/a | ✅ n/a | ✅ same guard |
| **W1/W2, supporting browser, no-preference** | — | — | — | ❌ **REQUIRED 1 and 2** |
| W3 parallax | ✅ `transform:none`, `animation-name:none` | ✅ correctly ungated | ✅ pure CSS | ✅ inside `@supports (animation-timeline: scroll(root block))` |
| W4 spotlight | ✅ only `opacity` transitions; global reduce rule collapses it | ✅ whole block pointer-gated; JS gate attaches **no listener** | ✅ vars fall back, `::before` is `opacity:0` until `:hover` | ✅ `@supports (mask-composite: exclude)` false → no pseudo-element |
| W5 morph | ✅ the explicit `::view-transition-*` reduce rule is **necessary and correct** — the blanket rule emits as `*,:before,:after`, which cannot match that tree | ✅ plain `<a href>` | ✅ plain navigation | ✅ no `startViewTransition` → plain navigation |

Claims that **held** under adversarial check:

- **W3 contrast + overflow (rule 7, T3/T4).** `scrollWidth === clientWidth` and
  `scrollHeight` constant at 6 scroll offsets on 1440×900, 390×844 and
  1280×520; the transform's x term is 0 everywhere and y reaches exactly 0.08·V
  then holds. Both tints are pseudo-elements of the translated box, so their
  separation is untouched and the coincident `rgb(23, 50, 47)` case still bounds
  it. Drift correctly scoped — `/work/blotquant` reports `animation-name:none`.
- **W4 charter 9.** A 3×3 point grid on all four cards resolves **36/36 inside
  the `<a>`**; exactly one `<a>` per card; `li::before` at rest is `opacity:0`,
  `pointer-events:none`, painted below the later-in-tree-order stretched
  `after:inset-0`.
- **W5 charter 9.** `viewTransitionName === "none"` at rest on both sides;
  `grep -c view-transition-name` = **0** across all five prerendered HTML files.
  Props land as inert `vt-*` attributes on the `<h3>`/`<h1>` themselves with no
  wrapper node, so no containing block is created. `default="none"` resolves
  enter/exit/update to `"none"` and only `share` to `project-title`, so the
  three unmatched titles do not animate.
- **Rule 5 / reflow.** No new animated or transitioned property outside
  `transform`/`opacity`.
- **Rule 2 tables and amendments A1–A4** are self-consistent with what shipped.
- **Not asked about, checked anyway:** `/notes/[slug]` untouched (0 reveals, 0
  glows, 0 spotlight cards, 0 `vt-name`); `src/react-canary.d.ts` is a single
  reference directive with no side effects.

### Threshold table

Protocol re-run in full: `pnpm build`, `pnpm start`, 3 Lighthouse 12.8.2 runs
per form factor at the registered flags, median of three. Host `benchmarkIndex`
2793–2814 branch vs 2944.5 baseline.

| ID | Metric | Baseline | Branch | Source (baseline → branch) | Verdict |
| --- | --- | --- | --- | --- | --- |
| T1 | LH performance, desktop (median n=3) | 100 | **100** (100/100/100) | `design/reports/baseline/lh-desktop-{1,2,3}.json` → `design/reports/branch/lh-desktop-{1,2,3}.json` | **PASS** |
| T2 | LH performance, mobile (median n=3) | 98 | **98** (98/98/98) | `…/baseline/lh-mobile-{1,2,3}.json` → `…/branch/lh-mobile-{1,2,3}.json` | **PASS** |
| T3 | CLS, desktop | 0.0000 | **0.0000** | `…/baseline/lh-desktop-*.json` → `…/branch/lh-desktop-*.json` | **PASS** |
| T4 | CLS, mobile | 0.0000 | **0.0000** | `…/baseline/lh-mobile-*.json` → `…/branch/lh-mobile-*.json` | **PASS** |
| T5 | Accessibility, desktop | 100 | **100** | `…/baseline/lh-desktop-*.json` → `…/branch/lh-desktop-*.json` | **PASS** |
| T6 | Accessibility, mobile | 100 | **100** | `…/baseline/lh-mobile-*.json` → `…/branch/lh-mobile-*.json` | **PASS** |
| T7 | First Load JS, `/` (gzip) | 175.36 kB | **175.56 kB** | `…/baseline/first-load-js.json` → `…/branch/first-load-js.json` (buildId `LcG3wWR0z-QMCe2pjxwz9`) | **PASS** (≤177.36) |
| T8 | First Load JS, `/work/[slug]` (gzip) | 312.09 kB | **311.87 kB** | same pair | **PASS** (≤314.09) |
| T9 | First Load JS, shared (gzip) | 165.16 kB | **165.16 kB** | same pair | **PASS**, unmoved |

Secondary, same reports: LCP desktop 545 → 543 ms, mobile 2475 → 2474 ms; TBT
desktop 0 → 0 ms, mobile 34 → 30 ms; best-practices 96 → 96.

**One recorded expectation was not met, though no threshold was.**
`design/BASELINE.md` notes that W1's removal of the IntersectionObserver
component means "the branch is expected to come in **under** baseline on T7/T9".
T7 came in **0.20 kB over** baseline: W4's spotlight chunk (11.09 kB raw, the
only chunk unique to `/`) more than offsets the removed boundary. T9 is unmoved,
as required. Recorded for Sofia against a note in BASELINE.md — **not** a
threshold change, and the reviewer did not edit that file.

### Verdict

**3 REQUIRED**, 8 RECOMMENDED. All nine thresholds pass. Findings 1 and 2 are
behavioural and share a single root cause: `entry` progress is measured from the
element's top edge crossing the viewport bottom, and both the range end
(`entry 36vh`) and the "already visible = already finished" claim were derived
as though it measured *how much of the block is showing*. Finding 3 is a
documentation-accuracy violation of a rule that makes the count normative.

---

## Cycle 2 — the reveal range correction, re-audited

Reviewed: working tree over `91abd50`. 930 insertions / 117 deletions across 9
modified tracked files plus the untracked set. Fresh reports in
`design/reports/branch-cycle2/`; cycle 1's were **not** reused, and the reviewer
checked port 3000 was free before starting (cycle 1 lost a pass to exactly that).

### What verified clean

Cycle 1's findings **1 and 3 are genuinely fixed**, and the reviewer confirmed
the mechanism rather than the comment:

- **The `min(h, V)` claim is correct**, against the spec and against
  measurement. Block shorter than the viewport: `/` @1512×900 wrapper #1,
  h=237 → 35.4px of travel vs `0.15·h` = 35.6. Block taller: wrapper #2,
  h=1068 > V=900 → 134.7px vs `0.15·V` = 135.0.
- **I1 holds everywhere it could be pushed.** Every `[data-reveal]` at maximum
  scroll reads `opacity 1.0000` across **33 page×viewport combinations** —
  five routes at 900, 1013, 1400, 2000, 2400, 3200, 1080, 1440, plus 320×568
  and 2560×1440. Cycle 1's 0.365-at-2400px case now reads 1.0000.
- **The `transform: none` correction is true** — 33/33 settled wrappers report
  `matrix(1, 0, 0, 1, 0, 0)`, never the keyword. Nothing else leans on the old
  claim.
- **Charter 12's count is right**: exactly nine files carry the directive.
  `/notes/[slug]` still untouched (0 reveals, 0 glows, 0 spotlight, 0 `vt-name`).
- Emitted chunk still has exactly one `data-reveal`, inside both guards. All
  four fallback paths correct for every W.

### REQUIRED

**1. The new range breaks T5. Desktop accessibility 100 → 95, on a real
colour-contrast failure the range change created.** Threshold T5, charter 7.

Deterministic, 3/3 runs. The failing audit is `color-contrast` on
`section#selected-work > h2.text-muted`: *"insufficient color contrast of 2.92
(foreground #5c5c62, background #0d0d0f, 11px)"*. Baseline and cycle 1 both
score 100 with `color-contrast` items = 0.

Reproduced independently over CDP at Lighthouse's desktop viewport (1350×940):
that `<h2>` sits inside a `[data-reveal]` whose computed opacity **at scroll 0**
is **0.5324**, compositing `--color-muted` to **rgb(92, 92, 98)** = **2.92:1** —
axe's exact numbers. Then an A/B on the same build with only `animation-range`
put back to `entry 8vh entry 36vh`: opacity **0**, ratio 1, audit passes. The
range change is the cause, not a coincidence.

**Mechanism.** The removed observer was a *cliff* — 0 below 15% visible, 1 above
— and `entry 8vh` preserved that with a dead zone for a block whose top has only
just crossed the fold. `entry 0%` replaces it with a continuous ramp from true
entry, so a block 2–7% entered paints its text at 0.26–0.53 opacity on the first
frame instead of at 0. axe ignores opacity 0 and flags sub-AA. At 1512×900 the
same label composites to 1.54:1. Mobile survives only because at 412×823 that
block's top is below the fold.

Rule 7 is breached in the same place: `globals.css` asserts *"Nothing here
widens that window"* about the sub-AA fade window. It does widen it, at the one
scroll position where the reader has no scroll behind them. **The fix converted
cycle 1's "invisible at first paint" into "illegible at first paint" — and the
first was invisible to axe, the second is not.**

**2. On most wrappers the reveal is now an order of magnitude below the site's
timing band, and A5 justifies only the case where it isn't.** Charter 16, A5.

Measured travel at 1512×900:

| route | wrappers | travel |
| --- | --- | --- |
| `/` | 5 | 135, 135, 46, 42, 36 px |
| `/work/blotquant` | 8 | 135, 135, 125, 47, 26, 22, **12**, **12** px |
| `/work/mira` | 3 | 26, 22, **12** px |
| `/colophon` | 3 | 31, 24, 16 px |

**14 of 19 wrappers complete in under 50px; 10 in under 32px; three in 12px.**
Using A5's own conversion (135px ≈ 200ms, i.e. ~675 px/s): 47px ≈ 70ms,
32px ≈ 47ms, **12px ≈ 18ms — one frame at 60Hz**. Rule 16's observed band floors
at 120ms. A5 derives only the 135px cap into the band and records the short case
as "close to a flash", then justifies it by assertion. Rule 16's wording is
"stays inside it **or justifies leaving it**".

Unprompted addition: W2's 3deg tilt rides the same keyframes and range, so those
wrappers compress a translate *and* a rotation into 12–26px. The projection stays
sub-pixel, but the effect is temporal — on `/work/mira`, `/colophon` and the tail
of `/work/blotquant`, **the reveal is a cut, not a fade.**

**3. `scripts/verify-reveal.mjs` exits 0 having measured nothing at all.**
Charter 13 (as extended — see the orchestrator's ruling below).

```
$ node scripts/verify-reveal.mjs --base=http://localhost:39999   # nothing listening
  ok   RM / 1512x900: 0 wrappers, opacity 1, animation-name none, 0 animations
  All I1/I2 assertions passed (3 observations).
$ echo $?
0
```

Every assertion loops over `querySelectorAll("[data-reveal]")`, and
`Page.loadEventFired` fires for Chrome's error page too, so an empty result set
is indistinguishable from a passing one. Nothing asserts navigation succeeded or
that any wrapper was found. The same vacuity would swallow a renamed attribute,
a dropped stylesheet chunk, or the reveal being deleted outright. Two narrower
gaps: I1's per-wrapper check is skipped when `end.rows` is empty, and I2 only
inspects wrappers ≥15% visible — so the `0 < visible < 15%` band, **where
REQUIRED 1 actually lives**, is never looked at. It covers one of four
`/work/[slug]` routes and never the 1350×940 viewport the protocol audits.

**4. T2 fails as measured — mobile performance 96 against `>= 98` — but the
protocol cannot tell whether that is the branch.** Threshold T2. **Addressed to
Sofia, not to the implementer.**

Median 96 (96/96/97), TBT 127 ms. A second three-run set: median 97 (96/97/97),
TBT 107 ms. Baseline is 98 with TBT 34 ms.

Against attribution: host `benchmarkIndex` in these six reports is **1612–1846**
versus **2944.5** at baseline and 2793–2814 in cycle 1 — a ~40% slower machine,
which mobile emulation multiplies through 4× CPU throttling into TBT, which is
what moves the score. The branch's shipped JS is byte-identical to cycle 1's,
and cycle 2 added **no JS at all** — its only change is four CSS tokens. The
reviewer could not run a same-session baseline control without mutating the tree,
which its contract forbids. Recorded as failing **as measured** and explicitly
**not attributable to this branch**. *The registered protocol has no host-speed
control; that is a gap in the protocol, and only Sofia may change it.*

### RECOMMENDED (accumulates for Sofia)

1. **Lightning CSS rewrites the range** to `animation-range:entry entry 15%`,
   dropping the explicit `0%`. Verified to resolve identically, but
   `Reveal.test.tsx` greps the *source*, so it could not see a minifier that
   weakened it. Same shape as cycle 1's RECOMMENDED 8.
2. **The count tests would not catch a tenth client component outside
   `src/components`** — `componentsWithUseClient()` does a flat `readdirSync` of
   that one directory while defending a site-wide claim.
3. **The range test never asserts the start.** `entry 50% entry 15%` satisfies
   both assertions. Given REQUIRED 1 is about the start, that is the half worth
   pinning.
4. **`globals.css` contradicts its own formula** — *"the band is at most
   `0.15·min(h, V)`: 120px at an 800px viewport, whether the block is 200px tall
   or 2400px"*. For a 200px block the band is 30px, not 120.
5. **A5's cost section understates the cost** — it names one 12px wrapper where
   10 are under 32px.
6. **`pnpm format:check` still fails**, now also on `design/LOOP_LOG.md`.
7. Cycle 1's RECOMMENDED 1, 2, 3, 4, 7, 8 remain open **by design**. #7
   re-confirmed latent-only: all 10 referenced chunks resolve, so T7–T9 are
   honest this cycle too.

### Threshold table

| ID | Metric | Baseline | Branch | Source (baseline → branch) | Verdict |
| --- | --- | --- | --- | --- | --- |
| T1 | LH performance, desktop | 100 | **100** (99/100/100) | `…/baseline/lh-desktop-{1,2,3}.json` → `…/branch-cycle2/lh-desktop-{1,2,3}.json` | PASS |
| T2 | LH performance, mobile | 98 | **96**; repeat set **97** | `…/baseline/lh-mobile-*.json` → `…/branch-cycle2/lh-mobile-{1,2,3}.json`, `…/branch-cycle2/repeat/lh-mobile-{4,5,6}.json` | **FAIL as measured — not attributable** (REQUIRED 4) |
| T3 | CLS, desktop | 0.0000 | **0.0000** | `…/branch-cycle2/lh-desktop-*.json` | PASS |
| T4 | CLS, mobile | 0.0000 | **0.0000** | `…/branch-cycle2/lh-mobile-*.json` | PASS |
| T5 | Accessibility, desktop | 100 | **95** (95/95/95) | `…/branch-cycle2/lh-desktop-{1,2,3}.json` | **FAIL** (REQUIRED 1) |
| T6 | Accessibility, mobile | 100 | **100** | `…/branch-cycle2/lh-mobile-*.json` | PASS |
| T7 | First Load JS, `/` (gzip) | 175.36 kB | **175.56 kB** | `…/branch-cycle2/first-load-js.json` (buildId `wOXMr0LHsp8dTn5MO3nl6`) | PASS |
| T8 | First Load JS, `/work/[slug]` | 312.09 kB | **311.87 kB** | same | PASS |
| T9 | First Load JS, shared | 165.16 kB | **165.16 kB** | same | PASS, unmoved |

Secondary: LCP desktop 545 → 556 ms, mobile 2475 → 2517 ms; TBT mobile
34 → 127 ms (repeat 107); best-practices 96 → 96.

### Orchestrator's ruling on REQUIRED 3's charter pin

The reviewer flagged, unprompted, that pinning a dev script to rule 13 is an
extension of a rule written about figures in the design records, and offered to
demote it to RECOMMENDED. **Ruling: it holds, and stays REQUIRED.** Rule 13 as
extended in `CHARTER.md` reads "every measurement in `design/BASELINE.md` and
`design/LOOP_LOG.md` cites the report file it was read from". `scripts/verify-
reveal.mjs` is cited as the measurement behind the cycle-1 fix in two places in
`globals.css` and in amendment A5. A cited source that can report success
without observing anything produces exactly the untraceable figure rule 13
exists to forbid. The pin is the rule working as intended, not a stretch.

### Verdict

**4 REQUIRED, 7 RECOMMENDED.** Cycle 1's findings 1 and 3 are fixed and the
mechanism verified. Finding 2 is fixed as the implementer defined it (≥15%
visible ⇒ opaque) — but the band it did not define, `0 < visible < 15%`, is
where the fix **broke a registered accessibility threshold**. That is the
headline. The rest: the timing band on short wrappers, a verification script
that cannot fail, and a mobile performance number the protocol cannot attribute.

---

## Cycle 3 — the fade removal and the length cap, re-audited, with a host control

Reviewed: working tree over `91abd50`. 1001 insertions / 119 deletions across 9
modified tracked files, plus 9 untracked paths. Every figure measured this
cycle; no report from `branch/`, `branch-cycle2/` or `impl-check/` reused.

**The protocol gained a host control, without mutating the tree.**
`git archive 91abd50` extracted to a temp directory outside the repo,
`node_modules` hardlink-copied from the repo (no install, no dependency), built
with the same `next build`, served on port 3100 while the branch served on 3000.
Lighthouse ran **interleaved**, alternating baseline and branch run-by-run in
one session, so machine drift lands on both. `git status --short` captured
before and after and identical; temp checkout deleted.

### REQUIRED

**Zero REQUIRED findings**

Cycle 2's REQUIRED 1, 2 and 3 all verify as genuinely fixed, mechanism checked
rather than comment read:

- **T5 repaired at the cause.** `color-contrast` items = 0 in 3/3 desktop
  reports, accessibility 100/100/100. Independently over CDP: at scroll 0,
  **141 wrapper observations** across 6 routes × three viewports read own-opacity
  and *effective* opacity (own × every ancestor) of **1.0000**. No `opacity` in
  `@keyframes reveal-rise` in source or emitted chunk.
- **The range resolves exactly as A6 claims.** Travel binary-searched per
  wrapper from the settled layout top — reading the rect mid-reveal is wrong by
  ~12px, the same trap as cycle 1's RECOMMENDED 1 — at **nine viewports, six of
  which the implementer never used** (1920×1080, 2560×1440, 3840×2160,
  1366×768, 768×1024, 320×568). Every wrapper on every route settles at
  `min(h, V, 135)` within **±0.6px**. Extremes 80.1px → 118.7ms and
  135.5px → 200.7ms.
- **The three 118ms wrappers really are as long as they can get** — the
  case-study closing block, h ≈ 80.5px, width-invariant from 320px to 3840px.
  Travel = h exactly, so the percentage half is already maxed; only a px floor
  could lengthen it, which is the thing the completion proof forbids.
- **A6's contrast arithmetic is right.** 7.576:1 at alpha 1, 4.403:1 at 0.72,
  4.687:1 at 0.75, crossing 4.5:1 at **0.7304**. The 0.5324 case composites to
  2.914:1, matching axe's quoted numbers.
- **A6's projection arithmetic is right**, and re-derived: 135²·sin3°/600 =
  **1.5896px**; peak of `p²(1−p)²` at p=0.5 is one sixteenth = **0.0993px**;
  the cap that would reach 12px is **370.9px**.
- **`verify-reveal.mjs` is no longer vacuous** — 26/26 cases, 141 wrapper
  observations, exit 0 clean; exit 1 against a dead port and four deliberate
  CSS mutations.
- **W3, W4, W5 re-verified from scratch**; cycle 1's numbers reproduce exactly.

### T2 resolved — *not the branch*, and the protocol's baseline is no longer reachable on this host

| mobile perf | n=3 (registered statistic) | n=6 | TBT median n=6 | benchmarkIndex |
| --- | --- | --- | --- | --- |
| baseline-then (`main` @ `91abd50`, 4h earlier) | **98** | — | 34 ms | 2739–2944 |
| **baseline-now** (`main` @ `91abd50`, same session) | **97** (97/96/97) | 97 | 105 ms | 1846–1855 |
| **branch-now** | **96** (96/97/96) | 96 | 107 ms | 1645–1857 |

Sources: `design/reports/baseline/lh-mobile-{1,2,3}.json` →
`design/reports/branch-cycle3/baseline-now/lh-mobile-{1,2,3}.json` +
`baseline-now/repeat/lh-mobile-{4,5,6}.json` →
`design/reports/branch-cycle3/lh-mobile-{1,2,3}.json` +
`repeat/lh-mobile-{4,5,6}.json`.

**Unmodified `main`, rebuilt and re-served in this session, also fails T2
(97 < 98).** The host is ~35% slower than the machine the threshold was frozen
on, and mobile emulation multiplies that through 4× CPU throttling into TBT.
The branch-vs-baseline gap on the same host in the same session is ≤1 point with
fully overlapping distributions (branch 96,97,96,96,97,97; baseline
97,96,97,97,97,97), +2 ms median TBT, LCP identical within 3 ms. Cycle 1
measured the branch at 98 = baseline on a fast host. **T2's failure is
host-attributable, not branch-attributable**, so the kill criterion is not in
play for any effect.

The control that *did* reproduce: the baseline rebuild reads **175.36 / 312.09 /
165.16 kB**, matching `design/BASELINE.md` to the last digit from a fresh build
(`…/branch-cycle3/baseline-now/first-load-js.json`, buildId
`HhMZy-J8h-awoHpgkq2bc`). The environment is faithful; only its speed drifted.

**For Sofia:** the registered T1–T6 numbers cannot currently be reproduced by
the commit they were registered from. Only Sofia may change a threshold.

### RECOMMENDED (accumulates for Sofia)

1. **A6's central proof is over-claimed — and it is the proof the kill criterion
   was invoked on.** The impossibility argument holds only for a ramp *spanning
   [0, 1]*. Muted text clears 4.5:1 at alpha ≥ 0.7304, so a continuous
   `opacity: 0.75 → 1` ramp is a fade, takes intermediate values, and has no
   sub-AA value anywhere. It would have passed T5 and breaches no charter rule.
   → **Escalated by the orchestrator into amendment A7**, since a kill criterion
   must not rest on an unsound argument. The decision was not reversed; the
   alternative is recorded for Sofia.
2. **"A floor cannot coexist with the completion invariant" overstates it.** The
   invariant's real quantity is `h + f`; the proof uses `min(h, V) ≤ h` only
   because that bound is document-independent. On the tightest block on the site
   (h = 309.0px, **f = 128.1px** beneath it) a 120px floor would have completed
   everywhere.

   > **CORRECTION, 2026-09-02 (authorised by Sofia, after cycle 4).** These two
   > figures are wrong. Re-measured at 1512×900: **h = 299.9px, f = 125.3px** —
   > matching `globals.css`, which cycle 3 contradicted. Source:
   > `design/reports/branch-cycle4/geometry.json`. Left above rather than
   > overwritten, so the record shows what was claimed and what corrected it.
   > **The conclusion is unaffected: 125.3 > 120**, so a 120px floor would still
   > have completed on that block, and the floor/ceiling asymmetry stands. Honest form: *a floor cannot be proved completable structurally;
   a ceiling can.* → also folded into **A7**.
3. **`verify-reveal.mjs` still cannot notice the effect's magnitude
   collapsing.** Demonstrated through a CSS-rewriting reverse proxy, no repo
   file touched:

   | mutation | script | caught by |
   | --- | --- | --- |
   | dead port | exit 1 | navigation check |
   | `opacity: 0` re-added | exit 1 | I4 + I2 |
   | `opacity: .75` re-added | exit 1 | I2 only (I4 passes at 4.69:1) |
   | range end → `entry 15%` | exit 1 | I3 |
   | cap → `min(100%, 400px)` | exit 1 | I3 |
   | **`rotateX` + `perspective()` deleted** | **exit 0** | nothing in the script |
   | **`translateY(12px)` → `translateY(0.4px)`** | **exit 0** | **nothing at all** |

   I3's only existence assertion is "the transform at entry is not the
   identity", which 0.4px satisfies. The **12px** that rule 2b and A6 both state
   is pinned by no check that runs. Also: I2/I3 coverage floors are literally
   `1` against 39 and 22 actual observations, and I3 measures only the *last*
   wrapper per case, so 26 of the 32 travels the stylesheet tabulates are
   unmeasured by the script the table cites.
4. **`EXPECTED_WRAPPERS` and `CASES` cover six of seven prerendered routes** —
   `/notes/[slug]` is in neither, so a `<Reveal>` added there would be invisible
   to the script. Latent only; confirmed 0 wrappers today.
5. **`scripts/measure-first-load-js.mjs` prints KiB and labels it "kB".**
   `/` is 175.36 **KiB** = 179.57 kB. Explicitly **not** a rule-13 breach — the
   figures reproduce exactly from the cited report (`"gzip": 179572` ÷ 1024 =
   175.36), so traceability is intact and T7–T9 are internally consistent. Only
   the unit label is wrong, identically on both sides of every comparison.
   **Left unfixed deliberately: the label appears inside `BASELINE.md`'s frozen
   threshold section, which only Sofia may edit.**
6. **The 0.18% horizontal figure is right but attributed to the wrong frame.**
   The 0.10px lift peaks at p = 0.5, where narrowing is 0.147% (2.23px);
   0.1745% / 2.638px is the peak of the *narrowing*, at p = 1/3. The worst case
   quoted is correct; only the "same factor" clause is loose.
7. **`CHARTER.md` quotes three comments that no longer exist** (rules 3, 11, 12).
   Addressed to the orchestrator, since the implementer must not edit the
   document it is audited against. → **Fixed**: the three quotes are now struck
   through with a note on what replaced them, and rule 12 carries the real
   nine-component count.
8. **`pnpm format:check` still fails** on `.claude/agents/*.md`, `design/*.md`
   and `scripts/measure-first-load-js.mjs`; 43 Lighthouse JSONs also fail and
   want a `.prettierignore` entry for `design/reports/`. Every modified tracked
   source file is clean. 186/186 tests, lint and typecheck clean.
9. **Cycle 1's RECOMMENDED 1 survives the fade removal** — `CardSpotlight` still
   caches card origins through a live transform; every wrapper on `/` carries a
   non-identity transform at scroll 0.
10. **Cycle 1's RECOMMENDED 2 and cycle 2's RECOMMENDED 3 are resolved.** The
    `transform: none` claim is corrected, and `Reveal.test.tsx` now pins the
    range start as well as the end. Cycle 1's 3, 4, 7, 8 and cycle 2's 1, 2, 4
    remain open by design.

### Behaviour matrix

All four paths verified for every W against the emitted chunk plus live CDP
measurement. Touch was emulated with **real device metrics + touch emulation**
(`matchMedia("(hover: hover) and (pointer: fine)")` confirmed `false`), not with
`setEmulatedMedia`, which does not move those features.

| W-step | reduced motion | touch | no JS | unsupported browser |
| --- | --- | --- | --- | --- |
| W1 reveal | ✅ 6/6 routes, **0 animations attached** | ✅ ungated | ✅ pure CSS; `data-reveal=""` with no inline style, no `<noscript>` needed — nothing can be stranded because nothing is hidden | ✅ exactly one `data-reveal` in the chunk, inside both guards |
| W2 tilt | ✅ same keyframe set | ✅ n/a | ✅ n/a | ✅ same guards |
| W3 parallax | ✅ `animation-name: none` on all 5 glow routes | ✅ correctly ungated | ✅ pure CSS | ✅ `@supports (animation-timeline: scroll(root block))` |
| W4 spotlight | ✅ `::before` `opacity 0` at rest | ✅ pseudo-element **does not exist** (`content: none`) under `hover: none` | ✅ gradient falls back to `50% 50%` | ✅ `@supports (mask-composite: exclude)` |
| W5 morph | ✅ explicit `::view-transition-*` reduce rule present and necessary | ✅ 4 cards, **exactly 1 `<a>` each** | ✅ `view-transition-name` appears **0 times** in all prerendered HTML | ✅ plain navigation |

### Threshold table

| ID | Metric | Baseline-then | Baseline-now (same host) | Branch | Verdict |
| --- | --- | --- | --- | --- | --- |
| T1 | LH performance, desktop | 100 | **100** | **100** (100/100/100) | **PASS** |
| T2 | LH performance, mobile | 98 | **97** | **96** | **FAIL as measured — host-attributable; `main` fails it too** |
| T3 | CLS, desktop | 0.0000 | 0.0000 | **0.0000** | **PASS** |
| T4 | CLS, mobile | 0.0000 | 0.0000 | **0.0000** | **PASS** |
| T5 | Accessibility, desktop | 100 | 100 | **100** (`color-contrast` items = 0) | **PASS — cycle 2's regression fixed** |
| T6 | Accessibility, mobile | 100 | 100 | **100** | **PASS** |
| T7 | First Load JS, `/` | 175.36 | **175.36** | **175.56** | **PASS** (≤177.36) |
| T8 | First Load JS, `/work/[slug]` | 312.09 | **312.09** | **311.87** | **PASS** (≤314.09) |
| T9 | First Load JS, shared | 165.16 | **165.16** | **165.16** | **PASS**, unmoved |

Sources: `design/reports/baseline/*` → `design/reports/branch-cycle3/baseline-now/*`
→ `design/reports/branch-cycle3/*` (branch buildId `o3wb1h14HldRUqnSxVd-6`).
Secondary: LCP desktop 545 → 556 → **555 ms**; LCP mobile 2475 → 2518 → **2515
ms**; TBT mobile (n=6) 34 → 105 → **107 ms**; best-practices 96 → 96 → **96**.

### Verdict

**Zero REQUIRED, 10 RECOMMENDED.** All three of cycle 2's actionable REQUIRED
findings are fixed, each mechanism re-derived independently. Cycle 2's REQUIRED
4 is *resolved rather than fixed*: a same-host control shows unmodified `main`
also missing T2. What remains is argument quality, not behaviour — chiefly that
the fade was removed on an impossibility proof a `0.75 → 1` ramp falsifies
(escalated to A7), and a verification script that still cannot notice the 12px
rise becoming 0.4px.

---

## Interruption between cycles 3 and 4 — an unattested measurement set, quarantined

A first cycle-4 reviewer stalled (machine sleep; the stream watchdog did not
recover) after completing a measurement run but **before writing any analysis**.
It is recorded here because the loop's evidence trail has to account for
measurements that were taken, not only for ones that were used.

**What it left.** Fourteen complete, parseable report files that had been
written into `design/reports/branch-cycle4/` — six Lighthouse runs against the
branch, six against a same-host baseline control, and a `first-load-js.json` for
each side.

**What was verified about the repository, from disk, before anything else.**

- `git status --porcelain` was byte-identical to a status the stalled agent
  itself captured before it began. Nothing staged; `git stash list` empty.
- `find src scripts -newer design/LOOP_LOG.md` returned nothing: **no source
  file was touched.** The reviewer contract forbids editing code, and it did
  not.
- `design/CHARTER.md` and `design/LOOP_LOG.md` were unmodified since the
  orchestrator wrote them.

So the branch itself was never in doubt. The question was only what to do with
the orphaned reports.

**Ruling (Sofia, R1): quarantine, do not cite.** The 14 files were moved out of
the deliverable to `scratchpad/unattested-cycle4-reports/` and **no figure from
them is cited anywhere in this log, in `BASELINE.md`, or in the final report.**
They are not reproduced here even as a footnote.

The reasoning is charter rule 13. The set is internally consistent — its branch
buildId matched the tree's `.next/BUILD_ID`, its `fetchTime` stamps genuinely
alternate between the two ports, and its baseline side reproduced
`BASELINE.md`'s JS figures exactly — but **no reviewer ever attested to how it
was produced**, because the agent stalled before writing a word. A figure whose
provenance rests on nothing but its own plausibility is precisely the
untraceable figure rule 13 exists to forbid, and its apparent agreement with
cycle 3's conclusions is a reason for more suspicion, not less: a number that
tells you what you already expect is the easiest kind to wave through.

Cycle 4 below therefore re-measured everything from scratch, including building
its own baseline control fresh via `git archive` of `91abd50`.

**Ruling (Sofia, R2): environment reset before cycle 4.** Two `next-server`
processes left listening (PID 37854 on `:3000`, cwd the repo; PID 38281 on
`:3100`, cwd a temp baseline checkout) were identity-verified and killed, both
ports proven free, and the temp checkout `scratchpad/ctrl-main` removed. A stale
server on `:3000` had already corrupted one measurement pass in cycle 1 — that
pass was caught and discarded by the cycle-1 reviewer — so clearing the ports is
a precondition of the protocol, not housekeeping.

---

## Cycle 4 — A7 re-derived, the rise and tilt measured, and a paired host control

Reviewed: working tree over `91abd50`, nothing committed. 1001 insertions / 119
deletions across 9 modified tracked files, plus 9 untracked paths. **No code has
changed since cycle 3**; `design/CHARTER.md` gained the rewritten and signed A7.
Every figure below was measured this cycle. No report from `branch/`,
`branch-cycle2/`, `branch-cycle3/` or `impl-check/` was reused, and the
quarantined set in `scratchpad/unattested-cycle4-reports/` was **neither opened
nor cited**.

**Protocol.** Branch built and served on `:3000`; `git archive 91abd50`
extracted to a temp directory outside the repo, `node_modules` clone-copied from
the repo (no install, no dependency), built with the same `next build`, served
on `:3100`. Lighthouse 12.8.2 ran **interleaved**, alternating run-by-run in one
session, so machine drift lands on both sides. `git status --porcelain` captured
before and after and verified identical; temp checkout deleted; both ports freed.

### REQUIRED

Both findings are **defects in the amendment record, not in the code.** The
shipped reveal animates no opacity at all, so no reader ever reaches any of
these alphas. They are REQUIRED because they are charter-rule violations inside
a **signed** amendment whose numbers are the registered basis for a
kill-criterion decision.

**1. A7's worst muted-text pair is not the worst pair the site renders, and the
0.75-floored ramp it evaluates is not a knife-edge — it is sub-AA.** Rule 7.

A7's four tabulated rows reproduce **exactly** under independent re-derivation
(page bg/page bg 7.576:1 → α 0.7304; card surface/page bg 7.169:1 → α 0.7497,
4.503:1 at α 0.75; glow rows 0.7048 and 0.7317), and the live instance was
reproduced: pointer resting on a project card on `/`, `p.text-muted` on
`hover:bg-surface`. The arithmetic is right. **The enumeration is not.**

An exhaustive sweep of every text/surface/backdrop triple **inside a
`[data-reveal]`**, across all 7 prerendered routes, at rest and after activating
all 86 in-Reveal controls, finds three pairs at or above A7's named worst:

| pair, all inside a `<Reveal>` | ratio at α=1 | crossing α | ratio at α=0.75 | where |
| --- | --- | --- | --- | --- |
| **`--color-danger` on its own 15% danger fill** `rgb(48.2, 28.0, 29.7)` | **5.789:1** | **0.8442** | **3.811:1** | `/work/media-automation-platform`, PipelineDiagram failed-stage `<text>`, `fillOpacity: 0.15` (`PipelineDiagram.tsx:76–87`) |
| `--color-danger` on page bg | 7.019:1 | 0.7663 | 4.353:1 | same route's "Simulate failure" switch label; `/work/lifespan-extract` GoldRecordInspector "no match" |
| `--color-muted` on `--color-surface` (A7's named worst) | 7.169:1 | 0.7497 | 4.503:1 | `/`, `/work/blotquant` |

Rule 7 requires a composite's bound stated "including the value that would break
it". A7 states that value as **0.7497** and claims its table was *"computed over
every surface pair the site renders — not one"*. The site renders a pair at
**0.8442**. The consequence reaches the sign-off, which records the basis as
*"the only ramp that never goes sub-AA clears the worst (muted / surface /
page-bg) pair by 0.0003 alpha"*: a `0.75 → 1` ramp does not clear every pair by
anything — it lands at **3.811:1** on danger-on-its-own-fill.

**This is an internal contradiction, not merely an omission.** The 5.8:1 figure
is *already in the charter's own rule 7 table* — "`--color-danger` | 7.0:1
(**5.8:1 as text on its own 15% fill**)" — and A7 did not carry it into its
enumeration. Verified independently by the orchestrator: the 15% fill composites
to `rgb(48.2, 28.0, 29.7)` and danger over it is 5.789:1, reproducing the
charter's registered 5.8:1.

**The decision is unaffected and, if anything, better supported**: the rejected
alternative is not merely un-robust, it is sub-AA on a pair the charter already
registers. What needs correcting is the exhaustiveness claim, the named worst
pair, the crossing alpha, and the sign-off's stated basis — **all of which is
signed text, so only Sofia may authorise the correction.**

**2. A7 and `globals.css` state different measured values for the same quantity,
and neither cites a report.** Rule 13 (as extended by the cycle-2 ruling).

`globals.css` says the tightest block on the site is `/`'s closing Contact block
at **299.9px** tall with **125px** beneath it. A7 — and cycle 3's RECOMMENDED 2,
which A7 folded in — says **h = 309.0px, f = 128.1px**. Measured this cycle at
1512×900: **h = 299.9px, f = 125.3px**. The stylesheet is right; A7 and this log
are wrong by ~9px and ~3px, and neither cites a source, so the charter cannot be
checked against itself.

A7's conclusion survives unchanged: 125.3 > 120, so "a 120px floor would have
completed there" still holds, and the floor/ceiling asymmetry is untouched.

**Zero behavioural REQUIRED findings.**

### The 12px rise and 3deg tilt, measured at runtime

Cycle 3 established nothing in the repository pins these. Confirmed here by two
independent measurements, **neither of which reads a number out of the
stylesheet**:

1. **Recovered from the rendered projection.** Every un-entered wrapper on all 6
   routes with reveals, computed transform sampled at a 3×5 point grid,
   `(translateY, tilt, perspective)` recovered by least squares against the
   projection model: **translateY = 12.000px, tilt = 3.000deg, perspective =
   599.79–600.00**, max RSS 0.0117 px².
2. **Pure geometry, no transform string read.** Bounding-rect delta between
   un-entered and settled: **riseObserved = 11.9709–11.9712px** on every wrapper
   of `/` and `/work/blotquant` — exactly `12·cos(3°)/(1 + 12·sin(3°)/600) =
   11.9711`. The same rows show **widthDelta = −0.7361px** on a 703px block,
   which is the tilt's horizontal foreshortening, confirming 3deg independently
   of the vertical term.

Rule 2b and A5/A6 are correct as written.

### Composition audit — what no per-step review saw

- **W1/W2 × W1/W2.** Smallest gap between consecutive wrapper tops is
  **194.5px** against a 135px range: **no two reveals are ever mid-range
  simultaneously**, at any viewport.
- **W2 × W3 × 2a.** In `/`'s first viewport the glow parallax, wrapper #1's
  reveal and the chevron nudge do overlap. All three are registered (2a chevron;
  2b reveal and glow container) and all are sub-pixel or 10%-opacity decorative;
  no objective rule 0 breach could be pinned, and none is claimed.
- **W2 × W4** — cycle 1's RECOMMENDED 1 **reproduces**: priming the spotlight
  origin cache mid-reveal leaves it **5.04px off in y, 0.60px in x,
  permanently**. Cosmetic against a 192px radius; the stated invariant is still
  wrong. Open by design.
- **W4 × W5 × W2.** All 14 `<h1>`/`<h3>` report `view-transition-name: none` at
  rest in all four fallback paths. Exactly **1 focusable `<a>` per card**,
  confirmed by keyboard traversal, with the spotlight staying at `opacity: 0`
  under `:focus-visible` — the documented deliberate asymmetry.

### Where earlier cycles did not look

- `/notes/[slug]`: 0 reveals, 0 glow, 0 spotlight cards, no `view-transition-name`,
  no overflow, at every viewport. Untouched by D1.
- **320px → 3840px**, 7 viewports × 4 routes × 6 scroll offsets: `scrollHeight`
  constant, minimum effective opacity **1.0000** everywhere, last wrapper at
  `matrix(1, 0, 0, 1, 0, 0)` at max scroll in **28/28** cases.
- **One horizontal-overflow case found and cleared.** `/work/blotquant` and
  `/work/lifespan-extract` gain 6px of scroll width at 320×568 from a long
  `a.link-underline` URL. Measured on the **baseline control at `91abd50`**:
  identical, 6px, same offender. **Pre-existing, not D1.**
- **Firefox-shaped case** (JS runs, `animation-timeline` unsupported): exactly
  one `[data-reveal]` selector in the chunk, inside both guards, declaring
  nothing when `@supports` is false. `.spotlight-card::before` sits in an
  independent `@supports (mask-composite: exclude)`, which Firefox satisfies —
  so the spotlight works while the reveal does not, and nothing depends on the
  reveal having run.

### RECOMMENDED (accumulates for Sofia)

1. **A7's reason for discounting its glow rows is not general**, though its
   conclusion holds. For text with no background of its own the surface *is* the
   tint, and muted-on-glow falls to 5.342:1 at α=1 (the charter's own 5.4:1),
   crossing at α **0.8817**. Real wrapper/glow overlap was found at 390×844 on
   `/work/mira` and `/work/media-automation-platform`, but the painted backdrop
   there samples `rgb(13, 13, 15)` — untinted, the gradients having faded out —
   so no rendered instance changes the worst case. Right conclusion, wrong reason.
2. **`verify-reveal.mjs` still cannot notice the rise or tilt collapsing**
   (cycle 3's RECOMMENDED 3). Its I3 line *prints* the entry matrix but the
   assertion behind it is still only "not the identity". This cycle's
   confirmation came entirely from external measurement.
3. **`pnpm format:check` still fails** on `.claude/agents/*.md`, `design/*.md`
   and `scripts/measure-first-load-js.mjs`; report JSONs push the total to 66
   files and still want a `.prettierignore` entry for `design/reports/`.
   186/186 tests, lint and typecheck clean.
4. **Lightning CSS still drops the explicit `0%`** from the range (cycle 2's
   RECOMMENDED 1); verified equivalent by measurement, not inspection.
5. **`measure-first-load-js.mjs` still prints KiB labelled "kB"** (cycle 3's
   RECOMMENDED 5). Identical on both sides of every comparison.
6. Cycle 1's RECOMMENDED 1, 3, 4, 7, 8 and cycle 2's RECOMMENDED 2, 4 remain
   open by design. Rule 12's count of **nine** re-verified.

### Behaviour matrix

| W-step | reduced motion | touch | no JS | unsupported browser |
| --- | --- | --- | --- | --- |
| W1 reveal | ✅ `animation-name: none`, **0 animations attached**, opacity 1 | ✅ ungated, scroll-driven | ✅ pure CSS; nothing to strand | ✅ 1 `[data-reveal]` in chunk, inside both guards → declares nothing |
| W2 tilt | ✅ same single `animation-name` | ✅ n/a | ✅ n/a | ✅ same guards |
| W3 parallax | ✅ `transform: none` | ✅ correctly ungated | ✅ pure CSS | ✅ `@supports (animation-timeline: scroll(root block))` |
| W4 spotlight | ✅ `::before` `opacity: 0` at rest | ✅ pseudo-element **does not exist** under `hover: none`; no listener | ✅ gradient falls back to `50% 50%` | ✅ `@supports (mask-composite: exclude)`, independent of the reveal's guard |
| W5 morph | ✅ explicit `::view-transition-*` rule present and necessary | ✅ 4 cards, **exactly 1 `<a>` each** | ✅ `view-transition-name: none` on all 14 titles | ✅ plain navigation |

Effective opacity (own × every ancestor) is **1.0000** for every wrapper in every
cell.

### Reveal travel — reproduces the stylesheet's table exactly

32 wrappers, 6 routes, 1512×900: `/` 135×5 · `/colophon` 135, 108.5, 135 ·
`/work/blotquant` 135×6, 81.6, 79.7 · `/work/lifespan-extract` 135×6, 81.6, 79.7
· `/work/media-automation-platform` 135×3, 81.6, 79.7 · `/work/mira` 135, 135,
81.6. All `= min(h, V, 135)`. Range **118.0–200.0ms**, exactly as rule 16 and A6
state.

### Threshold table

Paired, interleaved, same session, same host. `benchmarkIndex` **2763.5–2804.0**
across all 18 runs (registration was 2944.5; cycles 2–3 ran at 1612–1857).

| ID | Metric | Baseline-then | Baseline-now (`91abd50`) | Branch-now | Verdict |
| --- | --- | --- | --- | --- | --- |
| T1 | LH performance, desktop | 100 | **100** (100/100/100) | **100** (100/100/100) | **PASS** |
| T2 | LH performance, mobile | 98 | **98** (98/98/98) | **98** (98/98/98); n=6 also 98 | **PASS — host attribution confirmed** |
| T3 | CLS, desktop | 0.0000 | 0.0000 | **0.0000** | **PASS** |
| T4 | CLS, mobile | 0.0000 | 0.0000 | **0.0000** | **PASS** |
| T5 | Accessibility, desktop | 100 | 100 | **100** (`color-contrast` items = 0, 3/3) | **PASS** |
| T6 | Accessibility, mobile | 100 | 100 | **100** (`color-contrast` items = 0, 3/3) | **PASS** |
| T7 | First Load JS, `/` | 175.36 | **175.36** | **175.56** | **PASS** (≤177.36) |
| T8 | First Load JS, `/work/[slug]` | 312.09 | **312.09** | **311.87** | **PASS** (≤314.09) |
| T9 | First Load JS, shared | 165.16 | **165.16** | **165.16** | **PASS**, unmoved |

Sources — baseline-then `design/reports/baseline/*`; baseline-now
`design/reports/branch-cycle4/baseline-now/lh-{desktop,mobile}-{1,2,3}.json`,
`baseline-now/repeat/lh-mobile-{4,5,6}.json`, `baseline-now/first-load-js.json`
(buildId `G66RiylKcN8C1Ow0w1LWj`); branch-now
`design/reports/branch-cycle4/lh-{desktop,mobile}-{1,2,3}.json`,
`repeat/lh-mobile-{4,5,6}.json`, `first-load-js.json` (buildId
`4gs-pE3gjiSYjLMonniKt`). Secondary: LCP desktop 545 → 543 → **544 ms**; LCP
mobile 2475 → 2476 → **2476 ms**; TBT mobile (n=6) 34 → 31 → **34 ms**.

**T2 is resolved, not excused.** Cycle 3 could only show `main` failed it too on
a slow host. On a host back at registration speed **both sides read 98** — the
branch reproduces the registered number exactly, and the baseline rebuild
reproduces `BASELINE.md`'s JS figures to the last digit. The registered T1–T6
numbers *are* reachable from the commit they were registered on; cycles 2 and 3
ran on a machine ~35% slower. Nothing about T2 is charged to this branch.

### Verdict

**2 REQUIRED, both non-behavioural and both in the amendment record; 6
RECOMMENDED.** All nine thresholds pass, including T2, on a paired same-session
control. Every W-step is correct in all four fallback paths, the 12px rise and
3deg tilt are confirmed at runtime by two independent measurements, and the
composition of W1–W5 on `/` holds.

**The reviewer declined to use the stopping phrase**, and said why: the stopping
rule counts *behavioural* REQUIRED findings, of which there are none, but both
its findings sit in signed text it cannot edit, so whether the rule is satisfied
is Sofia's call and not its own. Recorded here as it was written rather than
resolved by the orchestrator.

---

## Loop closed — 2026-09-02

**Closed by Sofia after cycle 4.** Cycles 3 and 4 both returned **zero
behavioural REQUIRED findings**, which is the stopping rule as registered at the
top of this file. No cycle 5 was run; the cap was 5 and was not reached. **No
code changed after cycle 2's fix** — cycles 3 and 4 are pure verification of a
frozen tree.

| cycle | REQUIRED | of which behavioural | RECOMMENDED | outcome |
| --- | --- | --- | --- | --- |
| 1 | 3 | 3 | 8 | fixed in full |
| 2 | 4 | 3 (+1 threshold, not attributable) | 7 | 3 fixed; T2 withheld from the implementer |
| 3 | 0 | 0 | 10 | clean; T2 shown host-attributable |
| 4 | 2 | **0** | 6 | charter-text defects only; corrected below |

### Cycle 4's two REQUIRED findings — resolved as charter corrections

Both sat in signed text the reviewer could not edit, and it declined to use the
stopping phrase rather than round in its own favour. Sofia authorised five text
edits (C1–C5); none touches a line of code.

- **C1** — A7's worst pair replaced: `--color-danger` on its own 15% fill,
  **5.789:1** at α=1, crossing **0.8442**, **3.811:1** at α 0.75. A `0.75 → 1`
  ramp is *plainly sub-AA* there, not marginal. Cross-referenced to rule 7's
  table, which already registered 5.8:1 — a figure A7 failed to carry forward
  from the same file.
- **C2** — A7's exhaustiveness claim **withdrawn outright**. It now names the
  four muted-text pairs it actually computed and states the enumeration is not
  proven complete.
- **C3** — h/f corrected to **299.9px / 125.3px**, measured at 1512×900 and
  cited to `design/reports/branch-cycle4/geometry.json`. Cycle 3's entry above
  carries a dated correction rather than a silent overwrite. **The conclusion
  survives: 125.3 > 120**, so the floor/ceiling asymmetry stands.
- **C4** — the sign-off's registered basis replaced. The fade is not restored,
  now on the ground that **the alternative recorded in A7 does not exist**.
- **C5** — new **charter rule 17, "Contrast claims are enumerated, never
  universal."** Registered after the same defect appeared three times: in A6, in
  A7's correction of A6, and in A7 itself. Each iteration was more careful than
  the last and each still over-reached, which is why the rule constrains the
  *form* of the claim rather than asking for more care.

### What the loop actually caught

Recorded because the cost of four review cycles is only justified by what they
found that tests did not:

1. **A permanently faint content section** above a ~1210px viewport (cycle 1) —
   0.365 opacity at 2400px, body text under 4.5:1 for the life of the page,
   reachable by browser zoom-out alone. 182 tests passed over it.
2. **A frozen accessibility threshold broken by the fix for (1)** (cycle 2) —
   T5 100 → 95, deterministic 3/3. The cycle-1 fix converted "invisible at first
   paint" into "illegible at first paint", and only the second is visible to an
   audit.
3. **A verification script that passed against a dead port** (cycle 2), while
   being cited in two places as the measurement behind a fix.
4. **A threshold failure that was not the branch's fault** (cycles 2–3) — T2
   held for the host, not the code, proven by an interleaved same-session
   control in which unmodified `main` also failed.
5. **Three successive over-claimed contrast proofs** (cycles 3–4), the last of
   which contradicted a figure already registered in the same document.

None of these were found by `pnpm test`, which passed at every point. Findings 1,
2 and 5 were found by *measuring what the comments asserted*; 3 and 4 by
*distrusting the measurement apparatus itself*.

### Status at close

All nine thresholds pass, on a paired same-session control at a host
`benchmarkIndex` back in the registration band. Every W-step is correct under
reduced motion, touch, no-JS and unsupported-browser. The 12px rise and 3deg
tilt are confirmed at runtime by two independent measurements, after cycle 3
established that no check in the repository would notice them collapsing.

**Open, and going to Sofia rather than into the branch:** 14 RECOMMENDED items
across four cycles, listed in the final report. Nothing is committed, staged,
merged, or pushed.

---

## W5 partially reverted — 2026-09-02

**The shared-element morph never worked. It was reported landed twice on static
evidence.** This entry exists because the failure mode is the interesting part,
not the bug.

### What was claimed, and on what evidence

W5 was reported complete after implementation, and confirmed again in review.
The evidence in both cases was **static** and every piece of it was true:

- four `vt-name` attributes in the prerendered HTML, one per project, verified
  unique against `src/content/projects.ts`;
- `view-transition-name` = `none` on all 14 `<h1>`/`<h3>` at rest, and
  `grep -c view-transition-name` = 0 across every prerendered page — which was
  checked because a live name would have made the `<h3>` a containing block and
  collapsed the card's stretched hit target (charter 9);
- `<ViewTransition>` renders no DOM node, verified against the emitted HTML;
- the `::view-transition-*` reduced-motion rule verified necessary, because the
  blanket `*, *::before, *::after` rule provably cannot reach that tree;
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all passing.

None of it observed the effect.

### What actually happens at runtime

Measured in headless Chrome 152 against the production build, twice — once
plain, once after forcing prefetch by hovering the link and waiting 2.5s:

```
browser supports startViewTransition: true
startViewTransition calls: 1
ALL pseudo-elements animated at any frame:
    ::view-transition-old(root)
    ::view-transition-group(root)
    ::view-transition
named project-title groups present: 0
view-transition-name on the source <h3> during transition: ["none","(detached)"]
```

React **did** call `document.startViewTransition`, and a root crossfade ran. But
`view-transition-name` stayed `none` on the source `<h3>` for the entire
transition, and **no `::view-transition-group(project-title-*)` ever animated.**
The pair never formed. What shipped was a whole-page crossfade, not the
card-title ↔ page-title morph W5 was specified to deliver.

`default="none"` was tested as a suspect and cleared: removed from both sides,
rebuilt, retested — identical result, zero named groups.

### Cause

`package.json` pins `react` and `react-dom` at **19.2.8**, and
`require("react").ViewTransition` is **`undefined`**. Only Next's vendored
`19.3.0-canary-cbb046ab-20260731` exports it (`typeof` → `symbol`). The App
Router compiles app code against the vendored canary, which is why the component
rendered and the attributes appeared at all — but the morph is deferred to a
React version that actually ships the export.

**`src/react-canary.d.ts` was not load-bearing**, contrary to its own doc
comment. Deleting it leaves `pnpm typecheck` at exit 0 with the incremental
cache cleared, because `node_modules/next/dist/types.d.ts:3` already carries
`/// <reference types="react/experimental" preserve="true" />`, and
`@types/react/experimental.d.ts` declares `ViewTransition`. Next supplies the
type globally. A probe import of a nonexistent export (`DefinitelyNotAThing`)
fails with `TS2305`, so typecheck was genuinely checking these imports — the
type really was there, from a declaration file, for an export the pinned runtime
does not ship.

### What was removed, and one thing that could not be kept

Removed: `src/react-canary.d.ts`; both `<ViewTransition>` wrappers and their
imports; the four `project-title-*` names; and the
`::view-transition-group(.project-title)` duration rule, whose class nothing
applied any more.

Kept: `::view-transition { pointer-events: none }` and the
`prefers-reduced-motion` block — both **currently inert**, and marked as such in
`globals.css`. Both remove a user-agent default rather than adding motion, so
neither can introduce anything while dormant.

**The root crossfade could not be kept, and the ruling that asked for it was
not satisfiable.** Measured after the revert: `startViewTransition calls: 0`.
The crossfade was a by-product of the named `<ViewTransition>` components, not
an independent feature. An unnamed `<ViewTransition>` was tested as a way to
keep it without the dead attributes: it emits no `vt-name`, and it also produces
`startViewTransition calls: 0`. So keeping the crossfade requires keeping
exactly the named plumbing that was ordered removed. Removal was chosen, since
the substantive instruction was to remove anything claiming a morph that does
not happen. **Restoring the crossfade is available to Sofia at the price of
re-adding the four dead names.**

### Status

**Deferred, not delivered.** The morph is in the backlog with its precondition:
a React version that exports `ViewTransition`. Upgrading React is Sofia's gate
and is not part of D1.

### Backlog addition — deferred shared-element morph

**Item: the project card title ↔ case-study title morph (W5's original goal).**

- **Status:** deferred, not delivered. Removed from the branch rather than
  shipped inert.
- **Precondition, and it is hard:** a React version whose `react` package
  actually exports `ViewTransition`. `package.json` pins 19.2.8, where
  `require("react").ViewTransition` is `undefined`; only Next's vendored
  19.3.0-canary exports it. Until the pinned version ships the export, the
  component can render and emit attributes without the pair ever forming —
  which is exactly the failure that was mistaken for success.
- **Not attempted, and deliberately so: upgrading React is Sofia's gate and is
  not part of D1.** No dependency was added, changed, or bumped in this phase.
- **When it is retried, it must be accepted under charter rule 18**: a runtime
  observation of `::view-transition-group(project-title-*)` actually animating.
  Unique names, absent names at rest, and a green chain are not sufficient — all
  five were true of the version that did not work.
- **Related, and Sofia's call:** the root crossfade can be restored at the price
  of re-adding the four dead `project-title-*` names, since it is a by-product
  of the named components rather than an independent feature.
