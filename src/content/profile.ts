import type { Profile } from "./types";

/**
 * Structural values (name, email, links) are taken verbatim from the legacy
 * index.html at the repo root. Prose fields are "TODO" pending real copy.
 *
 * `location` is "TODO" because index.html never states one.
 */
export const profile = {
  name: "Sofia Petrusenko",
  headline: "TODO",
  summary: "TODO",
  location: "TODO",
  email: "sofia.petrusenko988@gmail.com",
  links: [
    { label: "Email", href: "mailto:sofia.petrusenko988@gmail.com" },
    {
      label: "LinkedIn",
      href: "https://linkedin.com/in/sofia-petrusenko-187810256",
    },
    { label: "Instagram", href: "https://instagram.com/s0fiichka" },
  ],
} satisfies Profile;
