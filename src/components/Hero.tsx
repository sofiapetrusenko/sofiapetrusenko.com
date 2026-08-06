import { profile } from "@/content";
import { LinkList } from "./LinkList";

export function Hero() {
  return (
    <header className="relative">
      {/*
        One soft radial glow in the accent hue behind the name. Static, and
        width-capped to the container so it can never widen the page.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-56 left-1/2 -z-10 h-[36rem] w-[36rem] max-w-full -translate-x-1/2 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(closest-side, var(--color-accent), transparent)",
        }}
      />

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
        <LinkList links={profile.links} />
      </div>
    </header>
  );
}
