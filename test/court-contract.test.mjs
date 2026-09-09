import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));
const basketballSport = JSON.parse(
  readFileSync(new URL("../sports/basketball/sport.json", import.meta.url), "utf-8")
);

// Find the allOf block whose custom_dimensions shape applies to a given sport const,
// mirroring the pattern already used in test/sport-branches.test.mjs.
function customDimensionsRequiredFields(sportConst) {
  for (const block of schema.allOf) {
    const ifSport = block.if?.properties?.sport;
    const matchesConst = ifSport?.const === sportConst;
    const matchesEnum = Array.isArray(ifSport?.enum) && ifSport.enum.includes(sportConst);
    if (matchesConst || matchesEnum) {
      const cd = block.then?.properties?.court?.properties?.custom_dimensions;
      if (cd?.required) return cd.required;
    }
  }
  return null;
}

test("basketball's court_contract.required_dimensions are all present in its custom_dimensions required fields", () => {
  const required = basketballSport.court_contract.required_dimensions;
  const cdRequired = customDimensionsRequiredFields("basketball");
  assert.ok(cdRequired, "basketball must have a custom_dimensions allOf branch");
  for (const dim of required) {
    assert.ok(cdRequired.includes(dim), `custom_dimensions for basketball must require '${dim}' (court_contract says it's mandatory)`);
  }
});

test("every promoted court profile file declares length and width", () => {
  const profiles = ["fiba", "nba", "ncaa", "nfhs"];
  for (const name of profiles) {
    const data = JSON.parse(
      readFileSync(new URL(`../sports/basketball/court_profiles/${name}.json`, import.meta.url), "utf-8")
    );
    for (const dim of basketballSport.court_contract.required_dimensions) {
      assert.ok(
        Object.hasOwn(data.court, dim),
        `${name}.json's court object must declare '${dim}' (court_contract requires it)`
      );
    }
  }
});
