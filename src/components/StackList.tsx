/** Wraps rather than scrolls, so long stacks stay readable at 360px. */
export function StackList({ stack }: { stack: readonly string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {stack.map((entry) => (
        <li
          key={entry}
          className="border-hairline hover:border-hairline-bright text-muted rounded-sm border px-2.5 py-1 font-mono text-xs transition-colors duration-150 ease-out"
        >
          {entry}
        </li>
      ))}
    </ul>
  );
}
