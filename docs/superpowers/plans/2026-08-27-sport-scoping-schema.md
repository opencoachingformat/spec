# Sport Scoping Schema (RFC 0003) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement RFC 0003 — add an optional `sport` field and a per-sport conditional action-type whitelist to `schema/v1.json`, with reserved skeleton action types, regression fixtures, docs, and a minor version bump to 1.2.0.

**Architecture:** Additive, draft-07. A new optional top-level `sport` (enum basketball/soccer/handball/hockey/futsal, default basketball) gates which action `type`s are valid via `allOf` + `if/then` branches. The existing top-level `custom`-ruleset `if/then` MUST be folded into the same `allOf` (draft-07 allows only one `if` per level). Reserved action types (`tackle`/`clear`/`faceoff`/`check`) are added as skeleton definitions (no variants). The neutral core is untouched. Backward compatibility hinges on the basketball branch matching `anyOf[ sport-absent, sport==basketball ]` because JSON Schema `default` does not apply during validation.

**Tech Stack:** JSON Schema draft-07, ajv-cli + ajv-formats (existing harness), node:test.

**Plan for RFC 0003.** Verified against ajv/draft-07 during RFC authoring: the multi-sport whitelist and the sport-absent back-compat guard both work.

---

### Task 1: Add reserved skeleton action types + extend `action_ref` pattern

**Files:**
- Modify: `schema/v1.json` (definitions block; `action_ref` at line ~211-214; `action` oneOf)

- [ ] **Step 1: Add four skeleton action definitions**

Insert after `action_pickup` (before the `action` oneOf). Each is a minimal action carrying the common action fields but **no `variant`** (variants are per-sport, TBD):

```json
    "action_tackle": {
      "type": "object",
      "$comment": "Reserved for invasion sports (soccer/futsal/hockey). No variants defined yet; must be specified before promotion.",
      "required": ["player", "type"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "tackle" },
        "physicality": { "$ref": "#/definitions/physicality" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },

    "action_clear": {
      "type": "object",
      "$comment": "Reserved for invasion sports (soccer/futsal/hockey). No variants defined yet.",
      "required": ["player", "type"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "clear" },
        "ball_id": { "$ref": "#/definitions/ball_ref" },
        "intensity": { "$ref": "#/definitions/ball_intensity" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },

    "action_faceoff": {
      "type": "object",
      "$comment": "Reserved for hockey. No variants defined yet.",
      "required": ["player", "type"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "faceoff" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },

    "action_check": {
      "type": "object",
      "$comment": "Reserved for hockey. No variants defined yet.",
      "required": ["player", "type"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "check" },
        "on_player": { "$ref": "#/definitions/entity_ref" },
        "physicality": { "$ref": "#/definitions/physicality" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },
```

- [ ] **Step 2: Add the four skeletons to the `action` oneOf**

Find `"action": { ... "oneOf": [ ... ] }` and append:

```json
        { "$ref": "#/definitions/action_move" },
        { "$ref": "#/definitions/action_cut" },
        { "$ref": "#/definitions/action_screen" },
        { "$ref": "#/definitions/action_defend" },
        { "$ref": "#/definitions/action_dribble" },
        { "$ref": "#/definitions/action_pass" },
        { "$ref": "#/definitions/action_shoot" },
        { "$ref": "#/definitions/action_rebound" },
        { "$ref": "#/definitions/action_pickup" },
        { "$ref": "#/definitions/action_tackle" },
        { "$ref": "#/definitions/action_clear" },
        { "$ref": "#/definitions/action_faceoff" },
        { "$ref": "#/definitions/action_check" }
```

- [ ] **Step 3: Extend the `action_ref` pattern to include the new types**

Change (line ~214):

```json
      "pattern": "^((offense|defense)_[1-9]|coach|(cone|station)_[1-9][0-9]*)\\.(move|cut|screen|defend|dribble|pass|shoot|rebound|pickup)$"
```

to:

```json
      "pattern": "^((offense|defense)_[1-9]|coach|(cone|station)_[1-9][0-9]*)\\.(move|cut|screen|defend|dribble|pass|shoot|rebound|pickup|tackle|clear|faceoff|check)$"
```

- [ ] **Step 4: Verify schema compiles and existing examples still validate**

Run: `npx ajv compile --spec=draft7 -s schema/v1.json -c ajv-formats`
Expected: `schema schema/v1.json is valid`.
Run: `npm run validate`
Expected: all `examples/*.ocf.json` valid (the new types are not used by any example, so no change).

- [ ] **Step 5: Commit**

```bash
git add schema/v1.json
git commit -m "feat(schema): add reserved skeleton action types (tackle/clear/faceoff/check) for invasion sports"
```

---

### Task 2: Add the `sport` field + fold the sport conditional into a single `allOf` with the existing custom-ruleset conditional

**Files:**
- Modify: `schema/v1.json` (top-level `properties`; the existing top-level `if`/`then` at ~line 660-670)

**IMPORTANT:** draft-07 permits only ONE top-level `if`. The schema already has one (`if court.ruleset == custom then require custom_dimensions`). It MUST be moved into an `allOf` alongside the new sport branches, or the sport conditional will silently replace it and break custom-ruleset validation.

- [ ] **Step 1: Add the `sport` property to top-level `properties`**

In the top-level `"properties": { ... }` (after `$schema`), add:

```json
    "sport": {
      "type": "string",
      "enum": ["basketball", "soccer", "handball", "hockey", "futsal"],
      "default": "basketball",
      "$comment": "Optional, default basketball (back-compat). Intended to become required in v2.0.0. basketball is fully defined; soccer/handball/hockey/futsal carry provisional minimal action whitelists pending sport-expert review."
    },
```

- [ ] **Step 2: Replace the standalone top-level `if`/`then` with an `allOf`**

Find the current top-level (near the end, after `"additionalProperties": false,`):

```json
  "if": {
    "type": "object",
    "properties": { "court": { "type": "object", "properties": { "ruleset": { "const": "custom" } } } }
  },
  "then": {
    "type": "object",
    "properties": {
      "court": {
        "type": "object",
        "required": ["custom_dimensions"]
      }
    }
  }
```

Replace it with an `allOf` that keeps the custom-ruleset rule AND adds the sport branches. Each sport branch restricts `frames[].actions[].type` to that sport's whitelist:

```json
  "allOf": [
    {
      "if": {
        "type": "object",
        "properties": { "court": { "type": "object", "properties": { "ruleset": { "const": "custom" } } } }
      },
      "then": {
        "type": "object",
        "properties": { "court": { "type": "object", "required": ["custom_dimensions"] } }
      }
    },
    {
      "$comment": "sport absent OR basketball -> basketball action whitelist (default is a non-validating annotation, so absence must be handled explicitly for back-compat)",
      "if": {
        "anyOf": [
          { "not": { "required": ["sport"] } },
          { "properties": { "sport": { "const": "basketball" } } }
        ]
      },
      "then": {
        "properties": { "frames": { "items": { "properties": { "actions": { "items": {
          "properties": { "type": { "enum": ["move","cut","screen","defend","dribble","pass","shoot","rebound","pickup"] } }
        } } } } } }
      }
    },
    {
      "if": { "required": ["sport"], "properties": { "sport": { "const": "soccer" } } },
      "then": {
        "properties": { "frames": { "items": { "properties": { "actions": { "items": {
          "properties": { "type": { "enum": ["move","pass","shoot","defend","dribble","tackle","clear"] } }
        } } } } } }
      }
    },
    {
      "if": { "required": ["sport"], "properties": { "sport": { "const": "handball" } } },
      "then": {
        "properties": { "frames": { "items": { "properties": { "actions": { "items": {
          "properties": { "type": { "enum": ["move","pass","shoot","defend","cut","screen","pickup"] } }
        } } } } } }
      }
    },
    {
      "if": { "required": ["sport"], "properties": { "sport": { "const": "hockey" } } },
      "then": {
        "properties": { "frames": { "items": { "properties": { "actions": { "items": {
          "properties": { "type": { "enum": ["move","pass","shoot","defend","dribble","clear","faceoff","check"] } }
        } } } } } }
      }
    },
    {
      "if": { "required": ["sport"], "properties": { "sport": { "const": "futsal" } } },
      "then": {
        "properties": { "frames": { "items": { "properties": { "actions": { "items": {
          "properties": { "type": { "enum": ["move","pass","shoot","defend","dribble","tackle","clear"] } }
        } } } } } }
      }
    }
  ]
```

- [ ] **Step 3: Verify schema compiles**

Run: `npx ajv compile --spec=draft7 -s schema/v1.json -c ajv-formats`
Expected: `schema schema/v1.json is valid`.

- [ ] **Step 4: Verify back-compat — existing (sport-less) examples still validate**

Run: `npm run validate`
Expected: all `examples/*.ocf.json` valid. Existing basketball examples have no `sport` field and use only basketball action types, so the sport-absent basketball branch keeps them valid. If any fails, STOP — the `anyOf` back-compat guard is wrong.

- [ ] **Step 5: Verify the custom-ruleset rule still works**

Run: `npm run test:invalid` (the invalid fixtures include ruleset/dimension cases) — must still pass.
Also confirm a custom-ruleset doc without `custom_dimensions` is still rejected:
`node -e "const a=require('child_process').execFileSync('npx',['ajv','validate','--spec=draft7','-s','schema/v1.json','-c','ajv-formats','-d','/dev/stdin'],{input: JSON.stringify({meta:{id:'9f8b7c6d-5e4a-4b3c-2d1e-0f9a8b7c6d5e',title:'x'},court:{ruleset:'custom',type:'half_court'},entities:[],frames:[{id:'f',actions:[],end_state:{}}]}),stdio:['pipe','pipe','pipe']}); " 2>&1 | grep -qi "custom_dimensions\|invalid\|passed" && echo "custom rule intact" || echo "check custom rule"`
Expected: the custom-without-dimensions doc is rejected (custom rule preserved).

- [ ] **Step 6: Commit**

```bash
git add schema/v1.json
git commit -m "feat(schema): add optional sport field + per-sport action whitelist (RFC 0003)"
```

---

### Task 3: Valid fixtures (sport field + back-compat)

**Files:**
- Create: `examples/sport-basketball.ocf.json`
- Create: `examples/sport-soccer.ocf.json`

- [ ] **Step 1: Write a basketball fixture that declares `sport` and uses a gated type**

Create `examples/sport-basketball.ocf.json`:

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "sport": "basketball",
  "meta": { "id": "a1b2c3d4-1111-4a6e-8f0c-2d5e9a1b3c7f", "title": "Sport-tagged basketball", "created": "2026-08-27T10:00:00Z", "source_format": "open" },
  "court": { "ruleset": "fiba", "type": "half_court", "drill_focus": "offense" },
  "entities": [
    { "type": "offense", "nr": 1, "x": 0.0, "y": 5.68 },
    { "type": "offense", "nr": 4, "x": -2.45, "y": 8.2 }
  ],
  "balls": [ { "id": "ball_1", "carried_by": "offense_1" } ],
  "frames": [
    { "id": "f1", "label": "Screen", "description": "big sets a ball screen",
      "actions": [ { "player": "offense_4", "type": "screen", "for_player": "offense_1", "variant": "ball_screen" } ],
      "end_state": { "offense_1": { "named": "top_of_the_key" }, "offense_4": { "x": -0.5, "y": 6.7 } } }
  ]
}
```

- [ ] **Step 2: Write a soccer fixture using only its provisional whitelist**

Create `examples/sport-soccer.ocf.json` (uses `tackle`, valid for soccer; ruleset must be `custom` since soccer has no basketball ruleset — provide custom_dimensions):

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "sport": "soccer",
  "meta": { "id": "b2c3d4e5-2222-4a6e-8f0c-2d5e9a1b3c7f", "title": "Sport-tagged soccer (provisional)", "created": "2026-08-27T10:00:00Z", "source_format": "open" },
  "court": { "ruleset": "custom", "type": "full_court", "custom_dimensions": { "unit": "m", "length": 105, "width": 68, "basket_from_baseline": 0, "three_point_distance": 0, "paint_width": 40.3, "paint_depth": 16.5, "free_throw_distance": 11 } },
  "entities": [
    { "type": "offense", "nr": 9, "x": 0.0, "y": 30.0 },
    { "type": "defense", "nr": 4, "x": 0.0, "y": 40.0 }
  ],
  "balls": [ { "id": "ball_1", "carried_by": "offense_9" } ],
  "frames": [
    { "id": "f1", "label": "Tackle", "description": "defender challenges",
      "actions": [ { "player": "defense_4", "type": "tackle" }, { "player": "offense_9", "type": "pass", "to_player": "offense_9" } ],
      "end_state": { "offense_9": { "x": 0.0, "y": 30.0 }, "defense_4": { "x": 0.0, "y": 38.0 } } }
  ]
}
```

Note: the soccer custom_dimensions reuse the basketball-shaped `custom_dimensions` object (required fields filled with soccer-ish values / zeros where N/A). This is a known limitation flagged in the RFC's open questions; the fixture's purpose is to exercise the sport whitelist, not model a correct pitch.

- [ ] **Step 3: Validate both**

Run: `npm run validate`
Expected: both new fixtures report valid (plus all existing).

- [ ] **Step 4: Commit**

```bash
git add examples/sport-basketball.ocf.json examples/sport-soccer.ocf.json
git commit -m "test(schema): add valid fixtures for sport-tagged basketball and soccer"
```

---

### Task 4: Invalid fixtures (sport whitelist enforcement)

**Files:**
- Create: `examples/invalid/sport-unknown.json`
- Create: `examples/invalid/sport-basketball-tackle.json`
- Create: `examples/invalid/sport-soccer-screen.json`

- [ ] **Step 1: Write the three invalid fixtures**

`examples/invalid/sport-unknown.json` (sport not in enum):
```json
{
  "sport": "volleyball",
  "meta": { "id": "c3d4e5f6-3333-4a6e-8f0c-2d5e9a1b3c7f", "title": "Unknown sport" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [], "frames": [ { "id": "f", "actions": [], "end_state": {} } ]
}
```

`examples/invalid/sport-basketball-tackle.json` (reserved type not in basketball whitelist):
```json
{
  "sport": "basketball",
  "meta": { "id": "d4e5f6a7-4444-4a6e-8f0c-2d5e9a1b3c7f", "title": "Tackle under basketball" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "defense", "nr": 4, "x": 0, "y": 8 } ],
  "frames": [ { "id": "f", "actions": [ { "player": "defense_4", "type": "tackle" } ], "end_state": {} } ]
}
```

`examples/invalid/sport-soccer-screen.json` (basketball type not in soccer whitelist):
```json
{
  "sport": "soccer",
  "meta": { "id": "e5f6a7b8-5555-4a6e-8f0c-2d5e9a1b3c7f", "title": "Screen under soccer" },
  "court": { "ruleset": "custom", "type": "full_court", "custom_dimensions": { "unit": "m", "length": 105, "width": 68, "basket_from_baseline": 0, "three_point_distance": 0, "paint_width": 40.3, "paint_depth": 16.5, "free_throw_distance": 11 } },
  "entities": [ { "type": "offense", "nr": 4, "x": 0, "y": 8 } ],
  "frames": [ { "id": "f", "actions": [ { "player": "offense_4", "type": "screen", "for_player": "offense_4" } ], "end_state": {} } ]
}
```

- [ ] **Step 2: Confirm each is rejected for the right reason**

For each, verify it becomes VALID if the offending part is fixed (sport→basketball / remove tackle / screen→pass), the way the invalid-fixture discipline requires. Then run:
Run: `npm run test:invalid`
Expected: output includes `ok: examples/invalid/sport-unknown.json correctly rejected.` and the same for the other two, ending with `All N invalid fixture(s) correctly rejected.`

- [ ] **Step 3: Full suite**

Run: `npm test`
Expected: validate + test:invalid + test:positions all pass.

- [ ] **Step 4: Commit**

```bash
git add examples/invalid/sport-unknown.json examples/invalid/sport-basketball-tackle.json examples/invalid/sport-soccer-screen.json
git commit -m "test(schema): add invalid fixtures for sport whitelist enforcement"
```

---

### Task 5: Convention test — every sport enum value has a whitelist branch

**Files:**
- Create: `test/sport-branches.test.mjs`
- Modify: `package.json` (add `test:sport` and chain into `test`)

- [ ] **Step 1: Write the test**

Create `test/sport-branches.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));

// Collect the sports each allOf branch handles (via if.properties.sport.const,
// or the basketball anyOf branch that also matches absent sport).
function branchSports(allOf) {
  const handled = new Set();
  for (const b of allOf) {
    const c = b.if?.properties?.sport?.const;
    if (c) handled.add(c);
    // the basketball back-compat branch uses anyOf[not-required, const basketball]
    const anyOf = b.if?.anyOf;
    if (anyOf?.some((x) => x.properties?.sport?.const === "basketball")) handled.add("basketball");
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

test("basketball branch also matches an absent sport (back-compat)", () => {
  const bbBranch = schema.allOf.find((b) =>
    b.if?.anyOf?.some((x) => x.not?.required?.includes("sport")),
  );
  assert.ok(bbBranch, "a branch matches when sport is absent (default-annotation back-compat)");
});
```

- [ ] **Step 2: Wire package.json**

Change `scripts` so:
```json
    "test:sport": "node --test test/sport-branches.test.mjs",
    "test": "npm run validate && npm run test:invalid && npm run test:positions && npm run test:sport"
```

- [ ] **Step 3: Run it**

Run: `npm run test:sport`
Expected: both tests pass.

- [ ] **Step 4: Full suite**

Run: `npm test`
Expected: all four sub-suites pass.

- [ ] **Step 5: Commit**

```bash
git add test/sport-branches.test.mjs package.json
git commit -m "test(schema): assert every sport enum value has a whitelist branch + back-compat branch"
```

---

### Task 6: Seed external sport skeleton files

**Files:**
- Create: `sports/basketball-v1.json`
- Create: `sports/soccer-v0.0.1.json`
- Create: `sports/handball-v0.0.1.json`
- Create: `sports/hockey-v0.0.1.json`
- Create: `sports/futsal-v0.0.1.json`
- Modify: `package.json` (`files` + `exports` so they publish)

- [ ] **Step 1: Write `sports/basketball-v1.json` (the defined one)**

```json
{
  "$schema": "https://opencoachingformat.org/registry/sports/sport-schema-v1.json",
  "sport": "basketball",
  "version": "1.0.0",
  "status": "defined",
  "action_types": ["move","cut","screen","defend","dribble","pass","shoot","rebound","pickup"],
  "variants": {
    "cut": ["backdoor","give_and_go","flash","v_cut","l_cut","curl","flare","fade","basket"],
    "screen": ["ball_screen","back_screen","down_screen","flare_screen","cross_screen","pin_down"],
    "defend": ["on_ball","deny","help","hedge","switch","box_out"],
    "pass": ["chest","bounce","overhead","lob","baseball","hand_off","outlet"],
    "shoot": ["jumper","three","layup","floater","dunk","hook","free_throw"],
    "rebound": ["offensive","defensive"]
  },
  "outcomes": ["make","miss","turnover","steal","foul"],
  "rulesets": ["fiba","nba","ncaa","nfhs"]
}
```

- [ ] **Step 2: Write the four skeletons (structure only, `status: provisional`)**

`sports/soccer-v0.0.1.json`:
```json
{
  "$schema": "https://opencoachingformat.org/registry/sports/sport-schema-v1.json",
  "sport": "soccer",
  "version": "0.0.1",
  "status": "provisional",
  "action_types": ["move","pass","shoot","defend","dribble","tackle","clear"],
  "variants": {},
  "outcomes": [],
  "rulesets": []
}
```

`sports/handball-v0.0.1.json`:
```json
{
  "$schema": "https://opencoachingformat.org/registry/sports/sport-schema-v1.json",
  "sport": "handball",
  "version": "0.0.1",
  "status": "provisional",
  "action_types": ["move","pass","shoot","defend","cut","screen","pickup"],
  "variants": {},
  "outcomes": [],
  "rulesets": []
}
```

`sports/hockey-v0.0.1.json`:
```json
{
  "$schema": "https://opencoachingformat.org/registry/sports/sport-schema-v1.json",
  "sport": "hockey",
  "version": "0.0.1",
  "status": "provisional",
  "action_types": ["move","pass","shoot","defend","dribble","clear","faceoff","check"],
  "variants": {},
  "outcomes": [],
  "rulesets": []
}
```

`sports/futsal-v0.0.1.json`:
```json
{
  "$schema": "https://opencoachingformat.org/registry/sports/sport-schema-v1.json",
  "sport": "futsal",
  "version": "0.0.1",
  "status": "provisional",
  "action_types": ["move","pass","shoot","defend","dribble","tackle","clear"],
  "variants": {},
  "outcomes": [],
  "rulesets": []
}
```

- [ ] **Step 3: Add a consistency test that these files match the schema branches**

Append to `test/sport-branches.test.mjs`:
```javascript
import { readdirSync } from "node:fs";

test("each sport skeleton's action_types matches its schema whitelist branch", () => {
  const dir = new URL("../sports/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const branchWhitelist = (sport) => {
    for (const b of schema.allOf) {
      const isBB = b.if?.anyOf?.some((x) => x.properties?.sport?.const === "basketball");
      const c = b.if?.properties?.sport?.const;
      if ((sport === "basketball" && isBB) || c === sport) {
        return b.then.properties.frames.items.properties.actions.items.properties.type.enum;
      }
    }
    return null;
  };
  for (const f of files) {
    const data = JSON.parse(readFileSync(new URL(f, dir), "utf-8"));
    const wl = branchWhitelist(data.sport);
    assert.ok(wl, `no schema branch for sport ${data.sport}`);
    assert.deepEqual([...data.action_types].sort(), [...wl].sort(),
      `${f} action_types must match the schema whitelist for ${data.sport}`);
  }
});
```

- [ ] **Step 4: Publish the sports/ directory**

In `package.json`, add `"sports"` to `files`, and add exports:
```json
    "./sports/basketball-v1.json": "./sports/basketball-v1.json",
    "./sports/soccer-v0.0.1.json": "./sports/soccer-v0.0.1.json",
    "./sports/handball-v0.0.1.json": "./sports/handball-v0.0.1.json",
    "./sports/hockey-v0.0.1.json": "./sports/hockey-v0.0.1.json",
    "./sports/futsal-v0.0.1.json": "./sports/futsal-v0.0.1.json"
```

- [ ] **Step 5: Run + commit**

Run: `npm run test:sport`
Expected: all sport tests pass (including the new skeleton-consistency test).

```bash
git add sports/ test/sport-branches.test.mjs package.json
git commit -m "feat(sports): seed basketball vocabulary + provisional sport skeletons"
```

---

### Task 7: Docs + version bump + RFC status

**Files:**
- Modify: `docs/specification-v1.adoc` (add a `sport` section; reconcile framing)
- Modify: `README.md` (framing)
- Modify: `package.json` (version → 1.2.0)
- Modify: `schema/v1.json` (`$comment` version → 1.2.0)
- Modify: `docs/specification-v1.adoc` (`:version:` → 1.2.0 + changelog)
- Modify: `rfcs/0003-sport-scoping.md` (Status → Accepted)

- [ ] **Step 1: Add a `sport` section to the spec doc**

Insert a new `== Sport` section (after the intro, before actions). Content:

```asciidoc
== Sport

OCF targets **invasion team sports** — two teams sharing a field, ball/puck
possession, and off-ball movement (basketball, soccer, handball, hockey,
futsal). Basketball is fully defined; the others are reserved with provisional
action vocabularies.

The optional `sport` field declares the sport:

[source,json]
----
"sport": "basketball"
----

`sport` is optional and defaults to `basketball` for backwards compatibility;
it is planned to become required in v2. The declared sport determines which
action types (and variants) are valid — e.g. `screen`/`rebound` are valid under
`basketball`, `tackle`/`clear` under `soccer`. Documents with no `sport` field
are treated as basketball.
----
```

- [ ] **Step 2: Reconcile the framing (description + README)**

In `schema/v1.json`, change `description` to:
```json
  "description": "Open standard for team-sport coaching diagrams and animations (invasion team sports; basketball first). Semantic action model.",
```
In `README.md`, adjust the tagline/first lines to say "invasion team sports, basketball first" rather than implying full multi-sport today (keep it truthful).

- [ ] **Step 3: Bump version to 1.2.0 in all four places**

- `package.json`: `"version": "1.2.0"`
- `schema/v1.json` `$comment`: `"Schema version 1.2.0. ..."` (keep the rest of the sentence)
- `docs/specification-v1.adoc` `:version:`: `1.2.0`
- Add a changelog entry:
```asciidoc
=== v1.2.0

Adds the optional `sport` field and per-sport action-type scoping (RFC 0003).
Basketball is fully defined; soccer/handball/hockey/futsal are reserved with
provisional vocabularies. Additive and backwards-compatible — documents without
a `sport` field validate as basketball.
```

- [ ] **Step 4: Mark RFC accepted**

In `rfcs/0003-sport-scoping.md`, change Status `Draft` → `Accepted`.

- [ ] **Step 5: Build the site + full suite**

Run: `cd site && npm run build` (asciidoctor must parse the new section) — expect success.
Run: `npm test` — all sub-suites pass.

- [ ] **Step 6: Commit**

```bash
git add docs/specification-v1.adoc README.md package.json schema/v1.json rfcs/0003-sport-scoping.md
git commit -m "docs: document sport scoping, reconcile framing, bump to 1.2.0, accept RFC 0003"
```

---

## Self-Review Notes

- **Spec coverage (RFC 0003):** `sport` field → Task 2; per-sport whitelist + fold with custom-ruleset `if` → Task 2; reserved skeleton action types + `action_ref` → Task 1; external sport skeletons → Task 6; valid/invalid fixtures → Tasks 3/4; back-compat (sport-absent) → Task 2 Step 4 + Task 5 back-compat test; convention "every enum value has a branch" → Task 5; docs/framing/version → Task 7.
- **The single-`if` trap is handled explicitly** (Task 2): the existing custom-ruleset `if/then` is folded into the new `allOf`, with a verification step that the custom rule still rejects a custom doc lacking `custom_dimensions`.
- **Back-compat is the highest-risk item** and is verified twice: existing examples still validate (Task 2 Step 4) and a dedicated test asserts the sport-absent branch exists (Task 5).
- **Type consistency:** the whitelist enums in the schema (Task 2), the skeleton `action_types` (Task 6), and the fixtures (Tasks 3/4) all use the same per-sport action sets; Task 6's consistency test enforces schema↔skeleton agreement so they can't drift.
- **Known limitation flagged, not hidden:** soccer/etc. reuse the basketball-shaped `custom_dimensions` (RFC open question); fixtures note this. Provisional non-basketball whitelists are marked provisional in schema `$comment`, skeleton `status`, and the RFC.
