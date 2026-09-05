import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));
const defs = schema.definitions;

const ACTION_DEFS = [
  "action_move", "action_cut", "action_screen", "action_defend", "action_dribble",
  "action_pass", "action_shoot", "action_rebound", "action_pickup",
  "action_tackle", "action_clear", "action_faceoff", "action_check",
];

for (const name of ACTION_DEFS) {
  test(`${name} requires id and has no after/with/on_catch`, () => {
    const d = defs[name];
    assert.ok(d, `${name} must exist`);
    assert.ok(d.required.includes("id"), `${name}.required must include "id"`);
    assert.equal(d.properties.id?.$ref, "#/definitions/action_id", `${name}.properties.id must ref action_id`);
    assert.equal(d.properties.after, undefined, `${name} must not have "after" anymore`);
    assert.equal(d.properties.with, undefined, `${name} must not have "with" anymore`);
    assert.equal(d.properties.on_catch, undefined, `${name} must not have "on_catch" anymore`);
    assert.equal(d.properties.trigger?.$ref, "#/definitions/trigger", `${name}.properties.trigger must ref trigger`);
  });
}

test("action_ref definition is fully removed (superseded by action_id)", () => {
  assert.equal(defs.action_ref, undefined, "action_ref must be deleted once nothing references it");
});
