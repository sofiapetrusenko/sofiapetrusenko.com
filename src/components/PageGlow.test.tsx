import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageGlow } from "./PageGlow";

// Read from disk rather than via import.meta.url: the jsdom environment hands
// modules an http:// URL, which fileURLToPath will not take.
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

/** The parallax guard block onwards — everything W3 added to the stylesheet. */
const guarded = css.slice(
  css.indexOf("@supports (animation-timeline: scroll("),
);

/** The declarations of a top-level rule, by exact selector. */
function ruleBlock(selector: string) {
  const start = css.indexOf(`\n${selector} {`);
  expect(start).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

describe("PageGlow", () => {
  it("renders a decorative layer with no pointer target of its own", () => {
    const { container } = render(<PageGlow />);
    const layer = container.firstElementChild;

    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer).toHaveClass("page-glow");
  });

  it("keeps drift and parallax behind the same single opt-in", () => {
    // Both motions hang off `--drift`, so the case studies — which render
    // <PageGlow /> with no prop — cannot pick either of them up. Charter 2:
    // the list of things allowed to move is closed, and this is how the glow
    // stays on it for the home hero only.
    const { container: still } = render(<PageGlow />);
    const { container: moving } = render(<PageGlow drift />);

    expect(still.firstElementChild).not.toHaveClass("page-glow--drift");
    expect(moving.firstElementChild).toHaveClass("page-glow--drift");
  });

  it("declares the parallax only under both guards", () => {
    // Charter 3: nothing may move outside @supports and no-preference. The
    // animation-name is the only thing that can bring the keyframes into
    // effect, so it is the declaration that has to sit inside both.
    expect(guarded).toMatch(
      /@supports \(animation-timeline: scroll\(root block\)\) \{\s*@media \(prefers-reduced-motion: no-preference\) \{\s*\.page-glow--drift \{[^}]*animation-name: glow-parallax;[^}]*animation-timeline: scroll\(root block\);/,
    );
  });

  it("tests the exact timeline it goes on to use", () => {
    // A @supports condition that names a weaker value than the declaration
    // would let a browser through the guard and then fail to animate — or, in
    // the other direction, gate the effect on something it never uses.
    const tested = guarded.match(
      /@supports \(animation-timeline: (scroll\([^)]*\))\)/,
    )?.[1];
    const used = guarded.match(
      /^\s*animation-timeline: (scroll\([^)]*\));/m,
    )?.[1];

    expect(tested).toBe("scroll(root block)");
    expect(used).toBe(tested);
  });

  it("leaves the glow untransformed for every browser outside the guards", () => {
    // Firefox has no scroll-driven animations and a reader may have asked for
    // less motion. Either way the resting rule must be the whole of the glow:
    // its layout position, no transform, nothing hidden.
    const base = ruleBlock(".page-glow");

    expect(base).toMatch(/position: absolute;/);
    expect(base).not.toMatch(/transform|animation|opacity/);
  });

  it("translates on the block axis alone, so no page can gain scroll width", () => {
    // The translate is outside .page-glow's own `overflow: clip`, so the x
    // term is what would widen the document. It is zero at both ends and there
    // is no other x term in the keyframes.
    const keyframes = css.slice(css.indexOf("@keyframes glow-parallax"));

    expect(keyframes).toMatch(
      /@keyframes glow-parallax \{\s*from \{\s*transform: translate3d\(0, 0, 0\);\s*\}\s*to \{\s*transform: translate3d\(0, 8vh, 0\);\s*\}\s*\}/,
    );
  });

  it("leaves the site-wide dot grid out of the parallax", () => {
    // The dot grid is one fixed layer rendered by the root layout on every
    // route, so animating it would move /work/[slug] too — where the glow is
    // deliberately static beside the charts. It stays the rate-0 plane it
    // already was: no class hook, no rule of its own, no animation.
    expect(layout).toMatch(/fixed inset-0 -z-10/);
    expect(layout).not.toMatch(/animation|data-/);

    // And the closed list stays closed: exactly two elements on the whole site
    // are driven by a scroll timeline — the reveal wrapper and this glow.
    const scrollDriven = css.match(/^\s*animation-timeline:/gm) ?? [];
    expect(scrollDriven).toHaveLength(2);
  });
});
