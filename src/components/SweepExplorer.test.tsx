import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { blotquantMetrics, chartableSweeps } from "@/content";
import { SweepExplorer } from "./SweepExplorer";

/**
 * The chart itself is recharts inside a ResponsiveContainer, which measures a
 * container jsdom gives no size, so these cover the parts that carry meaning
 * without it: which sweeps are offered, which one is shown, and the generated
 * line underneath.
 */

const sweeps = chartableSweeps(blotquantMetrics);
const [first, second] = sweeps;
if (!first || !second)
  throw new Error("expected at least two chartable sweeps");

/**
 * The generated line mixes the note with the parameter name and shipped value
 * in one paragraph, so match on the paragraph that contains it rather than on
 * an element whose whole text is the note.
 */
const noteParagraph = (note: string) =>
  screen.getAllByText(
    (_content, element) =>
      element?.tagName === "P" && (element.textContent ?? "").includes(note),
  );

describe("SweepExplorer", () => {
  it("offers every chartable sweep in the record", () => {
    render(<SweepExplorer />);

    const selector = screen.getByRole("group", { name: /parameter sweeps/i });
    const buttons = within(selector).getAllByRole("button");
    expect(buttons).toHaveLength(sweeps.length);
    expect(buttons.map((button) => button.textContent)).toStrictEqual(
      sweeps.map((sweep) => sweep.key),
    );
  });

  it("opens on the first sweep and marks it pressed", () => {
    render(<SweepExplorer />);

    const selector = screen.getByRole("group", { name: /parameter sweeps/i });
    expect(
      within(selector).getByRole("button", { name: first.key }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the shipped value for the selected sweep", () => {
    render(<SweepExplorer />);
    expect(
      screen.getByText(
        new RegExp(`shipped:\\s*${String(first.shipped_value)}`),
      ),
    ).toBeInTheDocument();
  });

  it("switches the whole panel when another sweep is chosen", () => {
    render(<SweepExplorer />);

    const selector = screen.getByRole("group", { name: /parameter sweeps/i });
    fireEvent.click(within(selector).getByRole("button", { name: second.key }));

    expect(
      within(selector).getByRole("button", { name: second.key }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(noteParagraph(second.note).length).toBeGreaterThan(0);
  });

  it("takes the line under the chart from the record's own note", () => {
    render(<SweepExplorer />);
    // Not an interpretation written here — the sweep's `note` field verbatim.
    expect(noteParagraph(first.note).length).toBeGreaterThan(0);
  });

  it("cites the commit the record was read from", () => {
    render(<SweepExplorer />);
    expect(
      screen.getByText(new RegExp(blotquantMetrics.source_commit.slice(0, 9))),
    ).toBeInTheDocument();
  });
});
