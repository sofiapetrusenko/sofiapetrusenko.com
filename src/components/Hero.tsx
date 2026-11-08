import { profile } from "@/content";
import { LinkList } from "./LinkList";
import { PageGlow } from "./PageGlow";

export function Hero() {
  return (
    <header className="relative">
      {/*
        Drifts, as do the site glows further down; the character field behind
        it is site-wide and mounted once in the root layout (charter A9).
      */}
      <PageGlow drift />

      {/*
        15.5vw keeps "Petrusenko", the longest unbreakable word, inside the
        column down to a 320px phone (about 5.2 em wide at this weight and
        tracking, against 320 minus two 28px gutters).
      */}
      <h1 className="text-[clamp(3rem,15.5vw,5.5rem)] leading-[0.92] font-bold tracking-[-0.02em] text-balance">
        {profile.name}
      </h1>
      {/*
        One sentence per line, so a narrow screen breaks between the two
        claims rather than inside one. The space stays in the text, so the
        paragraph still reads as a single string.
      */}
      <p className="mt-8 max-w-[30ch] text-[clamp(1.25rem,5.2vw,1.75rem)] leading-snug font-medium text-balance">
        {profile.headline.split(/(?<=\.)\s+/).map((sentence, i, all) => (
          <span key={sentence} className="block">
            {sentence}
            {i < all.length - 1 ? " " : null}
          </span>
        ))}
      </p>
      <p className="prose-hover mt-8 max-w-[68ch] text-[0.9375rem] leading-relaxed sm:text-base">
        {profile.summary}
      </p>
      <p className="text-muted mt-8 font-mono text-xs tracking-wider">
        {profile.location}
      </p>
      <div className="mt-10">
        <LinkList links={[...profile.links, profile.cv]} variant="pill" />
      </div>
    </header>
  );
}
