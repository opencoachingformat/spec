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

test("branch definition exists with id/on/cases", () => {
  const d = defs.branch;
  assert.ok(d, "definitions.branch must exist");
  assert.deepEqual(d.required, ["id", "on", "cases"]);
  assert.equal(d.properties.on.$ref, "#/definitions/action_id");
});

test("branch_case definition exists with actions[] and optional then", () => {
  const d = defs.branch_case;
  assert.ok(d, "definitions.branch_case must exist");
  assert.deepEqual(d.required, ["actions", "then"]);
  assert.deepEqual([...d.properties.then.type].sort(), ["null", "string"],
    "then must allow exactly string (a continuation target id) and null (explicit terminal marker), nothing else");
});

test("a branch validates with two cases, one terminal (then: null via type null)", () => {
  const validate = compileDef("branch");
  const ok = validate({
    id: "branch_1",
    on: "shoot_1",
    cases: {
      make: { actions: [], then: "frame_reset_first_action" },
      miss: { actions: [], then: null },
    },
  });
  assert.equal(ok, true, JSON.stringify(validate.errors));
});

test("a branch_case without 'then' is rejected (terminal must be explicit null, not omitted)", () => {
  const validate = compileDef("branch_case");
  const ok = validate({ actions: [] });
  assert.equal(ok, false, "then must be required (explicit null for terminal, not an absent field)");
});

test("the top-level actions[] item can be an action OR a branch", () => {
  const p = schema.properties.actions.items;
  assert.ok(p.oneOf, "actions[].items must be oneOf [action, branch]");
  const refs = p.oneOf.map((x) => x.$ref);
  assert.ok(refs.includes("#/definitions/action"), "must include action");
  assert.ok(refs.includes("#/definitions/branch"), "must include branch");
});
