import type { Link, Project } from "./types";

/**
 * index.html names exactly one discrete product: Mira. The other work it
 * describes ("AI agents for business automation", "the longevity space") is
 * prose inside the Founder role, not a named project — inventing names, slugs
 * or years for those is out of scope here.
 *
 * `year` is "TODO" because index.html carries no dates. `links` is empty
 * because index.html gives no repo, demo or writeup URL for Mira, and a
 * placeholder href would be a broken link rather than a marker. It carries an
 * explicit `readonly Link[]` annotation: a bare `[]` infers as `never[]`, which
 * makes every consumer that iterates the array fail to compile.
 *
 * To add a project: copy the entry below, give it a unique slug, and leave
 * every prose field as "TODO" until the real copy exists.
 */
export const projects = [
  {
    slug: "mira",
    name: "Mira",
    tagline: "TODO",
    problem: "TODO",
    approach: "TODO",
    stack: ["TODO"],
    links: [] as readonly Link[],
    year: "TODO",
  },
] satisfies readonly Project[];
