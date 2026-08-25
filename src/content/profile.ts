import type { Profile } from "./types";

export const profile = {
  name: "Sofia Petrusenko",
  headline: "Scientist studying ageing. Engineer building LLM systems.",
  summary:
    "I work at the intersection of ageing biology and applied AI. Research training in autophagy, proteostasis and longevity across the UK, Portugal, Germany and Ukraine — now building production LLM systems end-to-end: orchestration pipelines, retrieval-based memory, deployment.",
  location: "Cascais, Portugal",
  /** What's in flight now, rendered as a shell-prompt line under the location. */
  now: "building lifespan-extract & blotquant · shipping longevity × LLM tooling · learning português",
  availability:
    "Open to remote roles (EU): research / AI engineering in longevity, healthtech and scientific tooling.",
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
