import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const schema = JSON.parse(readFileSync(new URL("../schema/v2.json", import.meta.url), "utf-8"));
const defs = schema.definitions;

function compileDef(name) {
  const ajv = new Ajv({ schemas: [schema], strict: false });
  addFormats(ajv);
  return ajv.compile({ $ref: `${schema.$id}#/definitions/${name}` });
}

test("side_effect definition exists with type/on/physicality", () => {
  const d = defs.side_effect;
  assert.ok(d, "definitions.side_effect must exist");
  assert.deepEqual(d.required, ["type", "on"]);
  assert.equal(d.properties.on.$ref, "#/definitions/entity_ref");
});

test("action_dribble accepts ball_ids with 1 or 2 entries, one per hand", () => {
  const d = defs.action_dribble;
  const p = d.properties.ball_ids;
  assert.ok(p, "action_dribble.properties.ball_ids must exist");
  assert.equal(p.type, "array");
  assert.equal(p.minItems, 1);
  assert.equal(p.maxItems, 2);
  assert.equal(p.items.$ref, "#/definitions/ball_ref");
});

test("action_dribble with two ball_ids validates", () => {
  const validate = compileDef("action_dribble");
  const ok = validate({
    id: "d1",
    player: "offense_1",
    type: "dribble",
    ball_ids: ["ball_1", "ball_2"],
    moves: [{ to: { x: 1, y: 2 } }],
  });
  assert.equal(ok, true, JSON.stringify(validate.errors));
});

test("action_dribble rejects three ball_ids (max 2 hands)", () => {
  const validate = compileDef("action_dribble");
  const ok = validate({
    id: "d1",
    player: "offense_1",
    type: "dribble",
    ball_ids: ["ball_1", "ball_2", "ball_3"],
    moves: [{ to: { x: 1, y: 2 } }],
  });
  assert.equal(ok, false);
});

test("action_dribble rejects ball_id and ball_ids present together", () => {
  const validate = compileDef("action_dribble");
  const ok = validate({
    id: "d1",
    player: "offense_1",
    type: "dribble",
    ball_id: "ball_1",
    ball_ids: ["ball_1", "ball_2"],
    moves: [{ to: { x: 1, y: 2 } }],
  });
  assert.equal(ok, false, "ball_id and ball_ids must be mutually exclusive, per ball_ids' own description");
});

test("action_pass accepts an optional side_effects array", () => {
  const validate = compileDef("action_pass");
  const ok = validate({
    id: "p1",
    player: "offense_1",
    type: "pass",
    to_player: "offense_4",
    variant: "hand_off",
    side_effects: [{ type: "screen", on: "defense_4", physicality: "normal" }],
  });
  assert.equal(ok, true, JSON.stringify(validate.errors));
});
