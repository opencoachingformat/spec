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
// Pinned to the "next" npm dist-tag's version while OCF v2.0.0 is still a
// draft (see ocf-validator's release-ts.yml: a pre-release version like
// this one publishes under "next", never "latest", so this pin is the only
// place that actually points the site at it). Once schema/v2.json and this
// validator both leave alpha, this moves to a real (non-pre-release)
// version again.
export const OCF_VALIDATOR_VERSION = '1.0.0-alpha.1';

const JSDELIVR_NPM_BASE = `https://cdn.jsdelivr.net/npm/@opencoachingformat/validator@${OCF_VALIDATOR_VERSION}`;

export const OCF_VALIDATOR_BROWSER_URL = `${JSDELIVR_NPM_BASE}/dist/browser/browser.js`;

export const OCF_VALIDATOR_COMMIT = 'da9d58247139723e5e6e7622bdba983c5f9c1715';

const JSDELIVR_GH_BASE = `https://cdn.jsdelivr.net/gh/opencoachingformat/ocf-validator@${OCF_VALIDATOR_COMMIT}`;

export const OCF_ERROR_CODES_URL = `${JSDELIVR_GH_BASE}/shared/error-codes.json`;

// arc42 architecture docs live in the same ocf-validator repo, under
// docs/arc42/*.md, but they are NOT part of the published npm package and can
// be re-pinned independently of the validator bundle — so they get their own
// commit pin (identical value today, deliberately separate). build-arc42.mjs
// fetches each section file from this base via jsDelivr's GitHub-file CDN.
export const OCF_ARC42_COMMIT = 'da9d58247139723e5e6e7622bdba983c5f9c1715';

export const OCF_ARC42_BASE_URL = `https://cdn.jsdelivr.net/gh/opencoachingformat/ocf-validator@${OCF_ARC42_COMMIT}/docs/arc42`;
