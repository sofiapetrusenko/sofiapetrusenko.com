"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PipelineStage } from "@/content";
import { labels } from "@/content";
import { DEMO_FAILURE_INDEX } from "@/content/pipeline";
import { resumePlan, type StageStatus } from "./pipeline-status";

const PULSE_MS = 600;

/**
 * Horizontal geometry. `nodeH` is 48 rather than 44 because the SVG scales
 * down slightly inside the bordered card — 44 units lands under the 44px touch
 * target minimum. `vbH` leaves room for the gate caption below the row; it does
 * not affect touch target size, which depends only on nodeH/vbW.
 */
const H = {
  nodeW: 70,
  nodeH: 50,
  /* 12 units of gap, not 8: the snapped-connector break needs room to read. */
  pitch: 82,
  top: 36,
  glyphY: 16,
  vbH: 128,
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

const TOKEN = {
  accent: "var(--color-accent)",
  ok: "var(--color-ok)",
  danger: "var(--color-danger)",
  gate: "var(--color-gate)",
  fg: "var(--color-fg)",
  muted: "var(--color-muted)",
  hairline: "var(--color-hairline)",
  hairlineBright: "var(--color-hairline-bright)",
  surface: "var(--color-surface)",
} as const;

/**
 * How a node is painted. Every colour here encodes state or type — selection,
 * run status, or the gate's difference in kind. Nothing is decorative.
 */
type Visual = {
  stroke: string;
  strokeOpacity: number;
  strokeWidth: number;
  dashed: boolean;
  fill: string;
  fillOpacity: number;
  text: string;
  /** struck-through label, for stages a failed run never reached */
  struck: boolean;
};

function visualFor(
  stage: PipelineStage,
  status: StageStatus | null,
  isSelected: boolean,
  isPulsing: boolean,
  isHovered: boolean,
): Visual {
  const isGate = stage.kind === "gate";

  // Failure simulation owns the palette: the run's story outranks selection.
  if (status === "failed")
    return {
      stroke: TOKEN.danger,
      strokeOpacity: 1,
      strokeWidth: 2,
      dashed: false,
      fill: TOKEN.danger,
      fillOpacity: 0.15,
      text: TOKEN.danger,
      struck: false,
    };

  if (status === "complete")
    return {
      stroke: TOKEN.ok,
      strokeOpacity: 0.85,
      strokeWidth: isSelected ? 1.5 : 1,
      dashed: false,
      fill: TOKEN.ok,
      fillOpacity: isSelected ? 0.16 : 0.1,
      text: TOKEN.fg,
      struck: false,
    };

  if (status === "pending")
    return {
      stroke: TOKEN.hairline,
      strokeOpacity: 0.6,
      strokeWidth: 1,
      dashed: false,
      fill: TOKEN.surface,
      fillOpacity: isSelected ? 1 : 0,
      text: TOKEN.muted,
      struck: true,
    };

  // The gate keeps its own hue even when selected — it is a different kind of
  // thing, and the panel rule picks up the same colour.
  if (isGate)
    return {
      stroke: TOKEN.gate,
      strokeOpacity: isSelected ? 1 : 0.75,
      strokeWidth: isSelected ? 2 : 1,
      dashed: true,
      fill: TOKEN.gate,
      fillOpacity: isSelected ? 0.1 : isHovered ? 0.07 : 0.05,
      text: TOKEN.gate,
      struck: false,
    };

  if (isSelected)
    return {
      stroke: TOKEN.accent,
      strokeOpacity: 1,
      strokeWidth: 2,
      dashed: false,
      fill: TOKEN.accent,
      fillOpacity: 0.12,
      text: TOKEN.accent,
      struck: false,
    };

  if (isPulsing)
    return {
      stroke: TOKEN.accent,
      strokeOpacity: 0.7,
      strokeWidth: 1.5,
      dashed: false,
      fill: TOKEN.accent,
      fillOpacity: 0.08,
      text: TOKEN.fg,
      struck: false,
    };

  // Hover matches the home page's card language: hairline brightens, surface
  // lifts one step.
  if (isHovered)
    return {
      stroke: TOKEN.hairlineBright,
      strokeOpacity: 1,
      strokeWidth: 1,
      dashed: false,
      fill: TOKEN.surface,
      fillOpacity: 1,
      text: TOKEN.fg,
      struck: false,
    };

  return {
    stroke: TOKEN.hairline,
    strokeOpacity: 1,
    strokeWidth: 1,
    dashed: false,
    fill: TOKEN.surface,
    fillOpacity: 0,
    text: TOKEN.fg,
    struck: false,
  };
}

/** Status marks, so run state is never carried by colour alone. */
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
      ? TOKEN.danger
      : status === "complete"
        ? TOKEN.ok
        : TOKEN.muted;

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

/** The rule colour tying the detail panel to the node it describes. */
function accentForStage(
  stage: PipelineStage | undefined,
  status: StageStatus | null,
): string {
  if (status === "failed") return TOKEN.danger;
  if (stage?.kind === "gate") return TOKEN.gate;
  return TOKEN.accent;
}

function Diagram({
  orientation,
  stages,
  statuses,
  selectedIndex,
  pulseIndex,
  visited,
  onSelect,
}: {
  orientation: Orientation;
  stages: readonly PipelineStage[];
  statuses: StageStatus[] | null;
  selectedIndex: number;
  pulseIndex: number | null;
  visited: ReadonlySet<number>;
  onSelect: (index: number) => void;
}) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
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

  /** Edge geometry, plus the break that marks where the run stopped. */
  function edge(index: number) {
    const from = boxAt(index);
    const to = boxAt(index + 1);
    return isHorizontal
      ? {
          a: from.x + from.width,
          b: to.x,
          cross: from.y + from.height / 2,
          horizontal: true,
        }
      : {
          a: from.y + from.height,
          b: to.y,
          cross: V.nodeX + V.nodeW / 2,
          horizontal: false,
        };
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
        {stages.slice(0, -1).map((stage, index) => {
          const { a, b, cross, horizontal } = edge(index);
          const isBreak = statuses?.[index] === "failed";
          const downstream = statuses?.[index + 1] === "pending";

          const stroke = isBreak
            ? TOKEN.danger
            : statuses?.[index] === "complete"
              ? TOKEN.ok
              : TOKEN.hairline;
          const opacity = isBreak ? 1 : downstream ? 0.35 : statuses ? 0.5 : 1;

          const line = (x1: number, x2: number, key: string) => (
            <line
              key={key}
              x1={horizontal ? x1 : cross}
              y1={horizontal ? cross : x1}
              x2={horizontal ? x2 : cross}
              y2={horizontal ? cross : x2}
              stroke={stroke}
              strokeWidth={isBreak ? 1.5 : 1}
              strokeOpacity={opacity}
            />
          );

          // A snapped connector where the run stopped: two stubs, a gap, and a
          // pair of slashes across the break. The slashes run perpendicular to
          // the flow because that axis has room even when the gap is narrow.
          if (isBreak) {
            const gap = (b - a) * 0.28;
            const mid = (a + b) / 2;
            const slash = (offset: number, key: string) => (
              <line
                key={key}
                x1={horizontal ? mid + offset - 1.5 : cross - 6}
                y1={horizontal ? cross + 6 : mid + offset - 1.5}
                x2={horizontal ? mid + offset + 1.5 : cross + 6}
                y2={horizontal ? cross - 6 : mid + offset + 1.5}
                stroke={TOKEN.danger}
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            );
            return (
              <g key={`edge-${stage.id}`}>
                {line(a, mid - gap, `${stage.id}-a`)}
                {line(mid + gap, b, `${stage.id}-b`)}
                {slash(-2, `${stage.id}-s1`)}
                {slash(2, `${stage.id}-s2`)}
              </g>
            );
          }

          return line(a, b, `edge-${stage.id}`);
        })}

        {stages.map((stage, index) => {
          const status = statuses?.[index] ?? null;
          const isSelected = index === selectedIndex;
          const visual = visualFor(
            stage,
            status,
            isSelected,
            index === pulseIndex,
            index === hoveredIndex,
          );
          const box = boxAt(index);
          const labelY = box.y + box.height / 2;
          const isGate = stage.kind === "gate";

          return (
            <g key={stage.id}>
              <rect
                {...box}
                rx={3}
                fill={visual.fill}
                fillOpacity={visual.fillOpacity}
                stroke={visual.stroke}
                strokeOpacity={visual.strokeOpacity}
                strokeDasharray={visual.dashed ? "5 3" : undefined}
                strokeWidth={visual.strokeWidth}
                className="pipe-box"
              />
              {/* Second, inset rule: the gate reads as a checkpoint, not a box. */}
              {isGate && (
                <rect
                  x={box.x + 3}
                  y={box.y + 3}
                  width={box.width - 6}
                  height={box.height - 6}
                  rx={2}
                  fill="none"
                  stroke={TOKEN.gate}
                  strokeOpacity={0.35}
                  strokeWidth={1}
                />
              )}
              <text
                x={isHorizontal ? box.x + H.nodeW / 2 : V.nodeX + 14}
                y={labelY}
                textAnchor={isHorizontal ? "middle" : "start"}
                dominantBaseline="middle"
                fill={visual.text}
                fontSize={isHorizontal ? 11 : 13}
                textDecoration={visual.struck ? "line-through" : undefined}
                className="pipe-label"
              >
                {isHorizontal ? stage.short : stage.name}
              </text>

              {/* Gate caption: says in words what the hue and dashes imply. */}
              {isGate &&
                (isHorizontal ? (
                  <text
                    x={box.x + H.nodeW / 2}
                    y={box.y + box.height + 13}
                    textAnchor="middle"
                    fill={TOKEN.gate}
                    fontSize={10}
                  >
                    <tspan x={box.x + H.nodeW / 2}>human</tspan>
                    <tspan x={box.x + H.nodeW / 2} dy={11}>
                      approval
                    </tspan>
                  </text>
                ) : (
                  <text
                    x={V.nodeX + V.nodeW - 12}
                    y={labelY}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fill={TOKEN.gate}
                    fontSize={10}
                  >
                    {labels.humanApproval}
                  </text>
                ))}

              {status !== null && (
                <Glyph
                  status={status}
                  x={isHorizontal ? box.x + H.nodeW / 2 : V.glyphX}
                  y={isHorizontal ? H.glyphY : labelY}
                />
              )}

              {/* Exploration progress: filled dot once a stage has been opened. */}
              {visited.has(index) && (
                <circle
                  cx={box.x + box.width - 7}
                  cy={box.y + 7}
                  r={2.5}
                  fill={TOKEN.muted}
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
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {stages.map((stage, index) => {
          const box = boxAt(index);
          const isSelected = index === selectedIndex;
          const status = statuses?.[index] ?? null;
          const statusWord =
            status === "complete"
              ? labels.statusComplete
              : status === "failed"
                ? labels.statusFailed
                : status === "pending"
                  ? labels.statusNotRun
                  : null;

          return (
            <button
              key={stage.id}
              type="button"
              ref={(element) => {
                buttonRefs.current[index] = element;
              }}
              onClick={() => onSelect(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              onMouseEnter={() => setHoveredIndex(index)}
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
                {stage.kind === "gate" ? `, ${labels.humanApproval}` : ""}
                {statusWord !== null ? `, ${statusWord}` : ""}
                {visited.has(index) ? `, ${labels.visited}` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Labelled switch. State rides on the thumb position as well as the colour. */
function FailureSwitch({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className="flex cursor-pointer items-center gap-2.5 border-0 bg-transparent p-0 font-mono text-xs"
    >
      <span
        className="relative block h-4 w-7 rounded-full border transition-colors duration-150 ease-out"
        style={{
          borderColor: checked ? TOKEN.danger : TOKEN.hairlineBright,
          backgroundColor: checked
            ? "color-mix(in srgb, var(--color-danger) 22%, transparent)"
            : "transparent",
        }}
      >
        <span
          className="absolute top-1/2 block h-2.5 w-2.5 -translate-y-1/2 rounded-full transition-all duration-150 ease-out"
          style={{
            left: checked ? "calc(100% - 0.75rem)" : "0.125rem",
            backgroundColor: checked ? TOKEN.danger : TOKEN.muted,
          }}
        />
      </span>
      <span style={{ color: checked ? TOKEN.danger : TOKEN.muted }}>
        {labels.simulateFailure}
      </span>
    </button>
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
  const [visited, setVisited] = useState<ReadonlySet<number>>(new Set());

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
    setVisited((current) => new Set(current).add(index));
  }, []);

  const plan = resumePlan(stages.length, failing ? DEMO_FAILURE_INDEX : null);
  const statuses = failing ? plan.statuses : null;
  const selected = stages[selectedIndex];
  const failedStage = stages[DEMO_FAILURE_INDEX];
  const panelColor = accentForStage(
    selected,
    statuses?.[selectedIndex] ?? null,
  );

  const diagramProps = {
    stages,
    statuses,
    selectedIndex,
    pulseIndex,
    visited,
    onSelect: select,
  };

  return (
    <div>
      <div className="border-hairline border">
        <header className="border-hairline flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-4 py-3 sm:px-6">
          <span className="text-muted font-mono text-[0.6875rem] tracking-[0.22em] uppercase">
            {labels.pipelineRun}
          </span>
          <FailureSwitch
            checked={failing}
            onToggle={() => {
              setInteracted(true);
              setPulseIndex(null);
              setFailing((current) => !current);
            }}
          />
        </header>

        <div className="p-4 sm:p-6">
          <div className="hidden sm:block">
            <Diagram orientation="horizontal" {...diagramProps} />
          </div>
          <div className="sm:hidden">
            <Diagram orientation="vertical" {...diagramProps} />
          </div>

          {failing && failedStage && (
            <p
              className="text-muted mt-5 max-w-[68ch] border-l-2 pl-4 text-sm"
              style={{ borderColor: TOKEN.danger }}
            >
              <span style={{ color: TOKEN.danger }}>{failedStage.name}</span>{" "}
              failed. The five stages before it already wrote their artifacts,
              so a resumed run skips them and re-runs only this one — the struck
              stages after it never ran at all.
            </p>
          )}
        </div>
      </div>

      {selected && (
        <div
          aria-live="polite"
          className="mt-6 border-l-2 pl-5 sm:pl-6"
          style={{ borderColor: panelColor }}
        >
          <div key={selectedIndex} className="panel-swap">
            <h3 className="text-xl font-medium tracking-tight">
              {selected.name}
              {selected.kind === "gate" && (
                <span
                  className="ml-3 font-mono text-xs tracking-wider"
                  style={{ color: TOKEN.gate }}
                >
                  {labels.humanApproval}
                </span>
              )}
            </h3>
            <p className="prose-hover mt-3 max-w-[68ch] leading-relaxed">
              {selected.does}
            </p>

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
        </div>
      )}
    </div>
  );
}
