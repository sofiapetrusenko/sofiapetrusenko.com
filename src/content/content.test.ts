import { describe, expect, it } from "vitest";
import { profile, projects, roles } from "./index";

/** A labelled string, so a failure names the exact field that broke. */
type Field = { path: string; value: string };

/**
 * Every prose/text field in the content layer, flattened. Structural strings
 * (slug, email, year) are included deliberately: an empty one is just as broken
 * as empty copy.
 */
function textFields(): Field[] {
  const fields: Field[] = [
    { path: "profile.name", value: profile.name },
    { path: "profile.headline", value: profile.headline },
    { path: "profile.summary", value: profile.summary },
    { path: "profile.location", value: profile.location },
    { path: "profile.email", value: profile.email },
  ];

  for (const [i, link] of profile.links.entries()) {
    fields.push({ path: `profile.links[${i}].label`, value: link.label });
  }

  for (const project of projects) {
    const at = `projects[${project.slug}]`;
    fields.push(
      { path: `${at}.slug`, value: project.slug },
      { path: `${at}.name`, value: project.name },
      { path: `${at}.tagline`, value: project.tagline },
      { path: `${at}.problem`, value: project.problem },
      { path: `${at}.approach`, value: project.approach },
      { path: `${at}.year`, value: project.year },
    );
    for (const [i, entry] of project.stack.entries()) {
      fields.push({ path: `${at}.stack[${i}]`, value: entry });
    }
    for (const [i, link] of project.links.entries()) {
      fields.push({ path: `${at}.links[${i}].label`, value: link.label });
    }
  }

  for (const [i, role] of roles.entries()) {
    const at = `roles[${i}]`;
    fields.push(
      { path: `${at}.org`, value: role.org },
      { path: `${at}.title`, value: role.title },
      { path: `${at}.location`, value: role.location },
      { path: `${at}.period`, value: role.period },
      { path: `${at}.summary`, value: role.summary },
    );
  }

  return fields;
}

/** Every link in the content layer, labelled by where it lives. */
function allLinks(): { path: string; href: string }[] {
  const links = profile.links.map((link, i) => ({
    path: `profile.links[${i}]`,
    href: link.href,
  }));

  for (const project of projects) {
    for (const [i, link] of project.links.entries()) {
      links.push({
        path: `projects[${project.slug}].links[${i}]`,
        href: link.href,
      });
    }
  }

  return links;
}

/**
 * An href is valid when it is absolute — parseable on its own, without a base —
 * and either http(s) or a mailto: with an actual address. Relative paths,
 * protocol-relative URLs and bare placeholders all fail.
 */
function isAbsoluteOrMailto(href: string): boolean {
  if (href.trim() === "") return false;

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }

  if (url.protocol === "mailto:") return url.pathname.trim() !== "";
  return url.protocol === "http:" || url.protocol === "https:";
}

describe("content", () => {
  it("gives every project a unique slug", () => {
    const slugs = projects.map((project) => project.slug);
    expect(slugs).toStrictEqual([...new Set(slugs)]);
  });

  it("uses only absolute http(s) or mailto: hrefs", () => {
    const invalid = allLinks().filter((link) => !isAbsoluteOrMailto(link.href));
    expect(invalid).toStrictEqual([]);
  });

  it("has no empty text fields", () => {
    const empty = textFields().filter((field) => field.value.trim() === "");
    expect(empty).toStrictEqual([]);
  });
});
