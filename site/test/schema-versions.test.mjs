import { test } from "node:test";
import assert from "node:assert/strict";
import { isNewerVersion, fetchLatestSchemaVersion } from "../src/lib/schema-versions.mjs";

test("isNewerVersion: strictly greater major/minor/patch", () => {
  assert.equal(isNewerVersion("1.4.0", "1.3.0"), true);
  assert.equal(isNewerVersion("2.0.0", "1.9.9"), true);
  assert.equal(isNewerVersion("1.3.1", "1.3.0"), true);
});

test("isNewerVersion: equal versions are not newer", () => {
  assert.equal(isNewerVersion("1.4.0", "1.4.0"), false);
});

test("isNewerVersion: older is not newer", () => {
  assert.equal(isNewerVersion("1.3.0", "1.4.0"), false);
  assert.equal(isNewerVersion("1.3.0", "1.3.1"), false);
});

test("isNewerVersion: tolerates a leading v", () => {
  assert.equal(isNewerVersion("v1.4.0", "1.3.0"), true);
  assert.equal(isNewerVersion("1.4.0", "v1.4.0"), false);
});

test("isNewerVersion: compares numeric core, ignoring pre-release suffix", () => {
  assert.equal(isNewerVersion("1.4.0-rc.1", "1.4.0"), false);
  assert.equal(isNewerVersion("1.5.0-rc.1", "1.4.0"), true);
});

test("isNewerVersion: shorter version treated as zero-padded", () => {
  assert.equal(isNewerVersion("1.4", "1.4.0"), false);
  assert.equal(isNewerVersion("1.4.1", "1.4"), true);
});

test("isNewerVersion: non-parseable input returns false (no false alarm)", () => {
  assert.equal(isNewerVersion("", "1.0.0"), false);
  assert.equal(isNewerVersion("1.0.0", ""), false);
  assert.equal(isNewerVersion(null, "1.0.0"), false);
  assert.equal(isNewerVersion("abc", "1.0.0"), false);
});

test("fetchLatestSchemaVersion: returns the latest field from versions.json", async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        latest: "1.4.0",
        major: "v1",
        versions: ["1.0.0", "1.4.0"],
        schema_url: "https://opencoachingformat.org/schema/v1.json",
      }),
    };
  };
  const latest = await fetchLatestSchemaVersion(fakeFetch);
  assert.equal(latest, "1.4.0");
  assert.match(calls[0], /\/schema\/versions\.json$/);
});

test("fetchLatestSchemaVersion: non-OK response returns null (fail soft)", async () => {
  const fakeFetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  assert.equal(await fetchLatestSchemaVersion(fakeFetch), null);
});

test("fetchLatestSchemaVersion: fetch rejection returns null (fail soft)", async () => {
  const fakeFetch = async () => { throw new Error("network down"); };
  assert.equal(await fetchLatestSchemaVersion(fakeFetch), null);
});

test("fetchLatestSchemaVersion: missing latest field returns null", async () => {
  const fakeFetch = async () => ({ ok: true, status: 200, json: async () => ({ versions: [] }) });
  assert.equal(await fetchLatestSchemaVersion(fakeFetch), null);
});
