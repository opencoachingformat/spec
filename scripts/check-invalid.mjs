#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "examples/invalid";
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

if (files.length === 0) {
  console.error("No invalid fixtures found in examples/invalid/");
  process.exit(1);
}

let failures = 0;
for (const file of files) {
  const path = join(dir, file);
  let validated = false;
  try {
    execFileSync(
      "npx",
      ["ajv", "validate", "--spec=draft7", "-s", "schema/v1.json", "-d", path, "-c", "ajv-formats"],
      { stdio: "pipe" }
    );
    validated = true; // ajv exited 0 => it accepted the bad fixture
  } catch {
    // ajv exited non-zero => correctly rejected
  }
  if (validated) {
    console.error(`FAIL: ${path} was accepted by the schema but should be invalid.`);
    failures++;
  } else {
    console.log(`ok: ${path} correctly rejected.`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} invalid fixture(s) were wrongly accepted.`);
  process.exit(1);
}
console.log(`\nAll ${files.length} invalid fixture(s) correctly rejected.`);
