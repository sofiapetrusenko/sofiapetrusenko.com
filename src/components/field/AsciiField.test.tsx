import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AsciiField, FIRST_DRAWN, LEVELS, MAX_ALPHA } from "./AsciiField";
import { bucketAlpha } from "./asciiField.math";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** A 2D context that records what the field asks it to paint. */
function fakeContext() {
  const alphas: number[] = [];
  const ctx = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn(),
    fillStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    set globalAlpha(v: number) {
      alphas.push(v);
    },
    get globalAlpha() {
      return alphas.at(-1) ?? 1;
    },
  };
  return { ctx, alphas };
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

let fake: ReturnType<typeof fakeContext>;

beforeEach(() => {
  fake = fakeContext();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    fake.ctx as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(720);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(480);
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  preferReducedMotion(false);
  Object.defineProperty(window, "devicePixelRatio", {
    value: 1,
    configurable: true,
  });
});

/** An IntersectionObserver whose callback the test drives. */
function stubIntersection() {
  const io: { fire: (visible: boolean) => void } = { fire: () => {} };
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
        io.fire = (visible) => cb([{ isIntersecting: visible }]);
      }
      observe() {}
      disconnect() {}
    },
  );
  return io;
}

function mount() {
  return render(
    <header>
      <AsciiField />
      <a href="/cv.pdf">CV</a>
    </header>,
  );
}

describe("AsciiField", () => {
  it("is declared decoration with no pointer target of its own", () => {
    const { container } = mount();
    const wrap = container.querySelector(".ascii-field");
    expect(wrap).toHaveAttribute("aria-hidden", "true");
    expect(wrap?.querySelectorAll("canvas")).toHaveLength(1);

    const rule = css.slice(css.indexOf("\n.ascii-field {"));
    const block = rule.slice(0, rule.indexOf("}"));
    expect(block).toMatch(/pointer-events: none/);
    expect(block).toMatch(/position: absolute/);
  });

  it("holds the scrim at 20% under the text, so the 4% bound in globals.css holds", () => {
    const rule = css.slice(css.indexOf("\n.ascii-field__canvas {"));
    const block = rule.slice(0, rule.indexOf("}"));
    const stops = [...block.matchAll(/rgb\(0 0 0 \/ ([\d.]+)\)/g)].map((m) =>
      Number(m[1]),
    );
    expect(stops).toEqual([0.2, 0.2]);
    // The token the component reads must be emitted, or the field goes blank.
    expect(css).toMatch(/--color-glyph: var\(--color-muted\);/);
    expect(css).toMatch(/color: var\(--color-glyph\);/);
    // …and the 0.2 hold begins exactly at the header top (= the <h1> top),
    // with the full-strength band ending before it.
    expect(block).toMatch(/rgb\(0 0 0 \/ 0\.2\) var\(--ascii-bleed\)/);
    expect(block).toMatch(
      /black calc\(var\(--ascii-bleed\) - 3rem\),\s*rgb\(0 0 0 \/ 0\.2\) var\(--ascii-bleed\)/,
    );
  });

  it("paints a first frame at once, one globalAlpha per bucket, never above 0.2", () => {
    mount();
    expect(fake.ctx.fillText).toHaveBeenCalled();
    // Six drawable buckets (2..7), then the reset to 1. Strictly rising alphas
    // mean each bucket is one contiguous run — the counting sort worked — and
    // the floor pins the run start: nothing below bucket 2 is painted.
    const painted = fake.alphas.filter((a) => a !== 1);
    expect(painted.length).toBeLessThanOrEqual(LEVELS - FIRST_DRAWN);
    expect(Math.min(...painted)).toBeGreaterThanOrEqual(
      bucketAlpha(FIRST_DRAWN, LEVELS, MAX_ALPHA) - 1e-12,
    );
    for (let i = 1; i < painted.length; i++)
      expect(painted[i]!).toBeGreaterThan(painted[i - 1]!);
    expect(Math.max(...painted)).toBeLessThanOrEqual(0.2 + 1e-9);
    for (const [glyph] of fake.ctx.fillText.mock.calls)
      expect(glyph).toMatch(/^[A-Za-z0-9]$/);
  });

  it("caps the backing store at DPR 2", () => {
    Object.defineProperty(window, "devicePixelRatio", {
      value: 3,
      configurable: true,
    });
    const { container } = mount();
    const canvas = container.querySelector("canvas")!;
    expect(canvas.width).toBe(720 * 2);
    expect(canvas.height).toBe(480 * 2);
  });

  it("listens for the pointer on its parent, not on the canvas", () => {
    const add = vi.spyOn(HTMLElement.prototype, "addEventListener");
    const { container } = mount();
    const header = container.querySelector("header")!;
    const types = add.mock.contexts
      .map((el, i) => [el, add.mock.calls[i]![0]] as const)
      .filter(([el]) => el === header)
      .map(([, type]) => type);
    expect(types).toEqual(
      expect.arrayContaining(["pointerdown", "pointermove"]),
    );
    // The canvas may hear `contextrestored`, but never the pointer.
    expect(
      add.mock.contexts.some(
        (el, i) =>
          el instanceof HTMLCanvasElement &&
          String(add.mock.calls[i]![0]).startsWith("pointer"),
      ),
    ).toBe(false);
  });

  it("starts the loop once idle, and stops it when the hero leaves the screen", () => {
    vi.useFakeTimers();
    const io = stubIntersection();
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    mount();

    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

    io.fire(false);
    expect(cancel).toHaveBeenCalled();
    io.fire(true);
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it("removes its pointer listeners from the header on unmount", () => {
    const remove = vi.spyOn(HTMLElement.prototype, "removeEventListener");
    const { container, unmount } = mount();
    const header = container.querySelector("header")!;
    unmount();
    const types = remove.mock.contexts
      .map((el, i) => [el, remove.mock.calls[i]![0]] as const)
      .filter(([el]) => el === header)
      .map(([, type]) => type);
    expect(types).toEqual(
      expect.arrayContaining(["pointerdown", "pointermove"]),
    );
  });

  it("under reduced motion paints one static frame and never loops or listens", () => {
    vi.useFakeTimers();
    preferReducedMotion(true);
    const add = vi.spyOn(HTMLElement.prototype, "addEventListener");
    const { container } = mount();
    const header = container.querySelector("header")!;

    expect(fake.ctx.fillText).toHaveBeenCalled();
    // Past the point where the animated path starts its loop (test above).
    vi.advanceTimersByTime(5000);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    // React's own root listeners sit on the container; only the header's count.
    expect(add.mock.contexts.filter((el) => el === header)).toEqual([]);
  });

  it("does nothing, and does not throw, without a 2D context", () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    expect(() => mount()).not.toThrow();
  });
});
