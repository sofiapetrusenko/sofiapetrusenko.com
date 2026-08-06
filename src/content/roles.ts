import type { Role } from "./types";

/** Research roles, most recent first. Values taken from the CV. */
export const roles = [
  {
    org: "MRC PPU, School of Life Sciences",
    title: "Research Intern",
    location: "Dundee, Scotland, UK",
    period: "09/2024 – 01/2025",
    summary:
      "Investigated stress-induced protein phosphorylation in Saccharomyces cerevisiae and its relationship to longevity. Analysed experimental datasets in R and Python; contributed to a manuscript on the implications for ageing mechanisms.",
  },
  {
    org: "NOVA Medical School",
    title: "Research Intern",
    location: "Lisbon, Portugal",
    period: "06/2023 – 08/2023",
    summary:
      "Studied proteostasis and molecular mechanisms of ageing relevant to neurodegeneration and retinal disease, working with cellular models from yeast to human cells and brain and retinal organoids.",
  },
  {
    org: "Institute of Life Sciences",
    title: "Research Technician",
    location: "UK",
    period: "05/2022 – 09/2022",
    summary:
      "Investigated autophagy signalling and its alteration during ageing, in cancer, neurodegeneration and diabetes, including work on autophagy in immunity and pathogenic infection.",
  },
  {
    org: "Max Planck Institute of Animal Behaviour",
    title: "Research Intern",
    location: "Konstanz, Germany",
    period: "03/2022 – 05/2022",
    summary:
      "Researched collective animal behaviour and social influence across biological systems, working across experimental and theoretical approaches.",
  },
] satisfies readonly Role[];
