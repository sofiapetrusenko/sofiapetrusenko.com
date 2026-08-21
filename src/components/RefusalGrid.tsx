"use client";

import { useState } from "react";
import { blotquantMetrics, labels, shortCommit } from "@/content";

/**
 * The first real-data run: one cell per CC-BY crop, every one of them refused.
 *
 * The refusal reason is uniform across every crop — they are three-channel PNGs
 * and the loader quantifies single-channel images only — so it is stated once
 * above the grid rather than repeated per cell. Each cell carries its crop id,
 * which is the part that differs.
 *
 * The per-crop channel-divergence table is not committed (`runs/` is ignored in
 * that repo), so the cells are not colour-coded by group. The group counts are
 * shown as counts underneath instead of being guessed onto individual cells.
 */

const metrics = blotquantMetrics;
const run = metrics.real_data_run;

export function RefusalGrid() {
  const [active, setActive] = useState<number | null>(null);
  const activeCrop = active === null ? null : run.crop_ids[active];

  return (
    <div>
      <p className="max-w-[68ch] text-lg leading-relaxed">
        The run measured nothing: {run.produced} of {run.crops} crops produced a
        result document and {run.failed} were refused. That is the recorded
        result, not a run still pending.
      </p>

      <div className="border-hairline mt-6 border p-4 sm:p-6">
        <div
          className="grid grid-cols-5 gap-1.5 sm:grid-cols-10"
          role="group"
          aria-label={labels.refusalGrid}
          onMouseLeave={() => setActive(null)}
        >
          {run.crop_ids.map((crop, index) => (
            <button
              key={crop}
              type="button"
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              className="aspect-square cursor-pointer rounded-sm border transition-colors duration-150 ease-out motion-reduce:transition-none"
              style={{
                borderColor:
                  active === index
                    ? "var(--color-gate)"
                    : "color-mix(in srgb, var(--color-gate) 45%, transparent)",
                backgroundColor:
                  active === index
                    ? "color-mix(in srgb, var(--color-gate) 26%, transparent)"
                    : "color-mix(in srgb, var(--color-gate) 10%, transparent)",
              }}
            >
              <span className="sr-only">
                {crop}: {labels.refused}
              </span>
            </button>
          ))}
        </div>

        {/* One reason, one line, held steady so hovering does not reflow. */}
        <div className="border-hairline mt-4 min-h-[3.25rem] border-t pt-3">
          <p
            className="font-mono text-[0.6875rem] break-all"
            style={{ color: "var(--color-gate)" }}
          >
            {activeCrop ?? `${run.crops} crops · ${labels.refused}`}
          </p>
          <p className="text-muted mt-1 font-mono text-[0.6875rem] leading-relaxed">
            {run.reason}
          </p>
        </div>
      </div>

      <ul className="mt-5 flex flex-col gap-1.5">
        {run.channel_groups.map((group) => (
          <li
            key={group.group}
            className="text-muted flex flex-wrap items-baseline justify-between gap-x-4 font-mono text-[0.6875rem]"
          >
            <span>{group.group}</span>
            <span>
              <span className="text-fg">{group.crops}</span> ·{" "}
              {group.divergence}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-muted mt-5 max-w-[68ch] text-sm leading-relaxed">
        The fix is a documented loader decision about channel handling — the
        ruling puts {run.measurable} of {run.crops} crops within reach — and it
        has to be specified before any measurement is taken, not after. It is
        not a change to the pre-registration, which stands as frozen. Read from{" "}
        {shortCommit(metrics.source_commit)}.
      </p>
    </div>
  );
}
