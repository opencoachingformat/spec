import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));
const defs = schema.definitions;

function compileDef(name) {
  const ajv = new Ajv({ schemas: [schema], strict: false });
  addFormats(ajv);
  return ajv.compile({ $ref: `${schema.$id}#/definitions/${name}` });
}

test("action_id definition exists and is a non-empty string pattern", () => {
  const d = defs.action_id;
  assert.ok(d, "definitions.action_id must exist");
  assert.equal(d.type, "string");
  assert.ok(typeof d.pattern === "string" && d.pattern.length > 0, "action_id must have a pattern");
});

test("trigger definition exists with the correct type enum and ref requirement", () => {
  const d = defs.trigger;
  assert.ok(d, "definitions.trigger must exist");
  assert.equal(d.type, "object");
  assert.deepEqual(d.required, ["type"]);
  assert.equal(d.properties.type.type, "string");
  // type is sport-extensible (open vocabulary) but must at least document the
  // four known values via enum-like guidance; we keep it a free string with
  // one exception: reception carries no ref, others require one. Enforced via
  // if/then below, not by restricting the enum (open vocabulary requirement).
  assert.ok(Array.isArray(d.allOf) || Array.isArray(d.oneOf) || d.if,
    "trigger must conditionally require ref for non-reception types");
  assert.equal(d.properties.ref.$ref, "#/definitions/action_id");
});

test("trigger requires ref for action_end/action_start/action_overlap but not for reception", () => {
  const validate = compileDef("trigger");

  assert.equal(validate({ type: "reception" }), true, "reception needs no ref");
  assert.equal(validate({ type: "action_end", ref: "a1" }), true, "action_end with ref is valid");
  assert.equal(validate({ type: "action_end" }), false, "action_end without ref must fail");
  assert.equal(validate({ type: "action_start" }), false, "action_start without ref must fail");
  assert.equal(validate({ type: "action_overlap" }), false, "action_overlap without ref must fail");
  assert.equal(validate({ type: "custom_sport_trigger" }), true,
    "unknown/sport-extensible type with no ref is allowed (open vocabulary, no ref required by default)");
});
