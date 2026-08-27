import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
