"use client";

import { useId, useState, type ReactNode } from "react";
import { labels } from "@/content";

/**
 * Long-form reasoning behind a toggle, under a summary that is always visible.
 *
 * The body stays in the DOM and is hidden with `hidden` rather than unmounted,
 * so it is there for search engines and for in-page find. That is also why the
 * open state lives in a `<button aria-expanded>` and not in `<details>`: the
 * summary above is prose the toggle should not swallow, and the button gives
 * the same keyboard behaviour without nesting the two.
 */
export function Disclosure({
  summary,
  label = labels.whyToggle,
  defaultOpen = false,
  children,
}: {
  summary: ReactNode;
  label?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <div>
      <div className="prose-hover max-w-[68ch] text-lg leading-relaxed">
        {summary}
      </div>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="text-accent link-underline mt-4 cursor-pointer border-0 bg-transparent p-0 font-mono text-xs"
      >
        {label}
        <span
          aria-hidden="true"
          className="ml-1.5 inline-block transition-transform duration-150 ease-out motion-reduce:transition-none"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        >
          ↓
        </span>
      </button>

      <div id={bodyId} hidden={!open} className="mt-5">
        <div className="prose-hover border-hairline max-w-[68ch] border-l pl-5 text-lg leading-relaxed sm:pl-6">
          {children}
        </div>
      </div>
    </div>
  );
}
