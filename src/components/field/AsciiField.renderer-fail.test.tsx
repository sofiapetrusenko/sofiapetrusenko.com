import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AsciiField } from "./AsciiField";

// The static fallback's drawing code (`./renderer`) failing to load: its
// dynamic import rejects. A file of its own, because the mock replaces the
// module for every test in the file.
vi.mock("./renderer", () => {
  throw new Error("ChunkLoadError: Failed to load chunk");
});

const fillText = vi.fn();
const rejections: unknown[] = [];
const onRejection = (reason: unknown) => rejections.push(reason);

beforeEach(() => {
  vi.useFakeTimers();
  rejections.length = 0;
  process.on("unhandledRejection", onRejection);
  // Reduced motion: the static fallback is the only path.
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) =>
      ({
        matches: query.includes("reduce"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    canvas: { width: 0, height: 0 },
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillText,
    drawImage: vi.fn(),
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  process.off("unhandledRejection", onRejection);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AsciiField static fallback, renderer chunk fails to load", () => {
  it("leaves the field unshown, the page intact, and no unhandled rejection", async () => {
    const { container } = render(
      <>
        <AsciiField />
        <main>
          <a href="/cv.pdf">CV</a>
        </main>
      </>,
    );
    await act(async () => {
      vi.advanceTimersByTime(600);
      await vi.dynamicImportSettled();
    });
    // Let Node report any rejection left unhandled by the import above.
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 20));

    // The static path was taken: its canvas exists, and nothing drew on it.
    expect(container.querySelector("canvas")).not.toBeNull();
    expect(rejections).toEqual([]);
    expect(fillText).not.toHaveBeenCalled();
    expect(container.querySelector(".ascii-field")).not.toHaveAttribute(
      "data-ready",
    );
    expect(screen.getByRole("link", { name: "CV" })).toBeInTheDocument();
  });
});
