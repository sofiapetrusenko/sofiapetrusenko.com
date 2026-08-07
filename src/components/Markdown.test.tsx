import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";
import { parseMarkdown } from "./markdown-parser";

/** Renders through the real parser, so parser and renderer stay in step. */
function renderSource(source: string) {
  return render(<Markdown blocks={parseMarkdown(source)} />);
}

describe("Markdown", () => {
  it("renders paragraphs", () => {
    renderSource("hello there");
    expect(screen.getByText("hello there")).toBeInTheDocument();
  });

  it("renders headings below h1 so a page keeps a single h1", () => {
    const { container } = renderSource("# a\n\n## b\n\n### c");

    expect(container.querySelectorAll("h1")).toHaveLength(0);
    expect(
      screen.getByRole("heading", { level: 2, name: "a" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "b" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 4, name: "c" }),
    ).toBeInTheDocument();
  });

  it("renders a code block that scrolls rather than widening the page", () => {
    const { container } = renderSource("```ts\nconst a = 1;\n```");

    const pre = container.querySelector("pre");
    expect(pre).toBeInTheDocument();
    expect(pre).toHaveTextContent("const a = 1;");
    // Pipeline-panel language: surface fill, hairline border, mono, own scroller.
    expect(pre?.className).toContain("bg-surface");
    expect(pre?.className).toContain("border-hairline");
    expect(pre?.className).toContain("font-mono");
    expect(pre?.className).toContain("overflow-x-auto");
  });

  it("preserves whitespace inside code blocks", () => {
    const { container } = renderSource("```\nline one\n  indented\n```");
    expect(container.querySelector("pre code")?.textContent).toBe(
      "line one\n  indented",
    );
  });

  it("renders inline code as a code element, not literal backticks", () => {
    const { container } = renderSource("run `pnpm test` now");

    const code = container.querySelector("p code");
    expect(code).toHaveTextContent("pnpm test");
    expect(container.textContent).not.toContain("`");
  });

  it("renders nothing for an empty body", () => {
    const { container } = renderSource("");
    expect(container.querySelectorAll("p, pre, h2, h3, h4")).toHaveLength(0);
  });
});
