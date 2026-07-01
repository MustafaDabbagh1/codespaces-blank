---
name: Astro scoped CSS vs innerHTML-injected elements
description: Why JS-injected DOM loses styling in Astro scoped <style>, and how to fix it
---

# Astro scoped CSS breaks on innerHTML-injected elements

In an `.astro` file, `<style>` (without `is:global`) is compiled to attribute-scoped
selectors: `.foo li` becomes `.foo[data-astro-cid-XXXX] li[data-astro-cid-XXXX]`.
Only elements the Astro compiler rendered carry that `data-astro-cid-*` attribute.

**Symptom:** A component looks correct on first (server-rendered) paint, then loses all
styling the moment a vanilla-JS tab/handler rebuilds its contents via
`element.innerHTML = '<li>...</li>'`. The injected children have no `data-astro-cid`,
so the scoped child rules never match. A static screenshot check passes; the bug only
shows after a click.

**Why:** Astro scopes both the parent AND child in `.parent child` rules. Injected
children miss the scope attribute.

**How to apply / fixes:**
- Wrap the child selector in `:global()`, keeping the parent scoped:
  `.isv-vert-modules :global(li){...}` compiles to
  `.isv-vert-modules[data-astro-cid-XXX] li{...}` — parent stays scoped, child no longer
  needs the attribute, so injected `<li>` match. Verify by grepping the built CSS in
  `dist/client/_astro/*.css`.
- OR pre-render all panels statically and toggle with the `hidden` attribute instead of
  rebuilding innerHTML (the pattern iso.astro uses for its hero tabs).

Prefer `:global()` for small dynamic lists; prefer static-toggle when SEO/no-JS content
matters. Always click-through verify (e.g. testing subagent), not just a screenshot.
