import type { Profile } from "./types";

export const profile = {
  name: "Sofia Petrusenko",
  headline: "Scientist studying ageing. Engineer building LLM systems.",
  summary:
    "Research training in ageing biology — autophagy, proteostasis and longevity — across the UK, Portugal, Germany and Ukraine. Today I apply the same experimental discipline to markets: high-frequency data pipelines, reconciliation across inconsistent sources, and probabilistic modelling of how prices are formed — measured, tested and running in production.",
  location: "Cascais, Portugal",
  availability:
    "Hiring early. Engineers and operators who'd rather build than wait — say hello.",
  email: "sofia.petrusenko988@gmail.com",
  links: [
    { label: "GitHub", href: "https://github.com/sofiapetrusenko" },
    {
      label: "LinkedIn",
      href: "https://www.linkedin.com/in/sofia-petrusenko-187810256",
    },
    { label: "Email", href: "mailto:sofia.petrusenko988@gmail.com" },
  ],
  /** Served from `public/`; the hero appends it to the link pills. */
  cv: { label: "CV (PDF)", href: "/Sofia_Petrusenko_CV.pdf" },
} satisfies Profile;
