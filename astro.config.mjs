// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: process.env.REPL_SLUG ? `https://${process.env.REPLIT_DEV_DOMAIN}` : undefined,
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
