import type { Role } from "./types";

/**
 * Five roles, in the order they appear in the legacy index.html #experience
 * section. `org`, `title` and `location` are taken verbatim from that markup.
 *
 * `period` is "TODO" for every role: index.html states no dates anywhere, so
 * there is nothing to derive and nothing may be invented.
 * `location` is "TODO" for the independent role for the same reason.
 */
export const roles = [
  {
    org: "MRC PPU — University of Dundee",
    title: "Research Intern",
    location: "Scotland",
    period: "TODO",
    summary: "TODO",
  },
  {
    org: "NOVA Medical School",
    title: "Research Intern",
    location: "Portugal",
    period: "TODO",
    summary: "TODO",
  },
  {
    org: "Institute of Life Science",
    title: "Research Technician",
    location: "UK",
    period: "TODO",
    summary: "TODO",
  },
  {
    org: "Max Planck Institute",
    title: "Research Intern",
    location: "Germany",
    period: "TODO",
    summary: "TODO",
  },
  {
    org: "Independent",
    title: "Founder & Builder — AI & Longevity Ventures",
    location: "TODO",
    period: "TODO",
    summary: "TODO",
  },
] satisfies readonly Role[];
