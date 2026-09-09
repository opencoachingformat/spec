import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COURT_PROFILES = ["fiba", "nba", "ncaa", "nfhs"];
const cache = new Map();

function loadCourtProfile(courtProfile) {
  if (!COURT_PROFILES.includes(courtProfile)) {
    throw new Error(`Unknown court profile '${courtProfile}'. Known: ${COURT_PROFILES.join(", ")}`);
  }
  if (!cache.has(courtProfile)) {
    const path = resolve(__dirname, `${courtProfile}-v1.json`);
    cache.set(courtProfile, JSON.parse(readFileSync(path, "utf-8")));
  }
  return cache.get(courtProfile);
}

/** Returns { x, y } for a named position under a court profile, or throws if unknown. */
export function resolveNamedPosition(name, ruleset = "fiba") {
  const data = loadCourtProfile(ruleset);
  if (!Object.hasOwn(data.positions, name)) {
    throw new Error(`Unknown named position '${name}' for court profile '${ruleset}'.`);
  }
  const pos = data.positions[name];
  return { x: pos.x, y: pos.y };
}

/**
 * Returns the whole flat position map for a court profile (for bulk consumers).
 * Deep-copies the coordinate leaves so a caller mutating a returned point
 * cannot corrupt the module-level cache.
 */
export function loadPositions(ruleset = "fiba") {
  const positions = loadCourtProfile(ruleset).positions;
  return Object.fromEntries(
    Object.entries(positions).map(([name, { x, y }]) => [name, { x, y }])
  );
}
