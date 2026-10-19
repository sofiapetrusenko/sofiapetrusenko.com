**Correction to the T10 row above.**

This PR reported T10 as "0 of 1,782 nodes below AA (tightest 4.59:1)". That is
wrong. The code merged here (`39fb47c`) has **58 text nodes below WCAG AA** as T10
scores them, plus one under paint above it (below):

- **24 `--color-danger` nodes:**
  - 21 as text at 4.252:1;
  - 3 as the failed stage's label on its 15% fill at 3.537:1.
- **34 selected-stage labels:** `--color-accent` on the stage's 12% fill at
  4.402:1.

A 59th node sits under paint rather than over it: "Selected work" on `/` at
768 px, below the scroll-cue fade at page load. That is 2.797:1 with the
fade composited (T10 scores 4.589:1 on what is beneath it). It is tracked
separately in #21 and recorded as T10's one exclusion.

The 58 are measured over 2,930 nodes with the committed audit
(`scripts/contrast-audit.mjs`) on a fresh build of `39fb47c`.

The audit behind the original row was never committed. It also did not open
tab panels or switches, and it did not see fills painted beneath text by
sibling elements. The favicon exemption in the Lighthouse runs was likewise
applied by an uncommitted filter. The T1–T9 figures are unaffected.

Details and per-route counts: #23. Fixed in #25: CHARTER A11 (danger
→ `#fca5a5`) and A12 (selected-stage labels in `--color-fg`). That PR also adds
the committed audit, which ships with a known-answer self-test.
