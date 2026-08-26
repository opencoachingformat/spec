import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULESETS = ["fiba", "nba", "ncaa", "nfhs"];
const cache = new Map();

function loadRuleset(ruleset) {
  if (!RULESETS.includes(ruleset)) {
    throw new Error(`Unknown ruleset '${ruleset}'. Known: ${RULESETS.join(", ")}`);
  }
  if (!cache.has(ruleset)) {
    const path = resolve(__dirname, `${ruleset}-v1.json`);
    cache.set(ruleset, JSON.parse(readFileSync(path, "utf-8")));
  }
  return cache.get(ruleset);
}

/** Returns { x, y } for a named position under a ruleset, or throws if unknown. */
export function resolveNamedPosition(name, ruleset = "fiba") {
  const data = loadRuleset(ruleset);
  if (!Object.hasOwn(data.positions, name)) {
    throw new Error(`Unknown named position '${name}' for ruleset '${ruleset}'.`);
  }
  const pos = data.positions[name];
  return { x: pos.x, y: pos.y };
}

/**
 * Returns the whole flat position map for a ruleset (for bulk consumers).
 * Deep-copies the coordinate leaves so a caller mutating a returned point
 * cannot corrupt the module-level cache.
 */
export function loadPositions(ruleset = "fiba") {
  const positions = loadRuleset(ruleset).positions;
  return Object.fromEntries(
    Object.entries(positions).map(([name, { x, y }]) => [name, { x, y }])
  );
}
