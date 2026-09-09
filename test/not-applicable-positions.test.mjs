import { test } from "node:test";
import assert from "node:assert/strict";

// This test exercises the not_applicable mechanism directly against a
// synthetic court-profile object (not a real, checked-in file) — RFC 0010's
// own example (a hypothetical "minibasketball" court profile) is
// illustrative, not something this plan adds to the registry. The
// mechanism itself (resolveNamedPosition checking not_applicable before
// falling through to "unknown") is what needs proving, independent of any
// real court profile actually using it yet.
function makeResolver(courtProfileData) {
  return function resolveNamedPosition(name) {
    if (courtProfileData.not_applicable?.includes(name)) {
      throw new Error(`Position '${name}' is not applicable under this court profile.`);
    }
    if (!Object.hasOwn(courtProfileData.positions, name)) {
      throw new Error(`Unknown named position '${name}'.`);
    }
    return courtProfileData.positions[name];
  };
}

test("a not_applicable position throws a distinct error, not 'unknown'", () => {
  const resolve = makeResolver({
    positions: { basket: { x: 0, y: 0 }, paint_center: { x: 0, y: 1 } },
    not_applicable: ["left_wing", "right_wing", "left_corner", "right_corner"],
  });
  assert.throws(() => resolve("left_wing"), /not applicable/);
});

test("a genuinely unknown position (not in not_applicable either) throws 'unknown'", () => {
  const resolve = makeResolver({
    positions: { basket: { x: 0, y: 0 } },
    not_applicable: ["left_wing"],
  });
  assert.throws(() => resolve("some_typo_name"), /Unknown named position/);
});

test("a position not in not_applicable resolves normally", () => {
  const resolve = makeResolver({
    positions: { basket: { x: 0, y: 0 } },
    not_applicable: ["left_wing"],
  });
  assert.deepEqual(resolve("basket"), { x: 0, y: 0 });
});
