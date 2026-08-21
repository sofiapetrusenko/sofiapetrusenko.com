/**
 * The QC philosophy in one figure.
 *
 * Three bars, from the README's intensity-recovery table: mean absolute error
 * over all matched bands, then with truth-`saturated` bands removed, then over
 * bands whose ground truth carries no QC flag at all. The last is the honest
 * accuracy number, and the distance back to the first is what flagging is for.
 *
 * Plain elements rather than a chart library: three bars with a shared scale
 * need no axes, and this way they reflow at 380px without a container query.
 */

import {
  blotquantMetrics,
  intensitySubset,
  labels,
  shortCommit,
} from "@/content";

const metrics = blotquantMetrics;

export function QcEffectChart() {
  const rows = metrics.intensity_recovery;
  const worst = Math.max(...rows.map((row) => row.mean_absolute_percent));
  // First and last rows of the table, which is the order the README records:
  // everything matched, down to the bands with no ground-truth QC flag at all.
  const headline = intensitySubset(metrics, 0);
  const cleanest = intensitySubset(metrics, rows.length - 1);

  return (
    <div>
      <div className="border-hairline border p-4 sm:p-6">
        <ul className="flex flex-col gap-5">
          {rows.map((row, index) => {
            const isCleanest = index === rows.length - 1;
            const color = isCleanest ? "var(--color-ok)" : "var(--color-gate)";

            return (
              <li key={row.subset}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-fg text-sm">{row.subset}</span>
                  <span className="font-mono text-xs" style={{ color }}>
                    {row.mean_absolute_percent}%{" "}
                    <span className="text-muted">/ {row.bands} bands</span>
                  </span>
                </div>
                <div
                  className="mt-2 h-2 w-full overflow-hidden rounded-sm"
                  style={{ backgroundColor: "var(--color-bg)" }}
                >
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: `${(row.mean_absolute_percent / worst) * 100}%`,
                      backgroundColor: color,
                      opacity: isCleanest ? 1 : 0.55,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-muted mt-3 text-sm leading-relaxed">
        {cleanest.mean_absolute_percent}% is the accuracy claim;{" "}
        {headline.mean_absolute_percent}% is what you get if you quantify
        everything and flag nothing. {labels.qcChartCaption}{" "}
        {shortCommit(metrics.source_commit)}.
      </p>
    </div>
  );
}
