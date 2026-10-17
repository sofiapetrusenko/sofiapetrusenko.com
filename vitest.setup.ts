import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * jsdom does not implement this. Stubbed rather than left missing so components
 * take their real browser code path under test.
 *
 * The IntersectionObserver stub that stood beside it is gone with the observer
 * it existed for: the scroll reveal is a CSS scroll-driven animation now. The
 * hero's AsciiField does observe, but treats a missing observer as "visible",
 * and its own tests install one where they need it.
 */
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

/**
 * jsdom has no canvas backend and logs "Not implemented" on every call. Return
 * null, which is what a browser without 2D support gives, so the hero field
 * takes its own bail-out path. Tests that need a context stub it themselves.
 */
HTMLCanvasElement.prototype.getContext = vi.fn(() => null);

afterEach(() => {
  cleanup();
});
