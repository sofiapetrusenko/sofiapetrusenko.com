import { profile } from "@/content";
import { LinkList } from "./LinkList";

export function Hero() {
  return (
    <header>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {profile.name}
      </h1>
      <p className="mt-4 max-w-[68ch] text-lg text-balance sm:text-xl">
        {profile.headline}
      </p>
      <p className="text-muted mt-6 max-w-[68ch] leading-relaxed">
        {profile.summary}
      </p>
      <p className="text-muted mt-6 font-mono text-xs">{profile.location}</p>
      <div className="mt-8">
        <LinkList links={profile.links} />
      </div>
    </header>
  );
}
