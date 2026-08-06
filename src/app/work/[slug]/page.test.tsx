import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { projects } from "@/content";
import ProjectPage, { generateMetadata, generateStaticParams } from "./page";

const [first] = projects;
if (!first) throw new Error("projects fixture is empty");

/** The page is an async server component: await it, then render the tree. */
async function renderProject(slug: string) {
  return render(await ProjectPage({ params: Promise.resolve({ slug }) }));
}

describe("generateStaticParams", () => {
  it("emits one param per project", () => {
    expect(generateStaticParams()).toStrictEqual(
      projects.map((project) => ({ slug: project.slug })),
    );
  });
});

describe("ProjectPage", () => {
  it("renders the project's content", async () => {
    await renderProject(first.slug);

    expect(
      screen.getByRole("heading", { level: 1, name: first.name }),
    ).toBeInTheDocument();
    expect(screen.getByText(first.tagline)).toBeInTheDocument();
    expect(screen.getByText(first.problem)).toBeInTheDocument();
    expect(screen.getByText(first.approach)).toBeInTheDocument();
    expect(screen.getByText(first.year)).toBeInTheDocument();

    for (const entry of first.stack) {
      expect(screen.getByText(entry)).toBeInTheDocument();
    }
  });

  it("links back to the home page", async () => {
    await renderProject(first.slug);

    expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("omits the links section entirely when a project has none", async () => {
    const bare = projects.find((project) => project.links.length === 0);
    if (!bare) throw new Error("expected a project with no links");

    await renderProject(bare.slug);

    expect(
      screen.queryByRole("heading", { name: /^links$/i }),
    ).not.toBeInTheDocument();
  });

  it("404s on an unknown slug", async () => {
    // Assert the digest, not just "it threw" — any unrelated error would
    // otherwise satisfy this test.
    await expect(renderProject("no-such-project")).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });

  it("returns no metadata for an unknown slug", async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: "nope" }) }),
    ).resolves.toStrictEqual({});
  });
});
