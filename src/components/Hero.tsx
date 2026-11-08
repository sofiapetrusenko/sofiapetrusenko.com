import type { CSSProperties } from "react";
import { profile } from "@/content";
import { LinkList } from "./LinkList";
import { PageGlow } from "./PageGlow";
import { LazyWarp } from "./warp/LazyWarp";

/** Stable pseudo-random in [0, 1) per index: the same on every render. */
function hash(i: number): number {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Each letter's way out of the scene: a direction, a turn and a small delay,
 * read by `hero-letter-out` in `globals.css`. Inert unless the scene runs.
 */
function letterStyle(i: number): CSSProperties {
  const angle = hash(i) * Math.PI * 2;
  return {
    "--dx": Math.cos(angle).toFixed(3),
    "--dy": Math.sin(angle).toFixed(3),
    "--rot": `${Math.round((hash(i + 101) - 0.5) * 80)}deg`,
    "--delay": `${(hash(i + 211) * 12).toFixed(1)}%`,
  } as CSSProperties;
}

/**
 * The hero is a scene (charter A13). At rest it is the ordinary hero. Where
 * the stylesheet's scroll timeline runs and motion is allowed, the scene is
 * stretched to 280svh and the stage sticks while it is scrolled: the name's
 * letters fly apart into the warp field behind, and the headline and
 * everything under it rise into the name's place. Every hidden or moved state
 * lives inside those two guards, so without them nothing here moves.
 *
 * `data-hero-quiet` marks the text boxes the warp leaves empty.
 */
export function Hero() {
  let index = 0;
  return (
    <div data-hero-scene className="hero-scene">
      <header data-hero-stage className="hero-stage relative">
        {/* Before the glow, so the glow paints over the field, not under it. */}
        <LazyWarp />
        {/*
          Drifts, as do the site glows further down; the character field behind
          it is site-wide and mounted once in the root layout (charter A9).
        */}
        <PageGlow drift />

        {/*
          15.5vw keeps "Petrusenko", the longest unbreakable word, inside the
          column down to a 320px phone (about 5.2 em wide at this weight and
          tracking, against 320 minus two 28px gutters).

          The name reaches assistive tech once, from the visually hidden span;
          the letters are presentation only.
        */}
        <h1
          data-hero-quiet="name"
          className="text-[length:var(--hero-name-size)] leading-[0.92] font-bold tracking-[-0.02em]"
        >
          <span className="sr-only">{profile.name}</span>
          <span aria-hidden="true">
            {profile.name.split(" ").map((word) => (
              <span key={word} className="block whitespace-nowrap">
                {[...word].map((ch) => {
                  const i = index++;
                  return (
                    <span
                      key={i}
                      className="hero-letter"
                      style={letterStyle(i)}
                    >
                      {ch}
                    </span>
                  );
                })}
              </span>
            ))}
          </span>
        </h1>
        {/*
          One sentence per line, so a narrow screen breaks between the two
          claims rather than inside one. The space stays in the text, so the
          paragraph still reads as a single string.
        */}
        <p
          data-hero-quiet="lift"
          className="hero-lift mt-8 max-w-[30ch] text-[clamp(1.25rem,5.2vw,1.75rem)] leading-snug font-medium text-balance"
        >
          {profile.headline.split(/(?<=\.)\s+/).map((sentence, i, all) => (
            <span key={sentence} className="block">
              {sentence}
              {i < all.length - 1 ? " " : null}
            </span>
          ))}
        </p>
        <div className="hero-lift">
          <p
            data-hero-quiet="lift"
            className="prose-hover mt-8 max-w-[68ch] text-[0.9375rem] leading-relaxed sm:text-base"
          >
            {profile.summary}
          </p>
          <p
            data-hero-quiet="lift"
            className="text-muted mt-8 w-fit font-mono text-xs tracking-wider"
          >
            {profile.location}
          </p>
          <div data-hero-quiet="lift" className="mt-10">
            <LinkList links={[...profile.links, profile.cv]} variant="pill" />
          </div>
        </div>
      </header>
    </div>
  );
}
