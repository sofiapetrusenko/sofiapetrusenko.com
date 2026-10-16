/**
 * Grid geometry shared by the main-thread shim and the worker, plus the glyph
 * atlas the shim builds for the worker. Kept apart from `renderer.ts` so the
 * shim can size the atlas without pulling the renderer into the main bundle.
 */

/**
 * The glyph set, in `GLYPHS` order (`asciiField.math.ts`). A copy rather than
 * an import: this module is in the main bundle, and importing one constant
 * would bring the whole math module with it. A test pins the two equal, since
 * the worker indexes this atlas by position in `GLYPHS`.
 */
export const ATLAS_GLYPHS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export const NARROW_PX = 640;

export type Cell = { w: number; h: number; font: number };

/** Cell size and font px for a viewport `width` wide; coarser on a phone. */
export function cellSize(width: number): Cell {
  return width < NARROW_PX
    ? { w: 16, h: 28, font: 15 }
    : { w: 9, h: 16, font: 11.5 };
}

/**
 * Every glyph, rendered once in the page's own font and colour into one row of
 * cells at device resolution. Drawn exactly as `fillText` would draw it in a
 * grid cell — centred, `middle` baseline — so `drawImage` from this sheet puts
 * the same pixels in the same place. Main thread only: it needs the document's
 * loaded web font, which a worker cannot see.
 */
export async function buildAtlas(
  cell: Cell,
  dpr: number,
  font: string,
  color: string,
): Promise<ImageBitmap> {
  const c = document.createElement("canvas");
  c.width = Math.ceil(ATLAS_GLYPHS.length * cell.w * dpr);
  c.height = Math.ceil(cell.h * dpr);
  const g = c.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = color;
  g.font = `${cell.font}px ${font}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let k = 0; k < ATLAS_GLYPHS.length; k++) {
    g.fillText(ATLAS_GLYPHS[k]!, (k + 0.5) * cell.w, cell.h / 2);
  }
  return createImageBitmap(c);
}
