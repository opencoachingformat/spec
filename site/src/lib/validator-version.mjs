// Single source of truth for the ocf-validator version/commit used by the
// browser playground and by scripts/build-adoc.mjs (which fetches
// shared/error-codes.json from a pinned commit at build time).
//
// ocf-validator is published as @opencoachingformat/validator on npm, so the
// browser bundle itself is served from jsDelivr's npm CDN, pinned to an
// exact published version (bump OCF_VALIDATOR_VERSION on each release this
// site should pick up).
//
// shared/error-codes.json is NOT part of the published npm package
// (packages/ts's `files` field is dist-only) — that one file still has to
// come from a pinned git commit via jsDelivr's GitHub-file CDN.
//
// This is a plain .mjs (not .ts) so it can be imported both by Astro pages
// (via Vite) and directly by scripts/build-adoc.mjs, which runs under plain
// `node` with no TypeScript loader configured.
export const OCF_VALIDATOR_VERSION = '0.1.1';

const JSDELIVR_NPM_BASE = `https://cdn.jsdelivr.net/npm/@opencoachingformat/validator@${OCF_VALIDATOR_VERSION}`;

export const OCF_VALIDATOR_BROWSER_URL = `${JSDELIVR_NPM_BASE}/dist/browser/browser.js`;

export const OCF_VALIDATOR_COMMIT = '45a11869cfe170269d53a91890063b9ccc95f5fd';

const JSDELIVR_GH_BASE = `https://cdn.jsdelivr.net/gh/opencoachingformat/ocf-validator@${OCF_VALIDATOR_COMMIT}`;

export const OCF_ERROR_CODES_URL = `${JSDELIVR_GH_BASE}/shared/error-codes.json`;
