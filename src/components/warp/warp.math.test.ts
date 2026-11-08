import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CALM,
  LETTERS,
  LIFT,
  LIFT_EM,
  QUIET_PAD,
  calmAt,
  cameraSpeed,
  depthAlpha,
  heroProgress,
  inAny,
  quietRects,
  stageTop,
  toneFor,
} from "./warp.math";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("heroProgress", () => {
  it("runs 0 to 1 across the scene's contain range", () => {
    // Scene at page y 100, 2800 tall, in an 800 viewport: 2000px of scroll.
    expect(heroProgress(100, 100, 2800, 800)).toBe(0);
    expect(heroProgress(1100, 100, 2800, 800)).toBeCloseTo(0.5, 12);
    expect(heroProgress(2100, 100, 2800, 800)).toBe(1);
    expect(heroProgress(0, 100, 2800, 800)).toBe(0);
    expect(heroProgress(9000, 100, 2800, 800)).toBe(1);
  });

  it("reads a scene the stylesheet did not stretch as finished", () => {
    // No scroll timeline or reduced motion: the scene is its content's height,
    // so there is nothing to fly through and the warp must not start.
    expect(heroProgress(0, 100, 700, 800)).toBe(1);
    expect(heroProgress(0, 100, 800, 800)).toBe(1);
  });
});

describe("stageTop", () => {
  it("follows the flow, sticks at 0, then leaves with the scene", () => {
    const [top, scene, stage] = [100, 2800, 700];
    expect(stageTop(0, top, scene, stage)).toBe(100);
    expect(stageTop(100, top, scene, stage)).toBe(0);
    expect(stageTop(1500, top, scene, stage)).toBe(0);
    // Released once the scene's bottom meets the stage's: 100 + 2800 - 700.
    expect(stageTop(2200, top, scene, stage)).toBe(0);
    expect(stageTop(2300, top, scene, stage)).toBe(-100);
  });

  it("holds at its sticky offset rather than the viewport's top", () => {
    // The stage sticks at 96px: the place it already sits at rest.
    expect(stageTop(0, 96, 2800, 700, 96)).toBe(96);
    expect(stageTop(500, 96, 2800, 700, 96)).toBe(96);
    expect(stageTop(2300, 96, 2800, 700, 96)).toBe(-104);
  });
});

describe("calm and speed", () => {
  it("is fully warp before CALM.from and fully calm at the end", () => {
    expect(calmAt(0)).toBe(0);
    expect(calmAt(CALM.from)).toBe(0);
    expect(calmAt(CALM.to)).toBe(1);
    expect(calmAt(0.8)).toBeGreaterThan(0);
    expect(calmAt(0.8)).toBeLessThan(1);
  });

  it("drifts when the reader is still and jumps when they scroll the dissolve", () => {
    expect(cameraSpeed(0, 0)).toBeCloseTo(0.06, 12);
    expect(cameraSpeed(1, 0)).toBeCloseTo(0.03, 12);
    // The same scroll velocity moves the camera much faster mid-dissolve.
    const atRest = cameraSpeed(0, 1) - cameraSpeed(0, 0);
    const midJump = cameraSpeed(0.38, 1) - cameraSpeed(0.38, 0);
    expect(midJump / atRest).toBeGreaterThan(3);
    // Scrolling back up flies backwards.
    expect(cameraSpeed(0.38, -1)).toBeLessThan(0);
  });
});

describe("depthAlpha", () => {
  it("is faint far away, brightest mid-depth, and gone right at the camera", () => {
    expect(depthAlpha(1)).toBe(0);
    expect(depthAlpha(0.05)).toBe(0);
    expect(depthAlpha(0.4)).toBe(1);
    expect(depthAlpha(0.9)).toBeLessThan(depthAlpha(0.5));
    expect(depthAlpha(0.08)).toBeLessThan(depthAlpha(0.3));
  });
});

describe("quietRects", () => {
  const name = { x: 0, y: 0, w: 300, h: 120 };
  const lift = [{ x: 0, y: 160, w: 320, h: 300 }];

  it("pads every box and keeps the name until its letters have left", () => {
    const rest = quietRects(0, 28, 0, name, lift, 100);
    expect(rest).toHaveLength(2);
    expect(rest[0]).toEqual({
      x: 28 - QUIET_PAD,
      y: -QUIET_PAD,
      w: 300 + 2 * QUIET_PAD,
      h: 120 + 2 * QUIET_PAD,
    });
    expect(quietRects(0.5, 28, 0, name, lift, 100)).toHaveLength(1);
  });

  it("raises the lift boxes exactly as far as the stylesheet does, linearly", () => {
    const y = (p: number) => quietRects(p, 0, 0, null, lift, 100)[0]!.y;
    expect(y(LIFT.from)).toBe(160 - QUIET_PAD);
    expect(y((LIFT.from + LIFT.to) / 2)).toBeCloseTo(160 - QUIET_PAD - 50, 9);
    expect(y(LIFT.to)).toBe(160 - QUIET_PAD - 100);
    expect(y(1)).toBe(160 - QUIET_PAD - 100);
  });

  it("follows the stage as it moves", () => {
    expect(quietRects(0, 0, 96, null, lift, 0)[0]!.y).toBe(
      96 + 160 - QUIET_PAD,
    );
  });

  it("is what inAny tests against", () => {
    const rects = quietRects(0, 0, 0, name, lift, 0);
    expect(inAny(10, 10, rects)).toBe(true);
    expect(inAny(10, 128, rects)).toBe(true); // inside the name box's padding
    expect(inAny(500, 10, rects)).toBe(false);
  });
});

describe("toneFor", () => {
  it("keeps three quarters of the field muted", () => {
    const n = 1000;
    let muted = 0;
    for (let i = 0; i < n; i++) if (toneFor(i / n) === "muted") muted++;
    expect(muted).toBe(750);
  });
});

describe("the stylesheet agrees with these fractions", () => {
  // The worker and the CSS animate the same scene from two threads; if a range
  // drifts in one place only, the clipped text boxes stop matching the text.
  const range = (cls: string) =>
    css.match(new RegExp(`\\.${cls} \\{[^}]*animation-range:([^;]+);`))?.[1];

  it("lifts over LIFT", () => {
    expect(range("hero-lift")?.replace(/\s+/g, " ").trim()).toBe(
      `contain ${Math.round(LIFT.from * 100)}% contain ${Math.round(LIFT.to * 100)}%`,
    );
  });

  it("sends the letters over LETTERS plus their delay", () => {
    expect(range("hero-letter")?.replace(/\s+/g, " ").trim()).toBe(
      `contain calc(${Math.round(LETTERS.from * 100)}% + var(--delay)) contain calc(${Math.round(LETTERS.to * 100)}% + var(--delay))`,
    );
  });

  it("lifts by LIFT_EM name sizes", () => {
    expect(css).toContain(
      `translateY(calc(var(--hero-name-size) * -${LIFT_EM.toFixed(3)}))`,
    );
  });

  it("keeps every moved or hidden hero state inside both guards", () => {
    // Rule 3's corollary: no user agent may be stranded with an invisible name.
    const guarded = css.slice(
      css.indexOf("@supports (animation-timeline: view())"),
    );
    const outside = css.slice(0, css.indexOf("Hero scene and warp"));
    expect(guarded).toMatch(/@keyframes hero-letter-out/);
    expect(outside).not.toMatch(/hero-letter-out|hero-lift \{/);
    const sceneRules = css.slice(
      css.indexOf("/*\n * Hero scene and warp"),
      css.indexOf(
        "@media (prefers-reduced-motion: no-preference) {\n  .hero-warp",
      ),
    );
    // Declarations only: the section's own comment names what the guards hold.
    const declarations = sceneRules.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(declarations).not.toMatch(/sticky|280svh|animation/);
  });
});
