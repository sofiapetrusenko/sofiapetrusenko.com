import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Reveal } from "./Reveal";

const realMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = realMatchMedia;
});

/** Makes prefers-reduced-motion: reduce match. */
function preferReducedMotion() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion: reduce"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

describe("Reveal", () => {
  it("renders its children so content is never gated on JS", () => {
    render(
      <Reveal>
        <p>visible content</p>
      </Reveal>,
    );
    expect(screen.getByText("visible content")).toBeInTheDocument();
  });

  it("marks itself shown once observed", async () => {
    render(
      <Reveal>
        <p>content</p>
      </Reveal>,
    );

    await waitFor(() => {
      expect(screen.getByText("content").parentElement).toHaveAttribute(
        "data-reveal",
        "shown",
      );
    });
  });

  it("does not run the reveal when reduced motion is preferred", async () => {
    preferReducedMotion();

    render(
      <Reveal>
        <p>content</p>
      </Reveal>,
    );

    // Stays at the initial empty value; the CSS hidden state does not apply
    // under reduced motion either, so the content is simply visible.
    await waitFor(() => {
      expect(screen.getByText("content").parentElement).toHaveAttribute(
        "data-reveal",
        "",
      );
    });
  });
});
