"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  blotquantMetrics,
  chartableSweeps,
  labels,
  shortCommit,
} from "@/content";

/**
 * The parameter sweeps behind the shipped configuration, read from
 * `evals/dev_sweeps.json`.
 *
 * Both F1 series are plotted wherever a sweep has them, because the tension
 * between them is the point: a parameter that helps lane detection often costs
 * band detection, and the shipped value is where that trade-off was settled.
 * The line under the chart is generated — parameter, shipped value, and the
 * sweep's own `note` — so this component never editorialises a sweep it was
 * not told about.
 *
 * Recharts wants concrete colours rather than custom properties, so the hex
 * values here are the same tokens `globals.css` defines, and are the only place
 * on the site they are repeated.
 */

const CHART = {
  lane: "#38bdf8", // --color-accent
  band: "#4ade80", // --color-ok
  shipped: "#fbbf24", // --color-gate
  grid: "#26262b", // --color-hairline
  axis: "#a1a1aa", // --color-muted
  surface: "#0d0d0f", // --color-bg
} as const;

const metrics = blotquantMetrics;
const sweeps = chartableSweeps(metrics);

/** Axis ticks read better as the record's own labels than as floats. */
const formatValue = (value: number) => String(value);

export function SweepExplorer() {
  const [selectedKey, setSelectedKey] = useState(sweeps[0]?.key ?? "");

  const sweep = useMemo(
    () => sweeps.find((entry) => entry.key === selectedKey) ?? sweeps[0],
    [selectedKey],
  );

  const data = useMemo(
    () =>
      (sweep?.values ?? []).map((row) => ({
        value: row.value,
        label: row.label,
        laneF1: row.lane_f1,
        bandF1: row.band_f1,
        meanError: row.mean_absolute_percent,
      })),
    [sweep],
  );

  if (!sweep) return null;

  const shipped = sweep.shipped_value;
  const shippedRow = sweep.values.find(
    (row) => String(row.value) === String(shipped),
  );

  return (
    <div>
      {/* Selector. Wraps rather than scrolls, so it stays usable at 380px. */}
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label={labels.sweepSelector}
      >
        {sweeps.map((entry) => {
          const isSelected = entry.key === sweep.key;
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setSelectedKey(entry.key)}
              aria-pressed={isSelected}
              className="cursor-pointer rounded-sm border px-2.5 py-1 font-mono text-[0.6875rem] transition-colors duration-150 ease-out motion-reduce:transition-none"
              style={{
                color: isSelected
                  ? "var(--color-accent)"
                  : "var(--color-muted)",
                borderColor: isSelected
                  ? "color-mix(in srgb, var(--color-accent) 45%, transparent)"
                  : "var(--color-hairline)",
                backgroundColor: isSelected
                  ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
                  : "transparent",
              }}
            >
              {entry.key}
            </button>
          );
        })}
      </div>

      <div className="border-hairline mt-5 border">
        <header className="border-hairline flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b px-4 py-3 sm:px-6">
          <span className="font-mono text-xs">{sweep.key}</span>
          <span className="text-muted font-mono text-[0.6875rem]">
            {labels.shipped}: {String(shipped)}
          </span>
        </header>

        <div className="h-64 w-full px-1 py-4 sm:px-4">
          <ResponsiveContainer>
            <LineChart
              data={data}
              margin={{ top: 6, right: 14, bottom: 4, left: -14 }}
            >
              <CartesianGrid
                stroke={CHART.grid}
                strokeDasharray="2 4"
                vertical={false}
              />
              <XAxis
                dataKey="value"
                type="number"
                domain={["dataMin", "dataMax"]}
                ticks={data.map((row) => row.value as number)}
                tickFormatter={formatValue}
                tick={{ fill: CHART.axis, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: CHART.grid }}
                /* Ticks are the record's own measured values, never
                   interpolated ones. On a narrow screen the crowded ones drop
                   out rather than overprinting; the ends always stay. */
                interval="preserveStartEnd"
                minTickGap={14}
              />
              <YAxis
                domain={[0, 1]}
                ticks={[0, 0.25, 0.5, 0.75, 1]}
                tick={{ fill: CHART.axis, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: CHART.grid }}
              />
              <Tooltip
                contentStyle={{
                  background: CHART.surface,
                  border: `1px solid ${CHART.grid}`,
                  borderRadius: 3,
                  fontSize: 12,
                }}
                labelStyle={{ color: CHART.axis }}
                itemStyle={{ color: "#e8e8ea" }}
                labelFormatter={(label) =>
                  `${sweep.parameter} = ${String(label)}`
                }
              />
              <Legend
                verticalAlign="top"
                height={26}
                wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono)" }}
              />
              {shipped !== null && (
                <ReferenceLine
                  x={Number(shipped)}
                  stroke={CHART.shipped}
                  strokeDasharray="4 3"
                  label={{
                    value: labels.shipped,
                    fill: CHART.shipped,
                    fontSize: 10,
                    // Inside the plot area, so it never collides with the
                    // legend when the shipped value sits mid-chart.
                    position: "insideTopRight",
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="laneF1"
                name="lane F1"
                stroke={CHART.lane}
                strokeWidth={1.5}
                dot={{ r: 2, fill: CHART.lane }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="bandF1"
                name="band F1"
                stroke={CHART.band}
                strokeWidth={1.5}
                dot={{ r: 2, fill: CHART.band }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Generated, not written: the record's own note for this sweep. */}
        <p className="border-hairline text-muted border-t px-4 py-3 text-sm leading-relaxed sm:px-6">
          <span className="text-fg font-mono text-xs">{sweep.parameter}</span>{" "}
          ships at{" "}
          <span className="text-fg font-mono text-xs">{String(shipped)}</span>
          {shippedRow?.lane_f1 !== null &&
            shippedRow?.band_f1 !== undefined && (
              <>
                {" "}
                (lane F1 {shippedRow?.lane_f1}, band F1 {shippedRow?.band_f1})
              </>
            )}
          . {sweep.note}
        </p>
      </div>

      <p className="text-muted mt-3 font-mono text-[0.6875rem] leading-relaxed">
        {labels.sweepCaption} {shortCommit(metrics.source_commit)}.
      </p>
    </div>
  );
}
