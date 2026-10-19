**Title:** Scroll cue at page load: its fade covers "Selected work" (2.797:1) and its wrapper takes clicks from links beneath it

**Labels:** a11y, follow-up

Both problems come from `ScrollCue.tsx` while the page is at the top
(`scrollY` ≤ 24), before the cue hides. Both are on main at `39fb47c` and
unchanged by `fix/danger-contrast`.

### 1. The fade covers text: "Selected work" on `/` at 768 px

`.scroll-cue__fade` is a 140 px `linear-gradient(to top, var(--color-bg),
transparent)`, fixed to the viewport bottom. At 768×900 it lies over the
"Selected work" heading (`h2.text-muted`, muted text).

- T10 scores the heading **4.589:1**, but that counts only what is painted
  beneath it.
- With the fade composited (alpha 0.362 at the heading's midline) it is
  **2.797:1** over the T10 worst underlay and **3.696:1** on plain
  `--color-bg` (`design/reports/danger-contrast/evidence/scroll-cue-fade-composite.json`). Both are below AA
  (4.5:1).

T10 now detects paint above text and fails on it (ruling, Sofia,
2026-10-19). This node is the one entry in the exclusion list in
`design/BASELINE.md` ("T10 paint-above exclusions"), and the entry points
here. Fixing this means removing that entry. The audit fails the run if an
entry matches nothing, so the list cannot go stale.

T10 measures at a 900 px viewport height only. At other heights the fade
lies over different text. For example, at 1280×720 the fade starts at
y = 580 and the hero links sit at 651–689.

### 2. The wrapper takes clicks from links beneath it (noted 2026-10-16)

The outer `div.scroll-cue` is `fixed inset-x-0 bottom-0 z-10`. It is full
width and about 66 px tall, and it does not have `pointer-events-none`. Only the
fade inside it has that class. So the transparent band along the bottom of the
viewport intercepts clicks meant for anything under it.

Measured on the `fix/danger-contrast` build: `elementFromPoint` at each link's
visible centre inside the band, at scroll 0, after load.

| Viewport | Links whose click lands on `.scroll-cue` |
| --- | --- |
| 1280×720 | hero GitHub, LinkedIn, Email, CV (PDF) |
| 390×667 | hero GitHub, LinkedIn, Email |
| 768×900 | `lifespan-extract` card link (partly in view) |
| 1440×900, 1440×800, 768×1024, 390×844, 375×667 | none |

Probe: `design/drafts/issue-scroll-cue-overlay.probe.mjs`; its output is in
`design/drafts/issue-scroll-cue-overlay.probe.txt`. It is a scratch
script and expects `pnpm start -p 3201`.

### To decide

- **Clicks:** put `pointer-events-none` on the wrapper. The anchor already
  has `pointer-events-auto`, so it stays clickable.
- **Contrast:** either keep the fade clear of text at the top of the page
  (shorter, or tied to where the first content starts), or give it a tint
  that keeps AA for muted text beneath it. Either one changes shipped CSS and
  needs screenshots and a full re-measure.
- **Scope of T10:** decide whether it should also run at a short viewport
  (e.g. 720 px) so that paint above text at other heights is caught.
