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

## Design System

### Color Tokens
- `--navy: #060E21` (primary background)
- `--navy-2: #0C1A38` (secondary background)
- `--blue: #1549FF` (primary brand blue)
- `--blue-mid: #2D60FF` (lighter blue for gradients)
- `--cyan: #00CFFF` (accent cyan)
- `--green: #00E5A0` (accent green)
- `--surface: #F5F8FF` (light background)

### Button Pattern
- Primary: `linear-gradient(135deg, #2D60FF, #1549FF)` with `box-shadow: 0 8px 28px rgba(21,73,255,.35)`
- Hover: lift with stronger shadow

### Hero Pattern
- Dark navy background with radial gradient blue/cyan accents
- SVG dot grid overlay (`::before` pseudo-element)
- Consistent across all pages

### Industry-Specific Accents
- **Restaurants/Korona/Pays POS:** Warm orange (`#ff6a00`)
- **Contractors:** Yellow (`#ffc83a`)
- **Signup:** Green (`#0BA360`)
- **Non-profits:** Rose/pink (`#e11d48`)
- **Higher Education:** Purple (`#5b21b6`)
- **Healthcare:** Teal/cyan (`#06B6D4`)

## Project Structure

```
src/
  components/   - Reusable UI components (Header, Footer)
  layouts/      - Base layout (BaseLayout.astro) with full design system
  pages/        - Route pages (.astro files)
public/
  images/       - Product and marketing images
```

## Pages

### Core Pages
- `index.astro` - Homepage with animated terminal, marquee, features, solutions
- `contact.astro` - Contact form with scheduling
- `signup.astro` - Merchant signup form
- `customer-support.astro` - Support center (redesigned, uses `is:global` styles scoped under `.cs-page`). Premium layout: hero with 3 clickable support option cards + "All systems operational" indicator, Service Health status dashboard (3 status cards), ticket form (2-column layout) with Popular Help Topics sidebar (5 clickable topic cards) and Call Support card (dark navy panel with phone/hours), expandable FAQ accordion, and "Still need help?" CTA bar. Uses `cs-*` CSS prefix.
- `refer.astro` - Referral program
- `become-a-partner.astro` - Partner program landing page (redesigned). Streamlined 8-section architecture: Hero with dashboard preview panel, interactive Quick Compare table (contenteditable cells), "Why Partners Switch" value cards (dark section), 3-tier Program Tiers (Referral/Sales/ISO with "Most Popular" badge), Tools & Support grid, Testimonials, FAQ (expandable), Partner Kit downloads, Calendar booking embed, and application form. Uses `pp-*` CSS prefix, scoped styles. All sections use `reveal` intersection observer animation. Print styles for compare table.
- `iso.astro` - ISO Solutions landing page. Premium SaaS/fintech page targeting ISOs who want custom software. 8-section layout: Hero with "ISO Command Center" dashboard mockup (stats, portfolio chart, AI insights panel), "Generic vs Future-Ready ISO" comparison cards, "Three Pillars" product cards (Vertical Software, ISO CRM, Websites) with embedded mini-dashboard previews, 6-tab interactive demo showcase (Repair, Restaurant POS, ISO CRM, Onboarding & Risk, Agent Portal, AI Sales Assistant) with realistic data tables and stats, AI Features grid (8 capabilities), Vertical Domination cards (6 industries), "Why This Matters" numbered benefits grid (8 cards), and final CTA. Scoped `<style>`, `iso-*` CSS prefix, intersection observer animations. Navigation: between Partner Program and Customer Support.

### Industry Pages
- `retail.astro` - Retail solutions
- `restaurants.astro` - Restaurant POS & Online Ordering (redesigned, dark navy/blue/cyan design system). Premium SaaS layout: Hero with "PPD Restaurant — Dashboard" mockup (revenue/orders/tips KPIs, live orders, floating QR Pay and Online Order cards), metrics bar (4 stat cards), 6 icon-based feature cards (no external images), interactive menu experience (3 food items with real-time modifier pricing using semantic `<button>` elements with `aria-pressed`), live KDS simulation (tickets auto-advance New→Prep→Expo→Ready with color-coded columns), 6 hardware cards (icon-based), testimonials, CTA band, and demo modal (Formspree, focus trap, accessible form labels). Uses `rest-` CSS prefix, scoped styles. No neocities.org links.
- `healthcare.astro` - Healthcare payments
- `ecommerce.astro` - E-commerce payments (dark theme throughout)
- `non-profits.astro` - Non-profit solutions (rose accent)
- `higher-education.astro` - Education payments (purple accent)
- `contractors.astro` - Contractor solutions (uses `is:global` styles, yellow accent)
- `repair.astro` - PPD Repair SaaS product landing page (`rp-*` CSS prefix). Branded as "PPD Repair" throughout. Hero with layered dashboard mockup + 4 floating cards (POS, inventory, customer, payment). Industries section placed early (8 repair types). Centerpiece: 6-step guided interactive workflow demo (Check In → Assign Tech → Add Parts → Take Deposit → Notify Customer → Final Payment) with stepper, prev/next nav, animated transitions, and realistic software UI panels. **Core Modules showcase**: interactive 5-tab product demo (POS, Inventory, Team & Stores, Devices, Reporting) with two-column layout (mini demo panel + info/bullets); CSS in `src/styles/repair-modules.css` (imported, unscoped). Side-by-side "Why Switch" comparison, $30/month pricing card, premium CTA, and lead capture modal with PPDrepair logo, focus trap/restore, Esc-to-close (client-side only). Full ARIA tablist + roving tabindex + keyboard nav on both workflow stepper and module tabs. Scoped `<style>` and `<script>` (no `is:global`).

### Product Pages
- `merchant.astro` - PPD Merchant product landing page. Modern payments & merchant management platform. 6-section layout: Hero with "PPD Merchant Center" dashboard mockup (volume/transactions/approval stats, 7-day chart, operational panel), "Who It's For" value cards (6 cards: Keyed Payments, ACH/Billing, CRM, Shop Orders, Agreements, SPIn Devices), 5-tab interactive demo showcase (Dashboard, Shop Orders, Recurring Billing, Customers & Agents with CRM sub-tabs, Agreements & E-Sign) with realistic data tables/KPIs/charts, Gateway Infrastructure section (feature checklist + gateway diagram), "Why Choose" benefits grid (6 cards), and CTA. Uses `pm-*` CSS prefix, scoped styles. Intersection observer scroll animations. Navigation: Products dropdown in Header.astro and BaseLayout.astro.
- `clover.astro` - Clover devices
- `vp-800.astro` - VP800 POS terminal
- `pays-pos.astro` - Pays POS restaurant system (warm orange brand)
- `korona.astro` - Korona POS (warm orange brand)
- `mx-build.astro` - MX Build for contractors
- `passport-banking.astro` - Banking/treasury platform

## Important Notes

- `contractors.astro` and `customer-support.astro` use `<style is:global>` which sets `:root` CSS variables — these must stay aligned with the design system to avoid conflicts
- All hero sections use the consistent dark navy gradient pattern
- Brand-specific pages (korona, pays-pos) keep their warm orange accents

## Development

```bash
npm run dev      # Start dev server on port 5000
npm run build    # Build for production (output: dist/)
npm run preview  # Preview production build
```

## Deployment

Configured as a **static** site deployment:
- Build command: `npm run build`
- Public directory: `dist/`

## Replit Configuration

- Dev server runs on `0.0.0.0:5000`
- All hosts allowed (for Replit proxy)
- Workflow: "Start application" → `npm run dev`
