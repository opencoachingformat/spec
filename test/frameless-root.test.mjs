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
  assert.equal(p.items.$ref, "#/definitions/action");
});

test("frames property is fully removed from the root", () => {
  assert.equal(schema.properties.frames, undefined, "properties.frames must be removed");
});

test("every sport allOf branch whitelists actions[].type, not frames[].actions[].type", () => {
  for (const branch of schema.allOf) {
    if (!branch.then?.properties) continue;
    const actionsProp = branch.then.properties.actions;
    if (actionsProp) {
      assert.equal(actionsProp.items.properties.type.enum !== undefined, true,
        "each sport branch must whitelist actions[].items.properties.type.enum directly at the root");
    }
    assert.equal(branch.then.properties.frames, undefined,
      "no sport branch should reference frames[] anymore");
  }
});
