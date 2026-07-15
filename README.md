# Astro + Cloudflare website template

A neutral, production-minded starting point for static Astro 7 websites with a Cloudflare Worker scoped to `/api/*`. The homepage is intentionally a small smoke-test surface, not a design system or a finished brand.

## What is included

- Astro 7 static output, Vite through Astro, strictest TypeScript and `@/*` aliases
- Tailwind CSS 4 plus brand tokens and scoped native CSS
- Astro Assets, responsive images, Sharp through Astro, and Astro Fonts
- `astro-icon` with Lucide, Simple Icons for brand marks, and local SVG component support
- Content Collections, sitemap, canonical URLs, Open Graph, Twitter Cards and typed JSON-LD
- Dynamic `robots.txt`, a custom 404, social image, manifest and complete favicon source/set
- Cloudflare Workers Static Assets with Worker-first routing only for `/api/*`
- Secure contact form with Zod, Turnstile Siteverify, origin checks, request limits, honeypot, two rate-limit bindings and Cloudflare Email
- CSP and other security headers, uncached APIs, structured privacy-safe logs, Workers Logs and sampled traces
- Astro check, TypeScript, Workers Vitest, link/anchor checker, Playwright, axe and Wrangler dry run
- GitHub quality workflow, Renovate dependency management and instructions for Cloudflare Workers Builds

React, Vue, Nuxt, component libraries, a CMS, D1, KV, R2, Queues and PWA support are deliberately absent.

## Start a new site

1. Copy this repository and rename the package and Worker in `package.json` and `wrangler.jsonc`.
2. Run `npm install` and `npm run wrangler:types`.
3. Update `src/data/site.ts`, the tokens in `src/styles/global.css`, `SITE_URL`, the favicon/social assets and `site.webmanifest`.
4. Replace the neutral pages and components with the project content.
5. Update every `example.com` value and all preview/production variables in `wrangler.jsonc`.
6. Create separate Turnstile widgets for preview and production.
7. Configure Cloudflare Email sender/recipient addresses and set the secret with Wrangler.
8. Run `npm run quality` before the first push.
9. Install Renovate on the GitHub repository and enable the dependency graph and Dependabot alerts.

## Local development

```bash
cp .env.example .env
cp .dev.vars.example .dev.vars
npm install
npm run wrangler:types
npm run dev
```

`npm run dev` serves Astro only. Use `npm run dev:worker` to build and run the full static-assets + `/api/*` Worker surface at `http://localhost:8787`.

The checked-in Turnstile keys are Cloudflare's official test credentials and must never be used in production. `.dev.vars` is ignored by Git.

## Environment and secrets

Build-time values:

```dotenv
SITE_URL=https://example.com
PUBLIC_TURNSTILE_SITE_KEY=your-public-site-key
```

Runtime secrets:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY --env preview
npx wrangler secret put TURNSTILE_SECRET_KEY --env production
```

Runtime non-secret values live in `wrangler.jsonc`: allowed origins, accepted Turnstile hostnames, email addresses, environment name and the explicit rate-limiter failure policy. `TURNSTILE_TEST_MODE` is enabled only for the top-level local environment because Cloudflare's test response intentionally omits production hostname/action values.

## Commands

| Command                     | Purpose                                      |
| --------------------------- | -------------------------------------------- |
| `npm run dev`               | Astro development server                     |
| `npm run dev:worker`        | Build and run the Worker with static assets  |
| `npm run wrangler:types`    | Regenerate binding/runtime types             |
| `npm run build`             | Production Astro build                       |
| `npm run quality`           | Full ordered quality gate                    |
| `npm run deploy:dry-run`    | Validate the Worker bundle without deploying |
| `npm run deploy:preview`    | Deploy the explicit preview environment      |
| `npm run deploy:production` | Deploy the explicit production environment   |

Install the browser once on a new machine with `npx playwright install chromium`.

## Dependency updates

Install the [Mend Renovate GitHub App](https://github.com/apps/renovate) and grant it access only to the repositories that should use this template's update policy.

In **GitHub → Settings → Advanced Security**, enable the dependency graph and Dependabot alerts. Renovate reads those alerts and opens immediate security-fix pull requests. Leave Dependabot version updates and Dependabot security updates disabled to avoid duplicate pull requests.

The root `renovate.json` configuration:

- checks for regular updates early each Monday in the `Europe/Zurich` timezone;
- groups compatible Astro, Cloudflare, styling and quality-tooling updates;
- waits three days before proposing newly published npm releases;
- refreshes `package-lock.json` weekly;
- requires explicit Dependency Dashboard approval before opening major-update pull requests;
- never automerges dependency updates by default;
- lets vulnerability alerts bypass the regular schedule.

Review the Renovate Dependency Dashboard issue after installation. Branch protection and the GitHub quality workflow should be required before merging update pull requests.

## Optional content features

Content Collections are configured but empty. Add Markdown files below `src/content/pages/` and render them only when the site needs structured content.

For MDX:

```bash
npm install @astrojs/mdx
npx astro add mdx
```

For a blog or news feed:

```bash
npm install @astrojs/rss
```

Then create a feed endpoint from real published collection entries. Do not add empty RSS or `llms.txt` files just to satisfy a checklist; both should describe content that truly exists.

## Cloudflare Workers Builds

Connect the GitHub repository in **Cloudflare Dashboard → Compute → Workers & Pages → Import a repository**.

- Production branch: `main`
- Build command: `npm run build`
- Production deploy command: `npx wrangler deploy --env production`
- Non-production deploy command: `npx wrangler versions upload --env preview`
- Enable builds for non-production branches to receive preview URLs and PR comments
- Add `SITE_URL` and `PUBLIC_TURNSTILE_SITE_KEY` as build variables per trigger
- Add `TURNSTILE_SECRET_KEY` as a runtime secret per Worker environment

The GitHub workflow runs quality checks; Cloudflare Workers Builds owns preview and production deployment.

## Security choices to revisit per project

- `RATE_LIMIT_FAILURE_POLICY=closed` rejects form submissions with HTTP 503 if the limiter is unavailable. Change it only after an explicit availability-versus-abuse decision.
- Rate limiting uses both IP and normalized email because this template follows that contract. IP limits can affect people on shared networks, so tune limits from real traffic.
- CSP currently permits the Cloudflare Turnstile script/frame and inline styles required by Astro's emitted font styles. Tighten it with nonces when the final site architecture supports them.
- `Strict-Transport-Security` is enabled without `includeSubDomains` or `preload`. Add them only after every relevant subdomain is HTTPS-ready.

## Primary references

- [Astro deployment on Cloudflare](https://docs.astro.build/en/guides/deploy/cloudflare/)
- [Cloudflare Static Assets routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
- [Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Cloudflare Email Workers API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/)
