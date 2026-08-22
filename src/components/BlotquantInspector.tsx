"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { labels } from "@/content";

/**
 * A viewer over a committed blotquant result document. Nothing is computed
 * live: `/demo/blotquant/result.json` is real pipeline output and
 * `/demo/blotquant/image.png` is the 8-bit display derivative blotquant's own
 * `api/display.py` renders from the measured 16-bit source.
 *
 * If either artifact is missing the component falls back to placeholder data in
 * the same schema shape and says so in a banner. The two states are exclusive
 * by construction — `load()` returns one `Source` and every value on screen is
 * read from it — so the banner cannot appear over real numbers, and real
 * numbers cannot appear with a placeholder left in beside them.
 *
 * The field names on screen (`roi_source`, `integrated_intensity`, `qc_flags`)
 * are the result schema's own vocabulary rather than site copy, so they stay
 * here: renaming them in the content layer would misreport the document. The
 * chrome around them comes from `labels`.
 */

const RESULT_URL = "/demo/blotquant/result.json";
const IMAGE_URL = "/demo/blotquant/image.png";

const TOKEN = {
  accent: "var(--color-accent)",
  ok: "var(--color-ok)",
  gate: "var(--color-gate)",
  fg: "var(--color-fg)",
  muted: "var(--color-muted)",
  hairline: "var(--color-hairline)",
  hairlineBright: "var(--color-hairline-bright)",
  surface: "var(--color-surface)",
  bg: "var(--color-bg)",
} as const;

type Roi = { x: number; y: number; width: number; height: number };

type Band = {
  band_id: string;
  lane_id: string;
  roi: Roi;
  integrated_intensity: number;
  background_estimate: number;
  peak_value: number;
  clipped_pixel_count: number;
  qc_flags: readonly string[];
  excluded_from_normalization: boolean;
  exclusion_reason?: string;
};

type Lane = {
  lane_id: string;
  lane_index: number;
  roi: Roi;
  roi_source: string;
  total_protein_signal: number;
};

type Ratio = {
  lane_id: string;
  numerator_band_id: string;
  ratio: number;
  excluded: boolean;
  exclusion_reason?: string;
  qc_flags: readonly string[];
  reference_qc_flagged: boolean;
};

type Result = {
  schema_version: string;
  result_id: string;
  source: {
    path: string;
    sha256: string;
    image_format: string;
    bit_depth: number;
    max_value: number;
    width_px: number;
    height_px: number;
    lossy_format: boolean;
  };
  provenance: {
    software_version: string;
    config_id: string;
    config_digest: string;
    created_at: string;
  };
  lanes: readonly Lane[];
  bands: readonly Band[];
  normalization: {
    mode: string;
    exclude_qc_flagged: boolean;
    warnings: readonly string[];
    ratios: readonly Ratio[];
  };
  image_qc_flags: readonly string[];
};

/** Which of the two states the panel is in. Never both. */
type Source =
  | { kind: "real"; result: Result; imageUrl: string }
  | { kind: "placeholder"; result: Result; imageUrl: string };

/* ── placeholder ──────────────────────────────────────────────────────────
   Same schema, invented numbers. Used only when the committed artifacts
   cannot be fetched, and always behind the banner. */

const PLACEHOLDER_GEOMETRY = { width: 256, height: 192 } as const;

const PLACEHOLDER_LANE_X = [14, 71, 128, 185] as const;
const PLACEHOLDER_BAND_Y = [58, 131] as const;

function placeholderResult(): Result {
  const lanes: Lane[] = PLACEHOLDER_LANE_X.map((x, index) => ({
    lane_id: `L${index}`,
    lane_index: index,
    roi: { x, y: 0, width: 55, height: PLACEHOLDER_GEOMETRY.height },
    roi_source: "detected",
    total_protein_signal: 20_000_000,
  }));

  const bands: Band[] = [];
  for (const [index, x] of PLACEHOLDER_LANE_X.entries()) {
    for (const [bandIndex, y] of PLACEHOLDER_BAND_Y.entries()) {
      const saturated = index === 0 && bandIndex === 0;
      bands.push({
        band_id: `L${index}_B${bandIndex}`,
        lane_id: `L${index}`,
        roi: { x: x + 7, y, width: 43, height: 16 },
        integrated_intensity: 0,
        background_estimate: 0,
        peak_value: 0,
        clipped_pixel_count: saturated ? 1 : 0,
        qc_flags: saturated ? ["saturated"] : [],
        excluded_from_normalization: saturated,
        exclusion_reason: saturated ? "carries QC flags: saturated" : undefined,
      });
    }
  }

  return {
    schema_version: "—",
    result_id: "—",
    source: {
      path: "—",
      sha256: "—",
      image_format: "png",
      bit_depth: 16,
      max_value: 65535,
      width_px: PLACEHOLDER_GEOMETRY.width,
      height_px: PLACEHOLDER_GEOMETRY.height,
      lossy_format: false,
    },
    provenance: {
      software_version: "—",
      config_id: "—",
      config_digest: "—",
      created_at: "—",
    },
    lanes,
    bands,
    normalization: {
      mode: "total_protein",
      exclude_qc_flagged: true,
      warnings: [],
      ratios: bands.map((band) => ({
        lane_id: band.lane_id,
        numerator_band_id: band.band_id,
        ratio: 0,
        excluded: band.excluded_from_normalization,
        qc_flags: band.qc_flags,
        reference_qc_flagged: false,
      })),
    },
    image_qc_flags: [],
  };
}

/** A blot drawn in-browser, so the placeholder has something to point at. */
function placeholderImage(): string {
  const { width, height } = PLACEHOLDER_GEOMETRY;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  // A 1x1 transparent PNG rather than "", which browsers resolve against the
  // current URL and re-download the page for.
  if (!context) {
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  }

  const image = context.createImageData(width, height);
  const gauss = (v: number, c: number, s: number) =>
    Math.exp(-((v - c) * (v - c)) / (2 * s * s));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 14;
      for (const [index, laneX] of PLACEHOLDER_LANE_X.entries()) {
        const cx = laneX + 27;
        const across = gauss(x, cx, 14);
        value += (index === 0 ? 230 : 150) * across * gauss(y, 66, 5);
        value += 120 * across * gauss(y, 139, 4.5);
      }
      const v = Math.min(255, Math.max(0, value));
      const i = (y * width + x) * 4;
      image.data[i] = v;
      image.data[i + 1] = v;
      image.data[i + 2] = v;
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

/* ── loading ──────────────────────────────────────────────────────────────── */

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${url}`));
    image.src = url;
  });
}

/**
 * Real artifacts, or placeholder. Both files must load: a real image beside a
 * placeholder document would put invented numbers on measured pixels.
 */
async function load(): Promise<Source> {
  try {
    const response = await fetch(RESULT_URL);
    if (!response.ok) throw new Error(`${RESULT_URL}: ${response.status}`);
    const result = (await response.json()) as Result;
    if (!result.lanes?.length || !result.bands?.length) {
      throw new Error(`${RESULT_URL}: no lanes or bands`);
    }
    await loadImage(IMAGE_URL);
    return { kind: "real", result, imageUrl: IMAGE_URL };
  } catch {
    return {
      kind: "placeholder",
      result: placeholderResult(),
      imageUrl: placeholderImage(),
    };
  }
}

/* ── presentation ─────────────────────────────────────────────────────────── */

const isFlagged = (band: Band) => band.qc_flags.length > 0;

const compact = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(2)}M`
    : value >= 1000
      ? `${(value / 1000).toFixed(1)}k`
      : value.toFixed(0);

function Chip({ flagged, children }: { flagged: boolean; children: string }) {
  const color = flagged ? TOKEN.gate : TOKEN.ok;
  return (
    <span
      className="rounded-sm border px-2 py-0.5 font-mono text-[0.6875rem] tracking-wider"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted font-mono text-xs">{label}</dt>
      <dd className="font-mono text-xs break-all">{value}</dd>
    </div>
  );
}

export function BlotquantInspector() {
  const [source, setSource] = useState<Source | null>(null);
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const [showProvenance, setShowProvenance] = useState(false);
  /** Grayscale rows of the display image, for the densitometry trace. */
  const [pixels, setPixels] = useState<Uint8ClampedArray | null>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    let live = true;
    load().then((next) => {
      if (live) setSource(next);
    });
    return () => {
      live = false;
    };
  }, []);

  // Read the display image back out as grayscale. The trace below is therefore
  // computed from the 8-bit derivative, not from the measured 16-bit pixels the
  // numbers come from — said plainly in the caption rather than glossed.
  useEffect(() => {
    if (!source) return;
    let live = true;

    loadImage(source.imageUrl)
      .then((image) => {
        if (!live) return;
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0);
        setPixels(context.getImageData(0, 0, canvas.width, canvas.height).data);
      })
      .catch(() => {
        /* The trace is an extra; the document still renders without it. */
      });

    return () => {
      live = false;
    };
  }, [source]);

  const select = useCallback((index: number) => setSelected(index), []);

  const result = source?.result;
  const lane = result?.lanes[selected];

  const bands = useMemo(
    () =>
      result && lane
        ? result.bands.filter((b) => b.lane_id === lane.lane_id)
        : [],
    [result, lane],
  );

  const profile = useMemo(() => {
    if (!result || !lane || !pixels) return [];
    const { width_px, height_px } = result.source;
    const from = Math.max(0, lane.roi.x);
    const to = Math.min(width_px, lane.roi.x + lane.roi.width);
    const top = Math.max(0, lane.roi.y);
    const bottom = Math.min(height_px, lane.roi.y + lane.roi.height);

    const points: { y: number; intensity: number }[] = [];
    for (let y = top; y < bottom; y++) {
      let total = 0;
      for (let x = from; x < to; x++)
        total += pixels[(y * width_px + x) * 4] ?? 0;
      points.push({ y, intensity: Math.round(total / Math.max(1, to - from)) });
    }
    return points;
  }, [result, lane, pixels]);

  const maxRatio = useMemo(
    () =>
      result
        ? Math.max(
            ...result.normalization.ratios.map((r) => r.ratio),
            Number.EPSILON,
          )
        : 1,
    [result],
  );

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    if (!result) return;
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = Math.min(result.lanes.length - 1, Math.max(0, index + delta));
    select(next);
    buttonRefs.current[next]?.focus();
  }

  // Nothing is rendered until the source is decided, which also keeps recharts
  // off the server: it measures a container that has no width there.
  if (!source || !result || !lane) {
    return (
      <div
        className="border-hairline text-muted flex min-h-64 items-center justify-center border font-mono text-xs"
        aria-busy="true"
      >
        …
      </div>
    );
  }

  const { width_px, height_px } = result.source;
  const isPlaceholder = source.kind === "placeholder";

  return (
    <div>
      {isPlaceholder && (
        <p
          className="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-l-2 py-2 pl-4 text-sm"
          style={{
            borderColor: TOKEN.gate,
            backgroundColor:
              "color-mix(in srgb, var(--color-gate) 7%, transparent)",
          }}
        >
          <span
            className="font-mono text-[0.6875rem] tracking-[0.22em] uppercase"
            style={{ color: TOKEN.gate }}
          >
            {labels.placeholderBanner}
          </span>
          <span className="text-muted">
            The committed result document could not be loaded, so every value
            below is invented and shaped like the schema. Nothing here is a
            measurement.
          </span>
        </p>
      )}

      <div className="border-hairline border">
        <header className="border-hairline flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b px-4 py-3 sm:px-6">
          <span className="text-muted font-mono text-[0.6875rem] tracking-wider">
            {result.source.path}
          </span>
          <span className="text-muted font-mono text-[0.6875rem]">
            roi_source: {lane.roi_source} · {result.lanes.length} lanes ·{" "}
            {result.bands.length} bands
          </span>
        </header>

        <div className="flex flex-col gap-5 p-4 sm:p-6 lg:flex-row">
          {/* Image and ROI overlay. */}
          <div className="min-w-0 flex-1">
            <div className="relative">
              {/* The document's own render; next/image would re-encode it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={source.imageUrl}
                alt="Blot image with detected lane and band regions"
                width={width_px}
                height={height_px}
                className="border-hairline block w-full rounded-sm border"
              />
              <svg
                viewBox={`0 0 ${width_px} ${height_px}`}
                className="absolute inset-0 h-full w-full"
                aria-hidden
              >
                {result.lanes.map((entry, index) => {
                  const active = index === selected || index === hovered;
                  const laneBands = result.bands.filter(
                    (b) => b.lane_id === entry.lane_id,
                  );
                  const flagged = laneBands.some(isFlagged);
                  const color = flagged ? TOKEN.gate : TOKEN.ok;

                  return (
                    <g key={entry.lane_id}>
                      <rect
                        {...entry.roi}
                        rx={1}
                        fill={color}
                        fillOpacity={active ? 0.07 : 0}
                        stroke={color}
                        strokeOpacity={active ? 0.8 : 0.3}
                        strokeWidth={index === selected ? 1.5 : 0.75}
                        strokeDasharray="3 2"
                      />
                      {laneBands.map((band) => (
                        <rect
                          key={band.band_id}
                          {...band.roi}
                          rx={1}
                          fill="none"
                          stroke={isFlagged(band) ? TOKEN.gate : TOKEN.ok}
                          strokeOpacity={active ? 1 : 0.55}
                          strokeWidth={index === selected ? 1.5 : 1}
                        />
                      ))}
                    </g>
                  );
                })}
              </svg>

              {/* Hit targets over the same viewBox, as percentages. */}
              <div
                className="absolute inset-0"
                role="group"
                aria-label="Lanes"
                onMouseLeave={() => setHovered(null)}
              >
                {result.lanes.map((entry, index) => (
                  <button
                    key={entry.lane_id}
                    type="button"
                    ref={(element) => {
                      buttonRefs.current[index] = element;
                    }}
                    onClick={() => select(index)}
                    onKeyDown={(event) => onKeyDown(event, index)}
                    onMouseEnter={() => setHovered(index)}
                    tabIndex={index === selected ? 0 : -1}
                    aria-pressed={index === selected}
                    className="absolute cursor-pointer border-0 bg-transparent p-0"
                    style={{
                      left: `${(entry.roi.x / width_px) * 100}%`,
                      top: `${(entry.roi.y / height_px) * 100}%`,
                      width: `${(entry.roi.width / width_px) * 100}%`,
                      height: `${(entry.roi.height / height_px) * 100}%`,
                    }}
                  >
                    <span className="sr-only">
                      {entry.lane_id}
                      {result.bands.some(
                        (b) => b.lane_id === entry.lane_id && isFlagged(b),
                      )
                        ? ", flagged"
                        : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-muted mt-3 font-mono text-[0.6875rem] leading-relaxed">
              Dashed = lane ROI, solid = band ROI. A lane&rsquo;s vertical
              extent is not detected — it is fixed at full image height, which
              is a recorded convention rather than a measurement.
            </p>

            {result.image_qc_flags.length > 0 && (
              <p className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-muted font-mono text-[0.6875rem] tracking-[0.22em] uppercase">
                  image_qc_flags
                </span>
                {result.image_qc_flags.map((flag) => (
                  <Chip key={flag} flagged>
                    {flag}
                  </Chip>
                ))}
              </p>
            )}
          </div>

          {/* Selected lane. */}
          <div className="border-hairline bg-surface min-w-0 flex-1 border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm">{lane.lane_id}</span>
              <Chip flagged={bands.some(isFlagged)}>
                {bands.some(isFlagged) ? "flagged" : "pass"}
              </Chip>
            </div>

            <table className="mt-4 w-full font-mono text-xs">
              <thead>
                <tr className="text-muted text-left">
                  <th className="pb-2 font-normal">band</th>
                  <th className="pb-2 text-right font-normal">signal</th>
                  <th className="pb-2 text-right font-normal">bg</th>
                  <th className="pb-2 text-right font-normal">clipped</th>
                </tr>
              </thead>
              <tbody>
                {bands.map((band) => (
                  <tr key={band.band_id} className="border-hairline border-t">
                    <td className="py-2">{band.band_id}</td>
                    <td className="py-2 text-right">
                      {compact(band.integrated_intensity)}
                    </td>
                    <td className="text-muted py-2 text-right">
                      {compact(band.background_estimate)}
                    </td>
                    <td
                      className="py-2 text-right"
                      style={{
                        color:
                          band.clipped_pixel_count > 0
                            ? TOKEN.gate
                            : TOKEN.muted,
                      }}
                    >
                      {band.clipped_pixel_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {bands.filter(isFlagged).map((band) => (
              <p
                key={band.band_id}
                className="mt-3 border-l-2 py-1.5 pl-3 font-mono text-[0.6875rem] leading-relaxed"
                style={{ borderColor: TOKEN.gate, color: TOKEN.gate }}
              >
                {band.band_id}: {band.qc_flags.join(", ")}
                {band.excluded_from_normalization && band.exclusion_reason
                  ? ` — ${band.exclusion_reason}. Reported, not dropped.`
                  : ""}
              </p>
            ))}

            <div className="mt-5">
              <p className="text-muted mb-2 font-mono text-[0.6875rem] tracking-[0.22em] uppercase">
                {result.normalization.mode} ratios
              </p>
              {result.normalization.ratios.map((ratio) => {
                const laneIndex = result.lanes.findIndex(
                  (l) => l.lane_id === ratio.lane_id,
                );
                const color = ratio.excluded ? TOKEN.gate : TOKEN.ok;
                return (
                  <button
                    key={ratio.numerator_band_id}
                    type="button"
                    onClick={() => select(laneIndex)}
                    className="mb-1.5 flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left"
                  >
                    <span
                      className="font-mono text-[0.6875rem]"
                      style={{
                        color: laneIndex === selected ? TOKEN.fg : TOKEN.muted,
                        width: "3.5rem",
                      }}
                    >
                      {ratio.numerator_band_id}
                    </span>
                    <span
                      className="h-1.5 flex-1 overflow-hidden rounded-sm"
                      style={{ backgroundColor: TOKEN.bg }}
                    >
                      <span
                        className="block h-full"
                        style={{
                          width: `${(ratio.ratio / maxRatio) * 100}%`,
                          backgroundColor: color,
                          opacity: laneIndex === selected ? 1 : 0.45,
                        }}
                      />
                    </span>
                    <span
                      className="text-right font-mono text-[0.6875rem]"
                      style={{ color: TOKEN.muted, width: "2.75rem" }}
                    >
                      {ratio.ratio.toFixed(3)}
                    </span>
                  </button>
                );
              })}
              <p className="text-muted mt-2 font-mono text-[0.6875rem] leading-relaxed">
                Amber = excluded from the normalization, with its reason
                recorded. The ratio is still reported.
              </p>
            </div>

            {result.normalization.warnings.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1">
                {result.normalization.warnings.map((warning) => (
                  <li
                    key={warning}
                    className="font-mono text-[0.6875rem] break-all"
                    style={{ color: TOKEN.gate }}
                  >
                    warning: {warning}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Densitometry trace down the selected lane. */}
        {profile.length > 0 && (
          <div className="border-hairline border-t px-4 py-4 sm:px-6">
            <p className="text-muted mb-2 font-mono text-[0.6875rem] tracking-[0.22em] uppercase">
              densitometry — {lane.lane_id}
            </p>
            <div className="h-36 w-full">
              <ResponsiveContainer>
                <AreaChart
                  data={profile}
                  margin={{ top: 4, right: 4, bottom: 0, left: -24 }}
                >
                  <XAxis
                    dataKey="y"
                    tick={{ fill: "#a1a1aa", fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: "#26262b" }}
                  />
                  <YAxis
                    domain={[0, 255]}
                    tick={{ fill: "#a1a1aa", fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: "#26262b" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0d0d0f",
                      border: "1px solid #26262b",
                      borderRadius: 3,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#a1a1aa" }}
                    itemStyle={{ color: "#e8e8ea" }}
                    formatter={(value) => [String(value), "mean level"]}
                    labelFormatter={(label) => `row ${String(label)}px`}
                  />
                  {bands.map((band) => (
                    <ReferenceArea
                      key={band.band_id}
                      x1={band.roi.y}
                      x2={band.roi.y + band.roi.height}
                      fill={isFlagged(band) ? "#fbbf24" : "#4ade80"}
                      fillOpacity={0.12}
                      stroke="none"
                    />
                  ))}
                  <Area
                    type="monotone"
                    dataKey="intensity"
                    stroke="#38bdf8"
                    strokeWidth={1.5}
                    fill="#38bdf8"
                    fillOpacity={0.1}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-muted mt-1 font-mono text-[0.6875rem] leading-relaxed">
              Mean level per row across the lane ROI, read from the 8-bit
              display derivative. The measured values in the table are computed
              from the unrescaled {result.source.bit_depth}-bit source.
            </p>
          </div>
        )}

        {/* Provenance. */}
        <div className="border-hairline border-t px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => setShowProvenance((open) => !open)}
            aria-expanded={showProvenance}
            className="text-accent cursor-pointer border-0 bg-transparent p-0 font-mono text-xs"
          >
            {showProvenance ? "hide provenance" : "show provenance"}
          </button>

          {showProvenance && (
            <dl className="panel-swap mt-4 flex flex-col gap-2">
              <Row label="result_id" value={result.result_id} />
              <Row label="schema_version" value={result.schema_version} />
              <Row label="image sha256" value={result.source.sha256} />
              <Row
                label="config"
                value={`${result.provenance.config_id} · ${result.provenance.config_digest}`}
              />
              <Row
                label="software_version"
                value={result.provenance.software_version}
              />
              <Row label="created_at" value={result.provenance.created_at} />
              <Row
                label="source"
                value={`${result.source.image_format} · ${result.source.bit_depth}-bit · ${width_px}×${height_px} · lossy: ${result.source.lossy_format}`}
              />
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
