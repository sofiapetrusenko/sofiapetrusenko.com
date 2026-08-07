import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { colophon } from "@/content";
import ColophonPage from "./page";

describe("ColophonPage", () => {
  it("renders the intro", () => {
    render(<ColophonPage />);
    expect(screen.getByText(colophon.intro)).toBeInTheDocument();
  });

  it("renders every principle", () => {
    render(<ColophonPage />);

    for (const principle of colophon.principles) {
      expect(screen.getByText(principle)).toBeInTheDocument();
    }
  });

  it("renders every process step in order", () => {
    render(<ColophonPage />);

    const items = screen
      .getAllByRole("listitem")
      .map((li) => li.textContent ?? "");

    for (const step of colophon.steps) {
      expect(
        items.some((text) => text.startsWith(step.label)),
        `missing step: ${step.label}`,
      ).toBe(true);
    }
  });

  it("shows what the CI step actually runs", () => {
    render(<ColophonPage />);

    const ci = colophon.steps.find((step) => step.detail !== undefined);
    if (!ci?.detail) throw new Error("expected a step with a detail");
    expect(screen.getByText(ci.detail)).toBeInTheDocument();
  });

  it("renders every number with its label", () => {
    render(<ColophonPage />);

    for (const entry of colophon.numbers) {
      expect(screen.getByText(entry.value)).toBeInTheDocument();
      expect(screen.getByText(entry.label)).toBeInTheDocument();
    }
  });

  it("links back to the home page", () => {
    render(<ColophonPage />);
    expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
