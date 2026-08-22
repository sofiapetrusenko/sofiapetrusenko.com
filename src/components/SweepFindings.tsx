/**
 * Two readings of the sweep record that are findings rather than data, so the
 * sentences are written here — but every number in them is computed from
 * `blotquant-metrics.json`, not typed.
 *
 * Both say the same kind of thing: the shipped configuration is a decision with
 * a stated cost, not a point where everything happened to be best at once.
 */

import { blotquantMetrics, type Sweep } from "@/content";

const metrics = blotquantMetrics;

function sweepFor(key: string): Sweep {
  const sweep = metrics.sweeps.find((entry) => entry.key === key);
  if (!sweep) throw new Error(`no sweep ${key} in blotquant-metrics.json`);
  return sweep;
}

const rowAt = (sweep: Sweep, value: number | string | null) =>
  sweep.values.find((row) => String(row.value) === String(value));

const best = (sweep: Sweep, series: "lane_f1" | "band_f1") =>
  sweep.values.reduce((top, row) =>
    (row[series] ?? 0) > (top[series] ?? 0) ? row : top,
  );

/** Smallest setting in a sweep — the record's stand-in for "criterion off". */
const lowest = (sweep: Sweep) =>
  sweep.values.reduce((low, row) =>
    (row.value ?? 0) < (low.value ?? 0) ? row : low,
  );

/** Largest setting in a sweep. */
const highest = (sweep: Sweep) =>
  sweep.values.reduce((top, row) =>
    (row.value ?? 0) > (top.value ?? 0) ? row : top,
  );

const f1 = (value: number | null | undefined) => (value ?? 0).toFixed(4);
const delta = (value: number) => value.toFixed(4);

function Finding({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-hairline border-l pl-5 sm:pl-6">
      <p className="font-mono text-xs" style={{ color: "var(--color-accent)" }}>
        {title}
      </p>
      <p className="prose-hover mt-2 max-w-[68ch] leading-relaxed">
        {children}
      </p>
    </div>
  );
}

export function SweepFindings() {
  const smoothing = sweepFor("profile_smoothing_px");
  const shippedSmoothing = rowAt(smoothing, smoothing.shipped_value);
  const bandPeak = best(smoothing, "band_f1");

  const fraction = sweepFor("band.min_prominence_fraction");
  const sigma = sweepFor("band.min_prominence_sigma");

  const fractionShipped = rowAt(fraction, fraction.shipped_value);
  const sigmaShipped = rowAt(sigma, sigma.shipped_value);
  const fractionOff = lowest(fraction);
  const sigmaOff = lowest(sigma);

  const fractionCost =
    (fractionShipped?.band_f1 ?? 0) - (fractionOff.band_f1 ?? 0);
  const sigmaCost = (sigmaShipped?.band_f1 ?? 0) - (sigmaOff.band_f1 ?? 0);

  return (
    <div className="flex flex-col gap-7">
      <Finding title={smoothing.key}>
        Lane F1 climbs to {f1(shippedSmoothing?.lane_f1)} at the shipped window
        of {String(smoothing.shipped_value)} and then plateaus — every wider
        window measures the same. Band F1 does not: it peaks earlier, at{" "}
        {bandPeak.label} ({f1(bandPeak.band_f1)}), and degrades from there down
        to {f1(highest(smoothing).band_f1)} at the widest setting. The shipped
        window is therefore a stated trade-off and not an optimum for both: it
        buys the lane plateau for{" "}
        {delta((bandPeak.band_f1 ?? 0) - (shippedSmoothing?.band_f1 ?? 0))} of
        band F1.
      </Finding>

      <Finding title={`${fraction.key} vs ${sigma.key}`}>
        Two criteria gate the same decision — whether a peak is a band — and the
        record shows they are redundant but not equally weighted. Dropping the
        prominence fraction to {fractionOff.label}, the nearest legal stand-in
        for switching it off, costs {delta(fractionCost)} of band F1 (
        {f1(fractionOff.band_f1)} against {f1(fractionShipped?.band_f1)}).
        Switching the noise criterion off outright at {sigmaOff.label} costs{" "}
        {delta(sigmaCost)}. One of the two is doing nearly all of the work, and
        the record is what says which.
      </Finding>
    </div>
  );
}
