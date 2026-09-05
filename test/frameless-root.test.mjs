import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));

test("document root requires actions, not frames", () => {
  assert.ok(schema.required.includes("actions"), "root required[] must include 'actions'");
  assert.ok(!schema.required.includes("frames"), "root required[] must not include 'frames' anymore");
});

test("actions is a top-level array property referencing the action union, and may be empty", () => {
  const p = schema.properties.actions;
  assert.ok(p, "properties.actions must exist");
  assert.equal(p.type, "array");
  // No minItems: a static formation/setup-only diagram with zero actions is a
  // legitimate document (the old model allowed this via a single frame with
  // actions: [] — "Semantic actions in this phase. May be empty."). actions
  // is still a REQUIRED root property (the key must be present), just not
  // required to be non-empty.
  assert.equal(p.minItems, undefined, "actions[] must not require at least 1 item");
  // Since the branch construct was added, each item is oneOf [action, branch]
  // rather than a plain $ref to action.
  const refs = p.items.oneOf?.map((x) => x.$ref);
  assert.ok(refs?.includes("#/definitions/action"), "actions[].items must reference the action union");
});

test("frames property is fully removed from the root", () => {
  assert.equal(schema.properties.frames, undefined, "properties.frames must be removed");
});

test("every sport allOf branch whitelists actions[].type, not frames[].actions[].type", () => {
  const branchesWithActionWhitelist = [];
  for (const branch of schema.allOf) {
    if (!branch.then?.properties) continue;
    // A branch is a sport-scoping action-type whitelist only if it constrains
    // actions[].items.properties.type — the custom-ruleset branch (which only
    // touches court.custom_dimensions) has a `then.properties` too but no
    // `actions` key, so it's correctly skipped here, not silently miscounted.
    const actionsProp = branch.then.properties.actions;
    assert.equal(branch.then.properties.frames, undefined,
      "no branch should reference frames[] anymore");
    if (!actionsProp) continue;
    assert.ok(Array.isArray(actionsProp.items?.properties?.type?.enum),
      "each sport branch must whitelist actions[].items.properties.type.enum directly at the root");
    branchesWithActionWhitelist.push(branch);
  }
  // Guards against a branch's whitelist silently disappearing (e.g. an empty
  // then.properties): there must be exactly one action-type whitelist branch
  // per supported sport (basketball, soccer, handball, hockey, futsal).
  assert.equal(branchesWithActionWhitelist.length, 5,
    "expected exactly 5 sport action-type whitelist branches (basketball, soccer, handball, hockey, futsal)");
});
