# Design Charter

The rules this site already follows, lifted out of the comments that state them
in `src/app/globals.css` and `src/components/*.tsx`. Nothing here is new taste;
every rule cites where it is already written down. Rule 0 is the one addition,
registered for D1.

The design reviewer audits against **this file**, not against preference. A
finding must cite a rule number.

---

## 0. One signature effect per viewport; everything else supports it

At any scroll position there is exactly one thing asking to be looked at. Every
other moving or lit element is either static or subordinate to it. If a new
effect competes with the signature effect of its viewport, the new effect loses.

*Registered for D1. It is the generalisation of the rules the site already
applies one at a time: the glow drifts on the home hero and nowhere else
(`PageGlow.tsx`), the chevron is "the only other thing on this page that moves
without being asked to" (`Hero.tsx`).*

## 1. Depth is one surface step and a 1px hairline — no shadows, no blur

`--color-bg` → `--color-surface` is the entire depth vocabulary, plus
`--color-hairline` / `--color-hairline-bright`.

> "Depth comes from one surface step and a 1px hairline — no shadows or blur."
> — `globals.css`, palette header

Restated where it would have been easy to break:

> "No blur and no shadow; depth on this site is one surface step and a
> hairline." — `globals.css`, `.scroll-cue`

## 2. Movement is scarce, and every element allowed to move is named

Motion is a closed list, not a style. **Amendment A2** split the list in two:
*unprompted* motion runs on an idle page and is the scarcer, costlier kind;
*prompted* motion is driven by the reader's own scroll and stops when their hand
stops. Both are listed; a new entry in either is a charter change and the table
must be updated in the same diff.

### 2a. Unprompted — runs with no input, on an idle page

| Element | Where it is allowed | Source |
| --- | --- | --- |
| The two page-glow tints | home hero **only**, via the `drift` prop | `PageGlow.tsx`, `.page-glow--drift` |
| The scroll-cue chevron | home page, 6px nudge | `.scroll-cue__chevron` |
| The timeline ring | current role only **unless undisclosed**, opacity only | `.timeline-pulse` |
| The redaction bar | the undisclosed role only, opacity only, 2s | `.redaction__segment` |

> "Drifts, and only here. The scroll cue's chevron is the only other thing on
> this page that moves without being asked to." — `Hero.tsx`

> "Off everywhere but the home page hero: movement suits a landing page and
> competes with a chart someone is reading numbers off." — `PageGlow.tsx`

### 2b. Prompted — driven by the reader's scroll, still and silent when they are

| Element | Where | Rate / travel | Source |
| --- | --- | --- | --- |
| `[data-reveal]` wrappers | every page that uses `<Reveal>` | **12px rise + 3deg tilt, no opacity** over `entry 0% → entry min(100%, 135px)` | `reveal-rise`, `globals.css` (W1, W2; range corrected in cycle 1 per A5, fade removed and range capped in cycle 2 per **A6**) |
| The page-glow **container** | home hero **only**, same `drift` opt-in | 8vh of lag over the first 100vh of scroll | `glow-parallax` on `.page-glow--drift`, `globals.css` (W3) |

Prompted motion is held to a lower bar than unprompted motion — it cannot
pester a reader who is not scrolling — but it is **not** exempt: rule 0 still
caps it at one signature effect per viewport, rules 3 and 5 apply unchanged,
and it is listed here so the count stays visible.

**Pointer-prompted effects are out of scope for this rule** — see amendment A3 —
as are **navigation-prompted** ones (A4). Both are governed by rules 4
(hover-only gains) and 5 (transform/opacity only) instead. The axis rule 2
grades is *how much the reader asked for it*: 2a is asked for not at all, 2b
only while their hand moves, and past those lie effects that exist solely under
a pointer they are steering or a link they have just clicked.

## 3. Reduced motion removes motion, never content and never affordance

The pattern is fixed: the **resting, static state lives outside** the media
query, and only the animation is declared inside
`@media (prefers-reduced-motion: no-preference)`.

> "the base opacity lives outside the query so reduced motion keeps a static
> ring rather than losing it." — `.timeline-pulse`

> "Declared under `no-preference` exactly like `.page-glow--drift`, so asking
> for less motion leaves a still chevron rather than removing the cue; the
> opacity transition above is outside the query and applies to everyone."
> — `.scroll-cue__chevron`

> ~~"The hidden state only exists under `no-preference`, so with reduced motion
> requested the content is simply visible"~~ — `[data-reveal]`. **Stale as of
> A6**: the reveal no longer animates opacity at all, so it has no hidden state
> under any condition. The rule this quote illustrated still stands and is now
> illustrated by `.timeline-pulse` and `.scroll-cue__chevron` above.

Corollary: **a hidden state may never be declared unconditionally.** Any
`opacity: 0` must sit inside `no-preference` (and, for D1, inside its
`@supports` guard too), so that no user agent can strand content invisible.

## 4. Hover-only gains, never hover-dependent content

An effect may only *add* on hover if the resting state loses nothing. Demoting
text to muted so that hover can lift it is forbidden, because a touch visitor
pays the cost permanently and never gets the effect.

> "The rule for what may take this class is exactly: the text was already
> muted. Nothing that rendered at full contrast gets it, because making such
> text hover means demoting it to muted at rest, and a touch visitor never gets
> the hover back — they would pay a permanent cost for an effect they cannot
> trigger." — `.prose-hover`

Pointer-only effects are gated on `@media (hover: hover) and (pointer: fine)`,
and the touch fallback ships in the same rule block:

> "Gated on a real pointer so a touch device cannot strand a paragraph bright;
> those devices keep the resting muted" — `.prose-hover`

## 5. Animate transform and opacity only; nothing may reflow

> "Ring animates opacity only, so nothing reflows while it breathes."
> — `Background.tsx`, `Node`

> "Colour only, on a 150ms ease — nothing here can change a metric, so no glyph
> moves and nothing reflows." — `.prose-hover`

Colour transitions are permitted where they cannot move a glyph
(`.pipe-box`, `.prose-hover`, `.scroll-cue` anchor). Anything geometric is
`transform` or `opacity`.

`will-change` is scoped to the variant that actually animates:

> "`will-change` is scoped to this variant so the static pages do not promote a
> layer they never animate." — `.page-glow--drift`

## 6. The hero `<h1>` is the LCP element and never starts hidden

> "The hero is deliberately not wrapped in Reveal: it is the LCP element and
> must not start at opacity 0." — `src/app/page.tsx`

No typing, no scramble, no cursor:

> "Shell-prompt line: quiet, static, no cursor and no typing effect."
> — `Hero.tsx`

## 7. Contrast bounds are stated with their numbers, and every new composite re-derives them

Every layer that tints the page carries the arithmetic for its worst case in a
comment beside it, including the value that would break it.

Registered bounds today, against `--color-bg` `#0d0d0f`:

| Token | Ratio | Use |
| --- | --- | --- |
| `--color-fg` `#e8e8ea` | 15.9:1 | body text |
| `--color-muted` `#a1a1aa` | 7.6:1 (7.2:1 on `--color-surface`) | secondary text |
| `--color-accent` `#38bdf8` | 9.1:1 | links, focus rings, hero glow |
| `--color-ok` | 11.1:1 | pipeline status |
| `--color-danger` | 7.0:1 (5.8:1 as text on its own 15% fill) | pipeline status |
| `--color-gate` | 11.6:1 | human-checkpoint amber |

The page-glow composite bound, which any new layering must preserve:

> "each glow peaks at 10% opacity. The brightest colour the pair can composite
> to is both glows exactly coincident, rgb(23, 50, 47) — against which body
> text is 11.2:1, muted 5.4:1, accent 6.4:1 and the amber used by the stat
> strip 8.2:1. … 12% opacity would drop muted to 4.9:1, which is why it stays
> at 10%." — `.page-glow`

> "The two glows never coincide during the drift, so the contrast bound above
> still holds at every frame." — `.page-glow--drift`

A change that moves these layers relative to each other must show the same
reasoning, in the same form, at every offset it can reach.

## 8. Colour never carries state alone

> "Each is paired with a glyph or caption so state is never carried by colour
> alone." — `globals.css`, status colours

> "Always carries a word beside it — 'human approval', 'flagged', the flag's
> own name — and is never used decoratively." — `--color-gate`

## 9. One link per card in the accessibility tree

The whole card is clickable via a stretched pseudo-element on the title link.
Adding a second focusable element inside a card breaks this.

> "The whole card is the hit target via a stretched pseudo-element on the title
> link, which keeps it to a single link in the accessibility tree. Three
> affordances say so before the pointer arrives: the accent title, the explicit
> 'view case study' line, and the pointer cursor." — `ProjectCard.tsx`

## 10. Focus is visible, native, and keyboard parity is explicit

A global `:focus-visible` ring (2px accent, 3px offset) is never suppressed, and
hover affordances fire on `:focus-visible` too.

> "currentColor keeps it matched to the link, and `:focus-visible` triggers it
> so keyboard users get the same affordance as pointer users."
> — `.link-underline`

> "the hit targets are real HTML buttons laid over it, so focus, keyboard
> activation and the global `:focus-visible` ring all behave natively."
> — pipeline diagram

An element that fades out of use leaves the tab order at the end of its fade:

> "`visibility` is transitioned beside opacity so the anchor leaves the tab
> order at the *end* of the fade rather than lingering as an invisible target."
> — `.scroll-cue`

## 11. Content is never gated on JavaScript

Interactive affordances are real HTML that works before hydration.

> "The chevron is a real anchor to the first section, not a decoration with a
> scroll handler: it works before hydration and is reachable by keyboard."
> — `ScrollCue.tsx`

> ~~"Never leave content stuck at opacity 0 if the API is missing."~~
> — `Reveal.tsx`. **Stale as of W1/A6**: the observer is gone and the reveal
> hides nothing, so there is no stuck state to guard against.

> ~~"Without JS the reveal wrapper would never un-hide its contents."~~
> — `layout.tsx` `<noscript>`. **Removed in W1**, correctly: the reveal is pure
> CSS and needs no JS to un-hide anything. The rule is unchanged — it is simply
> no longer the reveal that demonstrates it. `ScrollCue`'s real `<a href>`
> anchor is now the site's clearest instance.

And nothing may flash: state that the server cannot know starts in the hidden
value, so the first client read reveals rather than hides.

> "Both start false, so the server renders it hidden and the first effect run
> reveals it — there is nothing to flash." — `ScrollCue.tsx`

## 12. Client boundaries are counted, named, and take children as a slot

> ~~"One of the site's two client components — ScrollCue is the other:
> IntersectionObserver is a browser API, so this needs a client boundary."~~
> — `Reveal.tsx`. **Doubly stale**: `Reveal` is a server component as of W1,
> and the count was never two — cycle 1's REQUIRED 3 found nine. The
> slot-as-children clause it ends with is the part that survives, and
> `CardSpotlight` now carries it:

> "It takes its children as a slot, so ProjectCard and everything inside it
> stays a server component and only this wrapper ships JS." — `CardSpotlight.tsx`

**The real count is nine**, and rule 12 means it literally: `ScrollCue` and
`CardSpotlight` are the chrome-level boundaries; `BlotquantInspector`,
`Disclosure`, `GoldRecordInspector`, `LifespanFunnel`, `PipelineDiagram`,
`RefusalGrid` and `SweepExplorer` are case-study widgets rendered only by
`/work/[slug]`. Two tests assert the exact list.

The count is part of the design. A new client component must say why a server
component cannot do the job, and must take children as a slot so nothing below
it is dragged across the boundary.

## 13. Every figure is traceable to a JSON key

> "Every value is read from the generated metric files, so a number here can be
> traced to a JSON key and, through it, to a file in the origin repository."
> — `src/app/work/[slug]/page.tsx`, `statsFor`

Extended to this phase's records: every measurement in `design/BASELINE.md` and
`design/LOOP_LOG.md` cites the report file it was read from.

## 14. Decoration is declared as decoration

Layers that carry no content are `aria-hidden`, `pointer-events: none`, and
named as decorative in a comment.

> "Purely decorative — as is the scroll cue's fade, the only other layer on the
> site that carries no content" — `.page-glow`

> "it paints behind everything with no pointer target of its own."
> — `PageGlow.tsx`

Decorative layers also may not create layout: `.page-glow` carries
`overflow: clip` as "a safety net … the page can never gain scroll width".

## 15. Hierarchy steps are shared, not re-invented per page

> "Shared so every label on the site sits at exactly the same step in the
> hierarchy." — `SectionLabel`

> "Between-section gap is far larger than any gap inside a section, so the
> grouping survives a squint test." — `src/app/page.tsx`

> "It reuses the same two tokens and the same 10% opacity the home page has
> always used" — `PageGlow.tsx`

## 16. Timings sit in a narrow band and are stated in the code

Observed band, and new work stays inside it or justifies leaving it:

| Duration | Used by |
| --- | --- |
| 120ms | `.panel-swap` content swap |
| 150ms | `.prose-hover`, `.pipe-box`, scroll-cue anchor colour |
| 175ms | project card border, accent rule, arrow nudge |
| 180ms | `.link-underline` wipe |
| 300ms | `.scroll-cue` fade |
| **118ms – 200ms** | `[data-reveal]` — scroll-driven; travel `min(h, V, 135)` px at ~675 px/s. See A1 → A5 → **A6** |
| 1.6s / 2s | chevron nudge, timeline pulse |
| 26s / 28s | glow drift ("breathing, not shimmer") |

> "~10% of the viewport over a half-minute — breathing, not shimmer."
> — `.page-glow--drift`

## 17. Contrast claims are enumerated, never universal

Any claim that a colour pair is the worst case must list every pair considered
and cite where the enumeration came from. A pair already registered elsewhere in
this charter must be carried forward or explicitly excluded with a reason.
Phrases asserting universality — "anywhere", "any layout", "every pair" — are
prohibited unless the enumeration is exhibited alongside them.

*Registered after the same defect appeared in A6, A7, and A7's correction.*

Its three instances, kept here because the rule is only legible with them:

- **A6** claimed no continuous opacity ramp could avoid a sub-AA value. True
  only of a ramp from zero.
- **A7** corrected A6, then claimed its own four-row table was "computed over
  every surface pair the site renders". It was four muted-text pairs.
- **A7's correction** found the real worst pair — `--color-danger` on its own
  15% fill, 5.789:1, crossing 0.8442 — **already registered in rule 7's table
  in this same file**, and not carried forward.

Each iteration was more careful than the last and each still over-reached, which
is why the rule constrains the *form* of the claim rather than asking for more
care. Rule 7 says a bound must be stated with the value that would break it;
rule 17 says a bound must also be stated with the search that found it.

## 18. A feature is landed only when its effect is observed, not its plumbing

Static evidence — attributes present, types resolving, rules correct —
establishes only that a feature *could* work. Landing requires an observation of
the effect itself at runtime.

*Registered after W5 was reported landed twice on plumbing that never paired,
and after two guards in this phase passed while inert.*

The three instances, kept because the rule is only legible with them:

- **W5's morph.** Four unique `vt-name` attributes, no `view-transition-name` at
  rest, a verified-necessary reduced-motion rule, and a full green chain — all
  true, none of it the effect. At runtime the pair never formed:
  `view-transition-name` stayed `none` throughout and zero
  `::view-transition-group(project-title-*)` animated.
- **`verify-reveal.mjs`.** Passed against a dead port, printing "All I1/I2
  assertions passed" over zero observations; later still passed with the 12px
  rise cut to 0.4px and the tilt deleted.
- **`measure-first-load-js.mjs`.** Counted an unreadable chunk as 0 bytes,
  silently *shrinking* a route's total — a budget check that could only ever
  fail in the safe direction.

The common shape: each was verified by reading what it declared rather than by
watching what it did. Rule 7 asks a bound to be stated with the value that would
break it; rule 17 asks it to be stated with the search that found it; rule 18
asks the claim to be stated with the observation that saw it happen.

A corollary for guards specifically: **a check that has never been seen to fail
is not evidence.** Ship a guard with a demonstrated failing case, or do not cite
it as proof.

---

# Amendments

Rules are amended in the open, never rewritten in place: an entry here says what
changed, in which W-step, and why. The reviewer audits the amended rule *and*
the justification.

## A1 — Rule 16, the `[data-reveal]` timing row (W1)

**Was:** `400ms | [data-reveal]`, a time-driven `transition`.

**Now:** the reveal is a CSS scroll-driven animation over
`animation-range: entry 8vh entry 36vh`. It has no duration at all —
`animation-duration` is left at `auto`, which binds the animation to the
timeline rather than to a clock, so the row no longer names a time.

**Why the band is still respected.** Rule 16 exists so that new work does not
feel unlike the rest of the site. The stand-in for the old 400ms is the 28vh
span: 224px of scrolling at an 800px viewport, roughly 400ms at an ordinary
flick. The easing changed from `ease-out` to `linear`, deliberately — the
timeline is the reader's own hand, and easing a scroll position drags the
reveal against the gesture producing it. The reasoning is in the comment above
the rule in `globals.css`, as rule 7 requires for anything whose bound moved.

**Recorded by:** the orchestrator, not the implementer, who flagged the stale
row rather than editing the charter they are audited against.

## A2 — Rule 2, split into unprompted and prompted motion (W3)

**Raised by:** the W3 implementer, unprompted by the brief. It was asked to
propose a rule-2 row for the parallax and did, but observed that W1's
`[data-reveal]` reveal is *also* motion and has no row — so rule 2 as written
was either incomplete or W1 had already broken it, and nobody had noticed.

**Ruling.** Rule 2's original wording is "every element allowed to move
**unprompted**", and its three listed members share a property the two new
effects do not: they run on an idle page. The glow drifts, the chevron nudges
and the timeline ring pulses at a reader who is doing nothing at all. A
scroll-driven animation cannot — it is a function of scroll position, so it is
still whenever the reader is still, and it stops the instant their hand does.
That is a real categorical difference and collapsing the two into one list
would have flattened it.

So the rule now carries **two** lists rather than one, and both W1 and W3 are
recorded. The alternative — leaving prompted motion off the list entirely on
the grounds that it is "prompted" — was rejected: it would have made the reveal
and the parallax invisible to exactly the audit rule 2 exists to make possible,
and would have left the next effect free to claim the same exemption.

**Rows added:** `[data-reveal]` (W1/W2) and the page-glow container (W3), both
under the new 2b.

**Recorded by:** the orchestrator. The implementer proposed its own row and
flagged the precedent question rather than resolving it, which is the correct
split of authority — it does not edit the document it is audited against.

## A3 — Rule 2 does not extend to pointer-prompted effects (W4)

**Raised by:** the W4 implementer, which was asked whether the border spotlight
needs a row in 2a or 2b and recommended **no row**, with its reasoning.

**Ruling: no row, and the boundary is now stated in the rule.** Rule 2 exists so
that motion the reader did not ask for stays scarce and countable. A2 already
graded that by how much the reader is asking: 2a runs at someone doing nothing,
2b runs only while their hand moves the page. A pointer-tracked effect is the
far end of that same axis — direct manipulation, present only under a pointer
the reader is actively steering, gone the moment they stop.

The decisive argument is the implementer's: the site already carries four
pointer-prompted appearance changes with no rows — `.prose-hover`,
`.link-underline`, the project card's own border/background treatment, and the
`group-hover:translate-x-1` on its arrow. A row for W4 alone would be a claim
that the spotlight is a different kind of thing from the arrow beside it in the
same card, which it is not. The alternative offered — a third table admitting
all four retroactively — was rejected on the ground that it turns rule 2 into
an inventory of every CSS transition on the site, and a list that long stops
being a constraint.

**Noted for the record**, because it is the honest counter-example: that arrow
nudge *is* pointer-prompted movement, not merely a colour change, and it has
never been listed. It is the precedent this ruling rests on rather than an
oversight the ruling creates.

**Recorded by:** the orchestrator. The implementer proposed the answer, gave
the counter-argument against its own recommendation, and did not edit the
document it is audited against.

## A4 — The shared-element morph needs no rule-2 row (W5)

**Raised by:** the W5 implementer, which read A3 and reached the same
conclusion, then argued the other side unprompted.

**Ruling: no row.** A navigation morph sits one step past even A3's
pointer-prompted class. It cannot occur without the reader clicking a link, it
lasts as long as the navigation they asked for, and it animates the very
element they aimed at. On the axis A2 and A3 established — how much the reader
asked for the motion — this is the far end.

**The counter-argument, which is real and is why this is recorded rather than
assumed:** the morph is the first effect on the site that moves an element
*between two pages*. None of A3's four precedents do that; they all move
something within a page that is already there. That is a genuinely new
category, and if a future effect uses view transitions for anything wider than
a single named pair — a directional slide, a whole-page crossfade — this ruling
does **not** cover it, and rule 2 should be revisited before it ships.

The scope of this ruling is exactly: one named shared-element pair, at 175ms,
on a navigation the reader initiated.

**Recorded by:** the orchestrator.

## A5 — Rule 16 / A1 superseded: the reveal's range was derived from a misreading

**Raised by:** review cycle 1, REQUIRED 1 and 2, both **measured** rather than
argued. This amendment supersedes A1's range figures; A1 stands as the record
of what was believed at the time.

**What was wrong.** A1 recorded the range as `entry 8vh → entry 36vh`, with the
28vh span as the stand-in for the old 400ms, and W1's comment argued that an
already-visible block "has finished entering" and that the last block on each
page had enough travel to complete. Both rested on reading `entry` progress as
*how much of the block is showing*. It is not: it is scrolled distance since
the block's top edge crossed the viewport bottom. The consequences were real
and were measured, not hypothesised —

- the last `<Reveal>` on `/` and `/work/[slug]` never reached opacity 1 at
  maximum scroll above a ~1210px viewport (0.829 at 1400px, 0.365 at 2400px),
  leaving body text permanently under 4.5:1 above ~2000px — a rule 3 corollary
  and rule 7 breach in a **fully supporting** browser;
- blocks inside the first viewport painted faint on load where the removed
  `IntersectionObserver` had shown them (`/colophon` wrapper #1: 100% visible,
  opacity 0.722).

**The correction, and why it is structural rather than a new number.** The range
is now **`entry 0% → entry 15%`**. The entry range is `min(h, V)` long — the
block's height for a block shorter than the viewport, the viewport's for one
taller. So a percentage of `entry` is a percentage of `min(h, V)`, which gives
both invariants by construction rather than by per-page arithmetic:

- **Nothing can be stranded.** The range needs `0.15·min(h, V)` of scroll, and
  the document always has at least `h` beneath a block's top, so
  `0.15·min(h,V) ≤ 0.15·h < h` at **every** viewport height. A range end
  expressed in `vh` could never satisfy this, because the scroll available
  beneath the last block is set by the document, which does not grow with the
  viewport.
- **It matches the observer it replaced.** For `h ≤ V`, entry progress *equals*
  the visible share of the block, so `entry 15%` is literally the removed
  `threshold: 0.15`. For a taller block it finishes earlier. Nothing the
  observer revealed is revealed later.

**The cost, recorded rather than hidden.** The reveal's travel is now
proportional to the block: 47px for `/`'s 309px Contact section, 135px for
anything taller than a 900px viewport (~200ms at an ordinary flick, inside rule
16's band), and **12px for the 81px closing wrapper on `/work/[slug]`**, which
is close to a flash. Short blocks get a short reveal. That is the trade for an
invariant that holds at every viewport height instead of at 800px.

**A second correction, made in the same change and flagged rather than slipped
in.** The stylesheet claimed `transform: none` at the `to` keyframe "leaves
nothing", against an identity transform's stacking context. Measurement says
otherwise: a filling animation's computed value is the interpolated one, so
Chrome reports `matrix(1, 0, 0, 1, 0, 0)` on every settled wrapper, permanently.
The comment was corrected to say what is true. No behaviour changed —
`will-change: transform` already promotes those elements — and the existing
argument that the stacking context is harmless was independently verified in
cycle 1.

**Why this is recorded and not quietly fixed.** Rule 7 requires a bound to be
stated with the value that would break it. The original comment named the value
that breaks W2's tilt (5deg) but never named the viewport height that breaks the
range — which is exactly the value that turned out to matter.

**Recorded by:** the orchestrator, on the implementer's proposed wording.

## A6 — The reveal's fade is removed; the range gains a length cap. Supersedes A5's figures.

**Raised by:** review cycle 2, REQUIRED 1 and 2, both **measured**.

**What was wrong.** A5's `entry 0% → entry 15%` removed the dead zone that
`entry 8vh` had provided *by accident*, so a block 2–7% entered painted its text
at 0.26–0.53 opacity on the first frame. On `/` at 1350×940 that put
`section#selected-work > h2.text-muted` at **2.92:1** and cost **T5** (100 → 95,
3/3 runs) — a frozen threshold, broken by the fix for the previous cycle. A5
also justified only the 135px cap, leaving 14 of 19 wrappers under 50px and
three at 12px: 18ms, one frame at 60Hz, against rule 16's 120ms floor.

**The correction, in two parts.**

**1. The opacity is removed from the animation.** The reveal is now
transform-only: a 12px rise and a 3deg lean. This is the registered **kill
criterion applied to the fade component**, and it is structural rather than a
tuned value. A scroll-driven opacity is a *static function of position*: at
scroll 0 every wrapper already sits at whatever value its place in the layout
selects, and no time passes to carry it off that value. Entry progress at first
paint is `(V − t) / min(h, V)` with `t` set by the layout, which ranges over all
of [0, 1] across the blocks a page can hold — and muted text clears 4.5:1 only
above alpha ≈ 0.74. Therefore **every** continuous ramp admits a layout that
parks a block on its sub-AA stretch, and only a curve taking no intermediate
value — a step — avoids it. A step is not a fade. A step at `entry 15%` was
considered and rejected: it flashes 141px of content at the viewport edge in
both directions every time the reader crosses it, and puts the full 3deg on a
block at the moment it appears.

Rule 3's corollary now has nothing left to be about on this selector: nothing on
it can hide anything.

**2. The range is `entry 0% → entry min(100%, 135px)`**, so travel is
`min(h, V, 135)` px. The percentage carries the completion invariant
(`min(h, V, 135) ≤ min(h, V) ≤ h ≤ h + f` at every viewport height); the cap
carries rule 16. The asymmetry is the point: **a floor in px cannot coexist with
the completion proof** — the proof's bound is the block's own height, and for a
block shorter than the floor the two contradict outright — **but a ceiling can**,
because it only ever lowers a range already proved completable. 135px is A5's
own stand-in for the original 400ms.

**Measured result:** all 32 wrappers on all six routes land between **118ms and
200ms**, against a one-shot band of 120–400ms.

**A side benefit worth recording.** The projection bound is now
viewport-independent: with the band capped at 135px the conservative offset is
**1.59px on any display at any zoom**, and the value that breaks it is a cap of
~371px — a number in the rule, rather than a viewport height nobody checks.
`0.36·V` broke at V ≈ 1030px and `0.15·V` at V ≈ 2470px; both were bounds whose
breaking value lived outside the stylesheet.

**The cost, recorded rather than hidden.** Three of the 32 wrappers — the 79.7px
closing wrapper of a case study — land at **118ms, 2ms under rule 16's floor**,
and provably as long as that block can get, since the range is capped at the
block's own entry. Those same three had 12px / 18ms before. This is rule 16's
"or justifies leaving it", with numbers.

The fade is the larger cost and is a **real reduction in the effect**: what
remains is a rise whose lean is carried by a 0.18% horizontal foreshortening
(2.6px across a 1512px block), not by its sub-pixel vertical offset. It reads as
a rise, not as a fade. Sofia should know that plainly rather than infer it from
a diff.

**A5's second correction stands** (`transform: none` resolves to
`matrix(1, 0, 0, 1, 0, 0)`), re-verified across 26/26 cases.

**Recorded by:** the orchestrator, on the implementer's proposed wording.

## A7 — A6's impossibility proof is over-claimed; the proof does not stand, and the decision now awaits sign-off

**Raised by:** review cycle 3, RECOMMENDED 1. Recorded as an amendment rather
than left in the backlog because A6 invoked the phase's **kill criterion** on
this proof, and a kill criterion must not rest on an argument that does not
hold.

**The over-claim.** A6 concludes: *"The only opacity curve with no sub-AA value
on it is one that takes no intermediate value at all — a step. A step is not a
fade."* The argument establishes only that a ramp **spanning [0, 1]** must cross
the sub-AA band, by the intermediate value theorem over first-paint entry
progress. It says nothing about a ramp that does not start at zero. That much of
cycle 3's finding is upheld: **A6's claim is false as written.**

**The crossing alpha, for the pairs enumerated below. The enumeration is NOT
proven complete** — see the correction under C1/C2, and rule 17, which exists
because of this defect. An ancestor's opacity composites the *whole* subtree, so
both the text and the surface beneath it fade toward whatever lies behind the
wrapper; both terms must be recomputed together at each alpha. Token values read
from `src/app/globals.css`: `--color-bg` `#0d0d0f`, `--color-surface` `#141418`,
`--color-muted` `#a1a1aa`; the glow figure is the documented worst-case
composite `rgb(23, 50, 47)`.

**The four pairs computed here are exactly:** muted-on-page-bg,
muted-on-card-surface, and each of those two behind the glow composite. **They
are all muted-text pairs.** No `--color-danger`, `--color-ok`, `--color-gate`,
`--color-accent` or `--color-fg` pair was considered, and no pair inside the
case-study widgets was considered. That omission is what C1 corrects.

| pair (muted text / its surface / what is behind the wrapper) | ratio at α=1 | crossing α for 4.5:1 | ratio at α=0.75 |
| --- | --- | --- | --- |
| page bg / page bg | 7.576:1 | 0.7304 | 4.687:1 |
| **card surface / page bg** | **7.169:1** | **0.7497** | **4.503:1** |
| page bg / glow composite *(single sample)* | 7.576:1 | 0.7048 | 4.901:1 |
| card surface / glow composite *(single sample)* | 7.169:1 | 0.7317 | 4.655:1 |

The model reproduces this file's own documented figures — 7.6:1 for muted on the
page background and **7.2:1 on a surface** — which is why it is trusted here.

**The two glow rows are single samples**, not bounds. `rgb(23, 50, 47)` is one
point on a continuous radial gradient that runs from that peak composite out to
the untinted page background, so the real glow surface is a continuum and these
rows sample its brightest point only. They are recorded for completeness and
**do not affect the worst case**, which is the untinted `card surface / page bg`
pair: tinting the backdrop lightens it, which raises the ratio at every alpha
and moves the crossing point *down*, away from the bound. Every glow row sits
below 0.7497 for exactly that reason.

**CORRECTION (C1, authorised by Sofia 2026-09-02, after cycle 4).** The worst
pair is **not** `--color-muted` on `--color-surface` at α 0.7497. It is
**`--color-danger` on its own 15% danger fill**:

| the actual worst pair | ratio at α=1 | crossing α | ratio at α=0.75 |
| --- | --- | --- | --- |
| **`--color-danger` over `rgb(48.2, 28.0, 29.7)`** (danger at 15% over page bg) | **5.789:1** | **0.8442** | **3.811:1** |

It renders inside a `<Reveal>`, in the PipelineDiagram failed-stage `<text>` on
`/work/media-automation-platform` (`PipelineDiagram.tsx:76–87`, `fillOpacity:
0.15`). A second missed pair, `--color-danger` on the page background, crosses
at 0.7663.

**So a `0.75 → 1` ramp is not marginal there — it is plainly sub-AA, at
3.811:1.** The "0.0003 alpha headroom" figure was real arithmetic on the wrong
pair. The muted-on-surface row (7.169:1, crossing 0.7497, 4.503:1 at α 0.75) is
correct and is retained above as one enumerated pair among several, not as the
bound.

**Cross-reference: rule 7's own table already registered this figure** —
"`--color-danger` | 7.0:1 (**5.8:1 as text on its own 15% fill**) | pipeline
status". The recomputation reproduces it as 5.789:1.

*A7 failed to carry forward a figure already present in this same file, roughly
three hundred lines above it.* Rule 17 is registered in response.

**What is claimed, and what is not.** A ramp with a floor above ≈0.75 takes
intermediate values and has no sub-AA value on the four pairs tabulated above.
It is **not** claimed that such a ramp would pass T5: that has not been run.
Determining it would require building a spike and measuring, and no such report
exists — so no score is asserted here. (A7 holds A6 to the standard that an
unexecuted result must not be stated as fact; it is bound by the same standard.)

**Which basis the fade removal now rests on — settled by the sign-off below.**
The surviving justification is narrower than A6's: **removing the fade *as
implemented*, a ramp from zero, was necessary to restore T5, but removing *every*
fade was a judgement that was never argued and is not established by any proof
in this record.** A6's kill-criterion invocation is unsound by this amendment's
own finding, so the removal was left open for Sofia to confirm or reverse. She
confirmed it, on the basis recorded in the sign-off below — which is the
knife-edge headroom, not A6's impossibility claim, and not the cost of rework.

**Also corrected, from the same cycle (RECOMMENDED 2).** A6 says a px floor and
the completion invariant *"contradict outright"* for a block shorter than the
floor. They do not. The invariant's real quantity is the scroll available
beneath the block's top, `h + f`; the proof uses `min(h, V) ≤ h` only because
that bound is document-independent.

**CORRECTED (C3, authorised by Sofia 2026-09-02).** A7's original figures —
h = 309.0px, f = 128.1px — were wrong, and disagreed with `globals.css`, which
said 299.9px / 125px. The stylesheet was right. Re-measured at 1512×900:
**h = 299.9px, f = 125.3px**, source `design/reports/branch-cycle4/geometry.json`
(`tightest`), which also records the last wrapper of all six routes with reveals.

**Single-viewport observation, not a general result:** at 1512×900 only, on the
tightest block on the site (`/`'s closing Contact wrapper), a 120px floor would
have completed there. `f` was not measured per route at the breakpoints the site
targets, so nothing is claimed about other viewports.

**The conclusion survives the correction — explicitly: 125.3 > 120**, so the
120px floor would still have completed there, and the asymmetry stands: **a
floor cannot be proved completable structurally; a ceiling can.** That is a real
asymmetry and it still justifies the choice made.

**Signed off by Sofia, 2026-09-02. Basis amended 2026-09-02 after cycle 4.**

The fade is not restored. The registered basis: the only ramp that could avoid a
sub-AA value from zero, `0.75 → 1`, is sub-AA at **3.811:1** on `--color-danger`
over its own 15% fill, a pair rule 7 already registers at 5.8:1. **The
alternative recorded in A7 does not exist.** The scheduling argument was weighed
separately and rejected as a basis. The earlier basis — 0.0003 alpha headroom on
muted/surface — named the wrong pair and is withdrawn.

*(The glow-composite rows remain labelled as single samples of a continuous
radial gradient; they do not affect the worst case. Retained from the original
sign-off.)*

**Recorded by:** the orchestrator, who wrote A6 and got it wrong.

---

**A8 — withdrawn.** The rule-0 breach it recorded was resolved in code, not accepted.
