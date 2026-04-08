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
- `customer-support.astro` - Support center (uses `is:global` styles)
- `refer.astro` - Referral program
- `become-a-partner.astro` - Partner application

### Industry Pages
- `retail.astro` - Retail solutions
- `restaurants.astro` - Restaurant POS (warm orange brand)
- `healthcare.astro` - Healthcare payments
- `ecommerce.astro` - E-commerce payments (dark theme throughout)
- `non-profits.astro` - Non-profit solutions (rose accent)
- `higher-education.astro` - Education payments (purple accent)
- `contractors.astro` - Contractor solutions (uses `is:global` styles, yellow accent)
- `repair.astro` - Repair shop management SaaS landing page (`rp-*` CSS prefix). Interactive 4-tab demo (Tickets, POS, Inventory, Employees), dashboard hero visual, 8 industry cards, comparison table, $30/month pricing card, and lead capture modal form (client-side only). Green accent (`#10B981`).

### Product Pages
- `clover.astro` - Clover devices
- `vp-800.astro` - VP800 POS terminal
- `pays-pos.astro` - Pays POS restaurant system (warm orange brand)
- `korona.astro` - Korona POS (warm orange brand)
- `mx-build.astro` - MX Build for contractors
- `passport-banking.astro` - Banking/treasury platform

## Important Notes

- `contractors.astro` and `customer-support.astro` use `<style is:global>` which sets `:root` CSS variables — these must stay aligned with the design system to avoid conflicts
- All hero sections use the consistent dark navy gradient pattern
- Brand-specific pages (restaurants, korona, pays-pos) keep their warm orange accents

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
