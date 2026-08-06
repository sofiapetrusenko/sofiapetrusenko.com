import type { Education } from "./types";

/**
 * Both degrees are taken verbatim from the legacy index.html at the repo root,
 * which is the only source here that records them. It carries no dates, so the
 * `Education` type has no `period` field — the timeline renders these without
 * one rather than showing an invented year.
 */
export const education = [
  {
    id: "dundee-biomedical-sciences",
    degree: "BSc Hons Biomedical Sciences",
    institution: "University of Dundee, Scotland",
    country: "UK",
  },
  {
    id: "kyiv-biology",
    degree: "BSc Biology",
    institution: "Taras Shevchenko National University of Kyiv",
    country: "Ukraine",
  },
] satisfies readonly Education[];
