import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { projects } from "@/content";
import ProjectPage from "@/app/work/[slug]/page";
import { Hero } from "./Hero";
import { ProjectCard } from "./ProjectCard";
import { SelectedWork } from "./SelectedWork";

// Read from disk rather than via import.meta.url: the jsdom environment hands
// modules an http:// URL, which fileURLToPath will not take.
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

type Morph = { name?: unknown; share?: unknown; default?: unknown };

/**
 * Every `<ViewTransition share="project-title">` in an element tree, read off
 * the props rather than the DOM.
 *
 * This walks the tree a component *returns*, without rendering it, and matches
 * on the `share` prop rather than on the `ViewTransition` symbol — so it keeps
 * working now that nothing imports that symbol, and would still catch a morph
 * reintroduced by any means.
 */
function morphs(node: ReactNode): Morph[] {
  const found: Morph[] = [];

  const walk = (current: unknown) => {
    if (Array.isArray(current)) {
      for (const child of current) walk(child);
      return;
    }
    if (!isValidElement(current)) return;

    const props = current.props as Record<string, unknown>;
    if (props.share === "project-title") found.push(props as Morph);
    walk(props.children);
  };

  walk(node);
  return found;
}

/**
 * The stylesheet with its comments stripped. The prose beside these rules names
 * the selectors and the media queries it is explaining, so a search over the raw
 * file cannot tell a rule from a sentence about one.
 */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Everything the view transition declares: it is the tail of the stylesheet. */
const vt = rules.slice(rules.indexOf("::view-transition"));

describe("the removed project title morph", () => {
  // D1 shipped a shared-element morph between the card <h3> and the case-study
  // <h1>, then removed it: the pair never formed at runtime. React called
  // `document.startViewTransition` and a root crossfade ran, but
  // `view-transition-name` stayed `none` on the <h3> for the whole transition
  // and no `::view-transition-group(project-title-*)` ever animated. `react`
  // resolves to 19.2.8, which exports no `ViewTransition`; only Next's vendored
  // 19.3.0-canary does. These tests pin the removal so the dead attributes
  // cannot come back without the feature.

  it("declares no <ViewTransition> on either half of the pair", () => {
    for (const file of [
      "src/components/ProjectCard.tsx",
      "src/app/work/[slug]/page.tsx",
    ]) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      expect(src).not.toMatch(/from "react"[^\n]*ViewTransition/);
      expect(src).not.toMatch(/<ViewTransition/);
    }
  });

  it("emits no view-transition name from any card or project page", async () => {
    for (const project of projects) {
      expect(morphs(ProjectCard({ project }))).toHaveLength(0);
      expect(
        morphs(
          await ProjectPage({
            params: Promise.resolve({ slug: project.slug }),
          }),
        ),
      ).toHaveLength(0);
    }
  });

  it("keeps no stylesheet rule selecting the morph's group class", () => {
    // `share="project-title"` was the only thing that put `.project-title` on a
    // group. A rule selecting a class nothing applies is a claim the feature
    // exists.
    // `rules`, not `css`: the comment above the surviving rules explains the
    // removal and names the selector, which is prose rather than a declaration.
    expect(rules).not.toMatch(/::view-transition-group\(\.project-title\)/);
  });

  it("leaves the home hero <h1> out of the transition entirely", async () => {
    // Charter 6: the hero is the LCP element of `/`. A view transition captures
    // and animates what it names, so the one heading on this site that may
    // never be captured is this one — and the page title it morphs into is a
    // different element on a different route.
    expect(morphs(Hero())).toHaveLength(0);

    const { container } = render(<Hero />);
    const h1 = container.querySelector("h1");
    expect(h1).toBeInTheDocument();
    expect(h1?.style.viewTransitionName).toBe("");
  });
});

describe("ProjectCard", () => {
  it("keeps the title link's parent the <h3> itself, with no wrapper node", () => {
    // Charter 9, and the reason this test outlived the feature that prompted
    // it. The <h3> must be the link's direct parent so the stretched
    // `after:inset-0` resolves against the `relative` <li> — the whole card,
    // not just the title.
    //
    // The morph that once wrapped this <h3> is gone (see the describe block
    // above), so there is no longer any wrapper or `view-transition-name` to
    // worry about, and no stand-in involved: this renders the real component.
    // The check stays because it guards the invariant, not the removed
    // feature — a live `view-transition-name` on the <h3>, from a
    // reintroduced morph or anything else, would make it a containing block
    // for absolutely positioned descendants and silently shrink the hit
    // target to the title.
    render(<SelectedWork />);

    for (const project of projects) {
      const link = screen.getByRole("link", { name: project.name });
      expect(link.parentElement?.tagName).toBe("H3");
      expect(link.className).toContain("after:inset-0");
    }
  });

  it("still exposes exactly one link per card", () => {
    // Charter 9 restated at the level that actually matters: whatever the tree
    // looks like, a card is one link in the accessibility tree.
    render(<SelectedWork />);

    const cards = document.querySelectorAll("li.spotlight-card");
    expect(cards).toHaveLength(projects.length);
    for (const card of cards) {
      expect(card.querySelectorAll("a")).toHaveLength(1);
    }
  });
});

describe("view transition stylesheet", () => {
  it("declares no animation of its own now the morph is gone", () => {
    // What remains is two rules that *remove* a user-agent default (pointer
    // events, reduced motion). Neither adds motion, and both are currently
    // inert because nothing on the site starts a view transition any more.
    expect(vt).not.toMatch(/animation-duration:\s*175ms/);
    expect(vt).not.toMatch(/@keyframes/);
  });

  it("lets pointer events through the transition overlay", () => {
    // The overlay sits above the live page and would swallow clicks for the
    // duration. Rules 11 and 14: an affordance works or it does not, and a
    // decoration may not take one away.
    expect(vt).toMatch(/::view-transition \{\s*pointer-events: none;\s*\}/);
  });

  it("flattens the morph under prefers-reduced-motion", () => {
    // Charter 3. The blanket `*, *::before, *::after` rule does not reach these:
    // `*` matches elements, not pseudo-elements, and the `::view-transition-*`
    // tree is a separate one rooted on the document element. At 0s the browser
    // swaps the titles instantly, which is what this site did before the morph.
    expect(vt).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*::view-transition-group\(\*\),\s*::view-transition-old\(\*\),\s*::view-transition-new\(\*\) \{\s*animation-duration: 0s !important;\s*animation-delay: 0s !important;\s*\}\s*\}/,
    );

    // And nothing about the morph is declared under `no-preference`: the
    // resting state is "no transition at all", which every user agent already
    // has, so there is no hidden state to strand (charter 3's corollary).
    expect(vt).not.toContain("no-preference");
    expect(vt).not.toContain("opacity: 0");
  });
});
