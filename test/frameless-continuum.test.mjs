import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));

test("continuum is an optional top-level boolean, default false", () => {
  const p = schema.properties.continuum;
  assert.ok(p, "properties.continuum must exist");
  assert.equal(p.type, "boolean");
  assert.equal(p.default, false);
  assert.ok(!schema.required.includes("continuum"), "continuum must stay optional");
});
