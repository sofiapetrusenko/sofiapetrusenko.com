import type { Link } from "@/content";

/** http(s) leaves the site; mailto: opens a client and must not target _blank. */
function isExternal(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

/**
 * `pill` gives each link a border and a hover fill, for places where the links
 * are the primary call to action rather than a footnote.
 */
export function LinkList({
  links,
  variant = "inline",
}: {
  links: readonly Link[];
  variant?: "inline" | "pill";
}) {
  const isPill = variant === "pill";

  return (
    <ul
      className={
        isPill ? "flex flex-wrap gap-3" : "flex flex-wrap gap-x-7 gap-y-3"
      }
    >
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            className={
              isPill
                ? "border-hairline-bright hover:border-accent hover:bg-surface text-accent block rounded-full border px-4 py-2 text-sm transition-colors duration-150 ease-out"
                : "link-underline text-accent text-sm"
            }
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
