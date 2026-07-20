// Single source of truth for the pinned ocf-validator commit used by the
// browser playground and by scripts/build-adoc.mjs (which fetches
// shared/error-codes.json from the same commit at build time).
//
// ocf-validator is not published to npm/PyPI (see docs/RELEASING.md in that
// repo), so the docs site pins an exact commit SHA and serves the committed
// browser bundle via the jsDelivr GitHub-file CDN instead.
//
// This is a plain .mjs (not .ts) so it can be imported both by Astro pages
// (via Vite) and directly by scripts/build-adoc.mjs, which runs under plain
// `node` with no TypeScript loader configured.
export const OCF_VALIDATOR_COMMIT = '93e8e286d5972ce82bf8935acb9ccae21018dc5e';

const JSDELIVR_BASE = `https://cdn.jsdelivr.net/gh/opencoachingformat/ocf-validator@${OCF_VALIDATOR_COMMIT}`;

export const OCF_VALIDATOR_BROWSER_URL = `${JSDELIVR_BASE}/packages/ts/dist/browser/browser.js`;
export const OCF_ERROR_CODES_URL = `${JSDELIVR_BASE}/shared/error-codes.json`;
