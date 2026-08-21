import { labels, profile } from "@/content";
import { LinkList } from "./LinkList";
import { PageGlow } from "./PageGlow";

export function Hero() {
  return (
    <header className="relative">
      {/* The one animated element on the site, and only here. */}
      <PageGlow drift />

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
        <LinkList links={profile.links} variant="pill" />
      </div>
    </header>
  );
}
