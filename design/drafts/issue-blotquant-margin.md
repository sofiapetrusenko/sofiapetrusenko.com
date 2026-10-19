**Title:** Pressed toggle text clears AA by only 0.07 (4.570:1) on blotquant and lifespan-extract

**Labels:** a11y, follow-up

### What

A pressed toggle button (`button.cursor-pointer.rounded-sm.border`) has
`--color-accent` text on a 10% accent fill. Against the T10 worst-case
underlay (`scripts/contrast-audit.mjs`; method in `design/BASELINE.md`, "T10
method") that is **4.570:1**, for **54 nodes**:

| Route | Nodes per width | Total | Buttons |
| --- | --- | --- | --- |
| `/work/blotquant` | 13 | 39 | the inspector's parameter buttons, e.g. `profile_smoothing_px`, `band.baseline_percentile` |
| `/work/lifespan-extract` | 5 | 15 | `records`, `quote checker`, `decrease`, `increase`, `no_effect` |

Source: `design/reports/danger-contrast/branch/contrast-audit.json`, which
covers every node at 4.570 across 1440, 768 and 390 px. Each node is counted
once, at its worst state.

That passes WCAG 2.1 AA (4.5:1). After `fix/danger-contrast` it is the tightest
pair on the site, but the margin is 0.07. It is the same pairing that failed in
the pipeline diagrams (accent text on its own accent fill, CHARTER A12), only
at 10% rather than 12%.

### Why it matters

It passes today, but nothing guards the margin:
- With a 5% glyph cap, the same audit already puts these buttons at
  4.499:1.
- Raising the fill to 12% gives 4.40:1, which is exactly A12's failure.

### Out of scope for `fix/danger-contrast`

That PR fixes only the pairs that shipped below AA in #17. This pair was never
below AA.

### To decide

- Widen the margin, e.g. with fg text on the pressed toggle as A12 did for
  stages. That needs a CHARTER amendment and screenshots.
- Or record the margin as accepted, and recheck this pair whenever the fill,
  the glyph cap, the glows or the accent token change.

### Reproduce

Run `pnpm build && pnpm start -p 3201`, then:

```
node scripts/contrast-audit.mjs http://localhost:3201 --routes /work/blotquant,/work/lifespan-extract --json out.json
```

Count the nodes in `out.json` whose `ratio` is below 4.575. There should be
54: 39 on blotquant and 15 on lifespan-extract.
