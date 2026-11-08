import type { Profile } from "./types";

export const profile = {
  name: "Sofia Petrusenko",
  headline: "Scientist studying ageing. Engineer building LLM systems.",
  summary:
    "Research training in ageing biology across the UK, Portugal, Germany and Ukraine, focused on autophagy, proteostasis and longevity. Now I build across the frontier model stack, from partnerships with model providers down to the infrastructure production AI runs on: multi-model orchestration, cost-aware routing and observability at the inference layer.",
  location: "Cascais, Portugal",
  availability:
    "Trading notes with AI engineers and builders who'd rather ship than speculate. Say hello.",
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
   * Not public: the PDF is no longer served, so the hero pill asks for it by
   * email instead. The hero appends it to the link pills.
   */
  cv: {
    label: "CV (on request)",
    href: "mailto:sofia.petrusenko988@gmail.com?subject=CV%20request",
  },
} satisfies Profile;
