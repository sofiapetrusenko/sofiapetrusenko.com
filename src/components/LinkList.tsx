import type { Link } from "@/content";

/** http(s) leaves the site; mailto: opens a client and must not target _blank. */
function isExternal(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

export function LinkList({ links }: { links: readonly Link[] }) {
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2">
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
            {...(isExternal(link.href)
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
