import type { Link } from "@/content";

/** http(s) leaves the site; mailto: opens a client and must not target _blank. */
function isExternal(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

export function LinkList({ links }: { links: readonly Link[] }) {
  return (
    <ul className="flex flex-wrap gap-x-7 gap-y-3">
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            className="link-underline text-accent text-sm"
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
