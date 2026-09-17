import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Role } from "@/content";

/**
 * The pulse rule has two halves — a current role rings, an undisclosed one does
 * not — and real content can only exercise one of them, because the site's only
 * current role *is* the undisclosed one. These three entries are the smallest
 * set that reaches both: current and undisclosed, current and disclosed, and
 * closed.
 *
 * Hoisted because `vi.mock` is itself hoisted above the imports, so a fixture
 * declared normally would not exist yet when the factory runs.
 */
const fixture = vi.hoisted(() => ({
  roles: [
    {
      org: "Withheld Co",
      title: "Founder & CEO",
      location: "Cascais, Portugal (remote)",
      country: "Portugal",
      kind: "engineering",
      period: "2026 – present",
      summary: "An ongoing role whose org is withheld.",
      undisclosed: true,
    },
    {
      org: "Disclosed Co",
      title: "Engineer",
      location: "Lisbon, Portugal",
      country: "Portugal",
      kind: "engineering",
      period: "2025 – present",
      summary: "An ongoing role whose org is public.",
    },
    {
      org: "Former Lab",
      title: "Research Intern",
      location: "Dundee, Scotland, UK",
      country: "UK",
      kind: "research",
      period: "2024",
      summary: "A closed role.",
    },
  ] satisfies readonly Role[],
}));

vi.mock("@/content", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/content")>()),
  roles: fixture.roles,
}));

const { Experience } = await import("./Background");

/** The `<li>` whose heading is `title`. */
function itemFor(title: string): HTMLElement {
  const item = screen.getByRole("heading", { name: title }).closest("li");
  if (!item) throw new Error(`no timeline item for ${title}`);
  return item;
}

describe("Experience timeline pulse", () => {
  it("does not ring the node of an undisclosed role", () => {
    render(<Experience />);

    const item = itemFor("Founder & CEO");
    // The bar is that item's signature effect; a ring would be a second rhythm.
    expect(item.querySelectorAll(".timeline-pulse")).toHaveLength(0);
    // Guard against passing because the item rendered nothing at all.
    expect(item.querySelectorAll(".redaction__segment").length).toBeGreaterThan(
      0,
    );
  });

  it("still rings the node of a current role that is not undisclosed", () => {
    render(<Experience />);

    expect(
      itemFor("Engineer").querySelectorAll(".timeline-pulse"),
    ).toHaveLength(1);
  });

  it("does not ring a closed role", () => {
    render(<Experience />);

    expect(
      itemFor("Research Intern").querySelectorAll(".timeline-pulse"),
    ).toHaveLength(0);
  });

  it("rings exactly one node across the whole rail", () => {
    const { container } = render(<Experience />);

    expect(container.querySelectorAll(".timeline-pulse")).toHaveLength(1);
  });
});
