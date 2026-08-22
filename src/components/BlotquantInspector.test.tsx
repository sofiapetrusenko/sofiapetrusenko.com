import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlotquantInspector } from "./BlotquantInspector";

/**
 * The load path is what these tests are for. The banner and real data are meant
 * to be mutually exclusive, so both directions are asserted: a banner over
 * measured numbers would misrepresent them, and measured numbers rendered with
 * a placeholder left in beside them would be worse.
 */

/** Enough of a result document to render, in the real schema's shape. */
const RESULT = {
  schema_version: "1.2.0",
  result_id: "8c4728c555e1fb7a",
  source: {
    path: "data/images/dev_02.png",
    sha256: "sha256:8734039250",
    image_format: "png",
    bit_depth: 16,
    max_value: 65535,
    width_px: 256,
    height_px: 192,
    lossy_format: false,
  },
  provenance: {
    software_version: "0.1.0",
    config_id: "default",
    config_digest: "sha256:f9db0bd62d",
    created_at: "2026-08-21T13:43:08Z",
  },
  lanes: [
    {
      lane_id: "L0",
      lane_index: 0,
      roi: { x: 14, y: 0, width: 55, height: 192 },
      roi_source: "detected",
      total_protein_signal: 23792794,
    },
  ],
  bands: [
    {
      band_id: "L0_B0",
      lane_id: "L0",
      roi: { x: 21, y: 58, width: 43, height: 16 },
      integrated_intensity: 15794644,
      background_estimate: 5653.98,
      peak_value: 59900,
      clipped_pixel_count: 111,
      qc_flags: ["saturated"],
      excluded_from_normalization: true,
      exclusion_reason: "carries QC flags: saturated",
    },
  ],
  normalization: {
    mode: "total_protein",
    exclude_qc_flagged: true,
    warnings: ["reference_band_saturated"],
    ratios: [
      {
        lane_id: "L0",
        numerator_band_id: "L0_B0",
        ratio: 0.6638414975559407,
        excluded: true,
        exclusion_reason: "carries QC flags: saturated",
        qc_flags: ["saturated"],
        reference_qc_flagged: true,
      },
    ],
  },
  image_qc_flags: ["saturated"],
};

const BANNER = /placeholder data/i;

/**
 * jsdom decodes no images, so `Image` never fires either handler on its own.
 * `ok` decides which one it fires, which is what puts the component down the
 * real or the fallback path.
 */
function stubImageLoading(ok: boolean) {
  class StubImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 256;
    naturalHeight = 192;
    set src(_value: string) {
      queueMicrotask(() => (ok ? this.onload?.() : this.onerror?.()));
    }
  }
  vi.stubGlobal("Image", StubImage);
}

beforeEach(() => {
  // The trace reads pixels back; jsdom has no 2d context, and the component is
  // written to carry on without one.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("BlotquantInspector", () => {
  it("renders the committed result with no banner when both artifacts load", async () => {
    stubImageLoading(true);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => RESULT }),
    );

    render(<BlotquantInspector />);

    // A value that exists only in the document, so this cannot pass on the
    // placeholder, whose every number is zero.
    expect(await screen.findByText("15.79M")).toBeInTheDocument();
    expect(screen.getByText(RESULT.source.path)).toBeInTheDocument();
    expect(screen.queryByText(BANNER)).not.toBeInTheDocument();
  });

  it("falls back to the placeholder and says so when the result is missing", async () => {
    stubImageLoading(true);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );

    render(<BlotquantInspector />);

    expect(await screen.findByText(BANNER)).toBeInTheDocument();
    expect(screen.queryByText("15.79M")).not.toBeInTheDocument();
    expect(screen.queryByText(RESULT.source.path)).not.toBeInTheDocument();
  });

  it("falls back when the document loads but the image does not", async () => {
    stubImageLoading(false);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => RESULT }),
    );

    render(<BlotquantInspector />);

    // Half-real is not a state: a measured document over a drawn image would
    // put real ROI coordinates on the wrong pixels.
    expect(await screen.findByText(BANNER)).toBeInTheDocument();
    expect(screen.queryByText("15.79M")).not.toBeInTheDocument();
  });

  it("falls back when the fetch itself rejects", async () => {
    stubImageLoading(true);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<BlotquantInspector />);

    expect(await screen.findByText(BANNER)).toBeInTheDocument();
  });

  it("reports a flagged band as excluded rather than dropping it", async () => {
    stubImageLoading(true);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => RESULT }),
    );

    render(<BlotquantInspector />);

    await waitFor(() =>
      expect(
        screen.getByText(/carries QC flags: saturated/),
      ).toBeInTheDocument(),
    );
    // The band is still on screen, with its ratio, not filtered out.
    expect(screen.getAllByText("L0_B0").length).toBeGreaterThan(0);
    expect(screen.getByText("0.664")).toBeInTheDocument();
    expect(
      screen.getByText(/warning: reference_band_saturated/),
    ).toBeInTheDocument();
  });
});
