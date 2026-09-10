// Pure, testable manifest builder. The release workflow feeds it the existing v*
// schema dirs from gh-pages plus the current release tag, and writes the result
// to dist/schema/versions.json.
// Matches X.Y.Z with an optional -prerelease suffix (e.g. "2.0.0-alpha.1").
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

function semverKey(v) {
  const m = v.match(SEMVER_RE);
  const [, major, minor, patch, prerelease] = m;
  return [Number(major), Number(minor), Number(patch), prerelease ?? null];
}
function cmp(a, b) {
  const [aMaj, aMin, aPatch, aPre] = semverKey(a);
  const [bMaj, bMin, bPatch, bPre] = semverKey(b);
  if (aMaj !== bMaj) return aMaj - bMaj;
  if (aMin !== bMin) return aMin - bMin;
  if (aPatch !== bPatch) return aPatch - bPatch;
  // A pre-release (e.g. "2.0.0-alpha.1") sorts BEFORE its final release
  // ("2.0.0") per SemVer precedence rules; between two pre-releases, compare
  // the suffix as a plain string (sufficient for this project's own
  // "alpha.N" convention — not a full SemVer pre-release precedence parser).
  if (aPre === bPre) return 0;
  if (aPre === null) return 1;
  if (bPre === null) return -1;
  return aPre < bPre ? -1 : 1;
}

export function buildVersionsManifest({ existing, current }) {
  const all = [...existing, current]
    .map((t) => t.replace(/^v/, ""))
    .filter((v) => SEMVER_RE.test(v));
  const unique = [...new Set(all)].sort(cmp);
  const latest = unique[unique.length - 1];
  const major = "v" + semverKey(latest)[0];
  return { latest, major, versions: unique, schema_url: `https://opencoachingformat.org/schema/${major}.json` };
}

// CLI: node build-versions-manifest.mjs "<space-separated existing v* dirs>" <current tag>
const invokedDirectly = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  const existing = (process.argv[2] || "").split(/\s+/).filter(Boolean);
  const current = process.argv[3];
  process.stdout.write(
    JSON.stringify(buildVersionsManifest({ existing, current }), null, 2) + "\n"
  );
}
