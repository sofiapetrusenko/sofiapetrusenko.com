import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ScrollCue } from "./ScrollCue";

/** jsdom reports a zero-height document, so both sides are set explicitly. */
function setPageMetrics({
  scrollHeight,
  innerHeight,
  scrollY = 0,
}: {
  scrollHeight: number;
  innerHeight: number;
  scrollY?: number;
}) {
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: innerHeight,
  });
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value: scrollY,
  });
}

function cue() {
  return document.querySelector(".scroll-cue") as HTMLElement;
}

afterEach(() => {
  setPageMetrics({ scrollHeight: 0, innerHeight: 768 });
});

describe("ScrollCue", () => {
  it("stays hidden when the page has nowhere to scroll", async () => {
    setPageMetrics({ scrollHeight: 800, innerHeight: 768 });
    render(<ScrollCue />);

    await waitFor(() => expect(cue()).toHaveAttribute("data-visible", "false"));
  });

  it("shows at the top of a page that overflows", async () => {
    setPageMetrics({ scrollHeight: 4000, innerHeight: 768 });
    render(<ScrollCue />);

    await waitFor(() => expect(cue()).toHaveAttribute("data-visible", "true"));
  });

  it("hides once the reader has scrolled, and returns at the top", async () => {
    setPageMetrics({ scrollHeight: 4000, innerHeight: 768 });
    render(<ScrollCue />);
    await waitFor(() => expect(cue()).toHaveAttribute("data-visible", "true"));

    setPageMetrics({ scrollHeight: 4000, innerHeight: 768, scrollY: 200 });
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    await waitFor(() => expect(cue()).toHaveAttribute("data-visible", "false"));

    setPageMetrics({ scrollHeight: 4000, innerHeight: 768, scrollY: 0 });
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    await waitFor(() => expect(cue()).toHaveAttribute("data-visible", "true"));
  });

  it("is an anchor to the first section, with an accessible name", () => {
    setPageMetrics({ scrollHeight: 4000, innerHeight: 768 });
    render(<ScrollCue />);

    expect(
      screen.getByRole("link", { name: /skip to selected work/i }),
    ).toHaveAttribute("href", "#selected-work");
  });
});
