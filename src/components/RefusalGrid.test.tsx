import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { blotquantMetrics } from "@/content";
import { RefusalGrid } from "./RefusalGrid";
import { StatStrip } from "./StatStrip";

const run = blotquantMetrics.real_data_run;

describe("RefusalGrid", () => {
  it("shows one cell per crop", () => {
    render(<RefusalGrid />);

    const grid = screen.getByRole("group", { name: /cc-by crops/i });
    expect(within(grid).getAllByRole("button")).toHaveLength(run.crops);
  });

  it("leads with the outcome rather than burying it", () => {
    render(<RefusalGrid />);
    expect(
      screen.getByText(
        new RegExp(
          `${run.produced} of ${run.crops} crops produced a result document`,
        ),
      ),
    ).toBeInTheDocument();
  });

  it("states the one shared reason once, not per cell", () => {
    render(<RefusalGrid />);
    expect(screen.getAllByText(run.reason)).toHaveLength(1);
  });

  it("names the crop under the pointer", () => {
    render(<RefusalGrid />);

    const grid = screen.getByRole("group", { name: /cc-by crops/i });
    const [cell] = within(grid).getAllByRole("button");
    const firstCrop = run.crop_ids[0];
    if (!cell || !firstCrop) throw new Error("expected at least one crop");

    fireEvent.mouseEnter(cell);
    expect(screen.getByText(firstCrop)).toBeInTheDocument();
  });

  it("breaks the crops down by channel divergence", () => {
    render(<RefusalGrid />);
    for (const group of run.channel_groups) {
      expect(screen.getByText(group.group)).toBeInTheDocument();
    }
  });
});

describe("StatStrip", () => {
  it("renders each figure with its label", () => {
    render(
      <StatStrip
        stats={[
          { value: "0.851", label: "band detection F1" },
          { value: "0 of 19", label: "real crops measured", flagged: true },
        ]}
      />,
    );

    expect(screen.getByText("0.851")).toBeInTheDocument();
    expect(screen.getByText("0 of 19")).toBeInTheDocument();
    // The label is on screen and also names the value for a screen reader.
    expect(screen.getAllByText("real crops measured").length).toBeGreaterThan(
      0,
    );
  });
});
