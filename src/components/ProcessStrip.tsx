import type { ProcessStep } from "@/content";

/**
 * The colophon's process, in the pipeline diagram's visual language — bordered
 * nodes, hairline connectors, accent on hover — but not its component. These
 * nodes are not interactive: there is no detail panel behind them, so they are
 * plain list items rather than buttons, and nothing animates on idle.
 *
 * Vertical below `sm` for the same reason the pipeline is: six labels do not
 * fit across 360px.
 */
export function ProcessStrip({ steps }: { steps: readonly ProcessStep[] }) {
  return (
    <ol className="flex flex-col items-stretch sm:flex-row sm:items-stretch">
      {steps.map((step, index) => (
        <li
          key={step.id}
          className="flex flex-col sm:flex-1 sm:flex-row sm:items-stretch"
        >
          {index > 0 && (
            <span
              aria-hidden="true"
              className="bg-hairline mx-auto h-4 w-px shrink-0 sm:mx-0 sm:my-auto sm:h-px sm:w-4"
            />
          )}
          <span className="border-hairline hover:border-accent hover:text-accent flex flex-1 flex-col justify-center rounded-sm border px-3 py-3 text-center font-mono text-xs transition-colors duration-150 ease-out">
            {step.label}
            {step.detail !== undefined && (
              <span className="text-muted mt-1.5 block text-[0.625rem] leading-snug">
                {step.detail}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
