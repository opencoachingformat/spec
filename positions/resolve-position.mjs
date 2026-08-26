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
  const pos = data.positions[name];
  if (!pos) {
    throw new Error(`Unknown named position '${name}' for ruleset '${ruleset}'.`);
  }
  return { x: pos.x, y: pos.y };
}

/** Returns the whole flat position map for a ruleset (for bulk consumers). */
export function loadPositions(ruleset = "fiba") {
  return { ...loadRuleset(ruleset).positions };
}
