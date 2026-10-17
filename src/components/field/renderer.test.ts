import { describe, expect, it, vi } from "vitest";
import {
  ALPHA_LEVELS,
  COLUMN_CAP,
  GLYPHS,
  gutterProfile,
} from "./asciiField.math";
import { ATLAS_GLYPHS, cellSize } from "./cells";
import {
  FIRST_DRAWN,
  FieldRenderer,
  STRONG,
  WEAK,
  type Context2D,
} from "./renderer";

/** A 2D context that records every glyph drawn and the alpha it was drawn at. */
function fakeContext() {
  const draws: { x: number; y: number; alpha: number; glyph: number }[] = [];
  const alphas: number[] = [];
  let alpha = 1;
  const canvas = { width: 0, height: 0 };
  const ctx = {
    canvas,
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn((g: string, x: number, y: number) => {
      draws.push({ x, y, alpha, glyph: GLYPHS.indexOf(g) });
    }),
    drawImage: vi.fn(
      (
        _img: unknown,
        sx: number,
        _sy: number,
        sw: number,
        _sh: number,
        dx: number,
        dy: number,
        dw: number,
        dh: number,
      ) => {
        // Record the destination cell centre, like fillText would.
        draws.push({
          x: dx + dw / 2,
          y: dy + dh / 2,
          alpha,
          glyph: Math.round(sx / sw),
        });
      },
    ),
    fillStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    set globalAlpha(v: number) {
      alpha = v;
      alphas.push(v);
    },
    get globalAlpha() {
      return alpha;
    },
  };
  return { ctx, draws, alphas, canvas };
}

const TEXT = { kind: "text", font: "monospace", color: "#a1a1aa" } as const;

function make(w = 1440, h = 480, dpr = 1, column = [360, 1080]) {
  const f = fakeContext();
  const r = new FieldRenderer(f.ctx as unknown as Context2D);
  r.setColumn(column[0]!, column[1]!);
  r.resize(w, h, dpr);
  r.setPainter(TEXT);
  return { r, ...f };
}

describe("cells", () => {
  it("atlas glyphs are GLYPHS, character for character (the worker indexes by position)", () => {
    expect(ATLAS_GLYPHS).toBe(GLYPHS);
  });

  it("is ~9x16 on desktop and coarser below 640px", () => {
    expect(cellSize(1440)).toMatchObject({ w: 9, h: 16 });
    const phone = cellSize(390);
    expect(phone.w).toBeGreaterThan(9);
    expect(phone.h).toBeGreaterThan(16);
  });
});

describe("FieldRenderer", () => {
  it("sizes the backing store at the DPR it is given", () => {
    const { canvas } = make(1440, 480, 2);
    expect(canvas.width).toBe(2880);
    expect(canvas.height).toBe(960);
  });

  it("caps every glyph touching the column at COLUMN_CAP, gutters at their peak", () => {
    const { r, draws } = make();
    r.drawStatic(0);
    expect(draws.length).toBeGreaterThan(0);
    const peak = gutterProfile(360).peak;
    for (const d of draws) {
      const touches = d.x + 4.5 > 360 && d.x - 4.5 < 1080;
      expect(d.alpha).toBeLessThanOrEqual(
        (touches ? COLUMN_CAP : peak) + 1e-12,
      );
    }
    const gutter = draws.filter((d) => d.x < 200 || d.x > 1240);
    expect(Math.max(...gutter.map((d) => d.alpha))).toBeGreaterThan(COLUMN_CAP);
  });

  it("holds COLUMN_CAP at ripple peak too", () => {
    const { r, draws } = make();
    // Strong ripples on the column, mid-wavefront, at full strength.
    for (let k = 0; k < 12; k++) r.addRipple(400 + k * 50, 200, STRONG, 0);
    r.tick(16, 16);
    for (const d of draws)
      if (d.x + 4.5 > 360 && d.x - 4.5 < 1080)
        expect(d.alpha).toBeLessThanOrEqual(COLUMN_CAP + 1e-12);
  });

  it("keeps a narrow gutter a soft margin, not a bright strip", () => {
    const { r, draws } = make(1024, 480, 1, [160, 864]);
    r.drawStatic(0);
    const peak = gutterProfile(160).peak;
    expect(peak).toBeLessThan(0.3);
    for (const d of draws) expect(d.alpha).toBeLessThanOrEqual(peak + 1e-12);
  });

  it("holds COLUMN_CAP everywhere below 640px and with no column", () => {
    for (const [w, col] of [
      [390, [24, 366]],
      [1440, [0, 0]],
    ] as const) {
      const { r, draws } = make(w, 480, 1, [...col]);
      r.drawStatic(0);
      expect(draws.length).toBeGreaterThan(0);
      for (const d of draws)
        expect(d.alpha).toBeLessThanOrEqual(COLUMN_CAP + 1e-12);
    }
  });

  it("paints one contiguous run per alpha level, ascending", () => {
    const { r, alphas } = make();
    r.drawStatic(0);
    const painted = alphas.filter((a) => a !== 1);
    expect(painted.length).toBeLessThanOrEqual(
      ALPHA_LEVELS.length - FIRST_DRAWN,
    );
    for (let i = 1; i < painted.length; i++)
      expect(painted[i]!).toBeGreaterThan(painted[i - 1]!);
    for (const a of painted) expect(ALPHA_LEVELS).toContain(a);
  });

  it("static frames swap no letters; animated frames do", () => {
    const { r, draws } = make();
    r.drawStatic(0);
    const first = draws.map((d) => d.glyph);
    draws.length = 0;
    r.drawStatic(0);
    expect(draws.map((d) => d.glyph)).toEqual(first);
    for (let k = 0; k < 30; k++) r.tick(k * 33, 33);
    draws.length = 0;
    r.drawStatic(0);
    expect(draws.map((d) => d.glyph)).not.toEqual(first);
  });

  it("paints from the atlas at the same cell centres as fillText, at the same alphas", () => {
    const text = make();
    text.r.drawStatic(0);
    const atlas = make();
    // Same glyph grid, so the frames are comparable cell for cell.
    (atlas.r as unknown as { glyphs: Uint8Array }).glyphs.set(
      (text.r as unknown as { glyphs: Uint8Array }).glyphs,
    );
    atlas.r.setPainter({
      kind: "atlas",
      image: {} as CanvasImageSource,
      dpr: 1,
    });
    atlas.r.drawStatic(0);
    expect(atlas.ctx.fillText).not.toHaveBeenCalled();
    expect(atlas.draws).toEqual(text.draws);
  });

  it("reads the atlas at device resolution", () => {
    const f = fakeContext();
    const r = new FieldRenderer(f.ctx as unknown as Context2D);
    r.setColumn(360, 1080);
    r.resize(1440, 480, 2);
    r.setPainter({ kind: "atlas", image: {} as CanvasImageSource, dpr: 2 });
    r.drawStatic(0);
    const [, sx, sy, sw, sh, , , dw, dh] = f.ctx.drawImage.mock.calls[0]!;
    expect([sw, sh, dw, dh]).toEqual([18, 32, 9, 16]);
    expect(sy).toBe(0);
    expect(sx % 18).toBe(0);
  });

  it("never lets drag ripples evict a click's", () => {
    const { r } = make();
    r.addRipple(100, 100, STRONG, 0);
    for (let k = 0; k < 40; k++) r.addRipple(100 + k, 100, WEAK, k);
    const ripples = (r as unknown as { ripples: { amp: number }[] }).ripples;
    expect(ripples).toHaveLength(12);
    expect(ripples.some((x) => x.amp === STRONG)).toBe(true);
  });

  it("draws nothing until it has a painter and a size", () => {
    const f = fakeContext();
    const r = new FieldRenderer(f.ctx as unknown as Context2D);
    r.drawStatic(0);
    r.resize(800, 400, 1);
    r.drawStatic(0);
    expect(f.draws).toHaveLength(0);
    expect(r.ready).toBe(false);
  });
});
