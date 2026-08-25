// Pinned ocf-renderer commit for the browser playground.
//
// ocf-renderer is not published to npm, so the docs site clones the
// repository at this exact commit, runs `npm run build:browser`, and
// copies the resulting ESM bundle into site/src/generated/renderer/.
//
// This is a plain .mjs (not .ts) so it can be imported both by Astro
// pages (via Vite) and directly by scripts/build-renderer.mjs under
// plain Node with no TypeScript loader.
export const OCF_RENDERER_REPOSITORY = 'opencoachingformat/ocf-renderer';
export const OCF_RENDERER_COMMIT = '32f25cc6176c63af6e7f9a59bca3352e4e577949';
export const OCF_RENDERER_SHORT_SHA = OCF_RENDERER_COMMIT.slice(0, 7);
