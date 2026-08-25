import type { Education } from "./types";

/** Most recent first, dated, and shown in their own Education section. */
export const education = [
  {
    id: "dundee-biomedical-sciences",
    degree: "BSc (Hons) Biomedical Sciences",
    institution: "University of Dundee, Scotland",
    country: "UK",
    period: "2022–2025",
  },
  {
    id: "kyiv-biology",
    degree: "BSc Biology",
    institution: "Taras Shevchenko National University of Kyiv",
    country: "Ukraine",
    period: "2020–2022",
  },
] satisfies readonly Education[];
