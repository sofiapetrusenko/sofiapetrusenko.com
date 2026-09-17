import type { Role } from "./types";

/** Most recent first. Values taken from the CV. */
export const roles = [
  {
    /* The org name is withheld, so the timeline renders a redaction bar in
       place of it. `undisclosed` is the only flag here that drives rendering;
       everything else is the same shape as any other entry. */
    org: "Name to be announced",
    title: "Founder & CEO",
    location: "Cascais, Portugal (remote)",
    country: "Portugal",
    kind: "engineering",
    period: "2026 – present",
    summary:
      "Building a company from zero to production — product, engineering and go-to-market. Currently in production; name to be announced.",
    undisclosed: true,
  },
  {
    org: "Independent",
    title: "Founder & Engineer — AI Content Automation",
    location: "Cascais, Portugal (remote)",
    country: "Portugal",
    kind: "engineering",
    period: "2025 – 2026",
    summary:
      "Designed, built and operated a full-stack platform for automated media production and distribution: LLM-driven generation pipeline, speech synthesis, video assembly, publishing and analytics, orchestrated through asynchronous background workers.",
  },
  {
    /* A dated line rather than a role write-up: adjacent contract work, kept
       separate from the engineering entry above instead of folded into it. */
    org: "Independent",
    title: "Paid acquisition & performance marketing (contract)",
    location: "Cascais, Portugal (remote)",
    country: "Portugal",
    kind: "engineering",
    period: "2025",
  },
  {
    org: "MRC PPU, School of Life Sciences",
    title: "Research Intern",
    location: "Dundee, Scotland, UK",
    country: "UK",
    kind: "research",
    period: "09/2024 – 01/2025",
    summary:
      "Investigated stress-induced protein phosphorylation in Saccharomyces cerevisiae and its relationship to longevity. Analysed experimental datasets in R and Python; contributed to a manuscript on the implications for ageing mechanisms.",
  },
  {
    org: "NOVA Medical School",
    title: "Research Intern",
    location: "Lisbon, Portugal",
    country: "Portugal",
    kind: "research",
    period: "06/2023 – 08/2023",
    summary:
      "Studied proteostasis and molecular mechanisms of ageing relevant to neurodegeneration and retinal disease, working with cellular models from yeast to human cells and brain and retinal organoids.",
  },
  {
    org: "Institute of Life Sciences",
    title: "Research Technician",
    location: "UK",
    country: "UK",
    kind: "research",
    period: "05/2022 – 09/2022",
    summary:
      "Investigated autophagy signalling and its alteration during ageing, in cancer, neurodegeneration and diabetes, including work on autophagy in immunity and pathogenic infection.",
  },
  {
    org: "Max Planck Institute of Animal Behaviour",
    title: "Research Intern",
    location: "Konstanz, Germany",
    country: "Germany",
    kind: "research",
    period: "03/2022 – 05/2022",
    summary:
      "Researched collective animal behaviour and social influence across biological systems, working across experimental and theoretical approaches.",
  },
] satisfies readonly Role[];

/**
 * The ongoing role, derived from the period rather than a separate flag so the
 * two can never drift apart.
 */
export function isCurrentRole(role: Role): boolean {
  return /present/i.test(role.period);
}
