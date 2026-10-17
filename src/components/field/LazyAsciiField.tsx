"use client";

import dynamic from "next/dynamic";

/**
 * The character field's client boundary, and all of it that is in First Load
 * JS. `AsciiField` (the shim) arrives as its own chunk with `ssr: false`: the
 * field is a canvas with nothing to prerender, and keeping it out of the
 * route's initial scripts is what holds the JS budget (BASELINE T7–T9). The
 * shim itself waits for the load event and then for idle before it starts the
 * worker or builds the glyph atlas.
 *
 * `ssr: false` is only allowed in a Client Component, which is why this file
 * exists rather than a dynamic import in the root layout. It takes no
 * children, so nothing is dragged across the boundary.
 *
 * A chunk that fails to load resolves to nothing. `next/dynamic` is
 * `React.lazy` underneath, so a rejected import would otherwise throw during
 * render, and from the root layout the nearest boundary replaces the whole
 * page — decoration must never take content down with it (charter 11, 14).
 */
const AsciiField = dynamic(
  () =>
    import("./AsciiField").then(
      (m) => m.AsciiField,
      () => NoField,
    ),
  { ssr: false },
);

function NoField() {
  return null;
}

export function LazyAsciiField() {
  return <AsciiField />;
}
