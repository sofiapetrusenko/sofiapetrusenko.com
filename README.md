# sofia-site

Personal site for Sofia Petrusenko, built with Next.js (App Router) and
TypeScript in strict mode, styled with Tailwind CSS, and deployed on Vercel.
Page content lives in typed modules under `src/content/` so copy can be edited
without touching layout code, reusable UI lives in `src/components/`, and
static assets such as the CV PDF and the Open Graph image are served from
`public/`. Every push and pull request to `main` runs lint, typecheck, tests,
and a production build in CI.

## Requirements

- Node 20
- pnpm 9 (`corepack enable pnpm`)

## Local development

```bash
pnpm install       # install dependencies
pnpm dev           # start the dev server on http://localhost:3000
pnpm lint          # ESLint
pnpm typecheck     # tsc --noEmit
pnpm test          # Vitest (single run)
pnpm test:watch    # Vitest in watch mode
pnpm build         # production build
pnpm start         # serve the production build
pnpm format        # apply Prettier
pnpm format:check  # verify formatting
```

## Layout

```
src/app/         routes, root layout, global styles
src/components/  reusable UI components
src/content/     typed content modules
public/          static assets (CV, OG image)
```
