import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { education, labels, notes, profile, projects, roles } from "@/content";
import Home from "./page";

describe("Home", () => {
  it("mounts", () => {
    render(<Home />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("renders the profile as the sole h1", () => {
    render(<Home />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(profile.name);
    expect(screen.getByText(profile.headline)).toBeInTheDocument();
    expect(screen.getByText(profile.summary)).toBeInTheDocument();
  });

  it("renders every project, linking to its detail page", () => {
    render(<Home />);

    for (const project of projects) {
      const link = screen.getByRole("link", { name: project.name });
      expect(link).toHaveAttribute("href", `/work/${project.slug}`);
      expect(screen.getByText(project.tagline)).toBeInTheDocument();
    }
  });

  it("renders every role in the experience timeline", () => {
    render(<Home />);

    for (const role of roles) {
      // A short contract entry is a dated line and carries no prose block.
      if (role.summary !== undefined) {
        expect(screen.getByText(role.summary)).toBeInTheDocument();
      }
      // A bare year can also be a project's year, so count rather than expect one.
      expect(
        screen.getAllByText(role.period).length,
        `period: ${role.period}`,
      ).toBeGreaterThan(0);
    }
  });

  it("renders the contract line as its own dated entry", () => {
    render(<Home />);

    const contract = roles.find((role) => role.summary === undefined);
    if (!contract) throw new Error("expected one summary-less contract entry");
    expect(screen.getByText(contract.title)).toBeInTheDocument();
  });

  it("splits experience and education into their own sections", () => {
    render(<Home />);

    for (const title of [/^experience$/i, /^education$/i]) {
      expect(
        screen.getByRole("heading", { level: 2, name: title }),
      ).toBeInTheDocument();
    }
  });

  it("lists both degrees with their years, without summaries", () => {
    render(<Home />);

    for (const entry of education) {
      expect(screen.getByText(entry.degree)).toBeInTheDocument();
      expect(screen.getByText(entry.institution)).toBeInTheDocument();
      expect(screen.getByText(entry.period)).toBeInTheDocument();
    }
  });

  it("offers the CV from the hero and states availability in the footer", () => {
    render(<Home />);

    expect(
      screen.getByRole("link", { name: profile.cv.label }),
    ).toHaveAttribute("href", profile.cv.href);
    expect(screen.getByText(profile.availability)).toBeInTheDocument();
  });

  it("redacts the undisclosed org, leaving the name to assistive tech alone", () => {
    const { container } = render(<Home />);

    const role = roles.find((entry) => entry.undisclosed);
    if (!role) throw new Error("expected one undisclosed role");

    // The org string reaches the a11y tree, and appears nowhere else on the page.
    const matches = screen.getAllByText(role.org);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveClass("sr-only");

    // The bar is decoration: hidden from the a11y tree and carrying no text.
    const bar = container.querySelector(".redaction");
    expect(bar).toHaveAttribute("aria-hidden", "true");
    expect(bar).toHaveTextContent("");
    expect(container.querySelectorAll(".redaction__segment")).toHaveLength(8);

    // The caption is the only visible text standing in for the name.
    expect(
      screen.getByText(`${labels.buildingSymbol} ${labels.buildingCaption}`),
    ).toBeInTheDocument();
  });

  it("tags every timeline entry with its country", () => {
    render(<Home />);

    // Countries repeat, so assert each appears at least as often as it is used.
    const expected = new Map<string, number>();
    for (const country of [
      ...roles.map((r) => r.country),
      ...education.map((e) => e.country),
    ]) {
      expected.set(country, (expected.get(country) ?? 0) + 1);
    }

    for (const [country, count] of expected) {
      expect(
        screen.getAllByText(country).length,
        `country tag: ${country}`,
      ).toBeGreaterThanOrEqual(count);
    }
  });

  it("renders the current-focus line from content", () => {
    render(<Home />);

    expect(screen.getByText(/currently:/i)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(profile.now.slice(0, 30), "i")),
    ).toBeInTheDocument();
  });

  it("lists every note, linking to its page", () => {
    render(<Home />);

    for (const note of notes) {
      const link = screen.getByRole("link", { name: note.title });
      expect(link).toHaveAttribute("href", `/notes/${note.slug}`);
      expect(screen.getByText(note.teaser)).toBeInTheDocument();
    }
  });

  it("links the colophon from the footer", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: /^colophon$/i })).toHaveAttribute(
      "href",
      "/colophon",
    );
  });

  it("gives every project card an explicit call to action", () => {
    render(<Home />);

    // The card is one link in the a11y tree, so the CTA is decorative text —
    // its job is to make the card look clickable before the pointer arrives.
    expect(screen.getAllByText(/view case study/i)).toHaveLength(
      projects.length,
    );
  });

  it("exposes the email and gives external links safe rel attributes", () => {
    render(<Home />);

    expect(
      screen.getByRole("link", { name: profile.email }),
    ).toBeInTheDocument();

    const external = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("http"));
    expect(external.length).toBeGreaterThan(0);
    for (const link of external) {
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });
});
