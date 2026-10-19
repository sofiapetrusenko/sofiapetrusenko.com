**Title:** #17 shipped 58 text nodes below WCAG AA (danger and selected-stage pairs)

**Labels:** a11y, bug

### Summary

PR #17 (`39fb47c`) reported T10 as "0 of 1,782 nodes below AA". The code it
shipped has **58 text nodes below WCAG 2.1 AA as T10 scores them**, under the
T10 worst-case underlay
(`design/BASELINE.md` → "T10 method"), in two colour pairs. Both are fixed in
`fix/danger-contrast` (PR #<n>).

One more node is below AA on `39fb47c` but is not among the 58: "Selected
work" on `/` at 768 px. The scroll-cue fade is painted *above* it at page load.
T10 scores it on what is beneath it (4.589:1). With the fade composited it is
2.797:1. The audit now detects paint above text. This node is the one
recorded exclusion in BASELINE, tracked in its own follow-up issue (#<scroll-cue
issue>), and is not fixed by `fix/danger-contrast`.

Measured on main `39fb47c` (fresh build `9cSYEmW-ULaHXwrJpQZ6s`) with the committed
audit `scripts/contrast-audit.mjs`: 2,930 text nodes across 47 page states per
width, at 1440/768/390 px, 0 unmeasured, 0 covered by paint above, 1 excluded
(the node above). Report:
`design/reports/danger-contrast/main/contrast-audit.{json,txt}`.

### Pair 1 — `--color-danger` `#f87171`: 24 nodes

| Use | Ratio | Nodes | Where |
| --- | --- | --- | --- |
| Danger text over the worst underlay | 4.252:1 | 21 | `/work/lifespan-extract` quote-checker tab (5 per width); `/work/media-automation-platform` failure simulation (2 per width) |
| Failed stage's SVG label on its own 15% danger fill | 3.537:1 | 3 | `/work/media-automation-platform`, failure simulation on (1 per width) |

### Pair 2 — selected stage label, `--color-accent` on its own 12% accent fill: 34 nodes

| Use | Ratio | Nodes | Where |
| --- | --- | --- | --- |
| Selected pipeline stage label | 4.402:1 | 34 | `/work/media-automation-platform` (7 per width); `/work/lifespan-extract` (5 at 1440 and 768, 3 at 390) |

The nodes are counted once each, at their worst state; the states come from
pressing each stage button and turning on the failure switch.

### Why #17 reported 0

- **Its audit was never committed.** It was an ad-hoc method that did not open
  tab panels (`aria-pressed` / `role="tab"`) or switches. So it never saw the
  quote-checker tab, the failure simulation, or any selected stage except the
  default one.
- **It inferred each node's underlay from its ancestors** and missed fills that
  are painted under the text but are not its ancestor. A sibling SVG `<rect>`
  under an SVG `<text>` is one: that is how both stage-fill pairs are drawn.
- **The favicon exemption was applied by an uncommitted filter.** This doesn't
  change any T10 number; it is one more #17 check that ran outside committed
  code.

### Fix (in `fix/danger-contrast`)

- `--color-danger` → `#fca5a5` (CHARTER A11): 6.20:1 as text, 4.66:1 on its 15%
  fill.
- Selected stage labels → `--color-fg` (CHARTER A12): 7.71:1 on the 12% fill.
  Border and fill still mark the selection.
- T10 is now committed code. It opens every disclosure, tab and switch, and
  hit-tests what is painted beneath each node (`elementsFromPoint`). It waits
  for finite animations and checks that each state actually holds. Any node it
  cannot measure fails the run, and so does any node with paint above its text
  that BASELINE does not list. A known-answer self-test,
  `node --test scripts/contrast-audit.selftest.mjs`, validates it.

After the fix: 0 of 2,930 below AA; the tightest node is 4.570:1. "Selected
work" at 768 px stays excluded until its follow-up lands.
