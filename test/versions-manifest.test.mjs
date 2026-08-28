import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVersionsManifest } from "../scripts/build-versions-manifest.mjs";

test("manifest lists sorted versions with latest + major + schema_url", () => {
  const m = buildVersionsManifest({
    existing: ["v1.0.0", "v1.2.0", "v1.10.0"],
    current: "v1.4.0",
  });
  assert.equal(m.major, "v1");
  assert.equal(m.schema_url, "https://opencoachingformat.org/schema/v1.json");
  assert.deepEqual(m.versions, ["1.0.0", "1.2.0", "1.4.0", "1.10.0"]);
  assert.equal(m.latest, "1.10.0");
});

test("current version is included even if not in existing", () => {
  const m = buildVersionsManifest({ existing: ["v1.0.0"], current: "v1.4.0" });
  assert.ok(m.versions.includes("1.4.0"));
  assert.equal(m.latest, "1.4.0");
});
