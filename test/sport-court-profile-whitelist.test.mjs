import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

function baseDoc(overrides = {}) {
  return {
    sport: "basketball",
    meta: { id: "11111111-1111-1111-1111-111111111111", title: "t" },
    court: { court_profile: "fiba", type: "half_court" },
    entities: [],
    actions: [],
    ...overrides,
  };
}

test("sport: soccer with court_profile: fiba is rejected", () => {
  const doc = baseDoc({ sport: "soccer", court: { court_profile: "fiba", type: "half_court" } });
  assert.equal(validate(doc), false, "a soccer document with a basketball court_profile must fail validation");
});

test("sport: soccer with court_profile: custom is accepted", () => {
  const doc = baseDoc({
    sport: "soccer",
    court: {
      court_profile: "custom",
      type: "full_court",
      custom_dimensions: {
        unit: "m", length: 105, width: 68,
        goal_width: 7.32, penalty_box_width: 40.3, penalty_box_depth: 16.5, penalty_spot_distance: 11,
      },
    },
  });
  assert.equal(validate(doc), true, JSON.stringify(validate.errors));
});

test("sport: basketball with court_profile: fiba is accepted (unchanged behavior)", () => {
  const doc = baseDoc();
  assert.equal(validate(doc), true, JSON.stringify(validate.errors));
});
