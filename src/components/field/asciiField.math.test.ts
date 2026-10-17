import { describe, expect, it } from "vitest";
import {
  ALPHA_LEVELS,
  COLUMN_CAP,
  FIELD_PERIOD,
  GLYPHS,
  GUTTER_CAP,
  EDGE_WOBBLE,
  GUTTER_REF,
  MIN_FEATHER,
  RIPPLE,
  alphaCap,
  bucketIndex,
  clamp01,
  edgeOffset,
  fieldValue,
  gutterProfile,
  rippleContribution,
} from "./asciiField.math";

describe("GLYPHS", () => {
  it("is exactly [A-Za-z0-9]", () => {
    expect(GLYPHS).toHaveLength(62);
    expect(GLYPHS).toMatch(/^[A-Za-z0-9]+$/);
    expect(new Set(GLYPHS).size).toBe(62);
  });
});

describe("fieldValue", () => {
  it("stays in [0, 1] across a long page and over time", () => {
    for (let t = 0; t < 600; t += 37.3)
      for (let x = 0; x <= 1440; x += 120)
        for (let y = 0; y <= 12000; y += 250) {
          const f = fieldValue(x, y, t, 1440);
          expect(f).toBeGreaterThanOrEqual(0);
          expect(f).toBeLessThanOrEqual(1);
        }
  });

  it("is deterministic in (x, y, t)", () => {
    expect(fieldValue(300, 2100, 12.5, 1200)).toBe(
      fieldValue(300, 2100, 12.5, 1200),
    );
  });

  it("is continuous across a period boundary", () => {
    // Neighbouring periods' blobs are summed in, so stepping one pixel over
    // the seam must not jump.
    for (const k of [1, 2, 5]) {
      const y = k * FIELD_PERIOD;
      expect(
        Math.abs(
          fieldValue(500, y - 0.5, 3, 1440) - fieldValue(500, y + 0.5, 3, 1440),
        ),
      ).toBeLessThan(0.01);
    }
  });

  it("recurs down the page: every period has a bright blob", () => {
    // Bright regions must not stop after the first screen — sample each
    // period and find a value well above the lattice-only baseline.
    for (let k = 0; k < 10; k++) {
      let best = 0;
      for (let x = 0; x <= 1440; x += 40)
        for (let y = k * FIELD_PERIOD; y < (k + 1) * FIELD_PERIOD; y += 40)
          best = Math.max(best, fieldValue(x, y, 0, 1440));
      expect(best).toBeGreaterThan(0.6);
    }
  });

  it("drifts: the same page point changes over time", () => {
    expect(fieldValue(700, 1500, 0, 1440)).not.toBeCloseTo(
      fieldValue(700, 1500, 20, 1440),
      3,
    );
  });
});

describe("rippleContribution", () => {
  it("peaks at amp on the wavefront at birth", () => {
    expect(rippleContribution(0, 0, 0, 1)).toBeCloseTo(1, 10);
    expect(rippleContribution(0, 0, 0, 1, 0.3)).toBeCloseTo(0.3, 10);
  });

  it("follows exp(-((d - v·t)/w)²) · exp(-k·t)", () => {
    const age = 0.5;
    const d = RIPPLE.speed * age + 1.3; // just behind the front
    const want =
      Math.exp(-(((d - RIPPLE.speed * age) / RIPPLE.width) ** 2)) *
      Math.exp(-RIPPLE.decay * age);
    expect(rippleContribution(d, 0, age, 1)).toBeCloseTo(want, 12);
  });

  it("is largest on the wavefront and falls off either side", () => {
    const age = 0.6;
    const r = RIPPLE.speed * age;
    const on = rippleContribution(r, 0, age, 1);
    expect(on).toBeGreaterThan(rippleContribution(r - 2, 0, age, 1));
    expect(on).toBeGreaterThan(rippleContribution(r + 2, 0, age, 1));
  });

  it("decays with age", () => {
    const at = (age: number) =>
      rippleContribution(RIPPLE.speed * age, 0, age, 1);
    expect(at(0.2)).toBeGreaterThan(at(1));
    expect(at(1)).toBeGreaterThan(at(2));
  });

  it("is zero outside its lifetime and far from the front", () => {
    expect(rippleContribution(0, 0, -0.1, 1)).toBe(0);
    expect(rippleContribution(0, 0, RIPPLE.lifetime, 1)).toBe(0);
    expect(
      rippleContribution(RIPPLE.speed * 0.5 + 4 * RIPPLE.width, 0, 0.5, 1),
    ).toBe(0);
  });

  it("corrects for cell aspect, so the ring is round on screen", () => {
    // Cells 9×16: one row down is 16/9 cell widths of real distance.
    const aspect = 16 / 9;
    const age = 0.4;
    const rows = 5;
    expect(rippleContribution(0, rows, age, aspect)).toBeCloseTo(
      rippleContribution(rows * aspect, 0, age, aspect),
      12,
    );
  });
});

describe("gutterProfile", () => {
  it("feathers across 70% of the gutter, never less than MIN_FEATHER", () => {
    expect(gutterProfile(368).feather).toBeCloseTo(0.7 * 368, 12);
    expect(gutterProfile(160).feather).toBe(MIN_FEATHER);
    expect(gutterProfile(32).feather).toBe(MIN_FEATHER);
  });

  it("scales the peak with gutter width, reaching GUTTER_CAP at GUTTER_REF", () => {
    expect(gutterProfile(GUTTER_REF).peak).toBeCloseTo(GUTTER_CAP, 12);
    expect(gutterProfile(2 * GUTTER_REF).peak).toBeCloseTo(GUTTER_CAP, 12);
    // A 1024px window's gutter is a soft margin, not a bright strip.
    expect(gutterProfile(160).peak).toBeLessThan(0.3);
    // A 768px window's 32px padding barely rises above the column.
    expect(gutterProfile(32).peak).toBeLessThan(0.1);
    expect(gutterProfile(0).peak).toBe(COLUMN_CAP);
  });
});

describe("edgeOffset", () => {
  it("only ever pushes the edge outward, by at most EDGE_WOBBLE", () => {
    for (let t = 0; t < 300; t += 13.7)
      for (let y = 0; y < 20000; y += 37)
        for (const side of [0, 1] as const) {
          const o = edgeOffset(y, t, side);
          expect(o).toBeGreaterThanOrEqual(0);
          expect(o).toBeLessThanOrEqual(EDGE_WOBBLE);
        }
  });

  it("varies along y, over time, and differs between the two sides", () => {
    expect(edgeOffset(0, 0, 0)).not.toBeCloseTo(edgeOffset(400, 0, 0), 1);
    expect(edgeOffset(0, 0, 0)).not.toBeCloseTo(edgeOffset(0, 10, 0), 1);
    expect(edgeOffset(0, 0, 0)).not.toBeCloseTo(edgeOffset(0, 0, 1), 1);
  });

  it("is low-frequency: under 1px of change per 4px of page height", () => {
    for (let y = 0; y < 5000; y += 4)
      expect(
        Math.abs(edgeOffset(y + 4, 3, 0) - edgeOffset(y, 3, 0)),
      ).toBeLessThan(1);
  });
});

describe("alphaCap", () => {
  const wide = gutterProfile(368);

  it("is exactly COLUMN_CAP inside or touching the column", () => {
    expect(alphaCap(0, wide)).toBe(COLUMN_CAP);
    expect(alphaCap(-120, wide)).toBe(COLUMN_CAP);
    expect(alphaCap(Number.NaN, wide)).toBe(COLUMN_CAP);
  });

  it("never exceeds COLUMN_CAP inside the column, whatever the wobble", () => {
    // The component passes out − offset with offset ≥ 0, and out = 0 inside.
    for (let t = 0; t < 100; t += 7)
      for (let y = 0; y < 5000; y += 50)
        expect(alphaCap(0 - edgeOffset(y, t, 0), wide)).toBe(COLUMN_CAP);
  });

  it("reaches the peak only at the far end of the feather", () => {
    expect(alphaCap(wide.feather, wide)).toBeCloseTo(wide.peak, 12);
    expect(alphaCap(wide.feather / 2, wide)).toBeCloseTo(
      (COLUMN_CAP + wide.peak) / 2,
      12,
    );
    expect(alphaCap(wide.feather * 0.25, wide)).toBeLessThan(
      COLUMN_CAP + (wide.peak - COLUMN_CAP) * 0.25,
    );
  });

  it("eases in and out — flat at both ends, no wall", () => {
    const step = (d: number) => alphaCap(d + 1, wide) - alphaCap(d, wide);
    const mid = step(wide.feather / 2);
    expect(step(1)).toBeLessThan(mid / 20);
    expect(step(wide.feather - 2)).toBeLessThan(mid / 20);
    // Steepest slope is smoothstep's 1.5× the linear one.
    expect(mid).toBeLessThan(((wide.peak - COLUMN_CAP) / wide.feather) * 1.51);
  });
});

describe("bucketIndex", () => {
  it("rounds down to the highest level that does not exceed the alpha", () => {
    expect(bucketIndex(0)).toBe(0);
    expect(bucketIndex(COLUMN_CAP * 0.29)).toBe(0);
    expect(bucketIndex(COLUMN_CAP * 0.3)).toBe(1);
    expect(bucketIndex(COLUMN_CAP * 0.6)).toBe(2);
    expect(bucketIndex(COLUMN_CAP)).toBe(4);
    expect(bucketIndex(0.079)).toBe(4);
    expect(bucketIndex(GUTTER_CAP)).toBe(ALPHA_LEVELS.length - 1);
    expect(bucketIndex(5)).toBe(ALPHA_LEVELS.length - 1);
  });

  it("never paints above the alpha it was given", () => {
    for (let a = 0; a <= 0.7; a += 0.0007)
      expect(ALPHA_LEVELS[bucketIndex(a)]!).toBeLessThanOrEqual(a);
  });

  it("clamps negative and NaN input to bucket 0", () => {
    expect(bucketIndex(-3)).toBe(0);
    expect(bucketIndex(Number.NaN)).toBe(0);
  });

  it("has ascending levels with COLUMN_CAP and GUTTER_CAP among them", () => {
    for (let i = 1; i < ALPHA_LEVELS.length; i++)
      expect(ALPHA_LEVELS[i]!).toBeGreaterThan(ALPHA_LEVELS[i - 1]!);
    expect(ALPHA_LEVELS).toContain(COLUMN_CAP);
    expect(ALPHA_LEVELS.at(-1)).toBe(GUTTER_CAP);
  });
});

describe("clamp01", () => {
  it("clamps", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(2)).toBe(1);
  });
});
