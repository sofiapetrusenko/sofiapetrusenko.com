import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown } from "./markdown-parser";

describe("parseInline", () => {
  it("splits text and code spans", () => {
    expect(parseInline("run `pnpm test` first")).toStrictEqual([
      { type: "text", value: "run " },
      { type: "code", value: "pnpm test" },
      { type: "text", value: " first" },
    ]);
  });

  it("leaves an unpaired backtick literal", () => {
    expect(parseInline("a ` b")).toStrictEqual([
      { type: "text", value: "a ` b" },
    ]);
  });

  it("handles text with no code at all", () => {
    expect(parseInline("plain")).toStrictEqual([
      { type: "text", value: "plain" },
    ]);
  });
});

describe("parseMarkdown", () => {
  it("joins wrapped lines into one paragraph", () => {
    const blocks = parseMarkdown("one\ntwo\n\nthree");
    expect(blocks).toStrictEqual([
      { type: "paragraph", spans: [{ type: "text", value: "one two" }] },
      { type: "paragraph", spans: [{ type: "text", value: "three" }] },
    ]);
  });

  it("starts headings at h2 so the page keeps one h1", () => {
    const blocks = parseMarkdown("# a\n\n## b\n\n### c\n\n#### d");
    expect(
      blocks.map((b) => (b.type === "heading" ? b.level : null)),
    ).toStrictEqual([2, 3, 4, 4]);
  });

  it("captures fenced code with its language, preserving indentation", () => {
    const blocks = parseMarkdown("```ts\nconst a = 1;\n  indented\n```");
    expect(blocks).toStrictEqual([
      { type: "code", language: "ts", code: "const a = 1;\n  indented" },
    ]);
  });

  it("treats a fence with no language as unlabelled", () => {
    const [block] = parseMarkdown("```\nx\n```");
    expect(block).toStrictEqual({ type: "code", language: null, code: "x" });
  });

  it("does not let a code block swallow a following paragraph", () => {
    const blocks = parseMarkdown("```\ncode\n```\n\nafter");
    expect(blocks.map((b) => b.type)).toStrictEqual(["code", "paragraph"]);
  });

  it("closes an unterminated fence at end of input", () => {
    const blocks = parseMarkdown("```\ncode never closed");
    expect(blocks).toStrictEqual([
      { type: "code", language: null, code: "code never closed" },
    ]);
  });

  it("passes unsupported syntax through as literal text", () => {
    // Lists, bold and links are not supported. They must stay readable rather
    // than render as a mangled half-parse.
    const blocks = parseMarkdown("- item\n\n**bold**\n\n[a](b)");
    expect(blocks.every((b) => b.type === "paragraph")).toBe(true);
    expect(
      blocks.flatMap((b) => (b.type === "paragraph" ? b.spans : [])),
    ).toStrictEqual([
      { type: "text", value: "- item" },
      { type: "text", value: "**bold**" },
      { type: "text", value: "[a](b)" },
    ]);
  });

  it("returns nothing for empty or whitespace-only input", () => {
    expect(parseMarkdown("")).toStrictEqual([]);
    expect(parseMarkdown("\n\n  \n")).toStrictEqual([]);
  });
});
