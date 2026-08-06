import { profile } from "@/content";
import { LinkList } from "./LinkList";

export function Hero() {
  return (
    <header className="relative">
      {/*
        Two slow radial glows behind the name — the one deliberately decorative
        element on the site. Geometry, clipping and contrast are all handled in
        globals.css; see `.hero-aurora` there.
      */}
      <div aria-hidden="true" className="hero-aurora" />

      <h1 className="text-[clamp(3.25rem,11vw,5.5rem)] leading-[0.92] font-semibold tracking-[-0.03em] text-balance">
        {profile.name}
      </h1>
      <p className="mt-8 max-w-[24ch] text-[clamp(1.375rem,3.5vw,1.75rem)] leading-snug font-medium text-balance">
        {profile.headline}
      </p>
      <p className="text-muted mt-8 max-w-[68ch] leading-relaxed">
        {profile.summary}
      </p>
      <p className="text-muted mt-8 font-mono text-xs tracking-wider">
        {profile.location}
      </p>
      <div className="mt-10">
        <LinkList links={profile.links} variant="pill" />
      </div>
    </header>
  );
}
