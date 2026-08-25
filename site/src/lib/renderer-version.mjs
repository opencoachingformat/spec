// Single source of truth for the ocf-renderer version used by the browser
// playground.
//
// ocf-renderer is published as @opencoachingformat/renderer on npm, so the
// browser bundle is fetched from jsDelivr's npm CDN by
// scripts/build-renderer.mjs (which copies it into
// site/src/generated/renderer/ for Astro/Vite to bundle as a static asset),
// pinned to an exact published version — bump OCF_RENDERER_VERSION on each
// release this site should pick up.
//
// This is a plain .mjs (not .ts) so it can be imported both by Astro pages
// (via Vite) and directly by scripts/build-renderer.mjs under plain Node
// with no TypeScript loader.
export const OCF_RENDERER_REPOSITORY = 'opencoachingformat/ocf-renderer';
export const OCF_RENDERER_VERSION = '0.1.0';

const JSDELIVR_NPM_BASE = `https://cdn.jsdelivr.net/npm/@opencoachingformat/renderer@${OCF_RENDERER_VERSION}`;

export const OCF_RENDERER_BROWSER_URL = `${JSDELIVR_NPM_BASE}/dist/browser/index.js`;
