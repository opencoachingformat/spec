import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));
const defs = schema.definitions;

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
