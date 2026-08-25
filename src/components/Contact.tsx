import NextLink from "next/link";
import { labels, profile } from "@/content";
import { LinkList } from "./LinkList";
import { SectionLabel } from "./Section";

export function Contact() {
  return (
    <footer className="border-hairline mt-32 border-t pt-10 sm:mt-40">
      <SectionLabel>{labels.contact}</SectionLabel>
      <a
        href={`mailto:${profile.email}`}
        className="link-underline text-accent inline-block text-lg break-all sm:text-xl"
      >
        {profile.email}
      </a>
      <p className="text-muted mt-6 max-w-[68ch] text-sm leading-relaxed">
        {profile.availability}
      </p>
      <div className="mt-8">
        <LinkList links={profile.links} />
      </div>
      {/* The colophon is linked from here only. */}
      <NextLink
        href="/colophon"
        className="link-underline text-muted hover:text-accent mt-10 inline-block font-mono text-xs tracking-wider transition-colors duration-150 ease-out"
      >
        {labels.colophon}
      </NextLink>
    </footer>
  );
}
