import { describe, expect, it } from "vitest";
import {
  education,
  isCurrentRole,
  notes,
  profile,
  projects,
  roles,
  type Project,
  type Role,
} from "./index";

/**
 * The declared contract rather than the inferred literal. `satisfies` keeps the
 * literal's narrow types, so a `sections: []` on every project would infer
 * `never[]` and quietly drop those fields out of the checks below.
 */
const allProjects: readonly Project[] = projects;

/** Same reason as `allProjects`: `undisclosed` is optional and set on one entry. */
const allRoles: readonly Role[] = roles;

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
    { path: "profile.availability", value: profile.availability },
    { path: "profile.email", value: profile.email },
    { path: "profile.cv.label", value: profile.cv.label },
  ];

  for (const [i, link] of profile.links.entries()) {
    fields.push({ path: `profile.links[${i}].label`, value: link.label });
  }

  for (const project of allProjects) {
    const at = `projects[${project.slug}]`;
    fields.push(
      { path: `${at}.slug`, value: project.slug },
      { path: `${at}.name`, value: project.name },
      { path: `${at}.tagline`, value: project.tagline },
      { path: `${at}.problem`, value: project.problem },
      { path: `${at}.approach`, value: project.approach },
      { path: `${at}.year`, value: project.year },
    );
    for (const section of project.sections) {
      fields.push(
        { path: `${at}.sections[${section.id}].id`, value: section.id },
        { path: `${at}.sections[${section.id}].label`, value: section.label },
        { path: `${at}.sections[${section.id}].body`, value: section.body },
      );
    }
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
      { path: `${at}.country`, value: role.country },
      { path: `${at}.period`, value: role.period },
    );
    // Optional: a short contract entry is a dated line with no prose block.
    if (role.summary !== undefined) {
      fields.push({ path: `${at}.summary`, value: role.summary });
    }
  }

  for (const note of notes) {
    const at = `notes[${note.slug}]`;
    fields.push(
      { path: `${at}.slug`, value: note.slug },
      { path: `${at}.title`, value: note.title },
      { path: `${at}.teaser`, value: note.teaser },
      { path: `${at}.date`, value: note.date },
      { path: `${at}.body`, value: note.body },
    );
  }

  for (const entry of education) {
    const at = `education[${entry.id}]`;
    fields.push(
      { path: `${at}.degree`, value: entry.degree },
      { path: `${at}.institution`, value: entry.institution },
      { path: `${at}.country`, value: entry.country },
      { path: `${at}.period`, value: entry.period },
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

  for (const project of allProjects) {
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

  it("gives every project section a slug unique within its project", () => {
    for (const project of allProjects) {
      const ids = project.sections.map((section) => section.id);
      expect(ids, project.slug).toStrictEqual([...new Set(ids)]);
    }
  });

  it("uses only absolute http(s) or mailto: hrefs", () => {
    const invalid = allLinks().filter((link) => !isAbsoluteOrMailto(link.href));
    expect(invalid).toStrictEqual([]);
  });

  it("has no empty text fields", () => {
    const empty = textFields().filter((field) => field.value.trim() === "");
    expect(empty).toStrictEqual([]);
  });

  it("marks exactly one role as current, and it is the most recent", () => {
    const current = roles.filter(isCurrentRole);
    expect(current).toHaveLength(1);
    expect(current[0]).toBe(roles[0]);
  });

  it("withholds at most one org, and only on the current role", () => {
    // An invariant, so it holds at zero too. That the flag is actually set on
    // one role today is anchored in `page.test.tsx`, which throws if it is not.
    const undisclosed = allRoles.filter((role) => role.undisclosed === true);

    expect(undisclosed.length).toBeLessThanOrEqual(1);
    for (const role of undisclosed) {
      expect(isCurrentRole(role), role.period).toBe(true);
    }
  });

  it("does not treat a closed period as current", () => {
    for (const role of roles.slice(1)) {
      expect(isCurrentRole(role), role.period).toBe(false);
    }
  });

  it("gives every timeline entry a country", () => {
    const countries = [
      ...roles.map((r) => r.country),
      ...education.map((e) => e.country),
    ];
    expect(countries.every((c) => c.trim() !== "")).toBe(true);
    // The four the site claims in the profile summary.
    expect(new Set(countries)).toStrictEqual(
      new Set(["Portugal", "UK", "Germany", "Ukraine"]),
    );
  });

  it("uses only known role kinds", () => {
    for (const role of roles) {
      expect(["engineering", "research"]).toContain(role.kind);
    }
  });

  it("gives every note a unique slug", () => {
    const slugs = notes.map((note) => note.slug);
    expect(slugs).toStrictEqual([...new Set(slugs)]);
  });

  it("dates every note as ISO yyyy-mm-dd with a positive reading time", () => {
    for (const note of notes) {
      expect(note.date, note.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(note.date)), note.slug).toBe(false);
      expect(note.readingMinutes, note.slug).toBeGreaterThan(0);
    }
  });

  it("gives education entries unique ids", () => {
    const ids = education.map((entry) => entry.id);
    expect(ids).toStrictEqual([...new Set(ids)]);
  });

  it("dates every education entry as a year range", () => {
    for (const entry of education) {
      expect(entry.period, entry.id).toMatch(/^\d{4}\u2013\d{4}$/);
    }
  });

  it("points the CV at a same-origin file served from public/", () => {
    // Deliberately outside `profile.links`, which is asserted absolute above.
    expect(profile.cv.href).toMatch(/^\/[\w.-]+\.pdf$/);
  });
});
