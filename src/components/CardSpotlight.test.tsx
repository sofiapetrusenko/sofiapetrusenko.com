import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { projects } from "@/content";
import { CardSpotlight } from "./CardSpotlight";
import { SelectedWork } from "./SelectedWork";

// Read from disk rather than via import.meta.url: the jsdom environment hands
// modules an http:// URL, which fileURLToPath will not take.
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/**
 * The W4 block alone: its @supports guard up to the next top-level comment.
 * Anchored to the start of a line, because the prose above the rule names the
 * same guard and would otherwise be read as the rule itself.
 */
const start = css.indexOf("\n@supports (mask-composite: exclude)") + 1;
const spotlight = css.slice(start, css.indexOf("\n/*", start));
/** The resting rule's own declarations. */
const resting = spotlight.slice(0, spotlight.indexOf("}"));

/**
 * Every addEventListener/removeEventListener call, with the element it was
 * called on. React attaches its own delegated `pointermove` to the render
 * container, so a plain spy on the method cannot tell that apart from the
 * component's — the target is what distinguishes them.
 */
type Attachment = { target: EventTarget; type: string; options: unknown };
const added: Attachment[] = [];
const removed: Attachment[] = [];
const realAdd = EventTarget.prototype.addEventListener;
const realRemove = EventTarget.prototype.removeEventListener;

/** Listeners the component put on its own <ul>, by event type. */
function onList(log: Attachment[], type: string) {
  return log.filter(
    (call) => call.type === type && (call.target as Element).tagName === "UL",
  );
}

/** Makes the pointer gate answer `matches`, as a fine pointer would or not. */
function pointerGate(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("hover: hover") ? matches : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

/** jsdom has no PointerEvent; a MouseEvent carries every field read here. */
function movePointer(target: Element, pageX: number, pageY: number) {
  const event = new MouseEvent("pointermove", { bubbles: true });
  Object.defineProperty(event, "pageX", { value: pageX });
  Object.defineProperty(event, "pageY", { value: pageY });
  target.dispatchEvent(event);
}

beforeEach(() => {
  added.length = 0;
  removed.length = 0;
  EventTarget.prototype.addEventListener = function (
    this: EventTarget,
    ...args
  ) {
    added.push({ target: this, type: args[0], options: args[2] });
    return realAdd.apply(this, args);
  };
  EventTarget.prototype.removeEventListener = function (
    this: EventTarget,
    ...args
  ) {
    removed.push({ target: this, type: args[0], options: args[2] });
    return realRemove.apply(this, args);
  };
});

afterEach(() => {
  EventTarget.prototype.addEventListener = realAdd;
  EventTarget.prototype.removeEventListener = realRemove;
  // A fresh gate rather than the setup file's, which `restoreAllMocks` strips
  // of its implementation on the way past.
  vi.restoreAllMocks();
  pointerGate(false);
});

describe("CardSpotlight", () => {
  it("renders its children as the list, adding no node of its own", () => {
    // Charter 11: the cards are server-rendered content in a slot, so they are
    // here before hydration and would be here without JS at all. Charter 12:
    // the boundary is the <ul> the cards were already in, not a wrapper.
    pointerGate(true);
    const { container } = render(
      <CardSpotlight>
        <li>first</li>
        <li>second</li>
      </CardSpotlight>,
    );

    const list = container.firstElementChild;
    expect(list?.tagName).toBe("UL");
    expect(list).toBe(screen.getByText("first").parentElement);
    expect(list?.children).toHaveLength(2);
  });

  it("attaches no listener when the pointer gate does not match", () => {
    // A touch device would otherwise run a handler on every frame of every
    // scroll-drag to write properties no rule reads: the CSS gate hides the
    // effect there, and this gate stops it being computed at all.
    pointerGate(false);
    render(
      <CardSpotlight>
        <li>card</li>
      </CardSpotlight>,
    );

    expect(onList(added, "pointermove")).toHaveLength(0);
  });

  it("attaches exactly one passive, delegated listener for the whole list", () => {
    // One listener on the <ul>, not one per card — the card under the pointer
    // is found by walking up from the event target.
    pointerGate(true);
    render(
      <CardSpotlight>
        <li>a</li>
        <li>b</li>
        <li>c</li>
      </CardSpotlight>,
    );

    const calls = onList(added, "pointermove");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.options).toEqual({ passive: true });
  });

  it("coalesces many moves into a single write per frame", () => {
    pointerGate(true);
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });

    const { container } = render(
      <CardSpotlight>
        <li>card</li>
      </CardSpotlight>,
    );
    const list = container.firstElementChild as HTMLElement;

    movePointer(screen.getByText("card"), 10, 20);
    movePointer(screen.getByText("card"), 30, 40);
    movePointer(screen.getByText("card"), 50, 60);

    // Three events, one frame requested, and nothing written until it runs.
    expect(frames).toHaveLength(1);
    expect(list.style.getPropertyValue("--spotlight-x")).toBe("");

    frames[0]?.(0);

    // The write is the last position only, and it lands on the list itself —
    // one element, not one per card. jsdom reports a zero rect, so the card's
    // document origin is (0, 0) and the local coordinates are the page ones.
    expect(list.style.getPropertyValue("--spotlight-x")).toBe("50px");
    expect(list.style.getPropertyValue("--spotlight-y")).toBe("60px");

    // And the next move opens a new frame rather than writing inline.
    movePointer(screen.getByText("card"), 70, 80);
    expect(frames).toHaveLength(2);
    expect(list.style.getPropertyValue("--spotlight-x")).toBe("50px");
  });

  it("takes its listener back off on unmount", () => {
    pointerGate(true);
    const { unmount } = render(
      <CardSpotlight>
        <li>card</li>
      </CardSpotlight>,
    );

    unmount();
    expect(onList(removed, "pointermove")).toHaveLength(1);
  });

  it("leaves each card at exactly one link in the accessibility tree", () => {
    // Charter 9. The wrapper adds no focusable element and the spotlight is a
    // pseudo-element, so the stretched hit target on the title link is still
    // the only link in the card.
    pointerGate(true);
    render(<SelectedWork />);

    const cards = document.querySelectorAll("li.spotlight-card");
    expect(cards).toHaveLength(projects.length);
    for (const card of cards) {
      expect(card.querySelectorAll("a")).toHaveLength(1);
    }

    // …and the stretched pseudo-element that makes the whole card clickable is
    // still on that link, so nothing has been laid over the hit target.
    for (const project of projects) {
      expect(
        screen.getByRole("link", { name: project.name }).className,
      ).toContain("after:inset-0");
    }
  });

  it("declares the spotlight only inside the pointer gate and the @supports", () => {
    // Charter 4: a touch device keeps today's card exactly, so the rule may not
    // exist outside `(hover: hover) and (pointer: fine)`. And without
    // `mask-composite` the mask would not cut the ring out of the border box,
    // so the gradient would wash the card's interior — behind text, which is
    // the one thing the stylesheet's contrast note promises it never does.
    expect(spotlight).toMatch(
      /^@supports \(mask-composite: exclude\) \{\s*@media \(hover: hover\) and \(pointer: fine\) \{\s*\.spotlight-card::before \{/,
    );
    // The class is declared nowhere else: no resting style, no touch variant.
    expect(css.match(/\.spotlight-card/g)).toHaveLength(2);
  });

  it("paints the hairline alone, with no blur, shadow or pointer target", () => {
    // Charter 1: depth is one surface step and a 1px hairline. The ring is the
    // border box minus the padding box, which is why `mask-composite` has to be
    // declared after the `mask` shorthand that resets it to `add`.
    expect(resting).toMatch(/inset: -1px;/);
    expect(resting).toMatch(/border: 1px solid transparent;/);
    expect(resting).toMatch(/pointer-events: none;/);
    expect(resting.indexOf("mask-composite: exclude;")).toBeGreaterThan(
      resting.indexOf("mask:"),
    );
    expect(spotlight).not.toMatch(/blur|box-shadow|filter:/);

    // Charter 5: opacity is the only thing that transitions, at the card's own
    // 175ms (charter 16), so nothing can reflow.
    expect(resting).toMatch(/transition: opacity 175ms ease-out;/);
    expect(spotlight).not.toMatch(/transition:(?!\s*opacity)/);
  });

  it("hides at rest and adds nothing that can dim the card", () => {
    // Charter 4: the resting state loses nothing to buy the hover. The only
    // opacity the effect can reach is on :hover, and the light only ever
    // brightens the border it sits on.
    expect(resting).toMatch(/opacity: 0;/);
    expect(spotlight).toMatch(
      /\.spotlight-card:hover::before \{\s*opacity: 0\.55;/,
    );
  });
});
