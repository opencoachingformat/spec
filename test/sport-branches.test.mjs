import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));

function branchSports(allOf) {
  const handled = new Set();
  for (const b of allOf) {
    const c = b.if?.properties?.sport?.const;
    if (c) handled.add(c);
    const e = b.if?.properties?.sport?.enum;
    if (Array.isArray(e)) for (const s of e) handled.add(s);
  }
  return handled;
}

test("every sport enum value has a whitelist branch", () => {
  const enumVals = schema.properties.sport.enum;
  assert.ok(Array.isArray(enumVals) && enumVals.length > 0, "sport enum present");
  const handled = branchSports(schema.allOf);
  for (const s of enumVals) {
    assert.ok(handled.has(s), `sport "${s}" has no if/then whitelist branch`);
  }
});

test("each sport bundle's actions.types matches its schema whitelist branch", () => {
  const sportsDir = new URL("../sports/", import.meta.url);
  const sportDirs = readdirSync(sportsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const branchWhitelist = (sport) => {
    for (const b of schema.allOf) {
      const c = b.if?.properties?.sport?.const;
      const e = b.if?.properties?.sport?.enum;
      if (c === sport || (Array.isArray(e) && e.includes(sport))) {
        return b.then?.properties?.actions?.items?.properties?.type?.enum;
      }
    }
    return null;
  };

  for (const dirName of sportDirs) {
    const manifest = JSON.parse(
      readFileSync(new URL(`${dirName}/sport.json`, sportsDir), "utf-8")
    );
    const wl = branchWhitelist(manifest.sport);
    assert.ok(wl, `no schema branch for sport ${manifest.sport}`);
    assert.deepEqual(
      [...manifest.actions.types].sort(),
      [...wl].sort(),
      `${dirName}/sport.json actions.types must match the schema whitelist for ${manifest.sport}`
    );
  }
});
