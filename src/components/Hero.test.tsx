import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { profile } from "@/content";
import { Hero } from "./Hero";
import { WarpField } from "./warp/WarpField";

describe("Hero scene", () => {
  it("names the page once for assistive tech, however it is split visually", () => {
    render(<Hero />);

    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveAccessibleName(profile.name);
    // The per-letter spans are presentation; the visually hidden span carries
    // the name, so a screen reader hears it once and not letter by letter.
    const letters = h1.querySelectorAll(".hero-letter");
    expect(letters).toHaveLength(profile.name.replace(/\s/g, "").length);
    expect(letters[0]!.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(h1.querySelector(".sr-only")).toHaveTextContent(profile.name);
  });

  it("gives every letter its own way out, the same on every render", () => {
    const a = render(<Hero />).container.innerHTML;
    const b = render(<Hero />).container.innerHTML;
    expect(a).toBe(b);

    const first = document.querySelector<HTMLElement>(".hero-letter")!;
    for (const prop of ["--dx", "--dy", "--rot", "--delay"]) {
      expect(first.style.getPropertyValue(prop)).not.toBe("");
    }
  });

  it("marks the name and every text box below it for the warp to leave empty", () => {
    const { container } = render(<Hero />);

    expect(container.querySelectorAll('[data-hero-quiet="name"]')).toHaveLength(
      1,
    );
    // Headline, bio, location and the link pills.
    expect(container.querySelectorAll('[data-hero-quiet="lift"]')).toHaveLength(
      4,
    );
    // Everything that rises sits inside a lifted element.
    for (const box of container.querySelectorAll('[data-hero-quiet="lift"]')) {
      expect(box.closest(".hero-lift")).not.toBeNull();
    }
  });

  it("keeps the hero's content in the HTML, untouched by any script", () => {
    render(<Hero />);
    expect(
      screen.getByText(
        (_, el) => el?.tagName === "P" && el.textContent === profile.headline,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(profile.summary)).toBeInTheDocument();
  });
});

describe("WarpField", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts nothing where the scroll timeline is unsupported", () => {
    // jsdom has no `animation-timeline`: the stylesheet would not stretch the
    // scene, so there is nothing to fly through and no canvas is made.
    vi.stubGlobal("CSS", { supports: () => false });
    const { container } = render(
      <div data-hero-scene>
        <div data-hero-stage>
          <WarpField />
        </div>
      </div>,
    );
    const wrap = container.querySelector(".hero-warp")!;
    expect(wrap).toHaveAttribute("aria-hidden", "true");
    expect(wrap.querySelector("canvas")).toBeNull();
  });

  it("starts nothing when the reader asked for less motion", () => {
    vi.stubGlobal("CSS", { supports: () => true });
    const media = vi.spyOn(window, "matchMedia").mockImplementation(
      (q: string) =>
        ({
          matches: q.includes("reduce"),
          media: q,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    const add = vi.spyOn(window, "addEventListener");

    const { container } = render(
      <div data-hero-scene>
        <div data-hero-stage>
          <WarpField />
        </div>
      </div>,
    );
    expect(container.querySelector(".hero-warp canvas")).toBeNull();
    expect(add.mock.calls.map(([type]) => type)).not.toContain("load");

    media.mockRestore();
    add.mockRestore();
  });
});
