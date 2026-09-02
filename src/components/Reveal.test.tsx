import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Reveal } from "./Reveal";

const realMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = realMatchMedia;
});

/** Makes prefers-reduced-motion: reduce match. */
function preferReducedMotion() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion: reduce"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

// Read from disk rather than via import.meta.url: the jsdom environment hands
// modules an http:// URL, which fileURLToPath will not take.
const source = readFileSync(
  join(process.cwd(), "src/components/Reveal.tsx"),
  "utf8",
);
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** Every component file whose first statement is the "use client" directive,
 *  by bare filename, sorted. Anchored to a whole line so that a *mention* of
 *  the string — this file's own assertion above, for one — is not counted. */
function componentsWithUseClient() {
  const dir = join(process.cwd(), "src/components");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
    .filter((f) =>
      /^\s*["']use client["'];?\s*$/m.test(readFileSync(join(dir, f), "utf8")),
    )
    .sort();
}

/** The source of every route file except the case-study page, so a widget that
 *  escaped `/work/[slug]` would be seen. */
function routeFilesOutsideCaseStudy() {
  const root = join(process.cwd(), "src/app");
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx"))
        if (p !== join(root, "work/[slug]/page.tsx"))
          out.push(readFileSync(p, "utf8"));
    }
  };
  walk(root);
  return out;
}

describe("Reveal", () => {
  it("renders its children so content is never gated on JS", () => {
    render(
      <Reveal>
        <p>visible content</p>
      </Reveal>,
    );
    expect(screen.getByText("visible content")).toBeInTheDocument();
  });

  it("marks the wrapper with the bare hook the stylesheet selects on", () => {
    render(
      <Reveal>
        <p>content</p>
      </Reveal>,
    );

    // The attribute carries no state any more — the CSS drives the reveal off
    // the element's own scroll position, so there is no "shown" value to reach.
    expect(screen.getByText("content").parentElement).toHaveAttribute(
      "data-reveal",
      "",
    );
  });

  it("renders no inline state at all, whatever the motion preference", () => {
    preferReducedMotion();

    render(
      <Reveal>
        <p>content</p>
      </Reveal>,
    );

    // Nothing in the component reads the preference: the whole effect lives
    // inside the stylesheet's two guards, so reduced motion and a browser
    // without `animation-timeline` both simply get the content where it was
    // laid out.
    const wrapper = screen.getByText("content").parentElement;
    expect(wrapper?.getAttribute("style")).toBeNull();
    expect(window.matchMedia).not.toHaveBeenCalled();
  });

  it("is a server component, so it is not one of the counted boundaries", () => {
    // Charter 12 counts the client boundaries — ScrollCue and CardSpotlight.
    // This wrapper is not one, so nothing it wraps is pulled across a boundary
    // and the reveal ships no JS.
    expect(source).not.toMatch(/["']use client["']/);
  });

  // Charter 12: "The count is part of the design." The negative above is why a
  // wrong count survived — nothing asserted the positive, so three comments
  // could say "the site's two client components" while nine files carried the
  // directive. These two tests assert the count itself.
  it("keeps the site to nine client components, two of them chrome", () => {
    const clients = componentsWithUseClient();

    expect(clients).toEqual([
      "BlotquantInspector.tsx",
      "CardSpotlight.tsx",
      "Disclosure.tsx",
      "GoldRecordInspector.tsx",
      "LifespanFunnel.tsx",
      "PipelineDiagram.tsx",
      "RefusalGrid.tsx",
      "ScrollCue.tsx",
      "SweepExplorer.tsx",
    ]);
    expect(clients).toHaveLength(9);
  });

  it("renders the other seven only from /work/[slug]", () => {
    // What makes "two" a defensible thing to say next to ScrollCue and
    // CardSpotlight: the other seven are the content of a case study, not part
    // of the site's chrome. That is only true while no other route imports one.
    const widgets = componentsWithUseClient().filter(
      (f) => f !== "ScrollCue.tsx" && f !== "CardSpotlight.tsx",
    );
    const caseStudy = readFileSync(
      join(process.cwd(), "src/app/work/[slug]/page.tsx"),
      "utf8",
    );

    for (const file of widgets) {
      const name = file.replace(/\.tsx$/, "");
      expect(caseStudy).toContain(name);
      expect(
        routeFilesOutsideCaseStudy().filter((s) => s.includes(name)),
      ).toEqual([]);
    }
  });

  it("animates nothing but the transform — the fade is gone", () => {
    // D1 cycle 2's REQUIRED 1. A scroll-driven opacity is a static function of
    // scroll position, so at the reader's first paint some wrapper sits at
    // whatever value the layout selects — 0.5324 on `/`, which composites
    // --color-muted to 2.92:1 and cost the registered desktop accessibility
    // threshold. The repair was not a narrower ramp (every ramp has the same
    // band, it only moves) but no ramp: these keyframes declare `transform` and
    // nothing else, so nothing this animation does can change what is painted
    // or what colour it is. `scripts/verify-reveal.mjs` invariant I4 measures
    // the consequence in a browser; this pins the cause.
    const keyframes = css.slice(
      css.indexOf("@keyframes reveal-rise"),
      css.indexOf("@supports (animation-timeline: view())"),
    );

    expect(keyframes).not.toMatch(/opacity/);
    expect(keyframes).toMatch(/transform:/);
  });

  it("declares its animation only under both guards", () => {
    // Charter 3: only motion goes inside the query. The animation-name — the
    // only thing that can bring the keyframes into effect — must sit inside
    // @supports and inside no-preference, and so must the transform-origin the
    // perspective pivots about.
    // Sliced at this guard by its full condition, not the property name: the
    // stylesheet has a second @supports (animation-timeline: …) block now, for
    // the hero glow's parallax, and this test is about the reveal's.
    const guarded = css.slice(
      css.indexOf("@supports (animation-timeline: view())"),
    );

    expect(guarded).toMatch(
      /@supports \(animation-timeline: view\(\)\) \{\s*@media \(prefers-reduced-motion: no-preference\) \{[^}]*transform-origin: 50% 0;[^}]*animation-name: reveal-rise;/,
    );
    // …and the selector itself declares no resting opacity or transform. The
    // selector is anchored to the start of a line so the prose above it, which
    // names `[data-reveal]`, cannot be read as a rule block.
    // (`transform-origin` is not `transform`: with no transform to pivot, it
    // styles nothing, which is why it may sit here without hiding anything.)
    expect(css).not.toMatch(/^\s*\[data-reveal\][^{]*\{[^}]*opacity:\s*0/m);
    expect(css).not.toMatch(/^\s*\[data-reveal\][^{]*\{[^}]*transform:/m);
  });

  it("bounds the range by the element and by a length, never by the viewport", () => {
    // The structural half of D1 cycle 1's REQUIRED 1, which a value assertion
    // would not catch. A range offset in vh asks for a fixed share of the
    // *window* while the scroll beneath the last block on a page is set by the
    // *document* and does not grow with the window, so some viewport height
    // always exists that strands it. A percentage of `entry` is a share of
    // min(block height, viewport), which the document always has beneath the
    // block. `scripts/verify-reveal.mjs` measures the consequence in a browser;
    // this asserts the shape, which is what may not regress.
    //
    // Three things are pinned, and each answers a different failed cycle.
    // The start, because cycle 2's regression was about the start and
    // `entry 50% entry 100%` would satisfy an end-only assertion while hiding
    // the first half of every block's entry. The percentage, at 100% — the
    // largest end the completion proof admits, since the range then asks for
    // min(h, V) <= h px of scrolling and the document always has h + f beneath
    // the block. And the cap, because a percentage alone cannot hold a duration:
    // min(h, V) runs from 79.7px to a full viewport on this site, so 100% alone
    // is 1333ms of scrolling on a tall block against a band that tops out at
    // 400ms. The cap is safe in the way a floor would not be — it can only lower
    // a range already proved completable, where a floor in px would contradict a
    // bound that is the block's own height.
    const range = css.match(/animation-range: entry ([^ ]+) entry ([^;]+);/);

    expect(range?.[1]).toBe("0%");
    expect(range?.[2]).toBe("min(100%, 135px)");
    // No length may appear as the *first* term of either offset: that is the
    // shape of the range that stranded content in cycle 1.
    expect(css).not.toMatch(/animation-range:[^;]*\d(vh|vw|px) entry/);
  });

  it("takes its depth from a transform function, adding no wrapper", () => {
    // W2 gives the reveal perspective. `perspective` the *property* would have
    // needed either a node per reveal or a shared ancestor — and that ancestor
    // is a containing block for the fixed ScrollCue and a stacking context
    // around .page-glow's z-index: -10. `perspective()` the transform function
    // needs neither, so the DOM stays at exactly one element per Reveal.
    const { container } = render(
      <Reveal>
        <p>content</p>
      </Reveal>,
    );

    expect(container.querySelectorAll("*")).toHaveLength(2); // wrapper + <p>
    expect(screen.getByText("content").parentElement).toBe(
      container.firstElementChild,
    );
    // The property appears nowhere in the stylesheet; the function appears in
    // the keyframes, on the element that also carries the rotation.
    expect(css).not.toMatch(/^\s*perspective:/m);
    expect(css).toMatch(
      /@keyframes reveal-rise \{\s*from \{[^}]*transform: perspective\([^)]+\) rotateX\(/,
    );
  });
});
