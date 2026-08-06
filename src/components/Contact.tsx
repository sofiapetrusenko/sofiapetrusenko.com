import { labels, profile } from "@/content";
import { LinkList } from "./LinkList";

export function Contact() {
  return (
    <footer className="border-hairline mt-20 border-t pt-8">
      <h2 className="text-muted mb-8 font-mono text-xs tracking-widest uppercase">
        {labels.contact}
      </h2>
      <a
        href={`mailto:${profile.email}`}
        className="text-accent decoration-accent/40 hover:decoration-accent break-all underline underline-offset-4"
      >
        {profile.email}
      </a>
      <div className="mt-6">
        <LinkList links={profile.links} />
      </div>
    </footer>
  );
}
