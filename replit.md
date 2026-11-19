# PPD Technology Website

A high-performance marketing website for PPD Technology, a payment processing solutions company. Redesigned with a modern, premium fintech/SaaS aesthetic.

## Tech Stack

- **Framework:** Astro v6.1.0
- **Language:** TypeScript
- **Styling:** CSS with CSS Variables (design system tokens)
- **Icons:** Font Awesome 6 (CDN)
- **Fonts:** Google Fonts (Inter)
- **Build Tool:** Vite (via Astro)
- **Package Manager:** npm
- **Node.js:** v22

## Site structure (rebuilt November 2026)

The site speaks to two audiences: merchants who want PPD's products and processing, and
payment sales agents PPD wants to recruit ("not just your ISO, your tech and branding partner").

### Layout

- `src/layouts/SiteLayout.astro` + `src/styles/site.css` — the design system (deep navy, a quiet
  star field, PPD blue and cyan, one accent per product or industry). Fonts are self-hosted via
  Fontsource (Bricolage Grotesque for display, Geist for text, Geist Mono for labels). Every page
  uses this layout; the old BaseLayout is gone.

### Shared pieces

- `src/data/site.ts` — single source of truth for products, hardware lineup, industries, partner
  links, login portals and company contact facts. Header, footer and pages read from it.
- `src/components/SiteHeader.astro`, `SiteFooter.astro` — self-contained global header (four
  links, a Log in menu for the customer portals, mobile sheet) and footer. The header is
  transparent over the hero and becomes a floating bar on scroll.
- `src/components/Landing.astro` — template for the industry pages and the hardware / partner
  software pages: typographic hero, optional scroll-lit statement, a plain numbered list,
  optional demo, gear grid, pricing, questions and one form. `FormExtras.astro` adds the
  optional city / time / topics inputs the old forms had.
- `src/components/Icon.astro` — inline stroke icons for the new pages (no icon font).
- `src/components/LeadForm.astro` — form wrapper for `/api/lead` (honeypot, optional Turnstile,
  fetch submit, redirect to `/thank-you`).
- `src/components/ProductPage.astro` — template for the four PPD-built product pages.
- `src/scripts/stepper.ts` — the small state machine behind every animation. Markup declares
  `data-stepper`, `data-durations`, and elements with `data-from` / `data-to`; CSS does the rest.
  Animations run only while on screen, can be paused, and rest on a static frame when the visitor
  prefers reduced motion.

### Animated demos

- `src/components/demos/` — `ForgeDemo` (a sale on the register + customer display), `RepairDemo`
  (one ticket across the command board), `MerchantDemo` (invoice sent, paid, books updated),
  `RewardsDemo` (volume to reward to redemption). All figures are sample data and labelled so.
- `src/components/agents/` — `BrandStudio` (types example agency names by itself, then lets the
  visitor type their own and see it on software, a website and a CRM), `LevelUp` (the four-level
  path), and `PitchDuel` (rate-sheet pitch vs software pitch).
- `src/components/Intro.astro` — the entrance sequence (light streaks, an "Authorizing 000 → 100"
  counter, "Approved", then the page). Plays once per browser session, skips on any key, click or
  scroll, and never plays with reduced motion. The decision is made by the inline script in
  SiteLayout's `<head>`; headline lines marked `.rise` / `.fade-up` wait for `html.is-ready`.
- Demos take `captions="list"` (step list beside the stage, used on product pages) or
  `captions="line"` (one-line caption under the stage, used on the homepage and `/products`).

### Pages

- `/` — dual-audience homepage, deliberately sparse: hero (headline, one sentence, two buttons,
  the four products orbiting the PPD chip), a scroll-lit statement, the four product demos,
  a short processing band, the agent brand studio, industries, closing CTA.
- `/agents` — the agent program. `/become-a-partner` 301-redirects here. Application form posts
  `_form=become-a-partner`; the Google Calendar scheduler loads on click.
- `/products` — the lineup: four product demos plus hardware and partner software (`#lineup`).
- `/forge`, `/repair`, `/merchant`, `/products/ppd-rewards` — PPD-built product pages
  (`ProductPage.astro`). Copy, pricing and sample data follow the four product sites.
- Industries (`Landing.astro`): `/restaurants` (with `KdsDemo`), `/retail` (Forge demo),
  `/ecommerce`, `/healthcare` (Merchant demo), `/contractors`, `/non-profits`,
  `/higher-education`.
- Hardware and partner software (`Landing.astro`): `/clover`, `/korona`, `/vp-800`,
  `/pays-pos`, `/mx-build`, `/passport-banking`.
- Partners: `/iso`, `/isv-solutions` (with the revenue estimator), `/refer`.
- Getting started: `/rate-review`, `/cash-discount`, `/contact` (message form plus a simple
  request-a-call form), `/customer-support` (ticket form, portal logins, questions).
- `/signup` — the six-step merchant application. Its form markup, validation and submission are
  unchanged from the previous site; it was re-skinned onto SiteLayout and still loads Font
  Awesome from cdnjs for its icons. Security wording now says only what is true (HTTPS in
  transit).
- `/pays-purchase` redirects to `/pays-pos#demo`: the old checkout there was never connected to
  a payment provider.
- `/thank-you`, 404.

Lead forms keep the `_form` tags the old pages used (`restaurants-demo`, `healthcare-demo`,
`contractors-demo`, `clover-pricing`, `korona-demo`, `vp-800-demo`, `pays-pos-demo`,
`mx-build-demo`, `refer-program`, `rate-review`, `contact-message`, `contact-call-request`,
`customer-support`, `merchant-signup`), so notification emails are labelled as before.

Claims the old pages made without a source (uptime percentages, "24/7 support", "HIPAA
compliant", "PCI Level 1 certified", customer counts, testimonials, competitor price
comparisons) were left out of the rebuilt pages. Add them back only with something to cite.

## Backend / API

- `src/pages/api/lead.ts` — server endpoint handling all lead form submissions via Resend.

## Important Notes

- Do not put `overflow-x: hidden` on `body` in the new layout: it must stay on `html`, or the
  sticky header and the mobile-menu scroll lock break.
- In SiteLayout, `main` is pulled up under the transparent header, so every page hero must start
  with `padding-top: var(--hero-top)`.
- Product facts come from the product sites. When a price or feature changes
  there, update `src/data/site.ts` and the matching product page.

## Development

```bash
npm run dev      # Start dev server on port 5000
npm run build    # Build for production (output: dist/)
npm run preview  # Preview production build
```

## Deployment

Server-rendered Astro app (`output: 'server'`, `@astrojs/node` standalone):
- Build command: `npm run build`
- Start command: `node ./dist/server/entry.mjs`

## Replit Configuration

- Dev server runs on `0.0.0.0:5000`
- All hosts allowed (for Replit proxy)
- Workflow: "Start application" → `npm run dev`

## Environment Variables

- `RESEND_API_KEY`, `LEAD_TO_EMAIL`, `LEAD_FROM_EMAIL` — required for `/api/lead` to send emails via Resend.
- `LEAD_ALLOWED_HOSTS` — optional comma-separated allowlist of Origin/Referer hosts for `/api/lead` (defaults to `ppdtechnology.com`).
- `PUBLIC_TURNSTILE_SITE_KEY` — Cloudflare Turnstile site key (exposed to the browser). When set, SiteLayout loads the Turnstile script and lead forms render the widget.
- `TURNSTILE_SECRET_KEY` — reserved for server-side Turnstile verification. `/api/lead` in this repo does not verify the token yet; the widget only renders when the site key is set.
