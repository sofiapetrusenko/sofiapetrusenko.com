import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AsciiField } from "./AsciiField";
import type { ToWorker } from "./protocol";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
const shim = readFileSync(
  join(process.cwd(), "src/components/field/AsciiField.tsx"),
  "utf8",
);

/** The declarations of a top-level rule, by exact selector. */
function ruleBlock(selector: string) {
  const start = css.indexOf(`\n${selector} {`);
  expect(start).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

/**
 * Live media state, like a real MediaQueryList: `matches` is read on access,
 * and `media()` notifies every registered change listener.
 */
const mediaState = { reduce: false, desktop: true };
const mediaListeners = new Set<() => void>();
function media({ reduce = false, desktop = true } = {}) {
  mediaState.reduce = reduce;
  mediaState.desktop = desktop;
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) =>
      ({
        get matches() {
          return query.includes("reduce")
            ? mediaState.reduce
            : query.includes("min-width: 1024px")
              ? mediaState.desktop
              : false;
        },
        media: query,
        onchange: null,
        addEventListener: (_: string, cb: () => void) => mediaListeners.add(cb),
        removeEventListener: (_: string, cb: () => void) =>
          mediaListeners.delete(cb),
        dispatchEvent: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
}

const VIEW = { w: 1440, h: 480 };
const COLUMN = { left: 360, right: 1080 };

/** A worker that records what it is sent, and can be made to fail or report ready. */
class FakeWorker {
  static last: FakeWorker | null = null;
  sent: { m: ToWorker; transfer: unknown[] }[] = [];
  terminated = false;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  constructor() {
    FakeWorker.last = this;
  }
  postMessage(m: ToWorker, transfer: unknown[] = []) {
    this.sent.push({ m, transfer });
  }
  terminate() {
    this.terminated = true;
  }
  of<T extends ToWorker["type"]>(type: T) {
    return this.sent
      .map((s) => s.m)
      .filter((m): m is Extract<ToWorker, { type: T }> => m.type === type);
  }
}

let fillText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  media();
  FakeWorker.last = null;
  fillText = vi.fn();
  // Main-thread contexts (the static fallback and the atlas canvas).
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    canvas: { width: 0, height: 0 },
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillText,
    drawImage: vi.fn(),
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(VIEW.w);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(
    VIEW.h,
  );
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const main = this.tagName === "MAIN";
      return {
        left: main ? COLUMN.left : 0,
        right: main ? COLUMN.right : VIEW.w,
        top: 0,
        bottom: VIEW.h,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON() {},
      } as DOMRect;
    },
  );
  // Run coalesced frames at once; the shim never schedules a loop of its own.
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    cb(0);
    return 1;
  });
});

afterEach(() => {
  mediaListeners.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  media({ reduce: false, desktop: false });
  Object.defineProperty(window, "devicePixelRatio", {
    value: 1,
    configurable: true,
  });
  delete (
    HTMLCanvasElement.prototype as { transferControlToOffscreen?: unknown }
  ).transferControlToOffscreen;
});

/** Make the browser look capable of the off-thread path. */
function offThreadCapable() {
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("OffscreenCanvas", class {});
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ bitmap: true })),
  );
  (
    HTMLCanvasElement.prototype as { transferControlToOffscreen?: unknown }
  ).transferControlToOffscreen = vi.fn(() => ({ offscreen: true }));
}

function mount() {
  return render(
    <>
      <AsciiField />
      <main>
        <a href="/cv.pdf">CV</a>
      </main>
    </>,
  );
}

/** Let the idle callback fire and any dynamic import / atlas promise settle. */
async function idle() {
  await act(async () => {
    vi.advanceTimersByTime(600);
    await vi.dynamicImportSettled();
    await Promise.resolve();
  });
}

describe("AsciiField (shim)", () => {
  it("is a fixed, full-viewport, decorative layer behind content", () => {
    const { container } = mount();
    expect(container.querySelector(".ascii-field")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    const block = ruleBlock(".ascii-field");
    expect(block).toMatch(/position: fixed/);
    expect(block).toMatch(/inset: 0/);
    expect(block).toMatch(/z-index: -10/);
    expect(block).toMatch(/pointer-events: none/);
    expect(block).toMatch(/color: var\(--color-glyph\)/);
    expect(css).toMatch(/--color-glyph: var\(--color-muted\);/);
  });

  it("is mounted once, in the root layout", () => {
    expect(layout.match(/<AsciiField/g)).toHaveLength(1);
  });

  it("keeps the renderer and the math out of the main bundle", () => {
    // Only a dynamic import of the renderer, only types from the protocol.
    expect(shim).not.toMatch(/from "\.\/renderer"/);
    expect(shim).not.toMatch(/from "\.\/asciiField\.math"/);
    expect(shim).toMatch(/import\("\.\/renderer"\)/);
    expect(shim).toMatch(/import type \{[^}]*\} from "\.\/protocol"/);
    const cells = readFileSync(
      join(process.cwd(), "src/components/field/cells.ts"),
      "utf8",
    );
    expect(cells).not.toMatch(/from "\.\/asciiField\.math"/);
  });

  it("does nothing at all until idle", () => {
    offThreadCapable();
    const { container } = mount();
    expect(FakeWorker.last).toBeNull();
    expect(container.querySelector("canvas")).toBeNull();
    expect(fillText).not.toHaveBeenCalled();
  });

  describe("worker path", () => {
    it("transfers the canvas and an atlas, with size, DPR ≤ 2, column, scroll and visibility", async () => {
      offThreadCapable();
      Object.defineProperty(window, "devicePixelRatio", {
        value: 3,
        configurable: true,
      });
      mount();
      await idle();
      const w = FakeWorker.last!;
      const [init] = w.of("init");
      expect(init).toMatchObject({
        w: VIEW.w,
        h: VIEW.h,
        dpr: 2,
        left: 360,
        right: 1080,
        scrollY: 0,
        hidden: false,
      });
      const sent = w.sent.find((s) => s.m.type === "init")!;
      expect(sent.transfer).toEqual([{ offscreen: true }, { bitmap: true }]);
      // The field is drawn there, not here.
      expect(fillText.mock.calls.length).toBe(62); // atlas glyphs only
    });

    it("forwards pointer input: every press, moves throttled to 90ms, touch moves ignored", async () => {
      offThreadCapable();
      mount();
      await idle();
      const w = FakeWorker.last!;
      const fire = (
        type: string,
        init: PointerEventInit & { timeStamp?: number },
      ) => {
        const e = new Event(type) as PointerEvent;
        const rest = { ...init };
        delete rest.timeStamp;
        Object.assign(e, {
          clientX: 10,
          clientY: 20,
          pointerType: "mouse",
          ...rest,
        });
        Object.defineProperty(e, "timeStamp", { value: init.timeStamp ?? 0 });
        window.dispatchEvent(e);
      };
      fire("pointerdown", {});
      fire("pointermove", { timeStamp: 100 });
      fire("pointermove", { timeStamp: 150 });
      fire("pointermove", { timeStamp: 200 });
      fire("pointermove", { timeStamp: 400, pointerType: "touch" });
      const pointer = w.of("pointer");
      expect(pointer.map((p) => p.strong)).toEqual([true, false, false]);
      expect(pointer[0]).toMatchObject({ x: 10, pageY: 20 });
    });

    it("forwards visibility and scroll, and re-sends the column only when it moves", async () => {
      offThreadCapable();
      mount();
      await idle();
      const w = FakeWorker.last!;
      const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
      document.dispatchEvent(new Event("visibilitychange"));
      expect(w.of("visibility").at(-1)).toEqual({
        type: "visibility",
        hidden: true,
      });
      hidden.mockReturnValue(false);
      Object.defineProperty(window, "scrollY", {
        value: 500,
        configurable: true,
      });
      window.dispatchEvent(new Event("scroll"));
      expect(w.of("scroll").at(-1)).toEqual({ type: "scroll", y: 500 });
      Object.defineProperty(window, "scrollY", {
        value: 0,
        configurable: true,
      });
      expect(w.of("column")).toHaveLength(0);
    });

    it("terminates the worker and removes every listener on unmount", async () => {
      offThreadCapable();
      const remove = vi.spyOn(window, "removeEventListener");
      const { unmount } = mount();
      await idle();
      unmount();
      expect(FakeWorker.last!.terminated).toBe(true);
      expect(remove.mock.calls.map(([t]) => t)).toEqual(
        expect.arrayContaining(["scroll", "pointerdown", "pointermove"]),
      );
    });

    it("falls back to one static main-thread frame when the worker errors", async () => {
      offThreadCapable();
      const { container } = mount();
      await idle();
      fillText.mockClear();
      await act(async () => {
        FakeWorker.last!.onerror!();
        await vi.dynamicImportSettled();
      });
      expect(FakeWorker.last!.terminated).toBe(true);
      expect(fillText).toHaveBeenCalled();
      expect(container.querySelectorAll("canvas")).toHaveLength(1);
      expect(container.querySelector(".ascii-field")).toHaveAttribute(
        "data-ready",
      );
    });

    it("falls back when the worker never reports ready", async () => {
      offThreadCapable();
      mount();
      await idle();
      fillText.mockClear();
      await act(async () => {
        vi.advanceTimersByTime(4000);
        await vi.dynamicImportSettled();
      });
      expect(FakeWorker.last!.terminated).toBe(true);
      expect(fillText).toHaveBeenCalled();
    });

    it("marks ready only when the worker says it has drawn", async () => {
      offThreadCapable();
      const { container } = mount();
      await idle();
      const wrap = container.querySelector(".ascii-field")!;
      expect(wrap).not.toHaveAttribute("data-ready");
      act(() => FakeWorker.last!.onmessage!({ data: { type: "ready" } }));
      expect(wrap).toHaveAttribute("data-ready");
    });
  });

  describe("static fallback", () => {
    it("is what a phone or a touch screen gets, even where the worker would work", async () => {
      offThreadCapable();
      media({ desktop: false });
      const add = vi.spyOn(window, "addEventListener");
      mount();
      await idle();
      expect(FakeWorker.last).toBeNull();
      expect(fillText).toHaveBeenCalled();
      expect(add.mock.calls.filter(([t]) => /pointer/.test(String(t)))).toEqual(
        [],
      );
    });

    it("re-decides when the window crosses 1024px", async () => {
      offThreadCapable();
      media({ desktop: false });
      mount();
      await idle();
      expect(FakeWorker.last).toBeNull();
      mediaState.desktop = true;
      await act(async () => {
        for (const cb of [...mediaListeners]) cb();
      });
      await idle();
      expect(FakeWorker.last).not.toBeNull();
    });

    it("draws exactly one frame on the main thread when OffscreenCanvas is missing, and never loops", async () => {
      const add = vi.spyOn(window, "addEventListener");
      const { container } = mount();
      await idle();
      expect(FakeWorker.last).toBeNull();
      const drawn = fillText.mock.calls.length;
      expect(drawn).toBeGreaterThan(0);
      expect(container.querySelector(".ascii-field")).toHaveAttribute(
        "data-ready",
      );
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });
      expect(fillText.mock.calls.length).toBe(drawn);
      expect(
        add.mock.calls.filter(([t]) => /pointer|scroll/.test(String(t))),
      ).toEqual([]);
    });

    it("is what reduced motion gets, even where the worker would work", async () => {
      offThreadCapable();
      media({ reduce: true });
      mount();
      await idle();
      expect(FakeWorker.last).toBeNull();
      expect(fillText).toHaveBeenCalled();
    });

    it("does not throw without a 2D context", async () => {
      vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
      mount();
      await expect(idle()).resolves.toBeUndefined();
    });
  });

  it("is hidden in forced colours and print", () => {
    const at = css.indexOf("@media (forced-colors: active), print {");
    const block = css.slice(at, css.indexOf("}\n}", at));
    expect(block).toMatch(/\.ascii-field/);
    expect(block).toMatch(/display: none/);
  });
});
