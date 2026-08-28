import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSportsIndex } from "../scripts/build-sports.mjs";

const basketball = {
  filename: "basketball-v1.json",
  data: {
    sport: "basketball",
    version: "1.0.0",
    status: "defined",
    action_types: ["move", "pass", "shoot"],
    variants: { pass: ["chest", "bounce"] },
    outcomes: ["make", "miss"],
    rulesets: ["fiba", "nba"],
  },
};
const soccer = {
  filename: "soccer-v0.0.1.json",
  data: {
    sport: "soccer",
    version: "0.0.1",
    status: "provisional",
    action_types: ["move", "pass", "shoot"],
    variants: {},
    outcomes: [],
    rulesets: [],
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
    filename: `${sport}-v0.0.1.json`,
    data: { sport, version: "0.0.1", status: "provisional", action_types: [], variants: {}, outcomes: [], rulesets: [] },
  });
  const idx = buildSportsIndex([mk("hockey"), mk("futsal"), mk("handball")]);
  assert.deepEqual(idx.map((s) => s.sport), ["futsal", "handball", "hockey"]);
});

test("buildSportsIndex: defaults missing arrays to empty and objects to {}", () => {
  const [x] = buildSportsIndex([{ filename: "x-v1.json", data: { sport: "x", version: "1", status: "defined" } }]);
  assert.deepEqual(x.action_types, []);
  assert.deepEqual(x.outcomes, []);
  assert.deepEqual(x.rulesets, []);
  assert.deepEqual(x.variants, {});
});
