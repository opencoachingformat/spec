# Frame-less Action Model — Plan 1: Schema Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `frames[]` with a flat `actions[]` array in `schema/v1.json`, give every action a unique `id`, and replace `after`/`with`/`on_catch` with a unified `trigger` field — the structural core of the frame-less action model design (`docs/superpowers/specs/2026-09-05-frameless-action-model-design.md`).

**Architecture:** All work happens in `schema/v1.json` (a single JSON Schema draft-07 document) plus its five `allOf`/`if-then` sport-scoping branches, which must all be updated in lockstep. Two new/changed shared definitions (`action_id`, `trigger`) replace `action_ref`. Every one of the 13 `action_*` definitions gets the same three-field swap. This plan does NOT touch `branch`/`continuum` (Plan 2), the 10 example fixtures (Plan 2), `specification-v1.adoc` prose (Plan 2), or the `ocf-validator` repo (Plan 3) — it only makes the raw schema internally consistent and independently testable via new unit tests against the schema JSON itself (no example files need to validate yet; that's Plan 2's job once fixtures are migrated).

**Tech Stack:** JSON Schema draft-07, Node.js `node:test` + `node:assert/strict` (existing project convention, see `test/sport-branches.test.mjs`), AJV (`ajv-cli`, already a dependency, used only to sanity-check the schema itself compiles).

---

## Before you start

Run this once to confirm the schema currently compiles and existing tests pass, so you have a clean baseline:

```bash
cd /Users/oliver-marcuseder/01-vibe-coding/00-Basektball/open-coaching-format/spec-frameless-action-model
npm run test:sport
```

Expected: all tests PASS (this exercises `test/sport-branches.test.mjs`, which reads `schema/v1.json` directly).

---

### Task 1: Add `action_id` and `trigger` definitions

**Files:**
- Modify: `schema/v1.json` (add two new entries to `"definitions"`)
- Test: `test/frameless-trigger.test.mjs` (new)

- [ ] **Step 1: Write the failing test**

Create `test/frameless-trigger.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));
const defs = schema.definitions;

test("action_id definition exists and is a non-empty string pattern", () => {
  const d = defs.action_id;
  assert.ok(d, "definitions.action_id must exist");
  assert.equal(d.type, "string");
  assert.ok(typeof d.pattern === "string" && d.pattern.length > 0, "action_id must have a pattern");
});

test("trigger definition exists with the correct type enum and ref requirement", () => {
  const d = defs.trigger;
  assert.ok(d, "definitions.trigger must exist");
  assert.equal(d.type, "object");
  assert.deepEqual(d.required, ["type"]);
  assert.equal(d.properties.type.type, "string");
  // type is sport-extensible (open vocabulary) but must at least document the
  // four known values via enum-like guidance; we keep it a free string with
  // one exception: reception carries no ref, others require one. Enforced via
  // if/then below, not by restricting the enum (open vocabulary requirement).
  assert.ok(Array.isArray(d.allOf) || Array.isArray(d.oneOf) || d.if,
    "trigger must conditionally require ref for non-reception types");
  assert.equal(d.properties.ref.$ref, "#/definitions/action_id");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/frameless-trigger.test.mjs`
Expected: FAIL — `definitions.action_id must exist` (defs.action_id is undefined).

- [ ] **Step 3: Add the definitions to schema/v1.json**

In `schema/v1.json`, inside `"definitions"`, add these two entries right after the existing `"action_ref"` definition (do not delete `action_ref` yet — Task 3 removes it once nothing references it):

```json
    "action_id": {
      "type": "string",
      "description": "Unique identifier for an action within the document. Author-chosen, must be unique across the whole actions[] sequence (including inside branch cases).",
      "minLength": 1,
      "pattern": "^[a-zA-Z0-9_-]+$"
    },

    "trigger": {
      "type": "object",
      "description": "Explicit timing coupling between this action and another action, or an implicit event on this action's own actor (e.g. receiving the ball). Replaces the old after/with/on_catch fields.",
      "required": ["type"],
      "properties": {
        "type": {
          "type": "string",
          "description": "action_end/action_start/action_overlap require 'ref'. 'reception' fires on this action's own actor receiving the ball and takes no ref. Sport definitions may add further open trigger types (e.g. a hockey 'faceoff_won') without a schema change."
        },
        "ref": { "$ref": "#/definitions/action_id" }
      },
      "additionalProperties": false,
      "if": {
        "properties": { "type": { "enum": ["action_end", "action_start", "action_overlap"] } }
      },
      "then": {
        "required": ["type", "ref"]
      }
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/frameless-trigger.test.mjs`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add schema/v1.json test/frameless-trigger.test.mjs
git commit -m "feat(schema): add action_id and trigger definitions"
```

---

### Task 2: Validate `trigger`'s conditional ref requirement behaviorally

**Files:**
- Modify: `test/frameless-trigger.test.mjs`
- Test fixtures used inline (no new files)

- [ ] **Step 1: Write the failing test**

Add an AJV import at the top of `test/frameless-trigger.test.mjs` (after the existing imports) and one helper function:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));
const defs = schema.definitions;

function compileDef(name) {
  const ajv = new Ajv({ schemas: [schema], strict: false });
  addFormats(ajv);
  return ajv.compile({ $ref: `${schema.$id}#/definitions/${name}` });
}
```

Then append a new test to the end of the file:

```javascript
test("trigger requires ref for action_end/action_start/action_overlap but not for reception", () => {
  const validate = compileDef("trigger");

  assert.equal(validate({ type: "reception" }), true, "reception needs no ref");
  assert.equal(validate({ type: "action_end", ref: "a1" }), true, "action_end with ref is valid");
  assert.equal(validate({ type: "action_end" }), false, "action_end without ref must fail");
  assert.equal(validate({ type: "action_start" }), false, "action_start without ref must fail");
  assert.equal(validate({ type: "action_overlap" }), false, "action_overlap without ref must fail");
  assert.equal(validate({ type: "custom_sport_trigger" }), true,
    "unknown/sport-extensible type with no ref is allowed (open vocabulary, no ref required by default)");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/frameless-trigger.test.mjs`
Expected: FAIL if `ajv`/`ajv-formats` aren't already installed as accessible imports, or PASS/FAIL depending on the if/then logic — run it first to see the actual failure mode before assuming.

Check first whether `ajv` is a direct dependency:

```bash
cat package.json | grep -A5 '"dependencies"\|"devDependencies"'
```

If `ajv` is not listed, install it as a dev dependency:

```bash
npm install --save-dev ajv ajv-formats
```

- [ ] **Step 3: Run test again after ensuring ajv is installed**

Run: `node --test test/frameless-trigger.test.mjs`
Expected: PASS, since Task 1's `trigger` definition already has the correct `if/then`. If it fails, the `if/then` in Task 1 Step 3 needs the `then.required` fixed to include `"ref"` — re-check that block.

- [ ] **Step 4: Commit**

```bash
git add test/frameless-trigger.test.mjs package.json package-lock.json
git commit -m "test(schema): verify trigger's conditional ref requirement via ajv"
```

---

### Task 3: Replace `after`/`with`/`on_catch` with `trigger` and `action_ref` with `id` on all 13 action types

**Files:**
- Modify: `schema/v1.json` (all of `action_move`, `action_cut`, `action_screen`, `action_defend`, `action_dribble`, `action_pass`, `action_shoot`, `action_rebound`, `action_pickup`, `action_tackle`, `action_clear`, `action_faceoff`, `action_check`)
- Test: `test/frameless-action-shape.test.mjs` (new)

This is the largest mechanical task: every one of the 13 action definitions currently has this exact trailing block:

```json
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
```

It becomes:

```json
        "id": { "$ref": "#/definitions/action_id" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "trigger": { "$ref": "#/definitions/trigger" }
```

And each action's `"required": [...]` array gains `"id"` as a required field (every action must be identifiable now — this is the whole point of the redesign).

- [ ] **Step 1: Write the failing test**

Create `test/frameless-action-shape.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));
const defs = schema.definitions;

const ACTION_DEFS = [
  "action_move", "action_cut", "action_screen", "action_defend", "action_dribble",
  "action_pass", "action_shoot", "action_rebound", "action_pickup",
  "action_tackle", "action_clear", "action_faceoff", "action_check",
];

for (const name of ACTION_DEFS) {
  test(`${name} requires id and has no after/with/on_catch`, () => {
    const d = defs[name];
    assert.ok(d, `${name} must exist`);
    assert.ok(d.required.includes("id"), `${name}.required must include "id"`);
    assert.equal(d.properties.id?.$ref, "#/definitions/action_id", `${name}.properties.id must ref action_id`);
    assert.equal(d.properties.after, undefined, `${name} must not have "after" anymore`);
    assert.equal(d.properties.with, undefined, `${name} must not have "with" anymore`);
    assert.equal(d.properties.on_catch, undefined, `${name} must not have "on_catch" anymore`);
    assert.equal(d.properties.trigger?.$ref, "#/definitions/trigger", `${name}.properties.trigger must ref trigger`);
  });
}

test("action_ref definition is fully removed (superseded by action_id)", () => {
  assert.equal(defs.action_ref, undefined, "action_ref must be deleted once nothing references it");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/frameless-action-shape.test.mjs`
Expected: FAIL — every action still has `after`/`with`/`on_catch` and lacks `id`; `action_ref` still exists.

- [ ] **Step 3: Update all 13 action definitions in schema/v1.json**

For **each** of the 13 action definitions listed above, make two edits:

1. Add `"id"` to the front of that definition's `"required"` array (e.g. `action_move`'s `"required": ["player", "type", "moves"]` becomes `"required": ["id", "player", "type", "moves"]`).
2. Replace the trailing three-line block:
   ```json
           "tags": { "type": "array", "items": { "type": "string" } },
           "after": { "$ref": "#/definitions/action_ref" },
           "with": { "$ref": "#/definitions/action_ref" },
           "on_catch": { "type": "boolean" }
   ```
   with:
   ```json
           "id": { "$ref": "#/definitions/action_id" },
           "tags": { "type": "array", "items": { "type": "string" } },
           "trigger": { "$ref": "#/definitions/trigger" }
   ```

Do this for all 13: `action_move`, `action_cut`, `action_screen`, `action_defend`, `action_dribble`, `action_pass`, `action_shoot`, `action_rebound`, `action_pickup`, `action_tackle`, `action_clear`, `action_faceoff`, `action_check`.

Then delete the `action_ref` definition entirely (it's no longer referenced by anything once this step is done):

```json
    "action_ref": {
      "type": "string",
      "description": "Reference to another action in the same frame: '<entity_ref>.<action_type>'.",
      "pattern": "^((offense|defense)_[1-9]|coach|(cone|station)_[1-9][0-9]*)\\.(move|cut|screen|defend|dribble|pass|shoot|rebound|pickup|tackle|clear|faceoff|check)$"
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/frameless-action-shape.test.mjs`
Expected: PASS (all 14 tests — 13 action shapes + the action_ref-removed check).

- [ ] **Step 5: Run the full existing test suite to check for fallout**

Run: `npm run test:sport`
Expected: This WILL fail — `test/sport-branches.test.mjs` navigates
`b.then.properties.frames.items.properties.actions.items.properties.type.enum`,
and `frames` still exists at this point (Task 4 removes it). Confirm the
failure is specifically about `frames` still being present, not a new
unrelated error, then proceed — Task 4 fixes this.

- [ ] **Step 6: Commit**

```bash
git add schema/v1.json test/frameless-action-shape.test.mjs
git commit -m "feat(schema): give every action a unique id, replace after/with/on_catch with trigger"
```

---

### Task 4: Replace `frames[]` with `actions[]` at the document root

**Files:**
- Modify: `schema/v1.json` (top-level `required`, `properties.frames` → `properties.actions`, all 5 `allOf` sport-scoping branches, delete unused `frame`/`outcome` definitions' frame-specific wiring — but NOT `outcome`, which Plan 2's `branch` construct reuses)
- Modify: `test/sport-branches.test.mjs` (update to navigate `actions` instead of `frames`)
- Test: `test/frameless-root.test.mjs` (new)

- [ ] **Step 1: Write the failing test**

Create `test/frameless-root.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));

test("document root requires actions, not frames", () => {
  assert.ok(schema.required.includes("actions"), "root required[] must include 'actions'");
  assert.ok(!schema.required.includes("frames"), "root required[] must not include 'frames' anymore");
});

test("actions is a top-level array property referencing the action union", () => {
  const p = schema.properties.actions;
  assert.ok(p, "properties.actions must exist");
  assert.equal(p.type, "array");
  assert.equal(p.minItems, 1);
  assert.equal(p.items.$ref, "#/definitions/action");
});

test("frames property is fully removed from the root", () => {
  assert.equal(schema.properties.frames, undefined, "properties.frames must be removed");
});

test("every sport allOf branch whitelists actions[].type, not frames[].actions[].type", () => {
  for (const branch of schema.allOf) {
    if (!branch.then?.properties) continue;
    const actionsProp = branch.then.properties.actions;
    if (actionsProp) {
      assert.equal(actionsProp.items.properties.type.enum !== undefined, true,
        "each sport branch must whitelist actions[].items.properties.type.enum directly at the root");
    }
    assert.equal(branch.then.properties.frames, undefined,
      "no sport branch should reference frames[] anymore");
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/frameless-root.test.mjs`
Expected: FAIL on all 4 tests — root still requires `frames`, has no `actions` property.

- [ ] **Step 3: Update the document root in schema/v1.json**

Change the top-level `required` array:

```json
  "required": ["meta", "court", "entities", "frames"],
```

to:

```json
  "required": ["meta", "court", "entities", "actions"],
```

Replace the `"frames"` entry under top-level `"properties"`:

```json
    "frames": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/definitions/frame" }
    },
```

with:

```json
    "actions": {
      "type": "array",
      "minItems": 1,
      "description": "Flat, ordered sequence of actions (and branch containers, added in a follow-up schema change). Framing/grouping into visual steps is entirely a renderer concern; the spec makes no framing decisions.",
      "items": { "$ref": "#/definitions/action" }
    },
```

- [ ] **Step 4: Update all 5 sport-scoping `allOf` branches**

Each of the 5 branches in the top-level `"allOf"` array currently has this shape (shown for the basketball branch; the other 4 differ only in which sport/action-type enum they list):

```json
    {
      "$comment": "sport absent OR basketball -> basketball action whitelist (default is a non-validating annotation, so absence must be handled explicitly for back-compat)",
      "if": {
        "anyOf": [
          { "not": { "required": ["sport"] } },
          { "properties": { "sport": { "const": "basketball" } } }
        ]
      },
      "then": {
        "type": "object",
        "properties": {
          "frames": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "actions": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": { "type": { "enum": ["move","cut","screen","defend","dribble","pass","shoot","rebound","pickup"] } }
                  }
                }
              }
            }
          }
        }
      }
    },
```

Change `then.properties.frames.items.properties.actions` (nested two levels: frame → actions) to `then.properties.actions` (one level: the root `actions[]` directly). The basketball branch becomes:

```json
    {
      "$comment": "sport absent OR basketball -> basketball action whitelist (default is a non-validating annotation, so absence must be handled explicitly for back-compat)",
      "if": {
        "anyOf": [
          { "not": { "required": ["sport"] } },
          { "properties": { "sport": { "const": "basketball" } } }
        ]
      },
      "then": {
        "type": "object",
        "properties": {
          "actions": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": { "type": { "enum": ["move","cut","screen","defend","dribble","pass","shoot","rebound","pickup"] } }
            }
          }
        }
      }
    },
```

Apply the same flattening (remove the `frames` → per-frame `actions` nesting, whitelist directly on the root `actions[]`) to the other 4 branches (soccer, handball, hockey, futsal), keeping each branch's existing `type` enum list unchanged — only the nesting level changes, not which action types each sport allows.

- [ ] **Step 5: Update `test/sport-branches.test.mjs`**

The `branchWhitelist` helper function currently does:

```javascript
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
```

Change the return line to match the new flattened shape:

```javascript
  const branchWhitelist = (sport) => {
    for (const b of schema.allOf) {
      const isBB = b.if?.anyOf?.some((x) => x.properties?.sport?.const === "basketball");
      const c = b.if?.properties?.sport?.const;
      if ((sport === "basketball" && isBB) || c === sport) {
        return b.then.properties.actions.items.properties.type.enum;
      }
    }
    return null;
  };
```

No other changes are needed in this file — the rest of its assertions are shape-agnostic.

- [ ] **Step 6: Run test to verify Task 4's new tests pass**

Run: `node --test test/frameless-root.test.mjs`
Expected: PASS (all 4 tests).

- [ ] **Step 7: Run the previously-broken sport-branches test to confirm it's fixed**

Run: `npm run test:sport`
Expected: PASS (all tests in `test/sport-branches.test.mjs`).

- [ ] **Step 8: Run the full test suite and confirm the two expected fixture-related failures**

Run: `npm test`
Expected: two parts of this WILL FAIL, both expected and out of scope for Plan 1 (Plan 2 migrates every fixture):

1. `npm run validate` (AJV against `examples/*.ocf.json`) fails because every valid example still uses the old `frames[]` shape and no longer matches the schema's root `required`. Confirm the failure is AJV rejecting `frames`-shaped documents (missing required `actions`), not a schema compile error.
2. `npm run test:invalid` (`scripts/check-invalid.mjs` against `examples/invalid/*.json`) will still report "ok" (correctly rejected) for every fixture — but for the WRONG reason. Every invalid fixture (e.g. `action-bad-ball-intensity.json`) also still uses `frames[]`, so it's now rejected for missing `actions` at the root rather than for the specific violation the fixture is named after (e.g. the bad `ball_intensity` enum value). The check only asserts "was this rejected", not "was it rejected for the right reason", so this won't show as a failure — it's a real gap, not a false negative in Plan 1's own tests. Do not attempt to fix this here; Plan 2 must re-verify each `examples/invalid/*.json` fixture still fails for its *original* intended reason after migrating it to the new `actions[]` shape (e.g. temporarily fix the unrelated violation and confirm the file then validates, to prove the rejection wasn't coming from something else).

Run just the schema-only tests to confirm those all pass:

```bash
node --test test/frameless-trigger.test.mjs test/frameless-action-shape.test.mjs test/frameless-root.test.mjs test/sport-branches.test.mjs test/positions-anchors.test.mjs test/schema-version.test.mjs test/versions-manifest.test.mjs
```

Expected: PASS for all of these (none of them depend on example fixture files).

- [ ] **Step 9: Commit**

```bash
git add schema/v1.json test/sport-branches.test.mjs test/frameless-root.test.mjs
git commit -m "feat(schema): replace frames[] with a flat actions[] array at the document root"
```

---

### Task 5: Add `ball_ids` (multi-ball dribble) and `side_effects` (composite actions) to `action_dribble` and the action base shape

**Files:**
- Modify: `schema/v1.json` (`action_dribble`, plus a new shared `side_effect` definition usable by any action)
- Test: `test/frameless-multiball-sideeffects.test.mjs` (new)

- [ ] **Step 1: Write the failing test**

Create `test/frameless-multiball-sideeffects.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));
const defs = schema.definitions;

function compileDef(name) {
  const ajv = new Ajv({ schemas: [schema], strict: false });
  addFormats(ajv);
  return ajv.compile({ $ref: `${schema.$id}#/definitions/${name}` });
}

test("side_effect definition exists with type/on/physicality", () => {
  const d = defs.side_effect;
  assert.ok(d, "definitions.side_effect must exist");
  assert.deepEqual(d.required, ["type", "on"]);
  assert.equal(d.properties.on.$ref, "#/definitions/entity_ref");
});

test("action_dribble accepts ball_ids with 1 or 2 entries, one per hand", () => {
  const d = defs.action_dribble;
  const p = d.properties.ball_ids;
  assert.ok(p, "action_dribble.properties.ball_ids must exist");
  assert.equal(p.type, "array");
  assert.equal(p.minItems, 1);
  assert.equal(p.maxItems, 2);
  assert.equal(p.items.$ref, "#/definitions/ball_ref");
});

test("action_dribble with two ball_ids validates", () => {
  const validate = compileDef("action_dribble");
  const ok = validate({
    id: "d1",
    player: "offense_1",
    type: "dribble",
    ball_ids: ["ball_1", "ball_2"],
    moves: [{ to: { x: 1, y: 2 } }],
  });
  assert.equal(ok, true, JSON.stringify(validate.errors));
});

test("action_dribble rejects three ball_ids (max 2 hands)", () => {
  const validate = compileDef("action_dribble");
  const ok = validate({
    id: "d1",
    player: "offense_1",
    type: "dribble",
    ball_ids: ["ball_1", "ball_2", "ball_3"],
    moves: [{ to: { x: 1, y: 2 } }],
  });
  assert.equal(ok, false);
});

test("action_pass accepts an optional side_effects array", () => {
  const validate = compileDef("action_pass");
  const ok = validate({
    id: "p1",
    player: "offense_1",
    type: "pass",
    to_player: "offense_4",
    variant: "hand_off",
    side_effects: [{ type: "screen", on: "defense_4", physicality: "normal" }],
  });
  assert.equal(ok, true, JSON.stringify(validate.errors));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/frameless-multiball-sideeffects.test.mjs`
Expected: FAIL — `side_effect` definition doesn't exist yet, `action_dribble` has no `ball_ids`, `action_pass` has no `side_effects`.

- [ ] **Step 3: Add the `side_effect` definition**

In `schema/v1.json`, inside `"definitions"`, add (near `action_id`/`trigger`):

```json
    "side_effect": {
      "type": "object",
      "description": "A secondary effect this action has on another actor, for composite actions where one physical motion does two semantic things at once (e.g. a dribble hand-off, where the passer's body also screens the receiver's defender). Open 'type' vocabulary, sport-extensible.",
      "required": ["type", "on"],
      "properties": {
        "type": { "type": "string" },
        "on": { "$ref": "#/definitions/entity_ref" },
        "physicality": { "$ref": "#/definitions/physicality" }
      },
      "additionalProperties": false
    },
```

Add `"side_effects"` as an optional property on every one of the 13 action definitions (same pattern as `tags`). For each of the 13 action defs, add this line alongside the existing `tags` property:

```json
        "side_effects": { "type": "array", "items": { "$ref": "#/definitions/side_effect" } },
```

(Only `action_pass` is exercised by the test above, but the design doc specifies this as a generic mechanism available to any action — add it to all 13 for consistency, matching how `tags` is already universal.)

- [ ] **Step 4: Add `ball_ids` to `action_dribble`**

In `schema/v1.json`, find `action_dribble`'s properties block. Add `ball_ids` alongside the existing `ball_id`:

```json
        "ball_id": { "$ref": "#/definitions/ball_ref" },
        "ball_ids": {
          "type": "array",
          "description": "Two-ball dribbling: one ball per hand. Use ball_id for the single-ball case; use ball_ids (not both) when this action controls two balls simultaneously.",
          "minItems": 1,
          "maxItems": 2,
          "items": { "$ref": "#/definitions/ball_ref" }
        },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/frameless-multiball-sideeffects.test.mjs`
Expected: PASS (all 5 tests).

- [ ] **Step 6: Run the full schema-only test set again**

Run:

```bash
node --test test/frameless-trigger.test.mjs test/frameless-action-shape.test.mjs test/frameless-root.test.mjs test/frameless-multiball-sideeffects.test.mjs test/sport-branches.test.mjs test/positions-anchors.test.mjs test/schema-version.test.mjs test/versions-manifest.test.mjs
```

Expected: PASS for all.

- [ ] **Step 7: Commit**

```bash
git add schema/v1.json test/frameless-multiball-sideeffects.test.mjs
git commit -m "feat(schema): add side_effects (composite actions) and ball_ids (two-ball dribbling)"
```

---

## Plan 1 completion checklist

- [x] `action_id` + `trigger` definitions added, `action_ref` removed
- [x] All 13 action types: unique required `id`, `trigger` replaces `after`/`with`/`on_catch`
- [x] Document root: `actions[]` replaces `frames[]`, all 5 sport `allOf` branches updated
- [x] `side_effects[]` on every action type
- [x] `ball_ids[]` (max 2) on `action_dribble`
- [ ] NOT done here (Plan 2): `branch`/`continuum` constructs, example fixture migration, `specification-v1.adoc` prose update
- [ ] NOT done here (Plan 3): `ocf-validator` repo (TS + Python) possession/coherence/references rule updates

At the end of Plan 1, `npm run validate` against the existing `examples/*.ocf.json` files is EXPECTED to fail (they still use the old `frames[]` shape) — this is not a regression, it's the reason Plan 2 exists.

**Important handoff note for Plan 2:** `npm run test:invalid` will keep reporting all fixtures in `examples/invalid/` as correctly rejected throughout Plan 1, but for the wrong reason (missing root `actions`, not each fixture's intended violation — see Task 4 Step 8). When Plan 2 migrates these fixtures to the new `actions[]` shape, each one must be re-verified to still fail for its *original* intended reason (e.g. by temporarily fixing the fixture's specific violation and confirming it then validates), not just "still rejected."
