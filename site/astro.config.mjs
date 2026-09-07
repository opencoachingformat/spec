import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// SITE_BASE_PATH lets the v2-preview deploy build under a subpath
// (e.g. "/v2-preview") without touching the main site's build, which
// always serves from root ("/"). Unset/empty means root, same as before.
const base = process.env.SITE_BASE_PATH || '/';
const site = `https://opencoachingformat.org${base === '/' ? '' : base}`;

export default defineConfig({
  site,
  base,
  outDir: './dist',
  integrations: [sitemap()],
  // /spec and /schema redirect via src/pages/spec.astro and schema.astro
  // (Astro.redirect + withBase), not this config's own `redirects` option:
  // that option always emits an unprefixed target URL, which breaks under
  // a non-root `base` (see the /v2-preview investigation).
});
