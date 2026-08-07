import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { notes } from "@/content";
import NotePage, { generateMetadata, generateStaticParams } from "./page";

const [first] = notes;
if (!first) throw new Error("notes fixture is empty");

/** The page is an async server component: await it, then render the tree. */
async function renderNote(slug: string) {
  return render(await NotePage({ params: Promise.resolve({ slug }) }));
}

describe("generateStaticParams", () => {
  it("emits one param per note", () => {
    expect(generateStaticParams()).toStrictEqual(
      notes.map((note) => ({ slug: note.slug })),
    );
  });
});

describe("NotePage", () => {
  it("renders the note's title, teaser and metadata", async () => {
    await renderNote(first.slug);

    expect(
      screen.getByRole("heading", { level: 1, name: first.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(first.teaser)).toBeInTheDocument();
    expect(screen.getByText(first.date)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`${first.readingMinutes} min read`)),
    ).toBeInTheDocument();
  });

  it("renders the parsed body", async () => {
    await renderNote(first.slug);
    expect(screen.getByText(first.body.trim())).toBeInTheDocument();
  });

  it("links back to the home page", async () => {
    await renderNote(first.slug);

    expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("404s on an unknown slug", async () => {
    // Assert the digest, not just "it threw" — any unrelated error would
    // otherwise satisfy this test.
    await expect(renderNote("no-such-note")).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });

  it("returns no metadata for an unknown slug", async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: "nope" }) }),
    ).resolves.toStrictEqual({});
  });
});
