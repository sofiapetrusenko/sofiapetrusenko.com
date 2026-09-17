import type { Profile } from "./types";

export const profile = {
  name: "Sofia Petrusenko",
  headline: "Scientist studying ageing. Engineer building LLM systems.",
  summary:
    "I work at the intersection of ageing biology and applied AI. Research training in autophagy, proteostasis and longevity across the UK, Portugal, Germany and Ukraine — now building production LLM systems end-to-end: orchestration pipelines, retrieval-based memory, deployment.",
  location: "Cascais, Portugal",
  /** What's in flight now, rendered as a shell-prompt line under the location. */
  now: "building my company · lifespan-extract & blotquant on the side · learning português",
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
  /**
   * Served from `public/`. Kept, with the PDF, while the hero's CV pill is
   * hidden — see `Hero.tsx`.
   *
   * TODO: not linked anywhere on the site while the CV still reflects
   * job-seeker positioning. Restore the hero pill once the CV is updated.
   */
  cv: { label: "CV (PDF)", href: "/Sofia_Petrusenko_CV.pdf" },
} satisfies Profile;
