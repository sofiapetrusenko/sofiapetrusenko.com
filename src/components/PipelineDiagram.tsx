"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PipelineStage } from "@/content";
import { DEMO_FAILURE_INDEX } from "@/content/pipeline";
import { resumePlan, type StageStatus } from "./pipeline-status";

const PULSE_MS = 600;

/**
 * Horizontal geometry, sized so the viewBox renders ~1:1 in the text column.
 * `nodeH` is 48 rather than 44 because the SVG scales down slightly inside the
 * bordered container — 44 units lands at ~41 CSS px, under the 44px touch
 * target minimum.
 */
const H = {
  nodeW: 70,
  nodeH: 48,
  pitch: 78,
  top: 36,
  glyphY: 16,
  vbH: 104,
} as const;
/** Vertical geometry for narrow viewports. Same touch-target reasoning. */
const V = {
  nodeX: 44,
  nodeW: 232,
  nodeH: 48,
  pitch: 68,
  glyphX: 22,
  vbW: 288,
} as const;

type Orientation = "horizontal" | "vertical";

type Box = { x: number; y: number; width: number; height: number };

/** How a node should be painted, independent of orientation. */
type Visual = {
  stroke: string;
  strokeOpacity: number;
  fill: string;
  text: string;
  glyph: StageStatus | null;
};

function visualFor(
  status: StageStatus | null,
  isSelected: boolean,
  isPulsing: boolean,
): Visual {
  // Failure simulation takes over the palette entirely; selection still shows
  // through as a brighter fill so the detail panel's subject stays findable.
  if (status !== null) {
    const base = {
      fill: isSelected ? "var(--color-surface)" : "transparent",
      glyph: status,
    };
    if (status === "failed")
      return {
        ...base,
        stroke: "var(--color-danger)",
        strokeOpacity: 1,
        text: "var(--color-danger)",
      };
    if (status === "complete")
      return {
        ...base,
        stroke: "var(--color-ok)",
        strokeOpacity: 0.8,
        text: "var(--color-fg)",
      };
    return {
      ...base,
      stroke: "var(--color-hairline)",
      strokeOpacity: 1,
      text: "var(--color-muted)",
    };
  }

  if (isSelected)
    return {
      stroke: "var(--color-accent)",
      strokeOpacity: 1,
      fill: "var(--color-surface)",
      text: "var(--color-accent)",
      glyph: null,
    };

  if (isPulsing)
    return {
      stroke: "var(--color-accent)",
      strokeOpacity: 0.45,
      fill: "var(--color-surface)",
      text: "var(--color-fg)",
      glyph: null,
    };

  return {
    stroke: "var(--color-hairline)",
    strokeOpacity: 1,
    fill: "transparent",
    text: "var(--color-fg)",
    glyph: null,
  };
}

/** Status marks, so failure state is never carried by colour alone. */
function Glyph({
  status,
  x,
  y,
}: {
  status: StageStatus;
  x: number;
  y: number;
}) {
  const stroke =
    status === "failed"
      ? "var(--color-danger)"
      : status === "complete"
        ? "var(--color-ok)"
        : "var(--color-muted)";

  const d =
    status === "complete"
      ? `M${x - 4} ${y} l3 3 l5 -6`
      : status === "failed"
        ? `M${x - 4} ${y - 4} l8 8 M${x + 4} ${y - 4} l-8 8`
        : `M${x - 4} ${y} l8 0`;

  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function Diagram({
  orientation,
  stages,
  statuses,
  selectedIndex,
  pulseIndex,
  onSelect,
}: {
  orientation: Orientation;
  stages: readonly PipelineStage[];
  statuses: StageStatus[] | null;
  selectedIndex: number;
  pulseIndex: number | null;
  onSelect: (index: number) => void;
}) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const isHorizontal = orientation === "horizontal";

  const vbW = isHorizontal ? (stages.length - 1) * H.pitch + H.nodeW : V.vbW;
  const vbH = isHorizontal
    ? H.vbH
    : (stages.length - 1) * V.pitch + V.nodeH + 8;

  const boxAt = (index: number): Box =>
    isHorizontal
      ? { x: index * H.pitch, y: H.top, width: H.nodeW, height: H.nodeH }
      : { x: V.nodeX, y: index * V.pitch, width: V.nodeW, height: V.nodeH };

  const move = useCallback(
    (from: number, delta: number) => {
      const next = Math.min(stages.length - 1, Math.max(0, from + delta));
      if (next === from) return;
      onSelect(next);
      buttonRefs.current[next]?.focus();
    },
    [onSelect, stages.length],
  );

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    // Both axes are accepted regardless of orientation: the pipeline reads as a
    // sequence either way, and guessing wrong should not trap the user.
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        move(index, 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        move(index, -1);
        break;
      case "Home":
        event.preventDefault();
        move(index, -index);
        break;
      case "End":
        event.preventDefault();
        move(index, stages.length - 1 - index);
        break;
      default:
        break;
    }
  }

  return (
    <div className="relative">
      {/*
        Presentation only. The interactive layer below is real HTML buttons:
        an SVG <g> can be document.activeElement while matching neither :focus
        nor :focus-visible and firing no focus event at all, which makes a
        focus ring on it impossible to render reliably.
      */}
      <svg viewBox={`0 0 ${vbW} ${vbH}`} className="block w-full" aria-hidden>
        {/* Connectors first, so node boxes paint over their ends. */}
        {stages.slice(0, -1).map((stage, index) => {
          const dimmed = statuses !== null && statuses[index + 1] === "pending";
          const line = isHorizontal
            ? {
                x1: index * H.pitch + H.nodeW,
                y1: H.top + H.nodeH / 2,
                x2: (index + 1) * H.pitch,
                y2: H.top + H.nodeH / 2,
              }
            : {
                x1: V.nodeX + V.nodeW / 2,
                y1: index * V.pitch + V.nodeH,
                x2: V.nodeX + V.nodeW / 2,
                y2: (index + 1) * V.pitch,
              };
          return (
            <line
              key={`edge-${stage.id}`}
              {...line}
              stroke="var(--color-hairline)"
              strokeWidth={1}
              strokeOpacity={dimmed ? 0.5 : 1}
            />
          );
        })}

        {stages.map((stage, index) => {
          const status = statuses?.[index] ?? null;
          const isSelected = index === selectedIndex;
          const visual = visualFor(status, isSelected, index === pulseIndex);
          const box = boxAt(index);
          const labelY = box.y + box.height / 2;

          return (
            <g key={stage.id}>
              <rect
                {...box}
                rx={3}
                fill={visual.fill}
                stroke={visual.stroke}
                strokeOpacity={visual.strokeOpacity}
                /* The gate is dashed — the one stage that does not run itself. */
                strokeDasharray={stage.kind === "gate" ? "4 3" : undefined}
                strokeWidth={isSelected || status === "failed" ? 1.5 : 1}
                className="pipe-box"
              />
              <text
                x={isHorizontal ? box.x + H.nodeW / 2 : V.nodeX + 14}
                y={labelY}
                textAnchor={isHorizontal ? "middle" : "start"}
                dominantBaseline="middle"
                fill={visual.text}
                fontSize={isHorizontal ? 11 : 13}
                className="pipe-label"
              >
                {isHorizontal ? stage.short : stage.name}
              </text>
              {visual.glyph !== null && (
                <Glyph
                  status={visual.glyph}
                  x={isHorizontal ? box.x + H.nodeW / 2 : V.glyphX}
                  y={isHorizontal ? H.glyphY : labelY}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/*
        Hit targets, positioned as percentages of the same viewBox so they track
        the SVG at any width. Native buttons carry the semantics, keyboard
        activation and the site-wide :focus-visible ring for free.
      */}
      <div
        className="absolute inset-0"
        role="group"
        aria-label="Pipeline stages"
      >
        {stages.map((stage, index) => {
          const box = boxAt(index);
          const isSelected = index === selectedIndex;
          const status = statuses?.[index] ?? null;

          return (
            <button
              key={stage.id}
              type="button"
              ref={(element) => {
                buttonRefs.current[index] = element;
              }}
              onClick={() => onSelect(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              tabIndex={isSelected ? 0 : -1}
              aria-pressed={isSelected}
              className="absolute cursor-pointer rounded-[3px] border-0 bg-transparent p-0"
              style={{
                left: `${(box.x / vbW) * 100}%`,
                top: `${(box.y / vbH) * 100}%`,
                width: `${(box.width / vbW) * 100}%`,
                height: `${(box.height / vbH) * 100}%`,
              }}
            >
              <span className="sr-only">
                {stage.name}
                {stage.kind === "gate" ? ", human review gate" : ""}
                {status !== null ? `, ${status}` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PipelineDiagram({
  stages,
}: {
  stages: readonly PipelineStage[];
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pulseIndex, setPulseIndex] = useState<number | null>(null);
  const [interacted, setInteracted] = useState(false);
  const [failing, setFailing] = useState(false);

  // Idle loop: suggests a run in progress until the user takes over, then stops
  // permanently. Never starts at all under reduced motion.
  useEffect(() => {
    if (interacted) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // The interval is the only writer: its first tick maps null to stage 0, so
    // the effect body never sets state synchronously.
    const timer = window.setInterval(() => {
      setPulseIndex((current) =>
        current === null ? 0 : (current + 1) % stages.length,
      );
    }, PULSE_MS);

    return () => window.clearInterval(timer);
  }, [interacted, stages.length]);

  const select = useCallback((index: number) => {
    setInteracted(true);
    setPulseIndex(null);
    setSelectedIndex(index);
  }, []);

  const plan = resumePlan(stages.length, failing ? DEMO_FAILURE_INDEX : null);
  const statuses = failing ? plan.statuses : null;
  const selected = stages[selectedIndex];
  const failedStage = stages[DEMO_FAILURE_INDEX];

  return (
    <div>
      <div className="border-hairline border p-4 sm:p-6">
        <div className="hidden sm:block">
          <Diagram
            orientation="horizontal"
            stages={stages}
            statuses={statuses}
            selectedIndex={selectedIndex}
            pulseIndex={pulseIndex}
            onSelect={select}
          />
        </div>
        <div className="sm:hidden">
          <Diagram
            orientation="vertical"
            stages={stages}
            statuses={statuses}
            selectedIndex={selectedIndex}
            pulseIndex={pulseIndex}
            onSelect={select}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <button
          type="button"
          onClick={() => {
            setInteracted(true);
            setPulseIndex(null);
            setFailing((current) => !current);
          }}
          aria-pressed={failing}
          className="border-hairline hover:border-hairline-bright text-muted hover:text-fg cursor-pointer border px-3 py-2 font-mono text-xs transition-colors duration-150 ease-out aria-pressed:border-[var(--color-danger)] aria-pressed:text-[var(--color-danger)]"
        >
          Simulate failure
        </button>
        {failing && failedStage && (
          <p className="text-muted max-w-[68ch] text-sm">
            <span className="text-fg">{failedStage.name}</span> failed. The five
            stages before it already wrote their artifacts, so a resumed run
            skips them and re-runs only this one — the stages after it never
            ran.
          </p>
        )}
      </div>

      {selected && (
        <div
          aria-live="polite"
          className="border-hairline mt-5 border-t pt-6 sm:pt-8"
        >
          <h3 className="text-xl font-medium tracking-tight">
            {selected.name}
            {selected.kind === "gate" && (
              <span className="text-muted ml-3 font-mono text-xs tracking-wider">
                human gate
              </span>
            )}
          </h3>
          <p className="mt-3 max-w-[68ch] leading-relaxed">{selected.does}</p>

          <dl className="mt-6 flex flex-col gap-5">
            <div>
              <dt className="text-muted font-mono text-[0.6875rem] tracking-[0.22em] uppercase">
                Writes
              </dt>
              <dd className="mt-2 max-w-[68ch] font-mono text-sm break-words">
                {selected.artifact}
              </dd>
            </div>
            <div>
              <dt className="text-muted font-mono text-[0.6875rem] tracking-[0.22em] uppercase">
                Failure mode
              </dt>
              <dd className="text-muted mt-2 max-w-[68ch] text-sm leading-relaxed">
                {selected.failure}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
