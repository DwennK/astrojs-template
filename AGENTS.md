# Project instructions

This repository is a reusable Astro 7 + Cloudflare Workers website template. Preserve the baseline unless a project brief explicitly replaces it.

## Core architecture

- Keep Astro output static. Do not add an SSR adapter unless the project genuinely requires on-demand rendering.
- Keep client JavaScript opt-in and small. Prefer `.astro`, HTML and CSS before adding a UI framework.
- Keep `@/*` mapped to `src/*` and preserve the strictest TypeScript settings.
- Use Tailwind CSS 4 for utilities and native scoped CSS for complex composition and animation.
- Change brand values in `src/data/site.ts` and the CSS custom properties in `src/styles/global.css` before spreading brand literals through components.
- Store optimizable images in `src/assets/` and render them with Astro Assets. Store only passthrough files in `public/`.
- Use Lucide icons for interface symbols, Simple Icons only for real brand marks, and `src/icons/` for project-owned SVGs.

## Content and SEO

- Every indexable page must provide a unique title, description and canonical URL through `BaseLayout.astro`.
- Add the most specific truthful `schema-dts` JSON-LD type that fits the page. Do not fabricate ratings, reviews, people, locations or business claims.
- Keep one logical `h1`, meaningful landmarks, visible focus styles and reduced-motion support.
- Add MDX and RSS only when the project contains content that needs them. Do not add empty blog machinery.
- Update the site URL, robots output, social preview image and favicon set for every new site.

## Cloudflare Worker and forms

- Worker code belongs in `worker/`; only `/api/*` runs Worker-first by default.
- Generate `Env` with `npm run wrangler:types`; never hand-write binding types.
- Never commit production secrets. Use Wrangler secrets and `.dev.vars` locally.
- Preserve method, content type, origin, body-size, field-size, honeypot, Turnstile hostname/action and rate-limit checks for public forms.
- Keep API responses `Cache-Control: no-store`. Return `Retry-After` with HTTP 429.
- Log structured JSON only. Never log message bodies, email addresses, Turnstile tokens, IP addresses or other personal data.
- The rate-limiter failure policy must remain explicit. Default to fail-closed unless the project risk decision documents otherwise.
- Escape untrusted values for both HTML and email headers before sending.

## Quality gate

Run the narrowest relevant check during development and `npm run quality` before handoff. The full order is:

1. format check
2. Astro check
3. TypeScript check
4. Worker tests
5. Wrangler type-drift check
6. production build
7. internal link and anchor check
8. Playwright smoke tests at 1440×900 and 390×844
9. axe accessibility tests
10. Wrangler dry run

For visual work, inspect at least 1440×900. Also inspect 390×844 whenever the surface is responsive or user-facing on mobile. Reuse a healthy browser session when practical.

## Git workflow

- Inspect the actual diff before staging. Other Codex tasks may share this worktree.
- Keep each logical change in its own commit and use partial staging when necessary.
- Write English multi-line commit messages with a concise title, a blank line, and a short explanatory body.
- Do not push until the current logical commits are complete, or until the user explicitly asks.
