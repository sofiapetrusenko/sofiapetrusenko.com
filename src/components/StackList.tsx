/** Wraps rather than scrolls, so long stacks stay readable at 360px. */
export function StackList({ stack }: { stack: readonly string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {stack.map((entry) => (
        <li
          key={entry}
          className="border-hairline text-muted rounded-sm border px-2 py-1 font-mono text-xs"
        >
          {entry}
        </li>
      ))}
    </ul>
  );
}
