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
  // Full SemVer, including an optional pre-release suffix (e.g. "2.0.0-alpha.1")
  // — a bare \d+\.\d+\.\d+ regex can't round-trip a pre-release version, and
  // the schema is legitimately on one during the v2.0.0 program (see
  // v2-program-strategy: no final v2.0.0 release until all breaking changes
  // land).
  const m = comment.match(/Schema version (\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?)\b/);
  assert.ok(m, "$comment should state 'Schema version X.Y.Z' (optionally with a pre-release suffix)");
  assert.equal(schema["x-ocf-version"], m[1]);
});
