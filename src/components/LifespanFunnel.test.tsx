import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LifespanFunnel } from "./LifespanFunnel";

describe("LifespanFunnel", () => {
  it("renders every stage as a control", () => {
    render(<LifespanFunnel />);

    const group = screen.getByRole("group", { name: /pipeline stages/i });
    expect(group.querySelectorAll("button")).toHaveLength(5);
  });

  it("says which stages are not built yet, in words as well as in the dashes", () => {
    render(<LifespanFunnel />);

    // Colour and stroke style carry it visually; the accessible name carries it
    // for everyone else.
    expect(
      screen.getByRole("button", { name: /^extract, planned$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^fetch, built$/i }),
    ).toBeInTheDocument();
  });

  it("labels the selected stage in fg, planned or not (CHARTER A12)", () => {
    const { container } = render(<LifespanFunnel />);

    for (const name of [/^extract, planned$/i, /^record, built$/i]) {
      fireEvent.click(screen.getByRole("button", { name }));
      // Accent on the 12% accent fill is 4.40:1 over the worst underlay; the
      // border and fill carry the selection instead.
      const [rect, ...rest] = [
        ...container.querySelectorAll("svg rect"),
      ].filter((r) => r.getAttribute("fill-opacity") === "0.12");
      expect(rest).toHaveLength(0);
      expect(rect?.getAttribute("stroke")).toBe("var(--color-accent)");
      const label = rect?.parentElement?.querySelector("text.pipe-label");
      expect(label?.getAttribute("fill")).toBe("var(--color-fg)");
    }
  });

  it("opens a stage's detail and its cited excerpt on selection", () => {
    render(<LifespanFunnel />);

    fireEvent.click(screen.getByRole("button", { name: /^record, built$/i }));

    expect(
      screen.getByRole("heading", { level: 3, name: /record/i }),
    ).toBeInTheDocument();
    // Every excerpt names the file it was quoted from.
    expect(
      screen.getByText(/protect_paths\.py — the module docstring/),
    ).toBeInTheDocument();
  });

  it("labels the counts as gold-set labels rather than a model run", () => {
    render(<LifespanFunnel />);

    expect(
      screen.getByText(/the model has not run against them yet/i),
    ).toBeInTheDocument();
  });

  it("breaks the gold records down to the counted total", () => {
    render(<LifespanFunnel />);

    // 18 + 7 + 1 = 26, the record count stated beside it.
    for (const count of ["18", "7", "1"]) {
      expect(screen.getAllByText(count).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText(/26 gold records/).length).toBe(2);
  });
});
