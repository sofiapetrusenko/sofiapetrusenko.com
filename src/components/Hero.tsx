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
      <div className="mt-10">
        <LinkList links={[...profile.links, profile.cv]} variant="pill" />
      </div>
    </header>
  );
}
