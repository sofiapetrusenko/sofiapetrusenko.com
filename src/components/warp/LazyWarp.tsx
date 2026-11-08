"use client";

import dynamic from "next/dynamic";

/**
 * The hero warp's client boundary (charter A13), on the `LazyAsciiField`
 * pattern: `WarpField` (the shim) arrives as its own chunk with `ssr: false`,
 * so none of it is in First Load JS, and it waits for load and idle before it
 * starts a worker. A server component cannot hold it because it needs a canvas
 * and a worker; it takes no children, so nothing is dragged across.
 *
 * A chunk that fails to load resolves to nothing: decoration must never take
 * the hero down with it (charter 11, 14).
 */
const WarpField = dynamic(
  () =>
    import("./WarpField").then(
      (m) => m.WarpField,
      () => NoWarp,
    ),
  { ssr: false },
);

function NoWarp() {
  return null;
}

export function LazyWarp() {
  return <WarpField />;
}
