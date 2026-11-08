import { useEffect, useRef } from "react";
import { ENTRIES, LIFT_EM, TONES, type Rect } from "./warp.math";
import type {
  Atlas,
  AtlasSlot,
  FromWorker,
  Layout,
  Size,
  ToWorker,
} from "./protocol";

/**
 * The hero warp's main-thread shim. The warp itself (a 3D field of glyphs the
 * camera flies through as the hero scene is scrolled) is drawn by
 * `warp.worker.ts` on an OffscreenCanvas. This file only:
 *
 *  - decides whether to run at all: motion allowed, the stylesheet's scroll
 *    timeline supported (without it the scene is not stretched, so there is
 *    nothing to fly through), and an off-thread canvas available;
 *  - renders a glyph atlas in the page's mono face and token colours, since a
 *    worker cannot see document fonts or custom properties;
 *  - measures the hero once at rest and again on resize (untransformed layout
 *    boxes, so the measurement holds wherever the scene's animations are), and
 *    forwards scroll (one message a frame) and visibility.
 *
 * Nothing runs until the load event has fired and the browser is then idle,
 * as with the site field. Decorative only: `aria-hidden`, no pointer events,
 * and no input is read but scroll. Where it cannot run, nothing is mounted
 * beyond an empty wrapper and the hero is the ordinary static hero.
 */

const IDLE_TIMEOUT_MS = 2000;
const READY_TIMEOUT_MS = 4000;
const ATLAS_FONT = 28;
const ATLAS_ROW = 36;
const ATLAS_WIDTH = 1024;

export function WarpField() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !canRun()) return;
    const scene = wrap.closest<HTMLElement>("[data-hero-scene]");
    const stage = scene?.querySelector<HTMLElement>("[data-hero-stage]");
    if (!scene || !stage) return;

    let stop: (() => void) | null = null;
    let idle: number | null = null;
    const usedIdle = typeof window.requestIdleCallback === "function";
    const begin = () => {
      idle = null;
      stop = start(wrap, scene, stage);
    };
    const afterLoad = () => {
      idle = usedIdle
        ? window.requestIdleCallback(begin, { timeout: IDLE_TIMEOUT_MS })
        : window.setTimeout(begin, 600);
    };
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });

    return () => {
      window.removeEventListener("load", afterLoad);
      if (idle !== null) {
        if (usedIdle) window.cancelIdleCallback(idle);
        else window.clearTimeout(idle);
      }
      stop?.();
    };
  }, []);

  return <div ref={wrapRef} aria-hidden="true" className="hero-warp" />;
}

function canRun(): boolean {
  return (
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("animation-timeline: view()") &&
    typeof Worker === "function" &&
    typeof OffscreenCanvas === "function" &&
    typeof HTMLCanvasElement.prototype.transferControlToOffscreen ===
      "function" &&
    typeof createImageBitmap === "function"
  );
}

function start(
  wrap: HTMLDivElement,
  scene: HTMLElement,
  stage: HTMLElement,
): () => void {
  const canvas = document.createElement("canvas");
  canvas.className = "hero-warp__canvas font-mono";
  wrap.append(canvas);

  let worker: Worker;
  try {
    worker = new Worker(new URL("./warp.worker.ts", import.meta.url));
  } catch {
    canvas.remove();
    return () => {};
  }
  const send = (m: ToWorker, transfer: Transferable[] = []) =>
    worker.postMessage(m, transfer);

  let alive = true;
  const fail = () => {
    if (!alive) return;
    teardown();
  };
  const readyTimer = window.setTimeout(fail, READY_TIMEOUT_MS);
  worker.onerror = fail;
  worker.onmessageerror = fail;
  worker.onmessage = (e: MessageEvent<FromWorker>) => {
    if (e.data.type === "ready") {
      window.clearTimeout(readyTimer);
      wrap.dataset.ready = "";
    } else fail();
  };

  const size = (): Size => ({
    w: wrap.clientWidth,
    h: wrap.clientHeight,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
  });
  const tokens = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) =>
    tokens.getPropertyValue(name).trim() || fallback;
  const colors = [
    token("--color-muted", "#a1a1aa"),
    token("--color-fg", "#e8e8ea"),
    token("--color-accent", "#38bdf8"),
    token("--color-ok", "#4ade80"),
  ];
  let sz = size();

  (async () => {
    const font = getComputedStyle(canvas).fontFamily || "monospace";
    // A face that fails to load is not a reason to drop the warp: the atlas is
    // drawn in whatever the stack falls back to.
    await document.fonts?.load(`${ATLAS_FONT}px ${font}`).catch(() => {});
    const atlas = await buildAtlas(font, colors, sz.dpr);
    if (!alive) return;
    const offscreen = canvas.transferControlToOffscreen();
    send(
      {
        type: "init",
        canvas: offscreen,
        atlas,
        colors,
        bg: token("--color-bg", "#0d0d0f"),
        scrollY: window.scrollY,
        hidden: document.hidden,
        layout: measure(scene, stage),
        ...sz,
      },
      [offscreen, atlas.image],
    );
  })().catch(fail);

  // Layout: re-measure (at most once a frame) when the scene or stage resize,
  // or the fonts settle and move the text.
  let layoutFrame = 0;
  const onLayout = () => {
    if (layoutFrame) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      const next = size();
      if (next.w !== sz.w || next.h !== sz.h || next.dpr !== sz.dpr) {
        sz = next;
        send({ type: "resize", ...sz });
      }
      send({ type: "layout", layout: measure(scene, stage) });
    });
  };
  const ro =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onLayout);
  ro?.observe(wrap);
  ro?.observe(scene);
  ro?.observe(stage);
  document.fonts?.ready.then(onLayout, () => {});

  let scrollFrame = 0;
  const onScroll = () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      send({ type: "scroll", y: window.scrollY });
    });
  };
  const onVisibility = () =>
    send({ type: "visibility", hidden: document.hidden });
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  function teardown() {
    alive = false;
    window.clearTimeout(readyTimer);
    worker.terminate();
    ro?.disconnect();
    if (layoutFrame) cancelAnimationFrame(layoutFrame);
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.remove();
    delete wrap.dataset.ready;
  }

  return teardown;
}

/**
 * The hero's layout at rest. Offsets, not client rects: they are layout
 * positions relative to the sticky stage, untouched by the scene's transforms,
 * so a measurement taken mid-scene is the same as one taken at the top.
 */
export function measure(scene: HTMLElement, stage: HTMLElement): Layout {
  // Summed up the offsetParent chain to the stage: a transformed ancestor
  // (the lifted wrapper) becomes an element's offsetParent in Chromium, and
  // offsets are layout positions either way, untouched by the transform.
  const box = (el: HTMLElement): Rect => {
    let x = 0;
    let y = 0;
    let node: Element | null = el;
    while (node instanceof HTMLElement && node !== stage) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent;
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  };
  const name = stage.querySelector<HTMLElement>('[data-hero-quiet="name"]');
  const lift = [
    ...stage.querySelectorAll<HTMLElement>('[data-hero-quiet="lift"]'),
  ].map(box);
  const nameSize = name ? parseFloat(getComputedStyle(name).fontSize) : 0;
  return {
    sceneTop: scene.getBoundingClientRect().top + window.scrollY,
    sceneHeight: scene.offsetHeight,
    stageHeight: stage.offsetHeight,
    stick: parseFloat(getComputedStyle(stage).top) || 0,
    stageX: stage.getBoundingClientRect().left,
    name: name ? box(name) : null,
    lift,
    liftPx: LIFT_EM * nameSize,
  };
}

/** Every entry in every tone, one row per tone wrapped at `ATLAS_WIDTH`. */
async function buildAtlas(
  font: string,
  colors: string[],
  dpr: number,
): Promise<Atlas> {
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = `${ATLAS_FONT}px ${font}`;
  const widths = ENTRIES.map((e) => Math.ceil(probe.measureText(e).width) + 6);

  // Lay one tone out, then stack the tones.
  const layout: AtlasSlot[] = [];
  let x = 0;
  let y = 0;
  for (const w of widths) {
    if (x + w > ATLAS_WIDTH) {
      x = 0;
      y += ATLAS_ROW;
    }
    layout.push({ x, y, w });
    x += w;
  }
  const toneHeight = y + ATLAS_ROW;

  const c = document.createElement("canvas");
  c.width = Math.ceil(ATLAS_WIDTH * dpr);
  c.height = Math.ceil(toneHeight * TONES.length * dpr);
  const g = c.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.font = `${ATLAS_FONT}px ${font}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const slots = TONES.map((_, t) => {
    g.fillStyle = colors[t]!;
    return layout.map((s, k) => {
      const slot = { x: s.x, y: s.y + t * toneHeight, w: s.w };
      g.fillText(ENTRIES[k]!, slot.x + slot.w / 2, slot.y + ATLAS_ROW / 2);
      return slot;
    });
  });
  return {
    image: await createImageBitmap(c),
    font: ATLAS_FONT,
    row: ATLAS_ROW,
    slots,
    dpr,
  };
}
