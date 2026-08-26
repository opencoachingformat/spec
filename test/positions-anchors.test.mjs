import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveNamedPosition } from "../positions/resolve-position.mjs";

// The 6 cross-ruleset anchors asserted by docs/specification-v1.adoc:288-294.
const ANCHORS = {
  fiba: { top_of_the_key: ["y", 5.68], left_wing: ["x", -6.75], left_corner: ["x", -7.5], free_throw_line: ["y", 8.2], left_elbow: ["x", -2.45] },
  nba:  { top_of_the_key: ["y", 20.75], left_wing: ["x", -22.15], left_corner: ["x", -25.0], free_throw_line: ["y", 28.0], left_elbow: ["x", -8.0] },
  ncaa: { top_of_the_key: ["y", 20.75], left_wing: ["x", -20.75], left_corner: ["x", -25.0], free_throw_line: ["y", 28.0], left_elbow: ["x", -6.0] },
  nfhs: { top_of_the_key: ["y", 19.75], left_wing: ["x", -19.75], left_corner: ["x", -25.0], free_throw_line: ["y", 23.0], left_elbow: ["x", -6.0] },
};

for (const [ruleset, anchors] of Object.entries(ANCHORS)) {
  test(`${ruleset} anchors match the spec difference table`, () => {
    for (const [name, [axis, expected]] of Object.entries(anchors)) {
      const got = resolveNamedPosition(name, ruleset)[axis];
      assert.ok(Math.abs(got - expected) <= 0.01, `${ruleset} ${name}.${axis} = ${got}, expected ${expected}`);
    }
  });
}

test("left/right mirror on x for every ruleset", () => {
  for (const ruleset of ["fiba", "nba", "ncaa", "nfhs"]) {
    for (const side of ["wing", "corner", "elbow", "block"]) {
      const l = resolveNamedPosition(`left_${side}`, ruleset);
      const r = resolveNamedPosition(`right_${side}`, ruleset);
      assert.equal(l.x, -r.x, `${ruleset} ${side} x not mirrored`);
      assert.equal(l.y, r.y, `${ruleset} ${side} y not mirrored`);
    }
  }
});
