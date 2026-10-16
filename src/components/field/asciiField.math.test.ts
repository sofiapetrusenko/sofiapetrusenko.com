import { describe, expect, it } from "vitest";
import {
  GLYPHS,
  RIPPLE,
  bucketAlpha,
  bucketIndex,
  clamp01,
  fieldValue,
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
  it("stays in [0, 1] across the field and over time", () => {
    for (let t = 0; t < 600; t += 7.3)
      for (let u = 0; u <= 1; u += 0.1)
        for (let v = 0; v <= 1; v += 0.1) {
          const f = fieldValue(u, v, t, 1.6);
          expect(f).toBeGreaterThanOrEqual(0);
          expect(f).toBeLessThanOrEqual(1);
        }
  });

  it("is deterministic in (x, y, t)", () => {
    expect(fieldValue(0.3, 0.7, 12.5, 1.2)).toBe(
      fieldValue(0.3, 0.7, 12.5, 1.2),
    );
  });

  it("is brightest near the blob centre", () => {
    // At t = 0 the blob sits at (0.5, 0.42 + 0.26·sin 1.3).
    const cy = 0.42 + 0.26 * Math.sin(1.3);
    expect(fieldValue(0.5, cy, 0, 1)).toBeGreaterThan(fieldValue(0, 0, 0, 1));
  });

  it("drifts: the same cell changes over time", () => {
    expect(fieldValue(0.5, 0.5, 0, 1)).not.toBeCloseTo(
      fieldValue(0.5, 0.5, 20, 1),
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
    // Cells 9×16: one row down is 16/9 cell widths of real distance. A cell
    // `n` rows down must sit where a cell `n·16/9` columns across does.
    const aspect = 16 / 9;
    const age = 0.4;
    const rows = 5;
    expect(rippleContribution(0, rows, age, aspect)).toBeCloseTo(
      rippleContribution(rows * aspect, 0, age, aspect),
      12,
    );
    expect(rippleContribution(0, rows, age, aspect)).not.toBeCloseTo(
      rippleContribution(0, rows, age, 1),
      6,
    );
  });
});

describe("bucketIndex", () => {
  it("maps [0, 1] onto 0..levels-1", () => {
    expect(bucketIndex(0, 8)).toBe(0);
    expect(bucketIndex(0.124, 8)).toBe(0);
    expect(bucketIndex(0.125, 8)).toBe(1);
    expect(bucketIndex(0.5, 8)).toBe(4);
    expect(bucketIndex(0.999, 8)).toBe(7);
    expect(bucketIndex(1, 8)).toBe(7);
  });

  it("clamps out-of-range and NaN input", () => {
    expect(bucketIndex(-3, 8)).toBe(0);
    expect(bucketIndex(42, 8)).toBe(7);
    expect(bucketIndex(Number.NaN, 8)).toBe(0);
  });
});

describe("bucketAlpha", () => {
  it("is linear from 0 to maxAlpha", () => {
    expect(bucketAlpha(0, 8, 0.2)).toBe(0);
    expect(bucketAlpha(7, 8, 0.2)).toBeCloseTo(0.2, 12);
    expect(bucketAlpha(3, 8, 0.2)).toBeCloseTo((0.2 * 3) / 7, 12);
  });
});

describe("clamp01", () => {
  it("clamps", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(2)).toBe(1);
  });
});
