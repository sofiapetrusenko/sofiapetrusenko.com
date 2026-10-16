import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AsciiField, FIRST_DRAWN } from "./AsciiField";
import {
  ALPHA_LEVELS,
  COLUMN_CAP,
  GUTTER_CAP,
  gutterProfile,
} from "./asciiField.math";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

/** The declarations of a top-level rule, by exact selector. */
function ruleBlock(selector: string) {
  const start = css.indexOf(`\n${selector} {`);
  expect(start).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

/** A 2D context that records what the field paints, and at which alpha. */
function fakeContext() {
  const alphas: number[] = [];
  const draws: { x: number; y: number; alpha: number }[] = [];
  let alpha = 1;
  const ctx = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn((_g: string, x: number, y: number) => {
      draws.push({ x, y, alpha });
    }),
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
  return { ctx, alphas, draws };
}

function preferReducedMotion(reduce: boolean) {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

/** Viewport and content column, as `getBoundingClientRect` will report them. */
const VIEW = { w: 1440, h: 480 };
let COLUMN = { left: 360, right: 1080 };

let fake: ReturnType<typeof fakeContext>;

beforeEach(() => {
  // Nothing renders until idle (jsdom has no requestIdleCallback, so the
  // 600ms timeout fallback); every test drives that clock itself.
  vi.useFakeTimers();
  fake = fakeContext();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    fake.ctx as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(VIEW.w);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(
    VIEW.h,
  );
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const isMain = this.tagName === "MAIN";
      return {
        left: isMain ? COLUMN.left : 0,
        right: isMain ? COLUMN.right : VIEW.w,
        top: 0,
        bottom: VIEW.h,
        width: isMain ? COLUMN.right - COLUMN.left : VIEW.w,
        height: VIEW.h,
        x: 0,
        y: 0,
        toJSON() {},
      } as DOMRect;
    },
  );
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
});

afterEach(() => {
  COLUMN = { left: 360, right: 1080 };
  vi.useRealTimers();
  vi.restoreAllMocks();
  preferReducedMotion(false);
  Object.defineProperty(window, "devicePixelRatio", {
    value: 1,
    configurable: true,
  });
});

function mount({ idle = true } = {}) {
  const result = render(
    <>
      <AsciiField />
      <main>
        <a href="/cv.pdf">CV</a>
      </main>
    </>,
  );
  if (idle) vi.advanceTimersByTime(600);
  return result;
}

describe("AsciiField", () => {
  it("is fixed, full-viewport, behind content, and declared decoration", () => {
    const { container } = mount();
    const wrap = container.querySelector(".ascii-field");
    expect(wrap).toHaveAttribute("aria-hidden", "true");
    expect(wrap?.querySelectorAll("canvas")).toHaveLength(1);

    const block = ruleBlock(".ascii-field");
    expect(block).toMatch(/position: fixed/);
    expect(block).toMatch(/inset: 0/);
    expect(block).toMatch(/z-index: -10/);
    expect(block).toMatch(/pointer-events: none/);
    // The token the component reads must be emitted, or the field goes blank.
    expect(block).toMatch(/color: var\(--color-glyph\)/);
    expect(css).toMatch(/--color-glyph: var\(--color-muted\);/);
  });

  it("is mounted once, in the root layout, and nowhere else", () => {
    expect(layout).toMatch(/<AsciiField \/>/);
    expect(layout.match(/<AsciiField/g)).toHaveLength(1);
    const hero = readFileSync(
      join(process.cwd(), "src/components/Hero.tsx"),
      "utf8",
    );
    expect(hero).not.toMatch(/AsciiField/);
  });

  it("is hidden in forced colours and print", () => {
    const at = css.indexOf("@media (forced-colors: active), print {");
    expect(at).toBeGreaterThan(-1);
    const block = css.slice(at, css.indexOf("}\n}", at));
    expect(block).toMatch(/\.ascii-field/);
    expect(block).toMatch(/display: none/);
  });

  it("caps every glyph over the column at COLUMN_CAP, gutters at GUTTER_CAP", () => {
    mount();
    expect(fake.draws.length).toBeGreaterThan(0);
    for (const d of fake.draws) {
      // Any part of the glyph's 9px cell inside the column → column ceiling.
      const cellLeft = d.x - 4.5;
      const cellRight = d.x + 4.5;
      const touchesColumn = cellRight > COLUMN.left && cellLeft < COLUMN.right;
      expect(d.alpha).toBeLessThanOrEqual(
        (touchesColumn ? COLUMN_CAP : GUTTER_CAP) + 1e-12,
      );
    }
    // The gutters are actually brighter than the column somewhere.
    const gutter = fake.draws.filter(
      (d) => d.x < COLUMN.left - 120 || d.x > COLUMN.right + 120,
    );
    expect(Math.max(...gutter.map((d) => d.alpha))).toBeGreaterThan(COLUMN_CAP);
  });

  it("paints one contiguous run per alpha level, ascending, from FIRST_DRAWN", () => {
    mount();
    const painted = fake.alphas.filter((a) => a !== 1);
    expect(painted.length).toBeLessThanOrEqual(
      ALPHA_LEVELS.length - FIRST_DRAWN,
    );
    for (let i = 1; i < painted.length; i++)
      expect(painted[i]!).toBeGreaterThan(painted[i - 1]!);
    for (const a of painted) expect(ALPHA_LEVELS).toContain(a);
    for (const [glyph] of fake.ctx.fillText.mock.calls)
      expect(glyph).toMatch(/^[A-Za-z0-9]$/);
  });

  it("keeps a narrow gutter a soft margin, not a bright strip", () => {
    // 1024px window, 704px column: 160px gutters.
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1024);
    COLUMN = { left: 160, right: 864 };
    mount();
    const peak = gutterProfile(160).peak;
    expect(peak).toBeLessThan(0.3);
    for (const d of fake.draws)
      expect(d.alpha).toBeLessThanOrEqual(peak + 1e-12);
  });

  it("holds COLUMN_CAP across the whole viewport below 640px", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(390);
    mount();
    expect(fake.draws.length).toBeGreaterThan(0);
    for (const d of fake.draws)
      expect(d.alpha).toBeLessThanOrEqual(COLUMN_CAP + 1e-12);
  });

  it("caps the backing store at DPR 2", () => {
    Object.defineProperty(window, "devicePixelRatio", {
      value: 3,
      configurable: true,
    });
    const { container } = mount();
    const canvas = container.querySelector("canvas")!;
    expect(canvas.width).toBe(VIEW.w * 2);
    expect(canvas.height).toBe(VIEW.h * 2);
  });

  it("listens for the pointer on window, never on the canvas", () => {
    const onWindow = vi.spyOn(window, "addEventListener");
    const onEl = vi.spyOn(HTMLElement.prototype, "addEventListener");
    mount();
    const types = onWindow.mock.calls.map(([type]) => type);
    expect(types).toEqual(
      expect.arrayContaining(["pointerdown", "pointermove"]),
    );
    expect(
      onEl.mock.contexts.some(
        (el, i) =>
          el instanceof HTMLCanvasElement &&
          String(onEl.mock.calls[i]![0]).startsWith("pointer"),
      ),
    ).toBe(false);
  });

  it("does nothing until idle — not even the first frame — then starts the loop, and stops it while the tab is hidden", () => {
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    const { container } = mount({ idle: false });

    expect(fake.ctx.fillText).not.toHaveBeenCalled();
    expect(container.querySelector(".ascii-field")).not.toHaveAttribute(
      "data-ready",
    );
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    expect(fake.ctx.fillText).toHaveBeenCalled();
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

    hidden.mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cancel).toHaveBeenCalled();

    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it("removes its window listeners on unmount", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = mount();
    unmount();
    expect(remove.mock.calls.map(([type]) => type)).toEqual(
      expect.arrayContaining(["pointerdown", "pointermove"]),
    );
  });

  it("under reduced motion paints one static frame and never loops or listens", () => {
    preferReducedMotion(true);
    const onWindow = vi.spyOn(window, "addEventListener");
    mount();

    expect(fake.ctx.fillText).toHaveBeenCalled();
    // Past the point where the animated path starts its loop (test above).
    vi.advanceTimersByTime(5000);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    expect(
      onWindow.mock.calls.filter(([type]) =>
        String(type).startsWith("pointer"),
      ),
    ).toEqual([]);
  });

  it("does nothing, and does not throw, without a 2D context", () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    expect(() => mount()).not.toThrow();
  });
});
