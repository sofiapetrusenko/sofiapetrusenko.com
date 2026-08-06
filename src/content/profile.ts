import type { Profile } from "./types";

export const profile = {
  name: "Sofia Petrusenko",
  headline:
    "I build and operate LLM systems end-to-end — pipelines, memory, deployment.",
  summary:
    "Biomedical scientist turned engineer. I design and run production systems: LLM orchestration pipelines, retrieval-based memory, async task processing and cloud deployment. Research background in ageing biology across the UK, Portugal, Germany and Ukraine.",
  location: "Cascais, Portugal",
  /** What's in flight now, rendered as a shell-prompt line under the location. */
  now: "building media-automation-platform · learning português",
  email: "sofia.petrusenko988@gmail.com",
  links: [
    { label: "GitHub", href: "https://github.com/sofiapetrusenko" },
    {
      label: "LinkedIn",
      href: "https://www.linkedin.com/in/sofia-petrusenko-187810256",
    },
    { label: "Email", href: "mailto:sofia.petrusenko988@gmail.com" },
  ],
} satisfies Profile;
