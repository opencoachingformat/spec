// Pure, testable manifest builder. The release workflow feeds it the existing v*
// schema dirs from gh-pages plus the current release tag, and writes the result
// to dist/schema/versions.json.
const SCHEMA_URL = "https://opencoachingformat.org/schema/v1.json";

function semverKey(v) {
  return v.split(".").map((n) => parseInt(n, 10));
}
function cmp(a, b) {
  const [aa, ab, ac] = semverKey(a);
  const [ba, bb, bc] = semverKey(b);
  return aa - ba || ab - bb || ac - bc;
}

export function buildVersionsManifest({ existing, current }) {
  const all = [...existing, current]
    .map((t) => t.replace(/^v/, ""))
    .filter((v) => /^\d+\.\d+\.\d+$/.test(v));
  const unique = [...new Set(all)].sort(cmp);
  const latest = unique[unique.length - 1];
  const major = "v" + semverKey(latest)[0];
  return { latest, major, versions: unique, schema_url: SCHEMA_URL };
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
