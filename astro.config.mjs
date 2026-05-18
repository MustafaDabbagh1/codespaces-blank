// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  site: 'https://ppdtechnology.com',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  // Disable Astro's built-in cross-origin POST check. Behind Replit's edge
  // proxy the upstream Host header is rewritten to the internal address
  // (e.g. 169.254.8.1:5000), so Astro's same-origin compare always fails
  // and rejects legitimate form submissions with 403 "Cross-site POST form
  // submissions are forbidden". `/api/lead` has its own honeypot protection.
  security: {
    checkOrigin: false,
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
  },
  vite: {
    server: {
      allowedHosts: true,
    },
  },
});
