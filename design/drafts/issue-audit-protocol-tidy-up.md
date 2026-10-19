**Title:** Audit and protocol tidy-up

**Labels:** none

These are the non-blocking items left open when the `fix/danger-contrast`
review loop closed (PR #25), after five cycles. None of them changes a
T10 result on the current site. Item 3 has a ruling and must be implemented
before the next PR's measurement.

### First, in the next PR (#21): limit Tailwind's source scanning

**Ruling (Sofia, 2026-10-19):** this is the first item of the next PR, #21.
Restrict Tailwind's source scanning to exclude `scripts/` and `design/`, for
example with `@source not` in `src/app/globals.css`.

**Why.** Tailwind v4 detects sources automatically and scans every file git
does not ignore, including the audit scripts, their fixtures, the drafts and
the committed Lighthouse JSON. Any string there that reads as a class name
becomes shipped CSS.

- In PR #25, from commit `1efcc33`, a self-test case name added one 21-byte
  rule, Tailwind's zero-opacity utility (`opacity: 0`). The case was renamed.
- Tailwind's own scanner finds four more such utilities in the measured build
  that come only from `scripts/` and `design/`: `.backdrop-filter`,
  `.contents`, `.isolate`, and an invalid `.\[xml\:lang\]{xml:lang}` taken
  from a Lighthouse report. `src/` uses none of them.

So this change removes those four rules from shipped CSS. It cannot be checked
for byte-identity; it needs its own CSS diff and a full measurement.

### 1. Paint-above detection scope (needs a ruling)

`design/BASELINE.md` ("T10 method", "Not detected") lists what paint-above
detection does not read:

- borders, outlines and `box-shadow`;
- SVG strokes;
- the glyphs and `text-shadow` of an overlapping element;
- `filter`, `backdrop-filter` and `mix-blend-mode`;
- pseudo-elements that paint only content (including a `content: url(...)`
  image, which the list does not yet name);
- anything between the sample points;
- any viewport other than 1440/768/390 px wide by 900 px tall, at the scroll
  offset each node is sampled at.

Decide whether to extend detection to any of these.

### 2. CHARTER A11's breaking value (needs a ruling)

A11's last sentence says "anything darker than `#faa0a0` on this hue" breaks
the bound. The superseding note of 2026-10-19 covers only "least
lightening". `#f9a0a0` is darker and still clears, at 4.5006:1. The first
value that breaks is `#f8a0a0`, at 4.4869:1.

### 3. Warm-up runs: implement the protocol (ruled)

**Ruling (Sofia):** the warm-up is one mobile and one desktop run per side.
Their reports go in a `warmup/` subfolder and are never counted by
`scripts/lh-summary.mjs`. Implement this before the next PR's measurement.

To do:

- Record the form factors and the `warmup/` location in BASELINE ("Protocol
  — warm-up run").
- Make `lh-summary.mjs` refuse any report path under `warmup/`, so a glob
  cannot count one by mistake.

### 4. The one exclusion depends on timing

The exclusion for "Selected work" relies on the scroll cue's fade being at
full opacity when `collect()` samples at `scrollY` 0. If the first frame is
slow, the entry matches nothing and the run fails. That failure is safe, but
only one real run per side shows the entry holds. Run the real audit
repeatedly, as was done for the self-test.

### 5. The stale-entry check only covers audited routes

An entry whose route is not in the run's route list, such as a typo like
`/index` or a route later dropped from `ROUTES`, never matches and never
fails. This is also safe, since the entry excludes nothing. On a run with the
default routes, reject any entry whose route is not in `ROUTES`.

### 6. Exclusions are coarse

- An entry names the overlay by tag plus its first three classes, and an SVG
  element by tag alone (`describe()` skips `SVGAnimatedString` class names).
- It does not check what the overlay paints, or how strongly.
- The fade shows only at the top of the page, and only the text sampled
  there sees it.

Consider:

- matching on `paints`, or on a hash of the computed background;
- a dedicated paint-above pass at scroll 0 over every node in view;
- recording `scrollY` with each sample.

### 7. Provenance in the audit JSON

The report does not record the script version, the exclusion table, or the
served build ID. Write `sha256(contrast-audit.mjs)`, a hash of the exclusion
table, and the build ID into the JSON.

### 8. Small items

- Commit the mutant logs as evidence. Today only the stability logs are
  committed.
- Rename `contrast-audit.cycle1.*` to `post-cycle1`; those files are the
  audit taken after review cycle 1.
- The audit's header comment repeats the "Not detected" list and is already
  behind BASELINE. Point it at BASELINE instead.
- Wrap the long lines in BASELINE's T10 method and self-test stability
  bullets.
- Native form controls (`<progress>`, `<meter>`, range inputs with
  `appearance: auto`) appear in neither the detected list nor the
  not-detected list.

### 9. Loop log

The five review cycles of `fix/danger-contrast` are not recorded in
`design/LOOP_LOG.md`, which holds only the D1 loop.
