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
      {/*
        The colophon page still exists at /colophon but is linked from nowhere.
        Restoring the footer link brings it back.
      */}
    </footer>
  );
}
