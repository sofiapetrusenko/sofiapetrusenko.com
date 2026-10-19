# Paint-above exclusions for the contrast-audit self-test

Test-only, in the format of the list in `design/BASELINE.md` ("T10
paint-above exclusions"). Read by `contrast-audit.selftest.mjs` through
`--exclusions`; the audit itself defaults to BASELINE.md.

<!-- T10 paint-above exclusions: begin -->
| route | width | selector | text | paint above | issue |
| --- | --- | --- | --- | --- | --- |
| `/fixture` | 768 | `p` | "CASE-above-excluded" | `div.cover-listed` | fixture |
| `/refuse-stale-exclusion` | 1440 | `p` | "CASE-refuse-stale-exclusion" | `div.cover-listed` | fixture |
| `/fixture-above-mismatch` | 768 | `p` | "CASE-above-m" | `div.cover-listed` | fixture |
| `/fixture-above-listed` | 1440 | `p` | "CASE-above-ok" | `div.cover-listed` | fixture |
| `/fixture-above-listed` | 768 | `p` | "CASE-above-ok" | `div.cover-listed` | fixture |
| `/fixture-above-listed` | 390 | `p` | "CASE-above-ok" | `div.cover-listed` | fixture |
<!-- T10 paint-above exclusions: end -->
