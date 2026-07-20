# Action Intensity & Physicality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two optional, additive enum fields to the OCF schema — `intensity`
(relative tempo, via `movement_intensity` for move/cut/dribble and
`ball_intensity` for pass/shoot) and `physicality` (contact/collision style
for screen/defend/rebound/pickup) — and deprecate the frame-level
`duration_ms` in favor of them.

**Architecture:** Three new named enum definitions in `schema/v1.json`
(`movement_intensity`, `ball_intensity`, `physicality`), referenced via
`$ref` from the relevant `action_*` definitions and from `move_step` (for
per-move override of `movement_intensity`). No new top-level structures, no
breaking changes — every field is optional with an implicit default of
`normal`. Validated using the repo's existing ajv-based test harness
(`npm run validate` against `examples/*.ocf.json`, `npm run test:invalid`
against `examples/invalid/*.json`).

**Tech Stack:** JSON Schema draft-07, ajv-cli, Node.js (`scripts/check-invalid.mjs`), AsciiDoc (`docs/specification-v1.adoc`).

**Spec:** `docs/superpowers/specs/2026-07-20-action-intensity-design.md` (approved)

---

### Task 0: Confirm clean baseline

**Files:** none (verification only)

- [ ] **Step 1: Run the existing test suite to confirm it's green before touching anything**

Run: `npm test`
Expected: `validate` passes for all `examples/*.ocf.json`, then
`test:invalid` reports `All 6 invalid fixture(s) correctly rejected.`

---

### Task 1: Red — use the new fields in examples before the schema supports them

This proves the fields don't yet exist (schema has `additionalProperties:
false` on every action object, so an unknown key is rejected).

**Files:**
- Modify: `examples/pick-and-roll.ocf.json`
- Modify: `examples/transition-3v2.ocf.json`

- [ ] **Step 1: Edit `examples/pick-and-roll.ocf.json`**

Replace the `frame_1` screen action:

```json
        { "player": "offense_4", "type": "screen", "for_player": "offense_1", "on_player": "defense_1", "variant": "ball_screen", "at": { "x": -0.5, "y": 6.7 }, "physicality": "hard" }
```

Replace the `frame_2` actions array:

```json
      "actions": [
        {
          "player": "offense_1",
          "type": "dribble",
          "ball_id": "ball_1",
          "intensity": "normal",
          "moves": [
            { "variant": "hesitation" },
            { "variant": "speed", "to": { "named": "left_elbow" }, "around_player": "defense_1", "intensity": "explosive" }
          ]
        },
        { "player": "offense_4", "type": "cut", "variant": "basket", "intensity": "fast", "moves": [ { "to": { "named": "right_block" } } ], "tags": ["roll"] }
      ],
```

Replace the `frame_3` actions array:

```json
      "actions": [
        { "player": "offense_1", "type": "pass", "to_player": "offense_4", "ball_id": "ball_1", "variant": "bounce", "intensity": "hard" },
        { "player": "offense_4", "type": "shoot", "ball_id": "ball_1", "variant": "layup", "result": "make", "on_catch": true, "intensity": "soft" }
      ],
```

- [ ] **Step 2: Edit `examples/transition-3v2.ocf.json`**

Find the rebound action (around line 71):

```json
        { "player": "offense_2", "type": "rebound", "ball_id": "ball_1", "variant": "offensive", "tags": ["put_back"] },
```

Replace with:

```json
        { "player": "offense_2", "type": "rebound", "ball_id": "ball_1", "variant": "offensive", "tags": ["put_back"], "physicality": "aggressive" },
```

- [ ] **Step 3: Run validation and confirm it fails**

Run: `npm run validate`
Expected: FAIL — ajv reports `must NOT have additional properties` for
`intensity` and `physicality` on the edited actions in both files.

- [ ] **Step 4: Commit the red state is NOT required**

Do not commit yet — Task 1's edits are only valid once the schema (Task 2-4)
lands. Leave the working tree dirty and continue directly to Task 2.

---

### Task 2: Add the three enum definitions to `schema/v1.json`

**Files:**
- Modify: `schema/v1.json:214-216` (insert between `action_ref` and `move_step`)

- [ ] **Step 1: Insert the new enum definitions**

Find this exact text (the blank line between `action_ref` and `move_step`):

```json
    "action_ref": {
      "type": "string",
      "description": "Reference to another action in the same frame: '<entity_ref>.<action_type>'.",
      "pattern": "^((offense|defense)_[1-9]|coach|(cone|station)_[1-9][0-9]*)\\.(move|cut|screen|defend|dribble|pass|shoot|rebound|pickup)$"
    },

    "move_step": {
```

Replace with:

```json
    "action_ref": {
      "type": "string",
      "description": "Reference to another action in the same frame: '<entity_ref>.<action_type>'.",
      "pattern": "^((offense|defense)_[1-9]|coach|(cone|station)_[1-9][0-9]*)\\.(move|cut|screen|defend|dribble|pass|shoot|rebound|pickup)$"
    },

    "movement_intensity": {
      "type": "string",
      "description": "Relative tempo over distance for move/cut/dribble. Does not imply a concrete duration — a downstream application derives timing from this plus actual player speed.",
      "enum": ["slow", "normal", "fast", "explosive"]
    },

    "ball_intensity": {
      "type": "string",
      "description": "Relative ball speed for pass/shoot. Independent of the pass 'variant' (technique/flight path), e.g. variant 'lob' + intensity 'soft' are separate axes.",
      "enum": ["soft", "normal", "hard", "bullet"]
    },

    "physicality": {
      "type": "string",
      "description": "Contact/collision style for screen/defend/rebound/pickup, used by a renderer to pick the right animation. Independent of intensity — no effect on distance/timing.",
      "enum": ["passive", "normal", "aggressive", "hard"]
    },

    "move_step": {
```

- [ ] **Step 2: Verify the file is still valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('schema/v1.json','utf8')); console.log('valid json')"`
Expected: `valid json`

- [ ] **Step 3: Run validation (still expected to fail — fields not wired into actions yet)**

Run: `npm run validate`
Expected: FAIL, same `additional properties` errors as Task 1 Step 3.

---

### Task 3: Wire `movement_intensity` into `move_step`, `action_move`, `action_cut`, `action_dribble`

**Files:**
- Modify: `schema/v1.json` (`move_step`, `action_move`, `action_cut`, `action_dribble` definitions)

- [ ] **Step 1: Add `intensity` to `move_step`**

Find:

```json
    "move_step": {
      "type": "object",
      "description": "One step in a movement sequence. Without 'to' = a move on the spot. Reference fields override the action-level ones.",
      "properties": {
        "variant": { "type": "string" },
        "to": { "$ref": "#/definitions/coordinate" },
        "around_player": { "$ref": "#/definitions/entity_ref" },
        "off_screen_by": { "$ref": "#/definitions/entity_ref" }
      },
      "additionalProperties": false
    },
```

Replace with:

```json
    "move_step": {
      "type": "object",
      "description": "One step in a movement sequence. Without 'to' = a move on the spot. Reference fields override the action-level ones.",
      "properties": {
        "variant": { "type": "string" },
        "to": { "$ref": "#/definitions/coordinate" },
        "around_player": { "$ref": "#/definitions/entity_ref" },
        "off_screen_by": { "$ref": "#/definitions/entity_ref" },
        "intensity": { "$ref": "#/definitions/movement_intensity" }
      },
      "additionalProperties": false
    },
```

- [ ] **Step 2: Add `intensity` to `action_move`**

Find:

```json
    "action_move": {
      "type": "object",
      "required": ["player", "type", "moves"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "move" },
        "moves": { "type": "array", "minItems": 1, "items": { "$ref": "#/definitions/move_step" } },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },
```

Replace with:

```json
    "action_move": {
      "type": "object",
      "required": ["player", "type", "moves"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "move" },
        "moves": { "type": "array", "minItems": 1, "items": { "$ref": "#/definitions/move_step" } },
        "intensity": { "$ref": "#/definitions/movement_intensity" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },
```

- [ ] **Step 3: Add `intensity` to `action_cut`**

Find:

```json
    "action_cut": {
      "type": "object",
      "required": ["player", "type", "moves"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "cut" },
        "moves": { "type": "array", "minItems": 1, "items": { "$ref": "#/definitions/move_step" } },
        "variant": { "type": "string", "enum": ["backdoor", "give_and_go", "flash", "v_cut", "l_cut", "curl", "flare", "fade", "basket"] },
        "around_player": { "$ref": "#/definitions/entity_ref" },
        "off_screen_by": { "$ref": "#/definitions/entity_ref" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },
```

Replace with:

```json
    "action_cut": {
      "type": "object",
      "required": ["player", "type", "moves"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "cut" },
        "moves": { "type": "array", "minItems": 1, "items": { "$ref": "#/definitions/move_step" } },
        "variant": { "type": "string", "enum": ["backdoor", "give_and_go", "flash", "v_cut", "l_cut", "curl", "flare", "fade", "basket"] },
        "around_player": { "$ref": "#/definitions/entity_ref" },
        "off_screen_by": { "$ref": "#/definitions/entity_ref" },
        "intensity": { "$ref": "#/definitions/movement_intensity" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },
```

- [ ] **Step 4: Add `intensity` to `action_dribble`**

Find:

```json
    "action_dribble": {
      "type": "object",
      "required": ["player", "type", "moves"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "dribble" },
        "moves": { "type": "array", "minItems": 1, "items": { "$ref": "#/definitions/move_step" } },
        "ball_id": { "$ref": "#/definitions/ball_ref" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },
```

Replace with:

```json
    "action_dribble": {
      "type": "object",
      "required": ["player", "type", "moves"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "dribble" },
        "moves": { "type": "array", "minItems": 1, "items": { "$ref": "#/definitions/move_step" } },
        "ball_id": { "$ref": "#/definitions/ball_ref" },
        "intensity": { "$ref": "#/definitions/movement_intensity" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },
```

- [ ] **Step 5: Commit is not yet — continue to Task 4 first (single commit at end of Task 6)**

---

### Task 4: Wire `ball_intensity` into `action_pass`, `action_shoot`

**Files:**
- Modify: `schema/v1.json` (`action_pass`, `action_shoot` definitions)

- [ ] **Step 1: Add `intensity` to `action_pass`**

Find:

```json
    "action_pass": {
      "type": "object",
      "required": ["player", "type", "to_player"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "pass" },
        "to_player": { "$ref": "#/definitions/entity_ref" },
        "ball_id": { "$ref": "#/definitions/ball_ref" },
        "variant": { "type": "string", "enum": ["chest", "bounce", "overhead", "lob", "baseball", "hand_off", "outlet"] },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },
```

Replace with:

```json
    "action_pass": {
      "type": "object",
      "required": ["player", "type", "to_player"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "pass" },
        "to_player": { "$ref": "#/definitions/entity_ref" },
        "ball_id": { "$ref": "#/definitions/ball_ref" },
        "variant": { "type": "string", "enum": ["chest", "bounce", "overhead", "lob", "baseball", "hand_off", "outlet"] },
        "intensity": { "$ref": "#/definitions/ball_intensity" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },
```

- [ ] **Step 2: Add `intensity` to `action_shoot`**

Find:

```json
    "action_shoot": {
      "type": "object",
      "required": ["player", "type"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "shoot" },
        "ball_id": { "$ref": "#/definitions/ball_ref" },
        "variant": { "type": "string", "enum": ["jumper", "three", "layup", "floater", "dunk", "hook", "free_throw"] },
        "result": { "type": "string", "enum": ["make", "miss"] },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },
```

Replace with:

```json
    "action_shoot": {
      "type": "object",
      "required": ["player", "type"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "shoot" },
        "ball_id": { "$ref": "#/definitions/ball_ref" },
        "variant": { "type": "string", "enum": ["jumper", "three", "layup", "floater", "dunk", "hook", "free_throw"] },
        "result": { "type": "string", "enum": ["make", "miss"] },
        "intensity": { "$ref": "#/definitions/ball_intensity" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },
```

---

### Task 5: Wire `physicality` into `action_screen`, `action_defend`, `action_rebound`, `action_pickup`

**Files:**
- Modify: `schema/v1.json` (`action_screen`, `action_defend`, `action_rebound`, `action_pickup` definitions)

- [ ] **Step 1: Add `physicality` to `action_screen`**

Find:

```json
    "action_screen": {
      "type": "object",
      "required": ["player", "type", "for_player"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "screen" },
        "for_player": { "$ref": "#/definitions/entity_ref" },
        "on_player": { "$ref": "#/definitions/entity_ref" },
        "at": { "$ref": "#/definitions/coordinate" },
        "variant": { "type": "string", "enum": ["ball_screen", "back_screen", "down_screen", "flare_screen", "cross_screen", "pin_down"] },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },
```

Replace with:

```json
    "action_screen": {
      "type": "object",
      "required": ["player", "type", "for_player"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "screen" },
        "for_player": { "$ref": "#/definitions/entity_ref" },
        "on_player": { "$ref": "#/definitions/entity_ref" },
        "at": { "$ref": "#/definitions/coordinate" },
        "variant": { "type": "string", "enum": ["ball_screen", "back_screen", "down_screen", "flare_screen", "cross_screen", "pin_down"] },
        "physicality": { "$ref": "#/definitions/physicality" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },
```

- [ ] **Step 2: Add `physicality` to `action_defend`**

Find:

```json
    "action_defend": {
      "type": "object",
      "required": ["player", "type", "guards_player"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "defend" },
        "guards_player": { "$ref": "#/definitions/entity_ref" },
        "variant": { "type": "string", "enum": ["on_ball", "deny", "help", "hedge", "switch", "box_out"] },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },
```

Replace with:

```json
    "action_defend": {
      "type": "object",
      "required": ["player", "type", "guards_player"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "defend" },
        "guards_player": { "$ref": "#/definitions/entity_ref" },
        "variant": { "type": "string", "enum": ["on_ball", "deny", "help", "hedge", "switch", "box_out"] },
        "physicality": { "$ref": "#/definitions/physicality" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },
```

- [ ] **Step 3: Add `physicality` to `action_rebound`**

Find:

```json
    "action_rebound": {
      "type": "object",
      "required": ["player", "type"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "rebound" },
        "ball_id": { "$ref": "#/definitions/ball_ref" },
        "variant": { "type": "string", "enum": ["offensive", "defensive"] },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },
```

Replace with:

```json
    "action_rebound": {
      "type": "object",
      "required": ["player", "type"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "rebound" },
        "ball_id": { "$ref": "#/definitions/ball_ref" },
        "variant": { "type": "string", "enum": ["offensive", "defensive"] },
        "physicality": { "$ref": "#/definitions/physicality" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },
```

- [ ] **Step 4: Add `physicality` to `action_pickup`**

Find:

```json
    "action_pickup": {
      "type": "object",
      "required": ["player", "type", "ball_id"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "pickup" },
        "ball_id": { "$ref": "#/definitions/ball_ref" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },
```

Replace with:

```json
    "action_pickup": {
      "type": "object",
      "required": ["player", "type", "ball_id"],
      "properties": {
        "player": { "$ref": "#/definitions/entity_ref" },
        "type": { "const": "pickup" },
        "ball_id": { "$ref": "#/definitions/ball_ref" },
        "physicality": { "$ref": "#/definitions/physicality" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "after": { "$ref": "#/definitions/action_ref" },
        "with": { "$ref": "#/definitions/action_ref" },
        "on_catch": { "type": "boolean" }
      },
      "additionalProperties": false
    },
```

---

### Task 6: Green — verify wiring and commit

**Files:** none (verification), then commit `schema/v1.json` + the two example files from Task 1.

- [ ] **Step 1: Verify reference counts**

Run: `grep -c '"\$ref": "#/definitions/movement_intensity"' schema/v1.json`
Expected: `4` (move_step, action_move, action_cut, action_dribble)

Run: `grep -c '"\$ref": "#/definitions/ball_intensity"' schema/v1.json`
Expected: `2` (action_pass, action_shoot)

Run: `grep -c '"\$ref": "#/definitions/physicality"' schema/v1.json`
Expected: `4` (action_screen, action_defend, action_rebound, action_pickup)

- [ ] **Step 2: Run validation — now expected to pass**

Run: `npm run validate`
Expected: PASS for all `examples/*.ocf.json`, no errors.

- [ ] **Step 3: Commit**

```bash
git add schema/v1.json examples/pick-and-roll.ocf.json examples/transition-3v2.ocf.json
git commit -m "feat: add intensity and physicality enums to action schema

Adds movement_intensity (move/cut/dribble, per-move overridable),
ball_intensity (pass/shoot) and physicality (screen/defend/rebound/pickup)
as optional additive enums. See docs/superpowers/specs/2026-07-20-action-intensity-design.md."
```

---

### Task 7: Add invalid fixtures for the three new enums

**Files:**
- Create: `examples/invalid/action-bad-movement-intensity.json`
- Create: `examples/invalid/action-bad-ball-intensity.json`
- Create: `examples/invalid/action-bad-physicality.json`

- [ ] **Step 1: Create `examples/invalid/action-bad-movement-intensity.json`**

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "meta": { "id": "00000000-0000-4000-8000-000000000007", "title": "bad movement intensity" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "offense", "nr": 1, "x": 0, "y": 5 } ],
  "frames": [
    { "id": "f1", "actions": [ { "player": "offense_1", "type": "move", "intensity": "medium", "moves": [ { "to": { "x": 0, "y": 6 } } ] } ], "end_state": {} }
  ]
}
```

- [ ] **Step 2: Create `examples/invalid/action-bad-ball-intensity.json`**

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

- [ ] **Step 3: Create `examples/invalid/action-bad-physicality.json`**

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "meta": { "id": "00000000-0000-4000-8000-000000000009", "title": "bad physicality" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "offense", "nr": 1, "x": 0, "y": 5 } ],
  "frames": [
    { "id": "f1", "actions": [ { "player": "offense_1", "type": "pickup", "ball_id": "ball_1", "physicality": "violent" } ], "end_state": {} }
  ]
}
```

- [ ] **Step 4: Run the invalid-fixture check**

Run: `npm run test:invalid`
Expected: `All 9 invalid fixture(s) correctly rejected.`

- [ ] **Step 5: Commit**

```bash
git add examples/invalid/action-bad-movement-intensity.json examples/invalid/action-bad-ball-intensity.json examples/invalid/action-bad-physicality.json
git commit -m "test: add invalid fixtures for intensity/physicality enums"
```

---

### Task 8: Deprecate `duration_ms` and document the new fields

**Files:**
- Modify: `schema/v1.json:464`
- Modify: `docs/specification-v1.adoc` (Action Types table, new subsection, Frame Model table, Enums Summary, Changelog)
- Modify: `package.json`

- [ ] **Step 1: Annotate `duration_ms` as deprecated in the schema**

Find (`schema/v1.json:464`):

```json
        "duration_ms": { "type": "integer", "minimum": 0 },
```

Replace with:

```json
        "duration_ms": { "type": "integer", "minimum": 0, "description": "Deprecated: use per-action 'intensity' instead. Suggested animation duration for the phase." },
```

- [ ] **Step 2: Update the Action Types table in `docs/specification-v1.adoc`**

Find (around line 525-537):

```
[cols="1,1,2,3", options="header"]
|===
| Type | Ball? | Required | Optional (variant enum / references)
| `move` | no | `moves[]` | —
| `cut` | no | `moves[]` | `variant` (backdoor, give_and_go, flash, v_cut, l_cut, curl, flare, fade, basket); per-move `around_player`, `off_screen_by`
| `screen` | no | `for_player` | `on_player`, `at`, `variant` (ball_screen, back_screen, down_screen, flare_screen, cross_screen, pin_down)
| `defend` | no | `guards_player` | `variant` (on_ball, deny, help, hedge, switch, box_out)
| `dribble` | yes | `moves[]` | `ball_id`; per-move `variant` (speed, hesitation, crossover, behind_back, between_legs, spin, retreat)
| `pass` | yes | `to_player` | `ball_id`, `variant` (chest, bounce, overhead, lob, baseball, hand_off, outlet)
| `shoot` | yes | `player` | `ball_id`, `variant` (jumper, three, layup, floater, dunk, hook, free_throw), `result` (make/miss)
| `rebound` | becomes carrier | `player` | `ball_id`, `variant` (offensive, defensive)
| `pickup` | becomes carrier | `ball_id` | —
|===
```

Replace with:

```
[cols="1,1,2,3", options="header"]
|===
| Type | Ball? | Required | Optional (variant enum / references)
| `move` | no | `moves[]` | `intensity`; per-move `intensity`
| `cut` | no | `moves[]` | `variant` (backdoor, give_and_go, flash, v_cut, l_cut, curl, flare, fade, basket); `intensity`; per-move `around_player`, `off_screen_by`, `intensity`
| `screen` | no | `for_player` | `on_player`, `at`, `variant` (ball_screen, back_screen, down_screen, flare_screen, cross_screen, pin_down), `physicality`
| `defend` | no | `guards_player` | `variant` (on_ball, deny, help, hedge, switch, box_out), `physicality`
| `dribble` | yes | `moves[]` | `ball_id`, `intensity`; per-move `variant` (speed, hesitation, crossover, behind_back, between_legs, spin, retreat), `intensity`
| `pass` | yes | `to_player` | `ball_id`, `variant` (chest, bounce, overhead, lob, baseball, hand_off, outlet), `intensity`
| `shoot` | yes | `player` | `ball_id`, `variant` (jumper, three, layup, floater, dunk, hook, free_throw), `result` (make/miss), `intensity`
| `rebound` | becomes carrier | `player` | `ball_id`, `variant` (offensive, defensive), `physicality`
| `pickup` | becomes carrier | `ball_id` | `physicality`
|===
```

- [ ] **Step 3: Add a new "Intensity & Physicality" subsection after "Movement Sequences"**

Find (end of the Movement Sequences section, right before `=== Timing`):

```
[source,json]
----
{
  "player": "offense_1",
  "type": "dribble",
  "ball_id": "ball_1",
  "moves": [
    { "variant": "crossover" },
    { "variant": "speed", "to": { "named": "basket" }, "around_player": "defense_1" }
  ]
}
----

=== Timing
```

Replace with:

```
[source,json]
----
{
  "player": "offense_1",
  "type": "dribble",
  "ball_id": "ball_1",
  "moves": [
    { "variant": "crossover" },
    { "variant": "speed", "to": { "named": "basket" }, "around_player": "defense_1" }
  ]
}
----

=== Intensity & Physicality

Two optional, independent enums express relative execution style. Neither
implies a concrete duration — a downstream application combines them with
actual player/roster data to derive timing or pick renderer animations.

[cols="1,2,3", options="header"]
|===
| Field | Applies to | Enum
| `intensity` (`movement_intensity`) | `move`, `cut`, `dribble` (action-level and per-move, move overrides action) | `slow`, `normal` (default), `fast`, `explosive`
| `intensity` (`ball_intensity`) | `pass`, `shoot` | `soft`, `normal` (default), `hard`, `bullet`
| `physicality` | `screen`, `defend`, `rebound`, `pickup` | `passive`, `normal` (default), `aggressive`, `hard`
|===

`intensity` describes tempo over distance (how fast a player/ball moves).
`physicality` describes contact/collision style and has no bearing on
timing — it exists purely to help a renderer pick the right animation (e.g.
a clean screen vs. a moving-screen-style rammed one). The two are
deliberately separate so a distance→time calculation built on `intensity`
never has to reason about `physicality` values.

[source,json]
----
{
  "player": "offense_1",
  "type": "cut",
  "intensity": "slow",
  "moves": [
    { "to": { "x": -2.0, "y": 4.5 } },
    { "to": { "named": "basket" }, "intensity": "explosive" }
  ]
}
----

`duration_ms` (see <<Frame Model>>) is deprecated in favor of `intensity`.
It remains valid for backward compatibility with existing play files, but
new play files should express tempo via `intensity` instead.

=== Timing
```

- [ ] **Step 4: Update the Frame Model table's `duration_ms` row**

Find (`docs/specification-v1.adoc:619`):

```
| `duration_ms` | no | Suggested animation duration for the phase.
```

Replace with:

```
| `duration_ms` | no | *Deprecated* — use per-action `intensity` instead. Suggested animation duration for the phase.
```

- [ ] **Step 5: Add the new enums to the Enums Summary table**

Find (around line 1156-1159):

```
| Pass `variant` | chest, bounce, overhead, lob, baseball, hand_off, outlet
| Shoot `variant` | jumper, three, layup, floater, dunk, hook, free_throw
| Rebound `variant` | offensive, defensive
| Frame `outcome` | make, miss, turnover, steal, foul
|===
```

Replace with:

```
| Pass `variant` | chest, bounce, overhead, lob, baseball, hand_off, outlet
| Shoot `variant` | jumper, three, layup, floater, dunk, hook, free_throw
| Rebound `variant` | offensive, defensive
| Frame `outcome` | make, miss, turnover, steal, foul
| `movement_intensity` (move/cut/dribble `intensity`) | slow, normal, fast, explosive
| `ball_intensity` (pass/shoot `intensity`) | soft, normal, hard, bullet
| `physicality` (screen/defend/rebound/pickup) | passive, normal, aggressive, hard
|===
```

- [ ] **Step 6: Add a changelog entry**

Find (`docs/specification-v1.adoc`, appendix):

```
[appendix]
== Changelog

=== v2.0.0
```

Replace with:

```
[appendix]
== Changelog

=== v2.1.0

Adds optional `intensity` (`movement_intensity` for move/cut/dribble,
`ball_intensity` for pass/shoot) and `physicality` (screen/defend/rebound/
pickup) enums. Deprecates frame-level `duration_ms` in favor of per-action
`intensity`; `duration_ms` remains valid for backward compatibility.

=== v2.0.0
```

- [ ] **Step 7: Bump the package version**

Find (`package.json`):

```json
  "version": "2.0.0",
```

Replace with:

```json
  "version": "2.1.0",
```

- [ ] **Step 8: Commit**

```bash
git add schema/v1.json docs/specification-v1.adoc package.json
git commit -m "docs: deprecate duration_ms, document intensity/physicality fields

Bumps spec to v2.1.0."
```

---

### Task 9: Final full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`
Expected: `validate` passes for all `examples/*.ocf.json` (now including the
9 invalid fixtures being excluded — they live in `examples/invalid/`, not
matched by the `examples/*.ocf.json` glob), then
`test:invalid` reports `All 9 invalid fixture(s) correctly rejected.`

- [ ] **Step 2: Confirm git status is clean**

Run: `git status`
Expected: `nothing to commit, working tree clean`
