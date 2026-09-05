# Frame-less Action Model — Plan 2: Branch/Continuum, Example Migration & Docs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `branch` action-sequence container and drill-level `continuum` flag to `schema/v1.json`, migrate all 10 files in `examples/*.ocf.json` (plus the invalid fixtures affected by Plan 1's root shape change) to the new `actions[]`/`trigger`/`id` shape, and update `docs/specification-v1.adoc` prose to match.

**Architecture:** This plan assumes Plan 1 is fully merged (schema root is `actions[]`, every action has `id`, `trigger` replaces `after`/`with`/`on_catch`, `side_effects`/`ball_ids` exist). It adds two more schema definitions (`branch`, the drill-level `continuum` property), then works through every example file one at a time (each is a self-contained JSON document, safe to migrate independently), and finishes with the prose doc. Does NOT touch the `ocf-validator` repo (Plan 3).

**Tech Stack:** Same as Plan 1 — JSON Schema draft-07, `node:test`, AJV via `ajv-cli` (`npm run validate`) and the `ajv`/`ajv-formats` packages already added in Plan 1.

---

## Before you start

Confirm Plan 1 is complete and its tests pass:

```bash
cd /Users/oliver-marcuseder/01-vibe-coding/00-Basektball/open-coaching-format/spec-frameless-action-model
node --test test/frameless-trigger.test.mjs test/frameless-action-shape.test.mjs test/frameless-root.test.mjs test/frameless-multiball-sideeffects.test.mjs test/sport-branches.test.mjs
```

Expected: PASS for all. If any fail, Plan 1 is not actually complete — stop and finish it first.

Also confirm the two EXPECTED failures from Plan 1 are still present (they are what this plan fixes):

```bash
npm run validate
```

Expected: FAIL (every `examples/*.ocf.json` file still has `frames[]`, not `actions[]`).

---

### Task 1: Add the `branch` definition and reference it from the `action` union

**Files:**
- Modify: `schema/v1.json` (new `branch` definition; `actions[]` items become `oneOf action or branch`)
- Test: `test/frameless-branch.test.mjs` (new)

The `outcome` definition already exists (`make`, `miss`, `turnover`, `steal`, `foul`) and is reused unchanged.

- [ ] **Step 1: Write the failing test**

Create `test/frameless-branch.test.mjs`:

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

test("branch definition exists with id/on/cases", () => {
  const d = defs.branch;
  assert.ok(d, "definitions.branch must exist");
  assert.deepEqual(d.required, ["id", "on", "cases"]);
  assert.equal(d.properties.on.$ref, "#/definitions/action_id");
});

test("branch_case definition exists with actions[] and optional then", () => {
  const d = defs.branch_case;
  assert.ok(d, "definitions.branch_case must exist");
  assert.deepEqual(d.required, ["actions", "then"]);
  assert.equal(d.properties.then.type, "string");
});

test("a branch validates with two cases, one terminal (then: null via type null)", () => {
  const validate = compileDef("branch");
  const ok = validate({
    id: "branch_1",
    on: "shoot_1",
    cases: {
      make: { actions: [], then: "frame_reset_first_action" },
      miss: { actions: [], then: null },
    },
  });
  assert.equal(ok, true, JSON.stringify(validate.errors));
});

test("a branch_case without 'then' is rejected (terminal must be explicit null, not omitted)", () => {
  const validate = compileDef("branch_case");
  const ok = validate({ actions: [] });
  assert.equal(ok, false, "then must be required (explicit null for terminal, not an absent field)");
});

test("the top-level actions[] item can be an action OR a branch", () => {
  const p = schema.properties.actions.items;
  assert.ok(p.oneOf, "actions[].items must be oneOf [action, branch]");
  const refs = p.oneOf.map((x) => x.$ref);
  assert.ok(refs.includes("#/definitions/action"), "must include action");
  assert.ok(refs.includes("#/definitions/branch"), "must include branch");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/frameless-branch.test.mjs`
Expected: FAIL — `branch`/`branch_case` don't exist, `actions[].items` is still a plain `$ref` to `action`.

- [ ] **Step 3: Add `branch_case` and `branch` definitions to schema/v1.json**

Add these two new definitions inside `"definitions"`, right after the existing `"frame"` definition (Task 4 of this plan removes `frame` once nothing references it — for now they coexist):

```json
    "branch_case": {
      "type": "object",
      "description": "One outcome path of a branch: its own self-contained action sub-sequence, plus an explicit continuation target. 'then' is required so a validator can distinguish 'this path ends here' (then: null) from an author forgetting to continue it — never an implicit missing field.",
      "required": ["actions", "then"],
      "properties": {
        "actions": {
          "type": "array",
          "description": "Self-contained action sub-sequence for this outcome. May be empty (e.g. a 'miss' case that does nothing but continue elsewhere via 'then').",
          "items": { "$ref": "#/definitions/action" }
        },
        "then": {
          "type": ["string", "null"],
          "description": "The action id this case continues into (may be an id that precedes the branch, for a continuum loop), or null if this path ends here (a made shot with no rebound, a turnover that ends the rep, etc)."
        }
      },
      "additionalProperties": false
    },

    "branch": {
      "type": "object",
      "description": "Outcome-dependent continuation, scoped to the outcome of one action. Only actors referenced inside the triggering case's own actions[] are affected — an uninvolved actor's action is unaffected by a branch it isn't part of.",
      "required": ["id", "on", "cases"],
      "properties": {
        "id": { "$ref": "#/definitions/action_id" },
        "on": {
          "$ref": "#/definitions/action_id",
          "description": "The action whose outcome selects which case applies."
        },
        "cases": {
          "type": "object",
          "description": "Outcome -> branch_case. Not every outcome needs a case; an outcome with no case means that outcome doesn't branch (the flat sequence continues normally for unaffected actors).",
          "propertyNames": { "$ref": "#/definitions/outcome" },
          "additionalProperties": { "$ref": "#/definitions/branch_case" },
          "minProperties": 1
        }
      },
      "additionalProperties": false
    },
```

- [ ] **Step 4: Make the top-level `actions[]` items accept either an action or a branch**

Change the top-level `properties.actions.items` from:

```json
    "actions": {
      "type": "array",
      "minItems": 1,
      "description": "Flat, ordered sequence of actions (and branch containers, added in a follow-up schema change). Framing/grouping into visual steps is entirely a renderer concern; the spec makes no framing decisions.",
      "items": { "$ref": "#/definitions/action" }
    },
```

to:

```json
    "actions": {
      "type": "array",
      "minItems": 1,
      "description": "Flat, ordered sequence of actions and branch containers. Framing/grouping into visual steps is entirely a renderer concern; the spec makes no framing decisions.",
      "items": {
        "oneOf": [
          { "$ref": "#/definitions/action" },
          { "$ref": "#/definitions/branch" }
        ]
      }
    },
```

Also update `branch_case.properties.actions.items` the same way (a branch case's own sub-sequence can itself contain a nested branch — e.g. a rebound possession fork inside a make/miss fork):

```json
        "actions": {
          "type": "array",
          "description": "Self-contained action sub-sequence for this outcome. May be empty (e.g. a 'miss' case that does nothing but continue elsewhere via 'then').",
          "items": {
            "oneOf": [
              { "$ref": "#/definitions/action" },
              { "$ref": "#/definitions/branch" }
            ]
          }
        },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/frameless-branch.test.mjs`
Expected: PASS (all 5 tests).

- [ ] **Step 6: Commit**

```bash
git add schema/v1.json test/frameless-branch.test.mjs
git commit -m "feat(schema): add branch/branch_case constructs, actions[] accepts action or branch"
```

---

### Task 2: Add the drill-level `continuum` flag

**Files:**
- Modify: `schema/v1.json` (top-level `properties.continuum`)
- Test: `test/frameless-continuum.test.mjs` (new)

- [ ] **Step 1: Write the failing test**

Create `test/frameless-continuum.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));

test("continuum is an optional top-level boolean, default false", () => {
  const p = schema.properties.continuum;
  assert.ok(p, "properties.continuum must exist");
  assert.equal(p.type, "boolean");
  assert.equal(p.default, false);
  assert.ok(!schema.required.includes("continuum"), "continuum must stay optional");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/frameless-continuum.test.mjs`
Expected: FAIL — `properties.continuum` doesn't exist.

- [ ] **Step 3: Add `continuum` to the document root properties**

In `schema/v1.json`, add to the top-level `"properties"` object (alongside `actions`, `areas`, `labels`):

```json
    "continuum": {
      "type": "boolean",
      "default": false,
      "description": "When true, this play is designed to loop: its terminal state(s) are expected to match its setup state (or an explicitly designated loop anchor a branch_case's 'then' points at), so it can repeat indefinitely. Exact tolerance and non-setup loop anchors are a validator-level concern, not enforced by this schema."
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/frameless-continuum.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add schema/v1.json test/frameless-continuum.test.mjs
git commit -m "feat(schema): add drill-level continuum flag"
```

---

### Task 3: Remove the now-unreferenced `frame` definition

**Files:**
- Modify: `schema/v1.json` (delete `"frame"` from `"definitions"`)
- Test: `test/frameless-root.test.mjs` (extend)

- [ ] **Step 1: Write the failing test**

Add to `test/frameless-root.test.mjs`:

```javascript
test("frame definition is fully removed (superseded by actions[]/branch)", () => {
  const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));
  assert.equal(schema.definitions.frame, undefined, "frame definition must be deleted");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/frameless-root.test.mjs`
Expected: FAIL — `frame` still exists in `definitions`.

- [ ] **Step 3: Delete the `frame` definition from schema/v1.json**

Remove the entire `"frame": { ... }` block from `"definitions"` (it was superseded by the root `actions[]` property plus `branch`/`branch_case` in Task 1 of this plan). Nothing in the schema references `#/definitions/frame` anymore once this is deleted — confirm with:

```bash
grep -n '#/definitions/frame"' schema/v1.json
```

Expected: no output (no remaining references).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/frameless-root.test.mjs`
Expected: PASS (all 5 tests, including the new one).

- [ ] **Step 5: Commit**

```bash
git add schema/v1.json test/frameless-root.test.mjs
git commit -m "chore(schema): remove unreferenced frame definition"
```

---

### Task 4: Migrate `quick-mode.ocf.json` (simplest fixture — no branches, no `after`)

**Files:**
- Modify: `examples/quick-mode.ocf.json`

This file has 2 frames, 4 actions total, no `after`/`branches`/`on_catch` usage — the simplest possible migration, good as a template for the pattern used in every later task.

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `examples/quick-mode.ocf.json`:

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "meta": {
    "id": "b1e2d3c4-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
    "title": "Quick Sketch — Give and Go",
    "description": "Minimal example: a coach sketches a give-and-go without any detail annotations.",
    "author": "OCF Examples",
    "tags": ["quick-mode", "give-and-go"],
    "source_format": "open"
  },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [
    { "type": "offense", "nr": 1, "x": -3.0, "y": 6.0 },
    { "type": "offense", "nr": 2, "x": 3.0, "y": 6.0 }
  ],
  "balls": [ { "id": "ball_1", "carried_by": "offense_1" } ],
  "actions": [
    { "id": "a1", "player": "offense_1", "type": "pass", "to_player": "offense_2" },
    { "id": "a2", "player": "offense_1", "type": "cut", "moves": [ { "to": { "named": "basket" } } ] },
    { "id": "a3", "player": "offense_2", "type": "pass", "to_player": "offense_1" },
    { "id": "a4", "player": "offense_1", "type": "shoot" }
  ]
}
```

Notes on this migration: `frame_1`/`frame_2` and both `end_state` blocks are gone — every position is now derived from `entities[]`/`balls[]` setup plus the action sequence itself (Plan 1 design decision: no per-action state anchors). `a4`'s `shoot` needed no `trigger` (the old file had no `on_catch` here either) — it's simply `offense_1`'s next action after `a3`'s `pass` targets them, so implicit per-actor chaining already places it correctly; no explicit `trigger: {type: "reception", ...}` was needed in the original file, so none is added now (see Task 5 for a fixture where `on_catch` DOES need conversion).

- [ ] **Step 2: Validate the migrated file**

Run:

```bash
npx ajv validate --spec=draft7 --strict-schema=false -s schema/v1.json -d examples/quick-mode.ocf.json --all-errors --verbose -c ajv-formats
```

Expected: PASS (valid).

- [ ] **Step 3: Commit**

```bash
git add examples/quick-mode.ocf.json
git commit -m "migrate(examples): quick-mode.ocf.json to flat actions[]/id/trigger shape"
```

---

### Task 5: Migrate `around-player-arc.ocf.json` (confirms `around_player` is untouched)

**Files:**
- Modify: `examples/around-player-arc.ocf.json`

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `examples/around-player-arc.ocf.json`:

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "sport": "basketball",
  "meta": { "id": "3c9f7a2e-4b1d-4e6f-8a0c-2d5e9a1b3c7f", "title": "Curl around a screen (side + arc)", "description": "Shooter curls tight around a down-screen; the action-level defaults are overridden on the curl step.", "created": "2026-08-28T10:00:00Z", "source_format": "open" },
  "court": { "ruleset": "fiba", "type": "half_court", "drill_focus": "offense" },
  "entities": [
    { "type": "offense", "nr": 2, "x": -6.75, "y": 13.98 },
    { "type": "offense", "nr": 5, "x": -2.45, "y": 8.2 }
  ],
  "balls": [ { "id": "ball_1", "carried_by": "offense_2" } ],
  "actions": [
    {
      "id": "a1",
      "player": "offense_2",
      "type": "cut",
      "variant": "curl",
      "side": "left",
      "arc": "normal",
      "description": "offense_2 curls tightly around offense_5's screen, passing on the right of the screener.",
      "moves": [ { "to": { "named": "right_elbow" }, "around_player": "offense_5", "side": "right", "arc": "tight", "intensity": "fast" } ]
    }
  ]
}
```

Note: the frame's `label`/`description` ("Curl") is dropped as a frame concept and its `description` text moved onto the one action it described (Plan 1/design doc: `description` is now action-scoped). `around_player: "offense_5"` is UNCHANGED — confirming the design decision that this geometric reference stays separate from `trigger`.

- [ ] **Step 2: Validate the migrated file**

Run:

```bash
npx ajv validate --spec=draft7 --strict-schema=false -s schema/v1.json -d examples/around-player-arc.ocf.json --all-errors --verbose -c ajv-formats
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add examples/around-player-arc.ocf.json
git commit -m "migrate(examples): around-player-arc.ocf.json to flat actions[]/id/trigger shape"
```

---

### Task 6: Migrate `based-on-references.ocf.json` (and its silent-movement `end_state`) and `min-schema-version.ocf.json`

**Files:**
- Modify: `examples/based-on-references.ocf.json`
- Modify: `examples/min-schema-version.ocf.json`

`based-on-references.ocf.json` has a real wrinkle: its single frame has `"actions": []` (empty!) but an `end_state` that repositions `offense_1` and `offense_5` anyway — exactly the "silent movement" ambiguity the frame-less redesign exists to eliminate (see `[[auto-framing-future-topic]]` memory). With no `end_state` concept left, these two positions must move into `entities[]` setup directly, since nothing in the new model can express "this entity ends up somewhere with no action explaining it."

- [ ] **Step 1: Confirm neither file uses `after`/`with`/`on_catch`**

```bash
grep -n '"after"\|"with"\|"on_catch"' examples/based-on-references.ocf.json examples/min-schema-version.ocf.json
```

Expected: no output (confirmed absent by reading both files in full during planning).

- [ ] **Step 2: Rewrite `examples/based-on-references.ocf.json`**

Replace the entire contents:

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "sport": "basketball",
  "meta": {
    "id": "9f8b7c6d-5e4a-4b3c-2d1e-0f9a8b7c6d5e",
    "title": "4-Out-1-In Variant with Lineage",
    "description": "Starts from the 4 Out 1 In formation with a tighter big, recorded as a variant of an existing play.",
    "author": "OCF Examples",
    "tags": ["example", "external-references"],
    "difficulty": "intermediate",
    "created": "2026-08-26T10:00:00Z",
    "source_format": "open",
    "based_on_formation": {
      "id": "4_out_1_in",
      "title": "4 Out 1 In",
      "source": "https://opencoachingformat.org/registry/formations/basketball-v1.json",
      "source_version": "1.0.0",
      "adjustments": [
        { "entity": "offense_5", "dx": -0.5, "dy": 0, "note": "tighter to the block for this play" }
      ]
    },
    "based_on_play": {
      "id": "7c9e4f2a-1b3d-4a6e-8f0c-2d5e9a1b3c7f",
      "title": "Pick the Picker BLOB",
      "source": "https://opencoachingformat.org/playbooks/hoopsgeek-classics/index.json",
      "relationship": "variant"
    }
  },
  "court": { "ruleset": "fiba", "type": "half_court", "drill_focus": "offense" },
  "entities": [
    { "type": "offense", "nr": 1, "x": 0, "y": 5.68 },
    { "type": "offense", "nr": 2, "x": -6.75, "y": 8.6 },
    { "type": "offense", "nr": 3, "x": 6.75, "y": 8.6 },
    { "type": "offense", "nr": 4, "x": -7.5, "y": 13.98 },
    { "type": "offense", "nr": 5, "x": -0.5, "y": 10.5 }
  ],
  "balls": [ { "id": "ball_1", "carried_by": "offense_1" } ],
  "actions": []
}
```

Migration notes: the old frame's `end_state.offense_1` (`{"named": "top_of_the_key"}`, which resolves to `x: 0, y: 5.68` in FIBA — matching `offense_1`'s already-correct setup coordinates) and `end_state.offense_5` (`{"x": -0.5, "y": 10.5}`, also already matching `offense_5`'s setup coordinates) turn out to be REDUNDANT with the setup positions already in `entities[]` — this fixture's `end_state` was restating the starting formation, not describing any actual movement. This confirms the "silent movement" ambiguity the old model had no way to distinguish from "author redundantly restated the start": with `actions: []` and no other position source, the new model correctly has nothing further to state. `actions: []` is valid here because Plan 1's root `actions` property deliberately has no `minItems` constraint (a static formation/setup-only diagram with zero actions is a legitimate document — see Plan 1 Task 4 Step 3's note on this).

- [ ] **Step 3: Rewrite `examples/min-schema-version.ocf.json`**

Replace the entire contents:

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "sport": "basketball",
  "meta": {
    "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    "title": "Declares a minimum schema version",
    "min_schema_version": "1.4.0"
  },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [
    { "type": "offense", "nr": 2, "x": -6.75, "y": 13.98 }
  ],
  "actions": [
    { "id": "a1", "player": "offense_2", "type": "move", "moves": [ { "to": { "named": "right_wing" } } ] }
  ]
}
```

- [ ] **Step 4: Validate both migrated files**

```bash
npx ajv validate --spec=draft7 --strict-schema=false -s schema/v1.json -d examples/based-on-references.ocf.json --all-errors --verbose -c ajv-formats
npx ajv validate --spec=draft7 --strict-schema=false -s schema/v1.json -d examples/min-schema-version.ocf.json --all-errors --verbose -c ajv-formats
```

Expected: PASS for both.

- [ ] **Step 5: Commit**

```bash
git add examples/based-on-references.ocf.json examples/min-schema-version.ocf.json
git commit -m "migrate(examples): based-on-references.ocf.json, min-schema-version.ocf.json to flat actions[] shape"
```

---

### Task 7: Migrate `sport-basketball.ocf.json` and `sport-soccer.ocf.json`

**Files:**
- Modify: `examples/sport-basketball.ocf.json`
- Modify: `examples/sport-soccer.ocf.json`

Both files (read in full during planning) have no `after`/`with`/`on_catch` usage and no `moves` that disagree with their `end_state` — a clean mechanical migration.

- [ ] **Step 1: Rewrite `examples/sport-basketball.ocf.json`**

Replace the entire contents:

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
  "actions": [
    { "id": "a1", "player": "offense_4", "type": "screen", "for_player": "offense_1", "variant": "ball_screen", "description": "big sets a ball screen" }
  ]
}
```

- [ ] **Step 2: Rewrite `examples/sport-soccer.ocf.json`**

Replace the entire contents:

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "sport": "soccer",
  "meta": { "id": "b2c3d4e5-2222-4a6e-8f0c-2d5e9a1b3c7f", "title": "Sport-tagged soccer (provisional)", "created": "2026-08-27T10:00:00Z", "source_format": "open" },
  "court": { "ruleset": "custom", "type": "full_court", "custom_dimensions": { "unit": "m", "length": 105, "width": 68, "basket_from_baseline": 0, "three_point_distance": 0, "paint_width": 40.3, "paint_depth": 16.5, "free_throw_distance": 11 } },
  "entities": [
    { "type": "offense", "nr": 9, "x": 0.0, "y": 30.0 },
    { "type": "offense", "nr": 8, "x": 12.0, "y": 28.0 },
    { "type": "defense", "nr": 4, "x": 0.0, "y": 40.0 }
  ],
  "balls": [ { "id": "ball_1", "carried_by": "offense_9" } ],
  "actions": [
    { "id": "a1", "player": "defense_4", "type": "tackle", "description": "defender challenges the ball carrier, who releases a pass" },
    { "id": "a2", "player": "offense_9", "type": "pass", "to_player": "offense_8" }
  ]
}
```

Note: the old `end_state.defense_4` (`{"x": 0.0, "y": 38.0}`) described `defense_4` moving 2 units after the tackle, but `defense_4`'s `tackle` action (`a1`) had no `moves` field (soccer's `action_tackle` doesn't define one — it's a contact event, not a movement). This was ANOTHER instance of the old model's silent-movement ambiguity: `end_state` moved an entity with no action explaining how. Since `action_tackle` has no `moves` field in the schema (confirmed: it only has `player`, `type`, `physicality`, `tags`, plus the Plan 1 additions), this movement cannot be expressed at all in the new model without a schema change — which is out of scope here. `defense_4` simply stays at its `entities[]` setup position (`y: 40.0`) in the migrated file; the 2-unit lunge implied by the old `end_state` is dropped as an artifact of a field the new model doesn't carry forward silently.

- [ ] **Step 3: Validate both migrated files**

```bash
npx ajv validate --spec=draft7 --strict-schema=false -s schema/v1.json -d examples/sport-basketball.ocf.json --all-errors --verbose -c ajv-formats
npx ajv validate --spec=draft7 --strict-schema=false -s schema/v1.json -d examples/sport-soccer.ocf.json --all-errors --verbose -c ajv-formats
```

Expected: PASS for both.

- [ ] **Step 4: Commit**

```bash
git add examples/sport-basketball.ocf.json examples/sport-soccer.ocf.json
git commit -m "migrate(examples): sport-basketball.ocf.json, sport-soccer.ocf.json to flat actions[] shape"
```

---

### Task 8: Migrate `pick-and-roll.ocf.json` (the spec doc's Complete Example — establishes the `trigger` conversion pattern)

**Files:**
- Modify: `examples/pick-and-roll.ocf.json`

This is the file also embedded in `docs/specification-v1.adoc`'s "Complete Example" section (migrated separately in Task 12). It has 3 frames, `on_catch: true` on its final `shoot` action — the first real `trigger` conversion in this plan.

- [ ] **Step 1: Read the current file**

```bash
cat examples/pick-and-roll.ocf.json
```

(Content matches what's shown in the design doc's context section — 3 frames: screen, dribble+cut, pass+shoot with `on_catch: true` on the shoot.)

- [ ] **Step 2: Rewrite the file**

Replace the entire contents of `examples/pick-and-roll.ocf.json`:

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "meta": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "title": "Basic Pick & Roll",
    "description": "Ball handler uses a ball screen at the top of the key. Screener rolls to the basket for the finish.",
    "author": "OCF Examples",
    "tags": ["pick-and-roll", "offense", "half-court", "2-player", "beginner"],
    "difficulty": "beginner",
    "created": "2025-02-27T10:00:00Z",
    "source_format": "open"
  },
  "court": { "ruleset": "fiba", "type": "half_court", "drill_focus": "offense" },
  "entities": [
    { "type": "offense", "nr": 1, "x": 0.0, "y": 5.68 },
    { "type": "offense", "nr": 4, "x": -2.45, "y": 8.20 },
    { "type": "defense", "nr": 1, "x": 0.5, "y": 5.20 },
    { "type": "defense", "nr": 4, "x": -2.80, "y": 7.80 }
  ],
  "balls": [ { "id": "ball_1", "carried_by": "offense_1" } ],
  "actions": [
    {
      "id": "a1",
      "player": "offense_4",
      "type": "screen",
      "for_player": "offense_1",
      "on_player": "defense_1",
      "variant": "ball_screen",
      "at": { "x": -0.5, "y": 6.7 },
      "description": "offense_4 moves up from the left elbow to set a ball screen for offense_1 at the top of the key."
    },
    {
      "id": "a2",
      "player": "offense_1",
      "type": "dribble",
      "ball_id": "ball_1",
      "moves": [
        { "variant": "hesitation" },
        { "variant": "speed", "to": { "named": "left_elbow" }, "around_player": "defense_1" }
      ],
      "description": "offense_1 uses the screen and dribbles hard left toward the elbow."
    },
    {
      "id": "a3",
      "player": "offense_4",
      "type": "cut",
      "variant": "basket",
      "moves": [ { "to": { "named": "right_block" } } ],
      "tags": ["roll"],
      "trigger": { "type": "action_end", "ref": "a1" },
      "description": "offense_4 rolls to the right block."
    },
    {
      "id": "a4",
      "player": "offense_1",
      "type": "pass",
      "to_player": "offense_4",
      "ball_id": "ball_1",
      "variant": "bounce",
      "description": "offense_1 throws a bounce pass to the rolling offense_4."
    },
    {
      "id": "a5",
      "player": "offense_4",
      "type": "shoot",
      "ball_id": "ball_1",
      "variant": "layup",
      "result": "make",
      "trigger": { "type": "reception" },
      "description": "offense_4 finishes with a layup."
    }
  ],
  "areas": [
    { "form": "rectangle", "color": "yellow", "opacity": 0.2, "x": 0.0, "y": 10.5, "width": 4.9, "height": 4.0, "rotation": 0 }
  ],
  "labels": [ { "text": "Roll!", "x": 3.2, "y": 9.5, "color": "black" } ]
}
```

Migration notes:
- `a3`'s old implicit "runs during frame 2, after the screen is set in frame 1" becomes an explicit `trigger: {type: "action_end", ref: "a1"}` — the roll starts once the screen action ends. This is a NEW explicit dependency that the old frame boundary expressed implicitly; making it explicit here is intentional (the whole point of the redesign is that such dependencies are no longer left to frame-boundary coincidence).
- `a5`'s old `"on_catch": true` becomes `"trigger": { "type": "reception" }` — the direct 1:1 mapping the design doc specifies.
- Each action's slice of the old frame `description` (which covered 2-4 actions per frame) is now attached to the one action it best describes — per the design doc's guidance that a renderer wanting a paragraph per visual step concatenates the descriptions of the actions it groups.
- `a2` and `a4` needed no `trigger` — implicit per-actor chaining already places them correctly (each is simply that actor's next action).

- [ ] **Step 3: Validate the migrated file**

```bash
npx ajv validate --spec=draft7 --strict-schema=false -s schema/v1.json -d examples/pick-and-roll.ocf.json --all-errors --verbose -c ajv-formats
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add examples/pick-and-roll.ocf.json
git commit -m "migrate(examples): pick-and-roll.ocf.json — first trigger (action_end, reception) conversions"
```

---

### Task 9: Migrate `3-man-weave.ocf.json` (multiple `after` references per file)

**Files:**
- Modify: `examples/3-man-weave.ocf.json`

This file (read in full during planning) has 4 frames and 5 uses of `after: "<entity>.<type>"` (`offense_1.pass`, `offense_2.dribble`, `offense_2.pass`, `offense_3.dribble`, `offense_3.pass`, `offense_1.dribble`) — good coverage of the `after` → `trigger` conversion across many actors.

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `examples/3-man-weave.ocf.json`:

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "sport": "basketball",
  "meta": {
    "id": "a3c2e1d0-9b8f-4a7e-b6c5-1d2e3f4a5b6c",
    "title": "3-Man Weave",
    "description": "Classic 3-player weave from full court. Players pass and follow their pass, weaving across the court to finish at the basket.",
    "author": "OCF Examples",
    "tags": ["passing", "transition", "full-court", "3-player", "beginner", "conditioning"],
    "difficulty": "beginner",
    "created": "2025-02-27T10:00:00Z",
    "source_format": "open"
  },
  "court": { "ruleset": "fiba", "type": "full_court", "drill_focus": "offense" },
  "entities": [
    { "type": "offense", "nr": 1, "x": 0, "y": -14 },
    { "type": "offense", "nr": 2, "x": -5, "y": -14 },
    { "type": "offense", "nr": 3, "x": 5, "y": -14 }
  ],
  "balls": [ { "id": "ball_1", "carried_by": "offense_1" } ],
  "actions": [
    {
      "id": "a1", "player": "offense_1", "type": "pass", "to_player": "offense_2", "ball_id": "ball_1",
      "variant": "chest", "intensity": "normal",
      "description": "offense_1 passes to offense_2 and follows the pass, cutting behind offense_2."
    },
    {
      "id": "a2", "player": "offense_1", "type": "cut", "intensity": "fast",
      "moves": [ { "to": { "x": -3, "y": -11 } } ],
      "trigger": { "type": "action_end", "ref": "a1" }
    },
    {
      "id": "a3", "player": "offense_2", "type": "dribble", "ball_id": "ball_1", "intensity": "normal",
      "moves": [ { "to": { "x": 0, "y": -8 } } ],
      "trigger": { "type": "reception" },
      "description": "offense_2 dribbles to the middle and passes to offense_3, then follows the pass."
    },
    {
      "id": "a4", "player": "offense_2", "type": "pass", "to_player": "offense_3", "ball_id": "ball_1",
      "variant": "chest", "intensity": "normal",
      "trigger": { "type": "action_end", "ref": "a3" }
    },
    {
      "id": "a5", "player": "offense_2", "type": "cut", "intensity": "fast",
      "moves": [ { "to": { "x": 3.5, "y": -4 } } ],
      "trigger": { "type": "action_end", "ref": "a4" }
    },
    {
      "id": "a6", "player": "offense_1", "type": "move", "intensity": "normal",
      "moves": [ { "to": { "x": -5, "y": -8 } } ]
    },
    {
      "id": "a7", "player": "offense_3", "type": "dribble", "ball_id": "ball_1", "intensity": "normal",
      "moves": [ { "to": { "x": 0, "y": 0 } } ],
      "trigger": { "type": "reception" },
      "description": "offense_3 dribbles toward the middle and passes to offense_1 cutting from the left, then follows."
    },
    {
      "id": "a8", "player": "offense_3", "type": "pass", "to_player": "offense_1", "ball_id": "ball_1",
      "variant": "chest", "intensity": "normal",
      "trigger": { "type": "action_end", "ref": "a7" }
    },
    {
      "id": "a9", "player": "offense_3", "type": "cut", "intensity": "fast",
      "moves": [ { "to": { "x": -3, "y": 5 } } ],
      "trigger": { "type": "action_end", "ref": "a8" }
    },
    {
      "id": "a10", "player": "offense_1", "type": "move", "intensity": "normal",
      "moves": [ { "to": { "x": -5, "y": 0 } } ]
    },
    {
      "id": "a11", "player": "offense_2", "type": "move", "intensity": "normal",
      "moves": [ { "to": { "x": 5, "y": 0 } } ]
    },
    {
      "id": "a12", "player": "offense_1", "type": "dribble", "ball_id": "ball_1", "intensity": "fast",
      "moves": [ { "variant": "speed", "to": { "named": "basket" } } ],
      "trigger": { "type": "reception" },
      "description": "offense_1 attacks the basket for the layup. offense_2 fills the right wing as the kick-out option."
    },
    {
      "id": "a13", "player": "offense_1", "type": "shoot", "ball_id": "ball_1", "variant": "layup", "result": "make",
      "intensity": "normal",
      "trigger": { "type": "action_end", "ref": "a12" }
    },
    {
      "id": "a14", "player": "offense_2", "type": "move", "intensity": "normal",
      "moves": [ { "to": { "named": "right_wing" } } ]
    }
  ]
}
```

Migration notes:
- `a3`, `a7`, `a12` each get `trigger: {type: "reception"}` — in the ORIGINAL file these three had no explicit `after`/`on_catch` at all (position was implied by frame order), but they are each that player's first action right after receiving a pass in the previous frame, so `reception` makes that dependency explicit rather than relying on flat-sequence ordering alone. This is a deliberate improvement, not a mechanical requirement — flag it in the PR/commit description so a reviewer knows it's intentional, not a mistranslation of the original `after` chain.
- Every other `after: "<entity>.<type>"` becomes `trigger: {type: "action_end", ref: "<preceding action's new id>"}` — a direct, mechanical 1:1 mapping (the referenced entity+type always resolved to exactly one action per frame in the original file, so which numbered `id` it maps to is unambiguous from reading the original frame in order).
- `a6`, `a10`, `a11`, `a14` (plain `move` actions with no original `after`) get no `trigger` — they run via implicit per-actor chaining exactly like the original implicit frame-order placement.

- [ ] **Step 2: Validate the migrated file**

```bash
npx ajv validate --spec=draft7 --strict-schema=false -s schema/v1.json -d examples/3-man-weave.ocf.json --all-errors --verbose -c ajv-formats
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add examples/3-man-weave.ocf.json
git commit -m "migrate(examples): 3-man-weave.ocf.json — 6 after-to-trigger conversions across 3 actors"
```

---

### Task 10: Migrate `continuous-ball-screen.ocf.json` (a real continuum candidate)

**Files:**
- Modify: `examples/continuous-ball-screen.ocf.json`

This file (read in full during planning) has 5 frames, NO `after`/`with`/`on_catch` usage at all (every dependency is expressed purely through frame order — e.g. frame 2's screen, dribble, and roll all sit in the same frame with no explicit ordering between them), and NO `branches`. Its last frame is explicitly titled "Reset to PG" with the description "reset the continuous set" — this is a real, pre-existing continuum play, a good candidate to demonstrate the new `continuum: true` flag.

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `examples/continuous-ball-screen.ocf.json`:

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "sport": "basketball",
  "meta": {
    "id": "7f3e2a1b-9c4d-4e6f-8a2b-1d3c5e7f9a0b",
    "title": "Continuous Ball Screen Set",
    "description": "Multi-frame offensive set with consecutive ball screens. PG passes to wing and cuts, center screens and rolls, with options to kick out or reset.",
    "author": "OCF Examples",
    "tags": ["offense", "half-court", "ball-screen", "continuous", "pick-and-roll"],
    "difficulty": "advanced"
  },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "continuum": true,
  "entities": [
    { "type": "offense", "nr": 1, "x": 0, "y": 7 },
    { "type": "offense", "nr": 2, "x": 6.75, "y": 8.6 },
    { "type": "offense", "nr": 3, "x": -6.75, "y": 8.6 },
    { "type": "offense", "nr": 4, "x": -2.45, "y": 11 },
    { "type": "offense", "nr": 5, "x": 2.45, "y": 11 }
  ],
  "balls": [ { "id": "ball_1", "carried_by": "offense_1" } ],
  "actions": [
    {
      "id": "a1", "player": "offense_1", "type": "pass", "to_player": "offense_2", "variant": "chest", "intensity": "normal",
      "description": "PG (1) passes to SG (2) on right wing, then cuts through to strong corner."
    },
    {
      "id": "a2", "player": "offense_1", "type": "cut", "moves": [ { "to": { "named": "right_corner" } } ], "intensity": "fast",
      "trigger": { "type": "action_end", "ref": "a1" }
    },
    {
      "id": "a3", "player": "offense_5", "type": "screen", "for_player": "offense_2", "variant": "ball_screen",
      "at": { "x": 3, "y": 9.5 }, "physicality": "aggressive",
      "description": "C (5) sets inside ball screen for SG (2). SG penetrates into paint, C rolls to baseline. PG lifts from corner to wing."
    },
    {
      "id": "a4", "player": "offense_2", "type": "dribble", "moves": [ { "to": { "x": 2, "y": 11.5 } } ], "intensity": "normal",
      "trigger": { "type": "reception" }
    },
    {
      "id": "a5", "player": "offense_5", "type": "cut", "moves": [ { "to": { "named": "right_block" } } ], "tags": ["roll"], "intensity": "fast",
      "trigger": { "type": "action_end", "ref": "a3" }
    },
    {
      "id": "a6", "player": "offense_1", "type": "move", "moves": [ { "to": { "named": "right_wing" } } ], "intensity": "normal"
    },
    {
      "id": "a7", "player": "offense_2", "type": "pass", "to_player": "offense_3", "variant": "chest", "intensity": "normal",
      "description": "If no shot, SG (2) passes to SF (3) spotting up on left wing, then cuts through to left corner."
    },
    {
      "id": "a8", "player": "offense_2", "type": "cut", "moves": [ { "to": { "named": "left_corner" } } ], "intensity": "fast",
      "trigger": { "type": "action_end", "ref": "a7" }
    },
    {
      "id": "a9", "player": "offense_4", "type": "screen", "for_player": "offense_3", "variant": "ball_screen",
      "at": { "x": -3, "y": 9.5 }, "physicality": "aggressive",
      "description": "PF (4) sets inside ball screen for SF (3). SF penetrates and can score, dump off to big, or kick out to wing."
    },
    {
      "id": "a10", "player": "offense_3", "type": "dribble", "moves": [ { "to": { "x": -2, "y": 11.5 } } ], "intensity": "normal",
      "trigger": { "type": "reception" }
    },
    {
      "id": "a11", "player": "offense_4", "type": "cut", "moves": [ { "to": { "named": "left_block" } } ], "tags": ["roll"], "intensity": "fast",
      "trigger": { "type": "action_end", "ref": "a9" }
    },
    {
      "id": "a12", "player": "offense_3", "type": "pass", "to_player": "offense_1", "variant": "chest", "intensity": "normal",
      "description": "SF (3) kicks out to PG (1) on wing. PG runs pick with center to reset the continuous set."
    },
    {
      "id": "a13", "player": "offense_5", "type": "move", "moves": [ { "to": { "x": 0, "y": 9.5 } } ], "intensity": "normal"
    },
    {
      "id": "a14", "player": "offense_5", "type": "screen", "for_player": "offense_1", "variant": "ball_screen",
      "at": { "x": 0, "y": 9 }, "physicality": "aggressive",
      "trigger": { "type": "action_end", "ref": "a13" }
    }
  ]
}
```

Migration notes:
- `a4`, `a10` get `trigger: {type: "reception"}` — each is that player's dribble immediately after receiving the ball from the preceding screen-then-catch sequence (in the old file this was purely implicit frame-order placement; making it explicit here is the same deliberate improvement made in Task 9).
- `a6`, `a13` (plain `move`, no original dependency) get no `trigger` — implicit per-actor chaining.
- `"continuum": true` is added at the document root — this is a NEW addition beyond a pure mechanical migration, chosen because the play's own title/description already describe it as a repeating set ("reset the continuous set"). This is the first real-world use of the `continuum` flag added in Task 2 of this plan. Full validator-level continuum tolerance checking is Plan 3's concern (or a later follow-up) — this task only adds the flag to a fixture that clearly warrants it.

- [ ] **Step 2: Validate the migrated file**

```bash
npx ajv validate --spec=draft7 --strict-schema=false -s schema/v1.json -d examples/continuous-ball-screen.ocf.json --all-errors --verbose -c ajv-formats
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add examples/continuous-ball-screen.ocf.json
git commit -m "migrate(examples): continuous-ball-screen.ocf.json to flat actions[]/id/trigger shape; mark as continuum"
```

---

### Task 11: Migrate `transition-3v2.ocf.json` (the one file using `branches` — the real `branch` construct test)

**Files:**
- Modify: `examples/transition-3v2.ocf.json`

This file (read in full during planning) is the only fixture using the old `frame.branches` mechanism: frame_2 branches `make` → `frame_reset`, `miss` → `frame_oreb`. This task converts it to the new `branch` action-sequence container.

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `examples/transition-3v2.ocf.json`:

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "sport": "basketball",
  "meta": {
    "id": "c9d8e7f6-5a4b-3c2d-1e0f-9a8b7c6d5e4f",
    "title": "3v2 Transition",
    "description": "Three offensive players attack two defenders in transition and create a quality shot through ball movement and spacing.",
    "author": "OCF Examples",
    "tags": ["transition", "3v2", "full-court", "offense", "intermediate"],
    "difficulty": "intermediate",
    "created": "2025-02-27T10:00:00Z",
    "source_format": "open"
  },
  "court": { "ruleset": "fiba", "type": "full_court", "drill_focus": "transition" },
  "entities": [
    { "type": "offense", "nr": 1, "x": 0, "y": -12 },
    { "type": "offense", "nr": 2, "x": -4, "y": -10 },
    { "type": "offense", "nr": 3, "x": 4, "y": -10 },
    { "type": "defense", "nr": 1, "x": -2, "y": 2 },
    { "type": "defense", "nr": 2, "x": 2, "y": 2 }
  ],
  "balls": [ { "id": "ball_1", "carried_by": "offense_1" } ],
  "actions": [
    {
      "id": "a1", "player": "offense_1", "type": "dribble", "ball_id": "ball_1", "intensity": "fast",
      "moves": [ { "variant": "speed", "to": { "x": 0, "y": 1 } } ],
      "description": "offense_1 pushes the ball up the middle; offense_2 and offense_3 fill the wings at full speed."
    },
    { "id": "a2", "player": "offense_2", "type": "move", "intensity": "fast", "moves": [ { "to": { "named": "left_wing" } } ] },
    { "id": "a3", "player": "offense_3", "type": "move", "intensity": "fast", "moves": [ { "to": { "named": "right_wing" } } ] },
    {
      "id": "a4", "player": "offense_1", "type": "dribble", "ball_id": "ball_1", "intensity": "fast",
      "moves": [ { "to": { "named": "left_elbow" }, "around_player": "defense_1", "side": "right", "arc": "wide" } ],
      "trigger": { "type": "action_end", "ref": "a1" },
      "description": "offense_1 attacks defense_1 to commit the help, then kicks to offense_3 in the right corner for the shot."
    },
    {
      "id": "a5", "player": "offense_3", "type": "cut", "variant": "fade", "intensity": "fast",
      "moves": [ { "to": { "named": "right_corner" } } ]
    },
    {
      "id": "a6", "player": "offense_1", "type": "pass", "to_player": "offense_3", "ball_id": "ball_1",
      "variant": "overhead", "intensity": "hard",
      "trigger": { "type": "action_end", "ref": "a4" }
    },
    {
      "id": "a7", "player": "offense_3", "type": "shoot", "ball_id": "ball_1", "variant": "three", "intensity": "normal",
      "trigger": { "type": "reception" }
    },
    {
      "id": "branch_1",
      "type": "branch",
      "on": "a7",
      "cases": {
        "make": {
          "actions": [],
          "then": null
        },
        "miss": {
          "actions": [
            {
              "id": "a8", "player": "offense_2", "type": "rebound", "ball_id": "ball_1", "variant": "offensive",
              "tags": ["put_back"], "physicality": "aggressive",
              "trigger": { "type": "action_end", "ref": "a7" },
              "description": "On a miss, offense_2 crashes from the left wing for the offensive rebound and finishes."
            },
            {
              "id": "a9", "player": "offense_2", "type": "shoot", "ball_id": "ball_1", "variant": "layup", "result": "make",
              "intensity": "normal",
              "trigger": { "type": "action_end", "ref": "a8" }
            }
          ],
          "then": null
        }
      }
    }
  ]
}
```

Migration notes — this is the most structurally significant conversion in Plan 2:
- The old `frame_reset` (empty actions, just sets the ball dead) is GONE entirely — it existed only to give the `make` outcome an explicit target frame. In the new model, `make`'s case simply has empty `actions: []` and `then: null` (an explicit terminal marker) — no placeholder frame needed.
- The old `frame_oreb`'s `start_state` (re-anchoring `offense_2` and the ball's position after the miss) is GONE — `offense_2`'s rebound action (`a8`) picks up implicitly from wherever `offense_2`'s last action (`a2`, the move to `left_wing`) left them, which is exactly the same position the old `start_state` re-stated. No re-anchoring needed because there's no per-action state anchor in the new model at all (Plan 1 decision).
- `branch_1` is itself an item in the flat top-level `actions[]` array (schema requires each item to be `oneOf action or branch` — note `branch_1` does NOT have a `player`/standard action `type` shape; it uses `"type": "branch"`... **correction while writing this fixture**: check this against the Task 1 schema — `branch`'s own definition has NO `type` property at all, only `id`/`on`/`cases`. Remove the `"type": "branch"` key from the JSON above before running it — it is not part of the `branch` definition's `additionalProperties: false` shape and AJV will reject it. The corrected `branch_1` object is:

```json
    {
      "id": "branch_1",
      "on": "a7",
      "cases": {
        "make": { "actions": [], "then": null },
        "miss": {
          "actions": [
            {
              "id": "a8", "player": "offense_2", "type": "rebound", "ball_id": "ball_1", "variant": "offensive",
              "tags": ["put_back"], "physicality": "aggressive",
              "trigger": { "type": "action_end", "ref": "a7" },
              "description": "On a miss, offense_2 crashes from the left wing for the offensive rebound and finishes."
            },
            {
              "id": "a9", "player": "offense_2", "type": "shoot", "ball_id": "ball_1", "variant": "layup", "result": "make",
              "intensity": "normal",
              "trigger": { "type": "action_end", "ref": "a8" }
            }
          ],
          "then": null
        }
      }
    }
```

Use this corrected version in the file (replace the earlier `branch_1` block that incorrectly included `"type": "branch"`).

- [ ] **Step 2: Validate the migrated file**

```bash
npx ajv validate --spec=draft7 --strict-schema=false -s schema/v1.json -d examples/transition-3v2.ocf.json --all-errors --verbose -c ajv-formats
```

Expected: PASS. If AJV reports `branch_1` failing `oneOf` against both `action` and `branch`, re-check that `"type": "branch"` was removed — this is the exact trap called out above.

- [ ] **Step 3: Commit**

```bash
git add examples/transition-3v2.ocf.json
git commit -m "migrate(examples): transition-3v2.ocf.json — first real branch construct migration (make/miss)"
```

---

### Task 12: Re-verify every `examples/invalid/*.json` fixture still fails for its ORIGINAL intended reason

**Files:**
- Modify: any file under `examples/invalid/` still using `frames[]` (all of them, per the Task 4/Plan 1 handoff note)
- Test: manual verification per fixture, documented inline below

Plan 1 flagged that these fixtures would keep "passing" `npm run test:invalid` for the WRONG reason (rejected for missing root `actions`, not their intended violation). This task fixes that by migrating each fixture to the new shape AND confirming it still fails for the right reason.

- [ ] **Step 1: List every invalid fixture and check which still reference `frames`**

```bash
grep -l '"frames"' examples/invalid/*.json
```

- [ ] **Step 2: For each listed file, migrate its shape and verify the ORIGINAL violation still causes rejection**

For each file returned by Step 1, follow this procedure (illustrated here for `action-bad-ball-intensity.json`, whose original content was read during planning):

Original:
```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "meta": { "id": "00000000-0000-4000-8000-000000000008", "title": "bad ball intensity" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [
    { "type": "offense", "nr": 1, "x": 0, "y": 5 },
    { "type": "offense", "nr": 2, "x": 1, "y": 5 }
  ],
  "frames": [
    { "id": "f1", "actions": [ { "player": "offense_1", "type": "pass", "to_player": "offense_2", "intensity": "lob" } ], "end_state": {} }
  ]
}
```

Migrated (only the wrapper changes; the intended violation — `"intensity": "lob"`, not a valid `ball_intensity` enum value — is preserved verbatim, and the action gains the now-required `id`):

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "meta": { "id": "00000000-0000-4000-8000-000000000008", "title": "bad ball intensity" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [
    { "type": "offense", "nr": 1, "x": 0, "y": 5 },
    { "type": "offense", "nr": 2, "x": 1, "y": 5 }
  ],
  "actions": [
    { "id": "a1", "player": "offense_1", "type": "pass", "to_player": "offense_2", "intensity": "lob" }
  ]
}
```

Then PROVE it still fails for the right reason: temporarily change `"lob"` to a valid value (`"soft"`) in a scratch copy and confirm THAT version validates successfully, before restoring `"lob"` in the committed file:

```bash
cp examples/invalid/action-bad-ball-intensity.json /tmp/scratch-check.json
sed -i '' 's/"lob"/"soft"/' /tmp/scratch-check.json
npx ajv validate --spec=draft7 --strict-schema=false -s schema/v1.json -d /tmp/scratch-check.json --all-errors --verbose -c ajv-formats
```

Expected: PASS (proves the ONLY reason the real fixture fails is the bad intensity value, not leftover shape drift). Then confirm the real (unmodified) fixture still fails:

```bash
npx ajv validate --spec=draft7 --strict-schema=false -s schema/v1.json -d examples/invalid/action-bad-ball-intensity.json --all-errors --verbose -c ajv-formats
```

Expected: FAIL, and the error message must mention `intensity`/`ball_intensity`/`enum` — not a missing-`actions`/`frames` structural error.

Apply the same migrate-then-prove procedure to each of the following 10 files (each shown as original → migrated, with the specific proof command for that fixture's violation).

**`action-bad-movement-intensity.json`** (violation: `"intensity": "medium"` is not a valid `movement_intensity` enum value):

Migrated:
```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "meta": { "id": "00000000-0000-4000-8000-000000000007", "title": "bad movement intensity" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "offense", "nr": 1, "x": 0, "y": 5 } ],
  "actions": [
    { "id": "a1", "player": "offense_1", "type": "move", "intensity": "medium", "moves": [ { "to": { "x": 0, "y": 6 } } ] }
  ]
}
```
Proof: change `"medium"` to `"normal"` in a scratch copy, confirm it then validates; confirm the real file still fails with an `intensity`/`movement_intensity`/`enum` error.

**`action-bad-physicality.json`** (violation: `"physicality": "violent"` is not a valid `physicality` enum value):

Migrated:
```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "meta": { "id": "00000000-0000-4000-8000-000000000009", "title": "bad physicality" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "offense", "nr": 1, "x": 0, "y": 5 } ],
  "actions": [
    { "id": "a1", "player": "offense_1", "type": "pickup", "ball_id": "ball_1", "physicality": "violent" }
  ]
}
```
Proof: change `"violent"` to `"aggressive"` in a scratch copy, confirm PASS; confirm the real file fails with a `physicality`/`enum` error.

**`action-pass-missing-receiver.json`** (violation: `pass` action has no `to_player`, which is required):

Migrated:
```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "meta": { "id": "00000000-0000-4000-8000-000000000003", "title": "pass without receiver" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "offense", "nr": 1, "x": 0, "y": 5 } ],
  "balls": [ { "id": "ball_1", "carried_by": "offense_1" } ],
  "actions": [
    { "id": "a1", "player": "offense_1", "type": "pass" }
  ]
}
```
Proof: add `"to_player": "offense_2"` (and an `offense_2` entity) in a scratch copy, confirm PASS; confirm the real file fails with a `required`/`to_player` error.

**`action-unknown-type.json`** (violation: `"type": "teleport"` is not a valid action type):

Migrated:
```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "meta": { "id": "00000000-0000-4000-8000-000000000004", "title": "unknown action" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "offense", "nr": 1, "x": 0, "y": 5 } ],
  "actions": [
    { "id": "a1", "player": "offense_1", "type": "teleport" }
  ]
}
```
Proof: change `"teleport"` to `"move"` (and add a required `moves` array) in a scratch copy, confirm PASS; confirm the real file fails (no action definition in the `oneOf` union matches `"type": "teleport"`, and it also fails the `branch` alternative of the `actions[].items.oneOf`, since it has no `on`/`cases` — the error will mention `oneOf`/no matching schema).

**`arc-bad-value.json`** (violation: `"arc": "loopy"` is not a valid `arc` enum value; note this file has no top-level `$schema` key in the original — preserve that, it's not part of the violation being tested):

Migrated:
```json
{
  "sport": "basketball",
  "meta": { "id": "3c9f7a2e-4b1d-4e6f-8a0c-2d5e9a1b3c7f", "title": "Bad arc" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "offense", "nr": 2, "x": -6, "y": 13 }, { "type": "offense", "nr": 5, "x": -2, "y": 8 } ],
  "actions": [
    { "id": "a1", "player": "offense_2", "type": "cut", "moves": [ { "to": { "named": "right_elbow" }, "around_player": "offense_5", "arc": "loopy" } ] }
  ]
}
```
Proof: change `"loopy"` to `"tight"` in a scratch copy, confirm PASS; confirm the real file fails with an `arc`/`enum` error.

**`frame-bad-branch-key.json`** (violation: `"swish"` is not a valid outcome key — renamed conceptually to a branch-case-key violation):

Read first: `cat examples/invalid/frame-bad-branch-key.json` (already read during planning — shown above). Original used `branches: {"swish": "f2"}` at the frame level. Migrated to the new `branch` construct, preserving the exact same violation (`"swish"` is still not a valid `outcome` value):

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "meta": { "id": "00000000-0000-4000-8000-000000000005", "title": "bad branch outcome" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "offense", "nr": 1, "x": 0, "y": 5 } ],
  "actions": [
    { "id": "a1", "player": "offense_1", "type": "shoot" },
    {
      "id": "branch_1",
      "on": "a1",
      "cases": {
        "swish": { "actions": [], "then": null }
      }
    }
  ]
}
```
Proof: change `"swish"` to `"make"` in a scratch copy, confirm PASS; confirm the real file fails, and specifically confirm the error concerns `cases`/`propertyNames`/`outcome` (not an unrelated shape error) — this exercises `branch.cases.propertyNames`'s `$ref` to `#/definitions/outcome` added in Task 1. If the real file unexpectedly PASSES, `branch.cases.propertyNames` is not correctly wired in `schema/v1.json` — go back and fix Task 1's `branch` definition before proceeding (this is a genuine regression, not a fixture problem).

**`frame-missing-end-state.json` — DELETE, do not migrate:**

This fixture's entire purpose was "a frame without `end_state` is invalid." There is no `end_state` concept anymore (Plan 1 removed it — every position derives from setup + actions, and `actions[]` may legitimately be empty per Task 6's `minItems` finding). The violation is structurally obsolete, not translatable to an equivalent new-model violation.

```bash
git rm examples/invalid/frame-missing-end-state.json
```

**`side-bad-value.json`** (violation: `"side": "middle"` is not a valid `side` enum value):

Migrated:
```json
{
  "sport": "basketball",
  "meta": { "id": "3c9f7a2e-4b1d-4e6f-8a0c-2d5e9a1b3c7f", "title": "Bad side" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "offense", "nr": 2, "x": -6, "y": 13 }, { "type": "offense", "nr": 5, "x": -2, "y": 8 } ],
  "actions": [
    { "id": "a1", "player": "offense_2", "type": "cut", "moves": [ { "to": { "named": "right_elbow" }, "around_player": "offense_5", "side": "middle" } ] }
  ]
}
```
Proof: change `"middle"` to `"left"` in a scratch copy, confirm PASS; confirm the real file fails with a `side`/`enum` error.

**`sport-basketball-tackle.json`** (violation: `tackle` is not in basketball's action-type whitelist):

Migrated:
```json
{
  "sport": "basketball",
  "meta": { "id": "d4e5f6a7-4444-4a6e-8f0c-2d5e9a1b3c7f", "title": "Tackle under basketball" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "defense", "nr": 4, "x": 0, "y": 8 } ],
  "actions": [
    { "id": "a1", "player": "defense_4", "type": "tackle" }
  ]
}
```
Proof: change `"sport": "basketball"` to `"sport": "soccer"` in a scratch copy, confirm PASS (tackle is valid under soccer); confirm the real file (sport: basketball) fails — this exercises the Plan 1 Task 4 flattened `allOf` whitelist branches directly, so a failure here specifically confirms that migration was done correctly.

**`sport-soccer-screen.json`** (violation: `screen` is not in soccer's action-type whitelist):

Migrated:
```json
{
  "sport": "soccer",
  "meta": { "id": "e5f6a7b8-5555-4a6e-8f0c-2d5e9a1b3c7f", "title": "Screen under soccer" },
  "court": { "ruleset": "custom", "type": "full_court", "custom_dimensions": { "unit": "m", "length": 105, "width": 68, "basket_from_baseline": 0, "three_point_distance": 0, "paint_width": 40.3, "paint_depth": 16.5, "free_throw_distance": 11 } },
  "entities": [ { "type": "offense", "nr": 4, "x": 0, "y": 8 } ],
  "actions": [
    { "id": "a1", "player": "offense_4", "type": "screen", "for_player": "offense_4" }
  ]
}
```
Proof: change `"sport": "soccer"` to `"sport": "basketball"` in a scratch copy, confirm PASS; confirm the real file (sport: soccer) fails.

**`state-bad-ball-key.json`** (violation: `end_state.balls` references `"not_a_ball"`, not matching the `ball_ref` pattern):

This fixture's violation is now structurally obsolete the same way `frame-missing-end-state.json`'s was — `end_state` doesn't exist anymore, so there is no place left in an action-sequence document to put a stray, badly-keyed ball reference the same way. However, the underlying concept (a `ball_id` reference that doesn't match a real ball) IS still expressible and still worth testing, just via a different field. Re-target the fixture at an action's `ball_id`:

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "meta": { "id": "00000000-0000-4000-8000-000000000002", "title": "bad ball reference" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "offense", "nr": 1, "x": 0, "y": 5 } ],
  "balls": [ { "id": "ball_1", "carried_by": "offense_1" } ],
  "actions": [
    { "id": "a1", "player": "offense_1", "type": "shoot", "ball_id": "not_a_ball" }
  ]
}
```
Proof: change `"not_a_ball"` to `"ball_1"` in a scratch copy, confirm PASS; confirm the real file fails with a `ball_id`/`ball_ref`/`pattern` error. This is a deliberate re-targeting of the fixture's intent (bad ball reference), not a mechanical migration — note this in the commit message.

- [ ] **Step 3: Run the full invalid-fixture check script**

```bash
npm run test:invalid
```

Expected: PASS (every remaining fixture in `examples/invalid/` is correctly rejected).

- [ ] **Step 4: Commit**

```bash
git add examples/invalid/
git commit -m "$(cat <<'EOF'
migrate(examples): update examples/invalid/*.json to flat actions[] shape

Verified each fixture still fails for its original intended reason, not
merely for missing the new root actions[] shape. Removed
frame-missing-end-state.json (end_state no longer exists as a concept).
Re-targeted state-bad-ball-key.json at a bad action ball_id reference
instead of end_state.balls, since end_state is gone but a bad ball
reference is still a real, worth-testing violation via a different field.
EOF
)"
```

---

### Task 13: Update `docs/specification-v1.adoc` — Timing, Frames, Complete Example sections

**Files:**
- Modify: `docs/specification-v1.adoc` (multiple sections)

- [ ] **Step 1: Replace the `=== Timing` section (lines ~678-689)**

Find:

```asciidoc
=== Timing

Actions express ordering semantically, not in seconds (omitted = at frame
start):

[cols="1,3", options="header"]
|===
| Field | Meaning
| `after` | `"<player>.<type>"` — starts after the referenced action begins.
| `with` | `"<player>.<type>"` — simultaneous with the referenced action.
| `on_catch` | `true` — straight out of the catch (catch-and-shoot).
|===
```

Replace with:

```asciidoc
=== Timing

Actions express ordering semantically, not in seconds. Every action has a
unique `id`. Absent an explicit `trigger`, an actor's actions run in the
order they appear for that actor in the flat `actions[]` sequence — the
first action for a given actor starts from its `entities`/`balls` setup
position; each subsequent action for that actor starts where its previous
action ended.

Cross-actor coupling uses `trigger`:

[cols="1,3", options="header"]
|===
| `trigger.type` | Meaning
| `action_end` | Starts after the referenced action (`ref`) ends.
| `action_start` | Starts after the referenced action (`ref`) begins.
| `action_overlap` | Runs *while* the referenced action (`ref`) is active (e.g. a curl cut during an active screen).
| `reception` | Starts the instant this action's own actor receives the ball. No `ref` — replaces the old `on_catch` boolean.
|===

`trigger.type` is open and sport-extensible — a sport may define further
trigger types beyond these four without a schema change, the same way
`tags` needs no schema change for open coaching vocabulary.

A `move_step`'s `around_player` reference (see <<Movement Sequences>>) is
NOT a `trigger` — it implies that the referenced actor must be at their
final position by the time that step is processed, as a side effect of the
geometric reference, without needing a separate explicit `trigger`.
```

- [ ] **Step 2: Replace the entire `== Frames` section (lines ~693-743) with `== Actions Sequence`**

Find the whole section from `== Frames` through the end of `=== Branches` (just before `== Areas and Labels`):

```asciidoc
== Frames

A frame is a coaching phase. It combines explicit anchors with semantic actions.

=== Frame Model

[cols="1,1,3", options="header"]
|===
| Field | Required | Meaning
| `id` | yes | Unique frame id within the drill.
| `label` | no | Short display label.
| `description` | no | Coaching instruction. LLMs should generate this.
| `duration_ms` | no | *Deprecated* — use per-action `intensity` instead. Suggested animation duration for the phase.
| `start_state` | no | Positional + ball anchor at phase start. Defaults to the previous frame's `end_state`.
| `actions` | yes | Semantic actions in this phase. May be empty.
| `end_state` | yes | Positional + ball anchor at phase end.
| `branches` | no | Outcome -> target frame id.
|===

=== States

`start_state` and `end_state` map entity refs to coordinates, plus an optional
`balls` map of ball ref -> ball state. Because each frame carries an explicit
anchor, any frame can be rendered as a still without simulating history — which
is what enables PDF export, editor scrubbing and video overlay.

`start_state` is optional and inherits the previous frame's `end_state`. Set it
explicitly only at jumps, steals, rebounds or continuum resets.

[source,json]
----
"end_state": {
  "offense_1": { "x": -1.0, "y": 9.0 },
  "offense_4": { "named": "right_block" },
  "balls": { "ball_1": { "carried_by": "offense_4" } }
}
----

=== Branches

Without `branches`, the next frame in the array follows. With `branches`, the
outcome selects the next frame. Outcomes are `make`, `miss`, `turnover`,
`steal`, `foul`. A branch may point at an earlier frame to build a continuum
loop. For a single set play, omit `branches` and let the final frame set the
ball `dead`.

[source,json]
----
"branches": { "make": "frame_reset", "miss": "frame_oreb" }
----
```

Replace the entire block with:

```asciidoc
== Actions Sequence

A play is a flat, ordered `actions[]` array at the document root — no frame
container. Framing (grouping actions into a still-frame, a PDF step, or a
page) is entirely a renderer/consumer decision; the spec makes no framing
choices and imposes no limit on how many actions an actor may have.

=== Action Identity and Ordering

Every action has a unique `id` (required). There is no per-action position
anchor: every entity's/ball's position at any point is derived purely from
its `entities`/`balls` setup state plus the effect of every action that
actor has had so far in the sequence. An actor has at most one active action
at a time — composite motions use `side_effects` (see <<Actions>>) or, for
two-ball dribbling, `ball_ids` on one `dribble` action, never two concurrent
actions for the same `player`.

=== Branching

An item in `actions[]` may be a `branch` instead of an action:

[cols="1,1,3", options="header"]
|===
| Field | Required | Meaning
| `id` | yes | Unique id for this branch.
| `on` | yes | The `id` of the action whose outcome selects the case.
| `cases` | yes | Map of outcome (`make`, `miss`, `turnover`, `steal`, `foul`) -> case.
|===

Each case is:

[cols="1,1,3", options="header"]
|===
| Field | Required | Meaning
| `actions` | yes | Self-contained action (or nested branch) sub-sequence for this outcome. May be empty.
| `then` | yes | The `id` this case continues into, or `null` if this path ends here. Required — always explicit, never an implicitly-missing field.
|===

Branch scope is per-branch, not global: only actors referenced inside the
triggering case's own `actions[]` are affected. Any other actor's action
that needs to react to the same outcome must live inside the relevant case's
sub-sequence, or `trigger` off an action inside it.

[source,json]
----
{
  "id": "branch_1",
  "on": "a7",
  "cases": {
    "make": { "actions": [], "then": null },
    "miss": {
      "actions": [
        { "id": "a8", "player": "offense_2", "type": "rebound", "ball_id": "ball_1", "variant": "offensive" },
        { "id": "a9", "player": "offense_2", "type": "shoot", "ball_id": "ball_1", "variant": "layup", "result": "make", "trigger": { "type": "action_end", "ref": "a8" } }
      ],
      "then": null
    }
  }
}
----

=== Continuum (Looping Plays)

A drill that is designed to repeat sets the document-level flag:

[source,json]
----
"continuum": true
----

A validator then checks that the play's terminal state matches its setup
state (or an explicitly designated loop anchor a `branch` case's `then`
points at, for a loop that re-enters mid-sequence rather than at the very
start). Exact tolerance is a validator-level concern, not enforced by the
schema itself.
```

- [ ] **Step 3: Replace the Complete Example (Pick & Roll) with the migrated fixture**

Find the `=== Pick & Roll — Half Court, FIBA` section's JSON block (the one starting `"frames": [` around line 1016). Replace the entire JSON code block with the exact contents of the now-migrated `examples/pick-and-roll.ocf.json` from Task 8 (copy it verbatim — this keeps the doc's embedded example in sync with the real fixture file, which a future doc-sync test could check).

- [ ] **Step 4: Update the Schema Reference PlantUML diagrams**

Find the `Drill` class block (around line 1178):

```
class Drill {
  +meta: Meta
  +court: Court
  +entities: Entity[]
  +balls: Ball[]
  +frames: Frame[]
  --
  +color_scheme: ColorScheme?
  +named_positions: NamedPositions?
  +areas: Area[]?
  +labels: Label[]?
}
```

Change `+frames: Frame[]` to `+actions: (Action|Branch)[]`, and add `+continuum: boolean?` to the optional section:

```
class Drill {
  +meta: Meta
  +court: Court
  +entities: Entity[]
  +balls: Ball[]
  +actions: (Action|Branch)[]
  --
  +color_scheme: ColorScheme?
  +named_positions: NamedPositions?
  +areas: Area[]?
  +labels: Label[]?
  +continuum: boolean?
}
```

Find the `Frame` class block:

```
class Frame {
  +id: string
  +actions: Action[]
  +end_state: State
  --
  +label: string?
  +description: string?
  +duration_ms: integer?
  +start_state: State?
  +branches: map?
}
```

Replace it with a `Branch` class:

```
class Branch {
  +id: string
  +on: string
  +cases: map
}

class BranchCase {
  +actions: (Action|Branch)[]
  +then: string?
}
```

Find the `Action` class block:

```
class Action {
  +player: EntityRef
  +type: enum
  --
  +ball_id: string?
  +moves: Move[]?
  +variant: string?
  +tags: string[]?
}
```

Replace it with:

```
class Action {
  +id: string
  +player: EntityRef
  +type: enum
  --
  +ball_id: string?
  +ball_ids: string[]?
  +moves: Move[]?
  +variant: string?
  +tags: string[]?
  +trigger: Trigger?
  +side_effects: SideEffect[]?
  +description: string?
}

class Trigger {
  +type: string
  --
  +ref: string?
}
```

Find the bottom relationship lines:

```
Drill *-- Meta
Drill *-- Court
Drill *-- Entity
Drill *-- Frame
Frame *-- Action
Action *-- Coordinate
@enduml
```

Replace with:

```
Drill *-- Meta
Drill *-- Court
Drill *-- Entity
Drill *-- Action
Drill *-- Branch
Branch *-- BranchCase
BranchCase *-- Action
Action *-- Coordinate
Action *-- Trigger
@enduml
```

- [ ] **Step 5: Update the Top-Level Fields table**

Find (around line 1264):

```asciidoc
| `frames`          | yes | Ordered coaching phases; each carries `actions` and `end_state`.
```

Replace with:

```asciidoc
| `actions`         | yes | Flat, ordered sequence of actions and branch containers.
```

And add a new row right after the `labels` row in the same table:

```asciidoc
| `continuum`       | no  | Marks this play as designed to loop; see <<Continuum (Looping Plays)>>.
```

- [ ] **Step 6: Update the Enums Summary table**

Find:

```asciidoc
| Frame `outcome` | make, miss, turnover, steal, foul
```

Replace with:

```asciidoc
| Branch `outcome` | make, miss, turnover, steal, foul
| `trigger.type` (built-in) | action_end, action_start, action_overlap, reception (sport-extensible)
```

- [ ] **Step 7: Update the LLM Generation Guide's output tips**

Find (around line 1373-1379):

```asciidoc
* Actions express *intent*, not geometry — prefer named positions in `end_state` over raw coordinates wherever a standard name applies
* Leave optional action fields out when the description is vague; add `variant`, `ball_id`, and timing only when the description implies them
* Use `relative_to` for positions defined as offsets ("2 meters right of the elbow")
* Every frame requires an `end_state`; list only the entities whose positions change in that frame (others inherit)
* Ball state in `end_state.balls` must reflect the result of the actions: use `carried_by` after a pass/pickup, `dead` after a made shot with no rebound
* Set the ball `dead` in `end_state.balls` after a `shoot` with `result: "make"` if no `rebound` or `pickup` follows in that frame or the next
* Frame `description` should mirror the coaching instruction in natural language — LLMs should always generate this field
```

Replace with:

```asciidoc
* Actions express *intent*, not geometry — prefer named positions in `moves[].to` over raw coordinates wherever a standard name applies
* Leave optional action fields out when the description is vague; add `variant`, `ball_id`, and `trigger` only when the description implies them
* Use `relative_to` for positions defined as offsets ("2 meters right of the elbow")
* Give every action a unique, stable `id` (e.g. `a1`, `a2`, ...) — later actions reference earlier ones by `id` via `trigger`
* An actor's actions run in the order they appear for that actor; only add `trigger` when timing depends on a DIFFERENT actor's action, or on this actor's own ball reception (`trigger: { "type": "reception" }`)
* Action `description` should mirror the coaching instruction in natural language for the one action it explains — LLMs should always generate this field
```

- [ ] **Step 8: Update the FIBA Import Mapping table**

Find (around line 1409-1411):

```asciidoc
| `lineElement.type`    | `frame.actions[].type`        | See action type map below
| `lineElement.curved`  | — (derived from action type)  | Renderer infers path style
| `lineElement.coords`  | `frame.actions[].moves[].to`  | Coordinate conversion each point
```

Replace with:

```asciidoc
| `lineElement.type`    | `actions[].type`              | See action type map below
| `lineElement.curved`  | — (derived from action type)  | Renderer infers path style
| `lineElement.coords`  | `actions[].moves[].to`        | Coordinate conversion each point
```

- [ ] **Step 9: Add a v2.0.0 changelog entry**

At the top of the `[appendix] == Changelog` section, before the existing `=== v1.4.0` entry, add:

```asciidoc
=== v2.0.0 (in progress)

**Breaking.** Replaces `frames[]` with a flat, ordered `actions[]` array at
the document root — framing (grouping actions into visual steps) is now
entirely a renderer/consumer concern, not part of the spec. Every action
gets a unique required `id` (replacing the `<entity_ref>.<action_type>`
`action_ref` pattern, which could not address more than one action of a
given type per actor — this was the real root cause of the old model's
de facto action-per-actor ceiling). `after`/`with`/`on_catch` are replaced
by a unified, sport-extensible `trigger` field
(`action_end`/`action_start`/`action_overlap`/`reception`). Frame-level
`label`/`description`/`start_state`/`end_state`/`duration_ms`/`branches`
are removed; `description` moves to each action. Outcome branching becomes
a dedicated `branch` action-sequence element with per-case sub-sequences
and an explicit terminal marker (`then: null`). Adds a document-level
`continuum` flag for looping plays. Adds `side_effects[]` (composite
actions, e.g. a dribble hand-off's screen side effect) and `ball_ids[]`
(two-ball dribbling) to the action model. See
`docs/superpowers/specs/2026-09-05-frameless-action-model-design.md` for
the full design rationale.
```

- [ ] **Step 10: Commit**

```bash
git add docs/specification-v1.adoc
git commit -m "docs: update specification-v1.adoc for the frame-less action model (v2.0.0)"
```

---

### Task 14: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Run the complete test suite**

```bash
npm test
```

Expected: PASS — `npm run validate` (all `examples/*.ocf.json` now migrated), `npm run test:invalid` (all invalid fixtures re-verified in Task 12), and all four `test:*` node-test scripts.

- [ ] **Step 2: Run every new frameless-*.test.mjs file explicitly, to be certain nothing regressed silently**

```bash
node --test test/frameless-trigger.test.mjs test/frameless-action-shape.test.mjs test/frameless-root.test.mjs test/frameless-multiball-sideeffects.test.mjs test/frameless-branch.test.mjs test/frameless-continuum.test.mjs
```

Expected: PASS for all.

- [ ] **Step 3: Grep the whole repo for any remaining stale references to the removed concepts**

```bash
grep -rn '"frames"\|frame\.actions\|frame\.end_state\|action_ref\b' schema/ examples/ docs/specification-v1.adoc test/ --include="*.json" --include="*.mjs" --include="*.adoc"
```

Expected: no output (or only false-positive matches inside comments/prose explaining the OLD model for historical contrast — read each hit and confirm before treating it as a leftover bug).

- [ ] **Step 4: Commit if Step 3 required any fixes**

If Step 3 found and required fixing any leftover reference:

```bash
git add -A
git commit -m "chore: clean up remaining frame/action_ref references found during regression pass"
```

If Step 3 found nothing to fix, no commit is needed for this task.

---

## Plan 2 completion checklist

- [x] `branch`/`branch_case` definitions added; `actions[]` items accept action or branch
- [x] Drill-level `continuum` flag added
- [x] `frame` definition removed
- [x] All 10 `examples/*.ocf.json` fixtures migrated to flat `actions[]`/`id`/`trigger`
- [x] All affected `examples/invalid/*.json` fixtures migrated and re-verified to fail for their original reason (one fixture, `frame-missing-end-state.json`, removed as structurally obsolete)
- [x] `docs/specification-v1.adoc` updated: Timing, Actions Sequence (replacing Frames), Complete Example, Schema Reference diagrams, Top-Level Fields, Enums Summary, LLM Generation Guide, FIBA Import Mapping, Changelog
- [ ] NOT done here (Plan 3): `ocf-validator` repo (TS + Python) possession/coherence/references rule updates — these still assume `frames[]` and will need their own migration against this now-final schema shape.
