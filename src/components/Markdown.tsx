import type { InlineSpan, MarkdownBlock } from "./markdown-parser";

/** Inline `code` gets the same surface-and-hairline treatment as code blocks. */
function Spans({ spans }: { spans: readonly InlineSpan[] }) {
  return (
    <>
      {spans.map((span, index) =>
        span.type === "code" ? (
          <code
            key={index}
            className="border-hairline bg-surface rounded-sm border px-1.5 py-0.5 font-mono text-[0.9em]"
          >
            {span.value}
          </code>
        ) : (
          <span key={index}>{span.value}</span>
        ),
      )}
    </>
  );
}

/**
 * Renders parsed blocks as elements. Blocks arrive as data from `parseMarkdown`,
 * so no HTML is ever injected and there is nothing to sanitise.
 */
export function Markdown({ blocks }: { blocks: readonly MarkdownBlock[] }) {
  return (
    <div className="flex flex-col gap-6">
      {blocks.map((block, index) => {
        if (block.type === "code") {
          return (
            // Scrolls inside its own box; a long line never widens the page.
            <pre
              key={index}
              className="border-hairline bg-surface max-w-full overflow-x-auto rounded-sm border p-4 font-mono text-xs leading-relaxed"
            >
              <code>{block.code}</code>
            </pre>
          );
        }

        if (block.type === "heading") {
          const className = "max-w-[68ch] font-medium tracking-tight";
          const content = <Spans spans={block.spans} />;
          if (block.level === 2)
            return (
              <h2 key={index} className={`${className} mt-4 text-xl`}>
                {content}
              </h2>
            );
          if (block.level === 3)
            return (
              <h3 key={index} className={`${className} mt-2 text-lg`}>
                {content}
              </h3>
            );
          return (
            <h4 key={index} className={`${className} text-base`}>
              {content}
            </h4>
          );
        }

        return (
          <p key={index} className="max-w-[68ch] leading-relaxed">
            <Spans spans={block.spans} />
          </p>
        );
      })}
    </div>
  );
}
