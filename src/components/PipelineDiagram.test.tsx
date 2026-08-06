import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { pipelineStages } from "@/content";
import { PipelineDiagram } from "./PipelineDiagram";

/**
 * The diagram renders twice — horizontal and vertical — with CSS hiding one.
 * jsdom applies no stylesheet, so both are present; scope queries to the first
 * copy rather than asserting on ambiguous global matches.
 */
function firstDiagram() {
  const [first] = screen.getAllByRole("group", { name: /pipeline stages/i });
  if (!first) throw new Error("no diagram rendered");
  return within(first);
}

function nodeFor(name: string) {
  return firstDiagram().getByRole("button", {
    name: new RegExp(`^${name}`, "i"),
  });
}

function failureSwitch() {
  return screen.getByRole("switch", { name: /simulate failure/i });
}

const [firstStage, , , fourthStage] = pipelineStages;

describe("PipelineDiagram", () => {
  it("renders every stage as a button", () => {
    render(<PipelineDiagram stages={pipelineStages} />);

    for (const stage of pipelineStages) {
      expect(nodeFor(stage.name)).toBeInTheDocument();
    }
  });

  it("shows the first stage's detail by default", () => {
    render(<PipelineDiagram stages={pipelineStages} />);
    if (!firstStage) throw new Error("no stages");

    expect(screen.getByText(firstStage.does)).toBeInTheDocument();
    expect(screen.getByText(firstStage.artifact)).toBeInTheDocument();
    expect(screen.getByText(firstStage.failure)).toBeInTheDocument();
  });

  it("fills the detail panel from the clicked stage", () => {
    render(<PipelineDiagram stages={pipelineStages} />);
    if (!fourthStage) throw new Error("missing stage");

    fireEvent.click(nodeFor(fourthStage.name));

    expect(screen.getByText(fourthStage.does)).toBeInTheDocument();
    expect(screen.getByText(fourthStage.failure)).toBeInTheDocument();
  });

  it("moves selection with arrow keys", () => {
    render(<PipelineDiagram stages={pipelineStages} />);
    const second = pipelineStages[1];
    if (!firstStage || !second) throw new Error("missing stages");

    fireEvent.keyDown(nodeFor(firstStage.name), { key: "ArrowRight" });
    expect(screen.getByText(second.does)).toBeInTheDocument();

    fireEvent.keyDown(nodeFor(second.name), { key: "ArrowLeft" });
    expect(screen.getByText(firstStage.does)).toBeInTheDocument();
  });

  it("jumps to the last stage with End", () => {
    render(<PipelineDiagram stages={pipelineStages} />);
    const last = pipelineStages[pipelineStages.length - 1];
    if (!firstStage || !last) throw new Error("missing stages");

    fireEvent.keyDown(nodeFor(firstStage.name), { key: "End" });
    expect(screen.getByText(last.does)).toBeInTheDocument();
  });

  it("keeps only the selected node in the tab order", () => {
    render(<PipelineDiagram stages={pipelineStages} />);
    if (!firstStage || !fourthStage) throw new Error("missing stages");

    expect(nodeFor(firstStage.name)).toHaveAttribute("tabindex", "0");
    expect(nodeFor(fourthStage.name)).toHaveAttribute("tabindex", "-1");

    fireEvent.click(nodeFor(fourthStage.name));

    expect(nodeFor(fourthStage.name)).toHaveAttribute("tabindex", "0");
    expect(nodeFor(firstStage.name)).toHaveAttribute("tabindex", "-1");
  });

  it("uses real HTML buttons that actually take focus", () => {
    render(<PipelineDiagram stages={pipelineStages} />);
    if (!firstStage) throw new Error("missing stage");

    const node = nodeFor(firstStage.name);

    // An SVG <g role="button"> can be activeElement while matching neither
    // :focus nor :focus-visible and firing no focus event, which makes a focus
    // ring impossible. Pin the element type so that cannot regress.
    expect(node.tagName).toBe("BUTTON");

    node.focus();
    expect(document.activeElement).toBe(node);
    expect(node.matches(":focus")).toBe(true);
  });

  it("keeps the SVG out of the accessibility tree", () => {
    const { container } = render(<PipelineDiagram stages={pipelineStages} />);
    for (const svg of container.querySelectorAll("svg")) {
      expect(svg).toHaveAttribute("aria-hidden");
    }
  });

  it("marks upstream, failed and downstream stages when failure is simulated", () => {
    render(<PipelineDiagram stages={pipelineStages} />);

    fireEvent.click(failureSwitch());

    // Status rides in the accessible name, so it is never colour-only.
    const diagram = firstDiagram();
    expect(
      diagram.getByRole("button", { name: /metadata & seo, failed/i }),
    ).toBeInTheDocument();
    expect(
      diagram.getByRole("button", { name: /script, complete/i }),
    ).toBeInTheDocument();
    expect(
      diagram.getByRole("button", { name: /upload, not run/i }),
    ).toBeInTheDocument();
  });

  it("explains that only the failed stage re-runs", () => {
    render(<PipelineDiagram stages={pipelineStages} />);

    fireEvent.click(failureSwitch());

    expect(screen.getByText(/re-runs only this one/i)).toBeInTheDocument();
  });

  it("exposes the failure toggle as a switch that reports its state", () => {
    render(<PipelineDiagram stages={pipelineStages} />);

    expect(failureSwitch()).toHaveAttribute("aria-checked", "false");
    fireEvent.click(failureSwitch());
    expect(failureSwitch()).toHaveAttribute("aria-checked", "true");
  });

  it("strikes through only the stages the run never reached", () => {
    const { container } = render(<PipelineDiagram stages={pipelineStages} />);
    fireEvent.click(failureSwitch());

    const svg = container.querySelector("svg");
    if (!svg) throw new Error("no svg rendered");
    const labelFor = (name: string) =>
      [...svg.querySelectorAll(".pipe-label")].find(
        (el) => el.textContent === name,
      );

    // Downstream of the failure: struck. Upstream: not struck.
    expect(labelFor("Thumbnail")).toHaveAttribute(
      "text-decoration",
      "line-through",
    );
    expect(labelFor("Script")).not.toHaveAttribute("text-decoration");
  });

  it("marks stages as visited once opened, and not before", () => {
    render(<PipelineDiagram stages={pipelineStages} />);
    const target = pipelineStages[4];
    if (!target) throw new Error("missing stage");

    expect(
      firstDiagram().queryByRole("button", {
        name: new RegExp(`${target.name}.*visited`, "i"),
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(nodeFor(target.name));

    expect(
      firstDiagram().getByRole("button", {
        name: new RegExp(`${target.name}.*visited`, "i"),
      }),
    ).toBeInTheDocument();
  });

  it("names the human gate as a checkpoint, not just a coloured node", () => {
    render(<PipelineDiagram stages={pipelineStages} />);

    expect(
      firstDiagram().getByRole("button", {
        name: /human review, human approval/i,
      }),
    ).toBeInTheDocument();
  });
});
