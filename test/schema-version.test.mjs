import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url)));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));

test("schema carries a machine-readable x-ocf-version", () => {
  assert.equal(typeof schema["x-ocf-version"], "string");
});

test("x-ocf-version matches package.json version", () => {
  assert.equal(schema["x-ocf-version"], pkg.version);
});

test("x-ocf-version matches the $comment prose version", () => {
  const comment = schema.$comment ?? "";
  const m = comment.match(/Schema version (\d+\.\d+\.\d+)/);
  assert.ok(m, "$comment should state 'Schema version X.Y.Z'");
  assert.equal(schema["x-ocf-version"], m[1]);
});
