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
  redirects: {
    '/spec': '/docs/spec',
    '/schema': '/docs/schema',
  },
});
