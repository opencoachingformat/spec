import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));

// Collect the sports each allOf branch handles (via if.properties.sport.const,
// or the basketball anyOf branch that also matches absent sport).
function branchSports(allOf) {
  const handled = new Set();
  for (const b of allOf) {
    const c = b.if?.properties?.sport?.const;
    if (c) handled.add(c);
    const anyOf = b.if?.anyOf;
    if (anyOf?.some((x) => x.properties?.sport?.const === "basketball")) handled.add("basketball");
  }
  return handled;
}

test("every sport enum value has a whitelist branch", () => {
  const enumVals = schema.properties.sport.enum;
  assert.ok(Array.isArray(enumVals) && enumVals.length > 0, "sport enum present");
  const handled = branchSports(schema.allOf);
  for (const s of enumVals) {
    assert.ok(handled.has(s), `sport "${s}" has no if/then whitelist branch`);
  }
});

test("basketball branch also matches an absent sport (back-compat)", () => {
  const bbBranch = schema.allOf.find((b) =>
    b.if?.anyOf?.some((x) => x.not?.required?.includes("sport")),
  );
  assert.ok(bbBranch, "a branch matches when sport is absent (default-annotation back-compat)");
});

test("each sport skeleton's action_types matches its schema whitelist branch", () => {
  const dir = new URL("../sports/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const branchWhitelist = (sport) => {
    for (const b of schema.allOf) {
      const isBB = b.if?.anyOf?.some((x) => x.properties?.sport?.const === "basketball");
      const c = b.if?.properties?.sport?.const;
      if ((sport === "basketball" && isBB) || c === sport) {
        return b.then.properties.frames.items.properties.actions.items.properties.type.enum;
      }
    }
    return null;
  };
  for (const f of files) {
    const data = JSON.parse(readFileSync(new URL(f, dir), "utf-8"));
    const wl = branchWhitelist(data.sport);
    assert.ok(wl, `no schema branch for sport ${data.sport}`);
    assert.deepEqual([...data.action_types].sort(), [...wl].sort(),
      `${f} action_types must match the schema whitelist for ${data.sport}`);
  }
});
