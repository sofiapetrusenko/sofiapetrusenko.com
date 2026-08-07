/**
 * A deliberately small markdown parser — no dependency, no HTML parsing, and
 * therefore no sanitising problem: it emits typed blocks, and the renderer maps
 * those to React elements. Nothing ever reaches `dangerouslySetInnerHTML`.
 *
 * Supported: ATX headings (`#`–`###`), fenced code blocks with an optional
 * language, blank-line-separated paragraphs, and inline `code` spans.
 *
 * NOT supported: lists, bold, italic, links, blockquotes, tables, images.
 * Unsupported syntax is passed through as literal text rather than being
 * half-parsed — a stray `- item` renders as "- item", never as a broken list.
 * `parseMarkdown` is pure, so anything added here is unit-testable in isolation.
 */

export type InlineSpan =
  { type: "text"; value: string } | { type: "code"; value: string };

export type MarkdownBlock =
  | { type: "heading"; level: 2 | 3 | 4; spans: InlineSpan[] }
  | { type: "paragraph"; spans: InlineSpan[] }
  | { type: "code"; language: string | null; code: string };

const FENCE = "```";

/** Splits a line into text and `code` spans. Unpaired backticks stay literal. */
export function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let rest = text;

  while (rest.length > 0) {
    const open = rest.indexOf("`");
    if (open === -1) break;

    const close = rest.indexOf("`", open + 1);
    if (close === -1) break;

    if (open > 0) spans.push({ type: "text", value: rest.slice(0, open) });
    spans.push({ type: "code", value: rest.slice(open + 1, close) });
    rest = rest.slice(close + 1);
  }

  if (rest.length > 0) spans.push({ type: "text", value: rest });
  return spans;
}

/** Note bodies sit under the page's h1, so `#` starts at h2 and clamps at h4. */
function headingLevel(hashes: number): 2 | 3 | 4 {
  if (hashes <= 1) return 2;
  if (hashes === 2) return 3;
  return 4;
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    blocks.push({ type: "paragraph", spans: parseInline(paragraph.join(" ")) });
    paragraph = [];
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";

    if (line.trimStart().startsWith(FENCE)) {
      flushParagraph();
      const language = line.trimStart().slice(FENCE.length).trim();
      const body: string[] = [];
      i += 1;
      while (
        i < lines.length &&
        !(lines[i] ?? "").trimStart().startsWith(FENCE)
      ) {
        body.push(lines[i] ?? "");
        i += 1;
      }
      // An unterminated fence still yields a code block rather than swallowing
      // the rest of the document into nothing.
      blocks.push({
        type: "code",
        language: language === "" ? null : language,
        code: body.join("\n"),
      });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading?.[1] !== undefined && heading[2] !== undefined) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: headingLevel(heading[1].length),
        spans: parseInline(heading[2].trim()),
      });
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  return blocks;
}
