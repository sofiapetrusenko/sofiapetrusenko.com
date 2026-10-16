import { labels, profile } from "@/content";
import { LinkList } from "./LinkList";
import { PageGlow } from "./PageGlow";
import { AsciiField } from "./hero/AsciiField";

export function Hero() {
  return (
    <header className="relative">
      {/*
        Drifts, and only here. Beside it, the character field below and the
        scroll cue's chevron are the only other things on this page that move
        without being asked to (charter A9, pending sign-off).
      */}
      <PageGlow drift />
      {/*
        Character field: after the glow so it paints above it, and a child of
        this header because it reads pointer input off its parent.
      */}
      <AsciiField />

      <h1 className="text-[clamp(3.25rem,11vw,5.5rem)] leading-[0.92] font-bold tracking-[-0.02em] text-balance">
        {profile.name}
      </h1>
      <p className="mt-8 max-w-[24ch] text-[clamp(1.375rem,3.5vw,1.75rem)] leading-snug font-medium text-balance">
        {profile.headline}
      </p>
      <p className="prose-hover mt-8 max-w-[68ch] leading-relaxed">
        {profile.summary}
      </p>
      <p className="text-muted mt-8 font-mono text-xs tracking-wider">
        {profile.location}
      </p>
      {/* Shell-prompt line: quiet, static, no cursor and no typing effect. */}
      <p className="text-muted mt-3 font-mono text-xs break-words">
        <span className="text-accent">
          {labels.promptSymbol} {labels.promptCurrently}
        </span>{" "}
        {profile.now}
      </p>
      <div className="mt-10">
        <LinkList links={[...profile.links, profile.cv]} variant="pill" />
      </div>
    </header>
  );
}
