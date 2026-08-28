// Testable helpers for the "Try it" schema-version transparency:
//  - isNewerVersion(a, b): true iff semver a > b (numeric core compare).
//  - fetchLatestSchemaVersion(fetchImpl): reads `latest` from
//    https://opencoachingformat.org/schema/versions.json; fail-soft (null).
// No side effects; fetch is injected so this file is unit-testable offline.

export const SCHEMA_VERSIONS_URL =
  "https://opencoachingformat.org/schema/versions.json";

// Parse "v1.4.0-rc.1" -> [1, 4, 0]; the pre-release "-…" suffix is dropped so
// comparisons run on the numeric core. Returns null if no numeric core.
function parseCore(version) {
  if (typeof version !== "string") return null;
  const core = version.trim().replace(/^v/i, "").split("-")[0].split("+")[0];
  if (core === "") return null;
  const parts = core.split(".");
  const nums = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    nums.push(Number(p));
  }
  return nums.length > 0 ? nums : null;
}

export function isNewerVersion(candidate, baseline) {
  const a = parseCore(candidate);
  const b = parseCore(baseline);
  if (a === null || b === null) return false;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (ai > bi) return true;
    if (ai < bi) return false;
  }
  return false;
}

export async function fetchLatestSchemaVersion(fetchImpl) {
  const doFetch = fetchImpl ?? fetch;
  try {
    const res = await doFetch(SCHEMA_VERSIONS_URL);
    if (!res || !res.ok) return null;
    const data = await res.json();
    const latest = data && data.latest;
    return typeof latest === "string" && latest !== "" ? latest : null;
  } catch {
    return null;
  }
}
