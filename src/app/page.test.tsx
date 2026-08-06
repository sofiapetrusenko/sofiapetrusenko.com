import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { profile, projects, roles } from "@/content";
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

  it("renders every role in the background timeline", () => {
    render(<Home />);

    for (const role of roles) {
      expect(screen.getByText(role.summary)).toBeInTheDocument();
      expect(screen.getByText(role.period)).toBeInTheDocument();
    }
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
