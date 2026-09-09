import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSportsIndex } from "../scripts/build-sports.mjs";

const basketball = {
  dirName: "basketball",
  data: {
    sport: "basketball",
    version: "2.0.0",
    status: "defined",
    actions: {
      types: ["move", "pass", "shoot"],
      variants: { pass: ["chest", "bounce"] },
      outcomes: ["make", "miss"],
    },
    court_profiles: { fiba: {}, nba: {} },
  },
};
const soccer = {
  dirName: "soccer",
  data: {
    sport: "soccer",
    version: "0.0.1",
    status: "provisional",
    actions: { types: ["move", "pass", "shoot"], variants: {}, outcomes: [] },
    court_profiles: {},
  },
};

test("buildSportsIndex: maps a defined sport to Full/not-reserved", () => {
  const [b] = buildSportsIndex([basketball]);
  assert.equal(b.sport, "basketball");
  assert.equal(b.label, "Basketball");
  assert.equal(b.status, "defined");
  assert.equal(b.statusLabel, "Full");
  assert.equal(b.reserved, false);
  assert.deepEqual(b.action_types, ["move", "pass", "shoot"]);
  assert.deepEqual(b.rulesets, ["fiba", "nba"]);
  assert.deepEqual(b.variants, { pass: ["chest", "bounce"] });
});

test("buildSportsIndex: maps a provisional sport to Reserved/reserved", () => {
  const [s] = buildSportsIndex([soccer]);
  assert.equal(s.label, "Soccer");
  assert.equal(s.statusLabel, "Reserved");
  assert.equal(s.reserved, true);
  assert.deepEqual(s.variants, {});
  assert.deepEqual(s.outcomes, []);
  assert.deepEqual(s.rulesets, []);
});

test("buildSportsIndex: basketball is sorted first, then the rest alphabetically", () => {
  const idx = buildSportsIndex([soccer, basketball]);
  assert.deepEqual(idx.map((s) => s.sport), ["basketball", "soccer"]);
});

test("buildSportsIndex: sorts non-basketball sports alphabetically", () => {
  const mk = (sport) => ({
    dirName: sport,
    data: { sport, version: "0.0.1", status: "provisional", actions: { types: [], variants: {}, outcomes: [] }, court_profiles: {} },
  });
  const idx = buildSportsIndex([mk("hockey"), mk("futsal"), mk("handball")]);
  assert.deepEqual(idx.map((s) => s.sport), ["futsal", "handball", "hockey"]);
});

test("buildSportsIndex: defaults missing actions/court_profiles to empty", () => {
  const [x] = buildSportsIndex([{ dirName: "x", data: { sport: "x", version: "1", status: "defined" } }]);
  assert.deepEqual(x.action_types, []);
  assert.deepEqual(x.outcomes, []);
  assert.deepEqual(x.rulesets, []);
  assert.deepEqual(x.variants, {});
});
