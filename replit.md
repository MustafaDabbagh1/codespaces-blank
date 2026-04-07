# PPD Technology Website

A high-performance marketing website for PPD Technology, a payment processing solutions company.

## Tech Stack

- **Framework:** Astro v6.1.0
- **Language:** TypeScript
- **Styling:** CSS with CSS Variables
- **Icons:** Font Awesome 6 (CDN)
- **Fonts:** Google Fonts (Inter)
- **Build Tool:** Vite (via Astro)
- **Package Manager:** npm
- **Node.js:** v22

## Project Structure

```
src/
  components/   - Reusable UI components (Header, Footer)
  layouts/      - Base layout (BaseLayout.astro)
  pages/        - Route pages (.astro files)
public/
  images/       - Product and marketing images
```

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
