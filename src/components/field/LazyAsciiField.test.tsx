import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The app build aliases `next/dynamic` to the App Router's `React.lazy`-based
// loader (`create-compiler-aliases.js`); Vitest would otherwise resolve the
// Pages-router one, which catches a rejection itself and so cannot show the
// failure this guards against.
vi.mock("next/dynamic", async () => ({
  default: (await import("next/dist/shared/lib/app-dynamic")).default,
}));

// The shim's chunk failing to load: the import itself rejects.
vi.mock("./AsciiField", () => {
  throw new Error("ChunkLoadError: Failed to load chunk");
});

describe("LazyAsciiField", () => {
  it("renders nothing, and leaves the page intact, when the shim's chunk fails to load", async () => {
    const { LazyAsciiField } = await import("./LazyAsciiField");
    const { container } = render(
      <>
        <LazyAsciiField />
        <main>
          <a href="/cv.pdf">CV</a>
        </main>
      </>,
    );
    await act(async () => {
      await vi.dynamicImportSettled();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByRole("link", { name: "CV" })).toBeInTheDocument();
    expect(container.querySelector(".ascii-field")).toBeNull();
  });
});
