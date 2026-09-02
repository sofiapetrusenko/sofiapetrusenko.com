import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * jsdom does not implement this. Stubbed rather than left missing so components
 * take their real browser code path under test.
 *
 * The IntersectionObserver stub that stood beside it is gone with the observer
 * it existed for: the scroll reveal is a CSS scroll-driven animation now and no
 * component calls the API.
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

afterEach(() => {
  cleanup();
});
