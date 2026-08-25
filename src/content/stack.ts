/**
 * What kind of thing each stack entry is. The content layer classifies; the
 * component decides what colour a category gets. An unknown entry returns null
 * and is rendered neutrally rather than guessing a colour it might not mean.
 */
export type StackCategory = "language" | "infra" | "media";

const CATEGORIES: Readonly<Record<string, StackCategory>> = {
  // Languages, frameworks and runtimes — the code layer.
  Python: "language",
  TypeScript: "language",
  FastAPI: "language",
  "Next.js": "language",

  // Data stores and the infrastructure that moves work between them.
  PostgreSQL: "infra",
  "Redis + RQ": "infra",
  Docker: "infra",
  "Markdown knowledge base": "infra",
  "PubMed / bioRxiv APIs": "infra",
  pytest: "infra",

  // Media, numerical and imaging libraries.
  ffmpeg: "media",
  "LLM APIs": "media",
  "retrieval / RAG": "media",
  "OpenCV / scikit-image": "media",
  "NumPy / SciPy": "media",
};

export function stackCategory(entry: string): StackCategory | null {
  return CATEGORIES[entry] ?? null;
}
