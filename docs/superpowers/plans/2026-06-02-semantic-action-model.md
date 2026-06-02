# Semantic Action Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the geometric OCF v1 schema with a semantic action model (action-based frames, automatic ball possession, multiple balls, outcome branches) and update all examples, tooling, and docs to match.

**Architecture:** This is a JSON-Schema / standard repo, not a code project. "Tests" = AJV (Draft-7) validation: valid `examples/*.ocf.json` must PASS, invalid fixtures in `examples/invalid/*.json` must FAIL. We rewrite `schema/v1.json` in place (replaces v1 directly, per spec §11), add a tiny npm test harness for negative fixtures, rewrite the three examples in the new model, and bring the AsciiDoc spec + README into line.

**Tech Stack:** JSON Schema Draft-7, AJV CLI (`ajv-cli` + `ajv-formats`), Node.js (test script), AsciiDoc.

**Spec:** `docs/superpowers/specs/2026-06-02-semantic-action-model-design.md`

**Out of scope (future, separate repos — see roadmap):** the semantic validator (ball-possession consistency, branch reference integrity, end_state agreement), the renderer, the editor, LLM generation. These are tracked as a TODO in Task 12, not built here.

---

## File Structure

- `package.json` — **Create.** npm scripts: `validate` (AJV over valid examples), `test:invalid` (assert AJV fails on each invalid fixture), `test` (both). Pins `ajv-cli`, `ajv-formats`.
- `scripts/check-invalid.mjs` — **Create.** Node script that runs AJV against each `examples/invalid/*.json` and exits non-zero if any of them *validates successfully* (i.e. the schema failed to reject bad input).
- `schema/v1.json` — **Rewrite.** Remove `entity_ball`, line-based frames, `entity_states`. Add `balls`, ball-state `oneOf`, `action` definitions (one per type), `moves`, hybrid `frame` (`start_state`/`end_state`/`actions`/`branches`), `state` block, `outcome` enum, `action_ref`.
- `examples/pick-and-roll.ocf.json` — **Rewrite** in the new model (detail mode).
- `examples/3-man-weave.ocf.json` — **Rewrite** in the new model.
- `examples/transition-3v2.ocf.json` — **Rewrite** in the new model (includes a branch / continuum element).
- `examples/quick-mode.ocf.json` — **Create.** Minimal "fast sketch" example proving all-optional fields (spec §9).
- `examples/invalid/` — **Create dir** with negative fixtures (one per schema rule under test).
- `.github/workflows/validate.yml` — **Modify.** Run `npm test` (valid + invalid) instead of a bare `ajv validate`.
- `docs/specification-v1.adoc` — **Modify.** Replace the "Entities/Ball", "Lines", "Frames", "Complete Example", "Schema Reference", "Enums Summary", "LLM Generation Guide", "Changelog" sections to describe the action model.
- `README.md` — **Modify.** Update the format overview / feature bullets and any inline example.

---

## Task 1: Test harness for negative fixtures

**Files:**
- Create: `package.json`
- Create: `scripts/check-invalid.mjs`
- Create: `examples/invalid/.gitkeep`

- [ ] **Step 1: Create `examples/invalid/.gitkeep`**

Create an empty file so the directory exists before fixtures are added:

```
(empty file)
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "open-coaching-format",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "description": "Open standard for basketball drill diagrams and animations.",
  "scripts": {
    "validate": "ajv validate --spec=draft7 -s schema/v1.json -d \"examples/*.ocf.json\" --all-errors --verbose -c ajv-formats",
    "test:invalid": "node scripts/check-invalid.mjs",
    "test": "npm run validate && npm run test:invalid"
  },
  "devDependencies": {
    "ajv-cli": "^5.0.0",
    "ajv-formats": "^3.0.1"
  }
}
```

- [ ] **Step 3: Create `scripts/check-invalid.mjs`**

This script asserts that every fixture in `examples/invalid/` is *rejected* by the schema. It shells out to the same `ajv` CLI; a fixture that validates successfully is a test failure.

```js
#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "examples/invalid";
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

if (files.length === 0) {
  console.error("No invalid fixtures found in examples/invalid/");
  process.exit(1);
}

let failures = 0;
for (const file of files) {
  const path = join(dir, file);
  let validated = false;
  try {
    execFileSync(
      "npx",
      ["ajv", "validate", "--spec=draft7", "-s", "schema/v1.json", "-d", path, "-c", "ajv-formats"],
      { stdio: "pipe" }
    );
    validated = true; // ajv exited 0 => it accepted the bad fixture
  } catch {
    // ajv exited non-zero => correctly rejected
  }
  if (validated) {
    console.error(`FAIL: ${path} was accepted by the schema but should be invalid.`);
    failures++;
  } else {
    console.log(`ok: ${path} correctly rejected.`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} invalid fixture(s) were wrongly accepted.`);
  process.exit(1);
}
console.log(`\nAll ${files.length} invalid fixture(s) correctly rejected.`);
```

- [ ] **Step 4: Install dependencies and run the harness (expect it to fail — no fixtures yet, and old schema)**

Run: `npm install && npm run test:invalid`
Expected: FAIL with "No invalid fixtures found in examples/invalid/" (only `.gitkeep` present, no `.json`). This confirms the harness itself works.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/check-invalid.mjs examples/invalid/.gitkeep
git commit -m "build: add npm test harness for negative schema fixtures"
```

---

## Task 2: Schema scaffolding — meta/court/balls (drop ball entity)

**Files:**
- Modify: `schema/v1.json`
- Create: `examples/invalid/ball-carried-and-at.json`

This task establishes the new top-level shape: keep `meta`/`court`/`color_scheme`/`named_positions` (unchanged), remove the ball entity, and add the `balls[]` array with the `carried_by` XOR `at` XOR `dead` lifecycle.

- [ ] **Step 1: Write the failing negative fixture**

A ball with BOTH `carried_by` and `at` must be rejected. Create `examples/invalid/ball-carried-and-at.json`:

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "meta": { "id": "00000000-0000-4000-8000-000000000001", "title": "bad ball state" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "offense", "nr": 1, "x": 0, "y": 5 } ],
  "balls": [ { "id": "ball_1", "carried_by": "offense_1", "at": { "named": "basket" } } ],
  "frames": [ { "id": "f1", "actions": [], "end_state": {} } ]
}
```

- [ ] **Step 2: Run the harness to verify it does NOT yet reject (old schema still loaded)**

Run: `npm run test:invalid`
Expected: FAIL — `ball-carried-and-at.json was accepted ... but should be invalid` (the current schema has no `balls` rule, and `additionalProperties:false` at root will actually reject it for a *different* reason; either way the rule we want isn't in place yet). Note the result; we fix it by rewriting the schema below.

- [ ] **Step 3: Begin the schema rewrite — replace the top of `schema/v1.json`**

Replace the entire file `schema/v1.json` with the following scaffold. This keeps the v1 coordinate / color / named-position / entity (minus ball) definitions and introduces `entity_ref` extended with balls, plus the `ball` definition and `balls` top-level array. (Action/frame/state definitions are added in later tasks; for now `frames` accepts a permissive placeholder so the document still parses.)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://opencoachingformat.org/schema/v1.json",
  "title": "Open Coaching Format",
  "description": "Open standard for basketball drill diagrams and animations. Semantic action model.",
  "type": "object",
  "required": ["meta", "court", "entities", "frames"],

  "definitions": {

    "ruleset": {
      "type": "string",
      "enum": ["fiba", "nba", "ncaa", "nfhs", "custom"],
      "description": "Basketball ruleset. Determines unit, field dimensions and named position coordinates."
    },

    "unit": {
      "type": "string",
      "enum": ["m", "ft"],
      "description": "Length unit used for all coordinates in this document. Derived from ruleset unless custom."
    },

    "coordinate_free": {
      "type": "object",
      "description": "Absolute coordinate in court units. Origin at center of court. x: negative=viewer's left, positive=viewer's right. y: positive=frontcourt (offense basket), negative=backcourt.",
      "required": ["x", "y"],
      "properties": { "x": { "type": "number" }, "y": { "type": "number" } },
      "additionalProperties": false
    },

    "coordinate_named": {
      "type": "object",
      "description": "Reference to a named court position resolved via the active ruleset. Custom positions use 'custom.' prefix.",
      "required": ["named"],
      "properties": { "named": { "type": "string" } },
      "additionalProperties": false
    },

    "coordinate_relative": {
      "type": "object",
      "description": "Offset from a named court position, in court units.",
      "required": ["relative_to", "dx", "dy"],
      "properties": {
        "relative_to": { "type": "string" },
        "dx": { "type": "number" },
        "dy": { "type": "number" }
      },
      "additionalProperties": false
    },

    "coordinate": {
      "description": "A single point: absolute, named, or relative.",
      "oneOf": [
        { "$ref": "#/definitions/coordinate_free" },
        { "$ref": "#/definitions/coordinate_named" },
        { "$ref": "#/definitions/coordinate_relative" }
      ]
    },

    "entity_ref": {
      "type": "string",
      "description": "Reference to a player, coach, cone or station. Format '{offense|defense}_{1-9}', 'coach', 'cone_N', 'station_N'.",
      "pattern": "^(offense|defense)_[1-9]$|^coach$|^(cone|station)_[1-9][0-9]*$"
    },

    "ball_ref": {
      "type": "string",
      "description": "Reference to a ball by id, e.g. 'ball_1'.",
      "pattern": "^ball_[1-9][0-9]*$"
    },

    "color_role": {
      "type": "string",
      "enum": ["offense", "defense", "black", "grey", "yellow", "green", "red", "blue", "white"],
      "description": "Semantic color role. Resolved to hex via color_scheme."
    },

    "entity_offense": {
      "type": "object",
      "description": "Offensive player.",
      "required": ["type", "nr", "x", "y"],
      "properties": {
        "type": { "type": "string", "const": "offense" },
        "nr": { "type": "integer", "minimum": 1, "maximum": 9 },
        "x": { "type": "number" },
        "y": { "type": "number" },
        "rotation": { "type": "number", "minimum": 0, "maximum": 360, "default": 0 },
        "color": { "$ref": "#/definitions/color_role", "default": "offense" },
        "label": { "type": "string" }
      },
      "additionalProperties": false
    },

    "entity_defense": {
      "type": "object",
      "description": "Defensive player.",
      "required": ["type", "nr", "x", "y"],
      "properties": {
        "type": { "type": "string", "const": "defense" },
        "nr": { "type": "integer", "minimum": 1, "maximum": 9 },
        "x": { "type": "number" },
        "y": { "type": "number" },
        "rotation": { "type": "number", "minimum": 0, "maximum": 360, "default": 0 },
        "color": { "$ref": "#/definitions/color_role", "default": "defense" },
        "label": { "type": "string" }
      },
      "additionalProperties": false
    },

    "entity_coach": {
      "type": "object",
      "description": "Coach position marker. May carry a ball.",
      "required": ["type", "x", "y"],
      "properties": {
        "type": { "type": "string", "const": "coach" },
        "x": { "type": "number" },
        "y": { "type": "number" }
      },
      "additionalProperties": false
    },

    "entity_cone": {
      "type": "object",
      "description": "Training cone / marker.",
      "required": ["type", "nr", "x", "y"],
      "properties": {
        "type": { "type": "string", "const": "cone" },
        "nr": { "type": "integer", "minimum": 1 },
        "x": { "type": "number" },
        "y": { "type": "number" }
      },
      "additionalProperties": false
    },

    "entity_station": {
      "type": "object",
      "description": "Numbered station for circuit training.",
      "required": ["type", "nr", "x", "y"],
      "properties": {
        "type": { "type": "string", "const": "station" },
        "nr": { "type": "integer", "minimum": 1 },
        "label": { "type": "string" },
        "x": { "type": "number" },
        "y": { "type": "number" }
      },
      "additionalProperties": false
    },

    "entity": {
      "description": "Any non-ball entity on the court.",
      "oneOf": [
        { "$ref": "#/definitions/entity_offense" },
        { "$ref": "#/definitions/entity_defense" },
        { "$ref": "#/definitions/entity_coach" },
        { "$ref": "#/definitions/entity_cone" },
        { "$ref": "#/definitions/entity_station" }
      ]
    },

    "ball": {
      "type": "object",
      "description": "A ball. Holds exactly one lifecycle state: carried_by, at, or dead.",
      "required": ["id"],
      "properties": {
        "id": { "$ref": "#/definitions/ball_ref" },
        "carried_by": { "$ref": "#/definitions/entity_ref" },
        "at": { "$ref": "#/definitions/coordinate" },
        "dead": { "type": "boolean", "const": true }
      },
      "additionalProperties": false,
      "oneOf": [
        { "required": ["carried_by"], "not": { "anyOf": [ { "required": ["at"] }, { "required": ["dead"] } ] } },
        { "required": ["at"], "not": { "anyOf": [ { "required": ["carried_by"] }, { "required": ["dead"] } ] } },
        { "required": ["dead"], "not": { "anyOf": [ { "required": ["carried_by"] }, { "required": ["at"] } ] } }
      ]
    },

    "custom_position": {
      "type": "object",
      "required": ["x", "y"],
      "properties": {
        "x": { "type": "number" },
        "y": { "type": "number" },
        "description": { "type": "string" }
      },
      "additionalProperties": false
    },

    "color_scheme": {
      "type": "object",
      "description": "Hex color values for each semantic role.",
      "properties": {
        "offense_fill": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$", "default": "#003366" },
        "offense_stroke": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$", "default": "#ffffff" },
        "defense_fill": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$", "default": "#58001d" },
        "defense_stroke": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$", "default": "#ffffff" },
        "black": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$", "default": "#000000" },
        "grey": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$", "default": "#7f7f7f" },
        "yellow": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$", "default": "#ffff00" },
        "green": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$", "default": "#7ce86a" },
        "red": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$", "default": "#ff0000" },
        "blue": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$", "default": "#5dd5ff" },
        "white": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$", "default": "#ffffff" }
      },
      "additionalProperties": false
    },

    "frame": {
      "type": "object",
      "description": "PLACEHOLDER — replaced in Task 5. Permissive so documents parse during scaffolding.",
      "required": ["id"],
      "properties": {
        "id": { "type": "string" },
        "label": { "type": "string" },
        "description": { "type": "string" },
        "duration_ms": { "type": "integer", "minimum": 0 },
        "start_state": { "type": "object" },
        "actions": { "type": "array" },
        "end_state": { "type": "object" },
        "branches": { "type": "object" }
      },
      "additionalProperties": false
    }
  },

  "properties": {

    "meta": {
      "type": "object",
      "required": ["id", "title"],
      "properties": {
        "id": { "type": "string", "format": "uuid" },
        "title": { "type": "string" },
        "description": { "type": "string" },
        "author": { "type": "string" },
        "tags": { "type": "array", "items": { "type": "string" } },
        "difficulty": { "type": "string", "enum": ["beginner", "intermediate", "advanced"] },
        "created": { "type": "string", "format": "date-time" },
        "modified": { "type": "string", "format": "date-time" },
        "source_format": { "type": "string", "enum": ["fiba", "fastdraw", "open", "custom"] },
        "source_url": { "type": "string", "format": "uri" }
      },
      "additionalProperties": false
    },

    "court": {
      "type": "object",
      "required": ["ruleset", "type"],
      "properties": {
        "ruleset": { "$ref": "#/definitions/ruleset" },
        "type": { "type": "string", "enum": ["half_court", "full_court"] },
        "drill_focus": { "type": "string", "enum": ["offense", "defense", "transition", "neutral"], "default": "offense" },
        "wheelchair": { "type": "boolean", "default": false },
        "custom_dimensions": {
          "type": "object",
          "required": ["unit", "length", "width", "basket_from_baseline", "three_point_distance", "paint_width", "paint_depth", "free_throw_distance"],
          "properties": {
            "unit": { "$ref": "#/definitions/unit" },
            "length": { "type": "number" },
            "width": { "type": "number" },
            "basket_from_baseline": { "type": "number" },
            "three_point_distance": { "type": "number" },
            "paint_width": { "type": "number" },
            "paint_depth": { "type": "number" },
            "free_throw_distance": { "type": "number" }
          },
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    },

    "color_scheme": { "$ref": "#/definitions/color_scheme" },

    "named_positions": {
      "type": "object",
      "properties": {
        "custom": {
          "type": "object",
          "additionalProperties": { "$ref": "#/definitions/custom_position" }
        }
      },
      "additionalProperties": false
    },

    "entities": {
      "type": "array",
      "description": "All non-ball entities and their initial (frame 0) positions.",
      "items": { "$ref": "#/definitions/entity" }
    },

    "balls": {
      "type": "array",
      "description": "Balls present at the start of the drill. Each holds exactly one lifecycle state.",
      "items": { "$ref": "#/definitions/ball" }
    },

    "frames": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/definitions/frame" }
    },

    "areas": { "type": "array", "items": { "$ref": "#/definitions/area" } },
    "labels": { "type": "array", "items": { "$ref": "#/definitions/label" } }
  },

  "additionalProperties": false,

  "if": { "properties": { "court": { "properties": { "ruleset": { "const": "custom" } } } } },
  "then": { "properties": { "court": { "required": ["custom_dimensions"] } } }
}
```

> Note: `area` and `label` definitions are referenced above but added in Task 8. Until then, validation of any example using `areas`/`labels` will error on the missing `$ref`. The examples are rewritten only from Task 6 onward, so this is fine; we do not run `npm run validate` until Task 6.

- [ ] **Step 4: Run the negative harness to verify the bad ball is now rejected**

Run: `npm run test:invalid`
Expected: PASS — `ok: examples/invalid/ball-carried-and-at.json correctly rejected.` (rejected by the ball `oneOf`).

- [ ] **Step 5: Commit**

```bash
git add schema/v1.json examples/invalid/ball-carried-and-at.json
git commit -m "feat(schema): replace ball entity with balls[] lifecycle (carried_by/at/dead)"
```

---

## Task 3: State block (start_state / end_state)

**Files:**
- Modify: `schema/v1.json`
- Create: `examples/invalid/state-bad-ball-key.json`

A `state` is a map of entity refs → coordinate, plus an optional `balls` map of ball ref → ball-state. Used by both `start_state` and `end_state`.

- [ ] **Step 1: Write the failing negative fixture**

A `balls` key inside a state that is not a valid `ball_ref` must be rejected. Create `examples/invalid/state-bad-ball-key.json`:

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "meta": { "id": "00000000-0000-4000-8000-000000000002", "title": "bad state ball key" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "offense", "nr": 1, "x": 0, "y": 5 } ],
  "frames": [
    {
      "id": "f1",
      "actions": [],
      "end_state": { "balls": { "not_a_ball": { "dead": true } } }
    }
  ]
}
```

- [ ] **Step 2: Run harness to verify it is NOT yet rejected**

Run: `npm run test:invalid`
Expected: FAIL — `state-bad-ball-key.json was accepted ... but should be invalid` (the placeholder `start_state`/`end_state` accept any object).

- [ ] **Step 3: Add the `state` and `ball_state` definitions**

In `schema/v1.json`, inside `definitions`, add after the `ball` definition:

```json
    "ball_state": {
      "type": "object",
      "description": "A ball's lifecycle state inside a frame state, keyed by ball ref. Exactly one of carried_by/at/dead.",
      "properties": {
        "carried_by": { "$ref": "#/definitions/entity_ref" },
        "at": { "$ref": "#/definitions/coordinate" },
        "dead": { "type": "boolean", "const": true }
      },
      "additionalProperties": false,
      "oneOf": [
        { "required": ["carried_by"], "not": { "anyOf": [ { "required": ["at"] }, { "required": ["dead"] } ] } },
        { "required": ["at"], "not": { "anyOf": [ { "required": ["carried_by"] }, { "required": ["dead"] } ] } },
        { "required": ["dead"], "not": { "anyOf": [ { "required": ["carried_by"] }, { "required": ["at"] } ] } }
      ]
    },

    "state": {
      "type": "object",
      "description": "Positional + ball anchor. Entity refs map to a coordinate; the optional 'balls' map keys ball refs to ball states.",
      "properties": {
        "balls": {
          "type": "object",
          "propertyNames": { "$ref": "#/definitions/ball_ref" },
          "additionalProperties": { "$ref": "#/definitions/ball_state" }
        }
      },
      "patternProperties": {
        "^(offense|defense)_[1-9]$|^coach$|^(cone|station)_[1-9][0-9]*$": { "$ref": "#/definitions/coordinate" }
      },
      "additionalProperties": false
    }
```

- [ ] **Step 4: Point the placeholder frame's state fields at `state`**

In the placeholder `frame` definition, change `start_state` and `end_state` from `{ "type": "object" }` to references:

```json
        "start_state": { "$ref": "#/definitions/state" },
        "end_state": { "$ref": "#/definitions/state" },
```

- [ ] **Step 5: Run harness to verify the bad ball key is now rejected**

Run: `npm run test:invalid`
Expected: PASS — both `ball-carried-and-at.json` and `state-bad-ball-key.json` correctly rejected. (`not_a_ball` fails `propertyNames`.)

- [ ] **Step 6: Commit**

```bash
git add schema/v1.json examples/invalid/state-bad-ball-key.json
git commit -m "feat(schema): add state block for start_state/end_state anchors"
```

---

## Task 4: Action definitions (move/cut/screen/defend/dribble/pass/shoot/rebound/pickup)

**Files:**
- Modify: `schema/v1.json`
- Create: `examples/invalid/action-pass-missing-receiver.json`
- Create: `examples/invalid/action-unknown-type.json`

Define every action type as its own `oneOf` branch, with required fields per the spec §7 catalog and optional `variant` enums + free `tags`.

- [ ] **Step 1: Write the failing negative fixtures**

Create `examples/invalid/action-pass-missing-receiver.json` (a `pass` without `to_player` must be rejected):

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "meta": { "id": "00000000-0000-4000-8000-000000000003", "title": "pass without receiver" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "offense", "nr": 1, "x": 0, "y": 5 } ],
  "balls": [ { "id": "ball_1", "carried_by": "offense_1" } ],
  "frames": [
    { "id": "f1", "actions": [ { "player": "offense_1", "type": "pass" } ], "end_state": {} }
  ]
}
```

Create `examples/invalid/action-unknown-type.json` (an unknown action type must be rejected):

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "meta": { "id": "00000000-0000-4000-8000-000000000004", "title": "unknown action" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "offense", "nr": 1, "x": 0, "y": 5 } ],
  "frames": [
    { "id": "f1", "actions": [ { "player": "offense_1", "type": "teleport" } ], "end_state": {} }
  ]
}
```

- [ ] **Step 2: Run harness to verify they are NOT yet rejected**

Run: `npm run test:invalid`
Expected: FAIL — both new fixtures accepted (placeholder `actions` is `{ "type": "array" }`).

- [ ] **Step 3: Add shared action sub-definitions**

In `definitions`, add the move-step and action-ref building blocks. (Timing fields `after`/`with`/`on_catch` are inlined directly on each action in Step 4 for authoring ergonomics — JSON Schema has no property spreading, so there is no separate `timing` definition.)

```json
    "action_ref": {
      "type": "string",
      "description": "Reference to another action in the same frame: '<entity_ref>.<action_type>'.",
      "pattern": "^((offense|defense)_[1-9]|coach|(cone|station)_[1-9][0-9]*)\\.(move|cut|screen|defend|dribble|pass|shoot|rebound|pickup)$"
    },

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
    }
```

- [ ] **Step 4: Add the per-type action definitions**

In `definitions`, add the nine action types. Each inlines the optional timing fields (`after`, `with`, `on_catch`) and a free `tags` array.

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

    "action": {
      "description": "Any action. Discriminated by 'type'.",
      "oneOf": [
        { "$ref": "#/definitions/action_move" },
        { "$ref": "#/definitions/action_cut" },
        { "$ref": "#/definitions/action_screen" },
        { "$ref": "#/definitions/action_defend" },
        { "$ref": "#/definitions/action_dribble" },
        { "$ref": "#/definitions/action_pass" },
        { "$ref": "#/definitions/action_shoot" },
        { "$ref": "#/definitions/action_rebound" },
        { "$ref": "#/definitions/action_pickup" }
      ]
    }
```

- [ ] **Step 5: Point the placeholder frame's `actions` at the `action` definition**

In the placeholder `frame` definition, change `actions` from `{ "type": "array" }` to:

```json
        "actions": { "type": "array", "items": { "$ref": "#/definitions/action" } },
```

- [ ] **Step 6: Run harness to verify both new fixtures are rejected**

Run: `npm run test:invalid`
Expected: PASS — `action-pass-missing-receiver.json` (no `to_player`) and `action-unknown-type.json` (`teleport` matches no `const`) both correctly rejected, plus the earlier two.

- [ ] **Step 7: Commit**

```bash
git add schema/v1.json examples/invalid/action-pass-missing-receiver.json examples/invalid/action-unknown-type.json
git commit -m "feat(schema): add semantic action types with role-based references"
```

---

## Task 5: Real frame definition (replace placeholder) + branches

**Files:**
- Modify: `schema/v1.json`
- Create: `examples/invalid/frame-bad-branch-key.json`

Replace the permissive placeholder `frame` with the real definition: `id` required, `actions` required (may be empty), `end_state` required, `start_state` optional, `branches` an outcome→frame-id map.

- [ ] **Step 1: Write the failing negative fixture**

A `branches` key that is not a valid outcome must be rejected. Create `examples/invalid/frame-bad-branch-key.json`:

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "meta": { "id": "00000000-0000-4000-8000-000000000005", "title": "bad branch outcome" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "offense", "nr": 1, "x": 0, "y": 5 } ],
  "frames": [
    {
      "id": "f1",
      "actions": [ { "player": "offense_1", "type": "shoot" } ],
      "end_state": {},
      "branches": { "swish": "f2" }
    },
    { "id": "f2", "actions": [], "end_state": {} }
  ]
}
```

- [ ] **Step 2: Run harness to verify it is NOT yet rejected**

Run: `npm run test:invalid`
Expected: FAIL — accepted (placeholder `branches` is `{ "type": "object" }`).

- [ ] **Step 3: Add the `outcome` enum and replace the `frame` definition**

In `definitions`, add:

```json
    "outcome": {
      "type": "string",
      "enum": ["make", "miss", "turnover", "steal", "foul"],
      "description": "Result that selects a branch target frame."
    }
```

Then replace the entire placeholder `frame` definition with:

```json
    "frame": {
      "type": "object",
      "description": "A coaching phase: explicit anchors (start_state/end_state) plus semantic actions, with optional outcome branches.",
      "required": ["id", "actions", "end_state"],
      "properties": {
        "id": { "type": "string", "description": "Unique frame id within the drill." },
        "label": { "type": "string" },
        "description": { "type": "string", "description": "Coaching instruction; LLMs should generate this." },
        "duration_ms": { "type": "integer", "minimum": 0 },
        "start_state": {
          "$ref": "#/definitions/state",
          "description": "Optional. Defaults to the previous frame's end_state."
        },
        "actions": {
          "type": "array",
          "description": "Semantic actions in this phase. May be empty.",
          "items": { "$ref": "#/definitions/action" }
        },
        "end_state": {
          "$ref": "#/definitions/state",
          "description": "Explicit anchor at the end of the phase."
        },
        "branches": {
          "type": "object",
          "description": "Optional outcome -> target frame id. Without branches, the next frame in the array follows.",
          "propertyNames": { "$ref": "#/definitions/outcome" },
          "additionalProperties": { "type": "string" },
          "minProperties": 1
        }
      },
      "additionalProperties": false
    }
```

- [ ] **Step 4: Run harness to verify the bad branch key is rejected**

Run: `npm run test:invalid`
Expected: PASS — `frame-bad-branch-key.json` rejected (`swish` fails the `outcome` propertyNames), plus all earlier fixtures.

- [ ] **Step 5: Add a negative fixture for a missing end_state**

Create `examples/invalid/frame-missing-end-state.json`:

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "meta": { "id": "00000000-0000-4000-8000-000000000006", "title": "frame without end_state" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "offense", "nr": 1, "x": 0, "y": 5 } ],
  "frames": [ { "id": "f1", "actions": [] } ]
}
```

- [ ] **Step 6: Run harness to verify it is rejected**

Run: `npm run test:invalid`
Expected: PASS — `frame-missing-end-state.json` rejected (`end_state` required).

- [ ] **Step 7: Commit**

```bash
git add schema/v1.json examples/invalid/frame-bad-branch-key.json examples/invalid/frame-missing-end-state.json
git commit -m "feat(schema): real frame definition with outcome branches"
```

---

## Task 6: Areas, labels + first valid example (pick-and-roll, detail mode)

**Files:**
- Modify: `schema/v1.json`
- Rewrite: `examples/pick-and-roll.ocf.json`

Add the still-missing `area` and `label` definitions (carried over from v1, unchanged shape), then rewrite the pick-and-roll example as the first *valid* document in the new model. This is the first task that runs `npm run validate`.

- [ ] **Step 1: Add `area` and `label` definitions**

In `definitions`, add:

```json
    "area": {
      "type": "object",
      "required": ["form", "x", "y"],
      "properties": {
        "form": { "type": "string", "enum": ["rectangle", "ellipse", "triangle"] },
        "color": { "$ref": "#/definitions/color_role", "default": "yellow" },
        "opacity": { "type": "number", "minimum": 0, "maximum": 1, "default": 0.4 },
        "x": { "type": "number" },
        "y": { "type": "number" },
        "width": { "type": "number" },
        "height": { "type": "number" },
        "rotation": { "type": "number", "minimum": 0, "maximum": 360, "default": 0 },
        "coords": { "type": "array", "minItems": 3, "maxItems": 3, "items": { "$ref": "#/definitions/coordinate" } }
      },
      "additionalProperties": false
    },

    "label": {
      "type": "object",
      "required": ["text", "x", "y"],
      "properties": {
        "text": { "type": "string" },
        "x": { "type": "number" },
        "y": { "type": "number" },
        "color": { "$ref": "#/definitions/color_role", "default": "black" }
      },
      "additionalProperties": false
    }
```

- [ ] **Step 2: Rewrite `examples/pick-and-roll.ocf.json` in the new model**

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
  "frames": [
    {
      "id": "frame_1",
      "label": "Step 1 — Screen",
      "description": "offense_4 moves up from the left elbow to set a ball screen for offense_1 at the top of the key.",
      "duration_ms": 1500,
      "actions": [
        { "player": "offense_4", "type": "screen", "for_player": "offense_1", "on_player": "defense_1", "variant": "ball_screen", "at": { "x": -0.5, "y": 6.7 } }
      ],
      "end_state": {
        "offense_1": { "named": "top_of_the_key" },
        "offense_4": { "x": -0.5, "y": 6.2 },
        "balls": { "ball_1": { "carried_by": "offense_1" } }
      }
    },
    {
      "id": "frame_2",
      "label": "Step 2 — Attack",
      "description": "offense_1 uses the screen and dribbles hard left toward the elbow; offense_4 rolls to the right block.",
      "duration_ms": 2000,
      "actions": [
        {
          "player": "offense_1",
          "type": "dribble",
          "ball_id": "ball_1",
          "moves": [
            { "variant": "hesitation" },
            { "variant": "speed", "to": { "named": "left_elbow" }, "around_player": "defense_1" }
          ]
        },
        { "player": "offense_4", "type": "cut", "variant": "basket", "moves": [ { "to": { "named": "right_block" } } ], "tags": ["roll"] }
      ],
      "end_state": {
        "offense_1": { "named": "left_elbow" },
        "offense_4": { "named": "right_block" },
        "balls": { "ball_1": { "carried_by": "offense_1" } }
      }
    },
    {
      "id": "frame_3",
      "label": "Step 3 — Finish",
      "description": "offense_1 throws a bounce pass to the rolling offense_4, who finishes with a layup.",
      "duration_ms": 1500,
      "actions": [
        { "player": "offense_1", "type": "pass", "to_player": "offense_4", "ball_id": "ball_1", "variant": "bounce" },
        { "player": "offense_4", "type": "shoot", "ball_id": "ball_1", "variant": "layup", "result": "make", "on_catch": true }
      ],
      "end_state": {
        "offense_1": { "named": "left_elbow" },
        "offense_4": { "named": "right_block" },
        "balls": { "ball_1": { "dead": true } }
      }
    }
  ],
  "areas": [
    { "form": "rectangle", "color": "yellow", "opacity": 0.2, "x": 0.0, "y": 10.5, "width": 4.9, "height": 4.0, "rotation": 0 }
  ],
  "labels": [ { "text": "Roll!", "x": 3.2, "y": 9.5, "color": "black" } ]
}
```

- [ ] **Step 3: Run full validation**

Run: `npm test`
Expected: PASS — `pick-and-roll.ocf.json` validates; all invalid fixtures still rejected. (The other two examples are still in the old format and WILL fail here — so temporarily this command fails on `3-man-weave` / `transition-3v2`.)

> Because `npm run validate` globs all `examples/*.ocf.json`, the two not-yet-rewritten examples will fail. To verify just this one in isolation during this task:
> Run: `npx ajv validate --spec=draft7 -s schema/v1.json -d examples/pick-and-roll.ocf.json -c ajv-formats --all-errors`
> Expected: `examples/pick-and-roll.ocf.json valid`

- [ ] **Step 4: Commit**

```bash
git add schema/v1.json examples/pick-and-roll.ocf.json
git commit -m "feat(schema): add area/label defs; rewrite pick-and-roll in action model"
```

---

## Task 7: Rewrite 3-man-weave example

**Files:**
- Rewrite: `examples/3-man-weave.ocf.json`

- [ ] **Step 1: Rewrite `examples/3-man-weave.ocf.json` in the new model**

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
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
    { "type": "offense", "nr": 1, "x": 0.0, "y": -14.0 },
    { "type": "offense", "nr": 2, "x": -5.0, "y": -14.0 },
    { "type": "offense", "nr": 3, "x": 5.0, "y": -14.0 }
  ],
  "balls": [ { "id": "ball_1", "carried_by": "offense_1" } ],
  "frames": [
    {
      "id": "frame_1",
      "label": "Start",
      "description": "offense_1 passes to offense_2 and follows the pass, cutting behind offense_2.",
      "duration_ms": 1500,
      "actions": [
        { "player": "offense_1", "type": "pass", "to_player": "offense_2", "ball_id": "ball_1", "variant": "chest" },
        { "player": "offense_1", "type": "cut", "moves": [ { "to": { "x": -3.0, "y": -11.0 } } ], "after": "offense_1.pass" }
      ],
      "end_state": {
        "offense_1": { "x": -3.0, "y": -11.0 },
        "offense_2": { "x": -5.0, "y": -14.0 },
        "offense_3": { "x": 5.0, "y": -14.0 },
        "balls": { "ball_1": { "carried_by": "offense_2" } }
      }
    },
    {
      "id": "frame_2",
      "label": "First Exchange",
      "description": "offense_2 dribbles to the middle and passes to offense_3, then follows the pass.",
      "duration_ms": 2000,
      "actions": [
        { "player": "offense_2", "type": "dribble", "ball_id": "ball_1", "moves": [ { "to": { "x": 0.0, "y": -8.0 } } ] },
        { "player": "offense_2", "type": "pass", "to_player": "offense_3", "ball_id": "ball_1", "variant": "chest", "after": "offense_2.dribble" },
        { "player": "offense_2", "type": "cut", "moves": [ { "to": { "x": 3.5, "y": -4.0 } } ], "after": "offense_2.pass" },
        { "player": "offense_1", "type": "move", "moves": [ { "to": { "x": -5.0, "y": -8.0 } } ] }
      ],
      "end_state": {
        "offense_1": { "x": -5.0, "y": -8.0 },
        "offense_2": { "x": 3.5, "y": -4.0 },
        "offense_3": { "x": 5.0, "y": -8.0 },
        "balls": { "ball_1": { "carried_by": "offense_3" } }
      }
    },
    {
      "id": "frame_3",
      "label": "Second Exchange",
      "description": "offense_3 dribbles toward the middle and passes to offense_1 cutting from the left, then follows.",
      "duration_ms": 2000,
      "actions": [
        { "player": "offense_3", "type": "dribble", "ball_id": "ball_1", "moves": [ { "to": { "x": 0.0, "y": 0.0 } } ] },
        { "player": "offense_3", "type": "pass", "to_player": "offense_1", "ball_id": "ball_1", "variant": "chest", "after": "offense_3.dribble" },
        { "player": "offense_3", "type": "cut", "moves": [ { "to": { "x": -3.0, "y": 5.0 } } ], "after": "offense_3.pass" },
        { "player": "offense_1", "type": "move", "moves": [ { "to": { "x": -5.0, "y": 0.0 } } ] },
        { "player": "offense_2", "type": "move", "moves": [ { "to": { "x": 5.0, "y": 0.0 } } ] }
      ],
      "end_state": {
        "offense_1": { "x": -5.0, "y": 0.0 },
        "offense_2": { "x": 5.0, "y": 0.0 },
        "offense_3": { "x": -3.0, "y": 5.0 },
        "balls": { "ball_1": { "carried_by": "offense_1" } }
      }
    },
    {
      "id": "frame_4",
      "label": "Finish",
      "description": "offense_1 attacks the basket for the layup. offense_2 fills the right wing as the kick-out option.",
      "duration_ms": 2000,
      "actions": [
        { "player": "offense_1", "type": "dribble", "ball_id": "ball_1", "moves": [ { "variant": "speed", "to": { "named": "basket" } } ] },
        { "player": "offense_1", "type": "shoot", "ball_id": "ball_1", "variant": "layup", "result": "make", "after": "offense_1.dribble" },
        { "player": "offense_2", "type": "move", "moves": [ { "to": { "named": "right_wing" } } ] }
      ],
      "end_state": {
        "offense_1": { "named": "basket" },
        "offense_2": { "named": "right_wing" },
        "balls": { "ball_1": { "dead": true } }
      }
    }
  ]
}
```

- [ ] **Step 2: Validate this example in isolation**

Run: `npx ajv validate --spec=draft7 -s schema/v1.json -d examples/3-man-weave.ocf.json -c ajv-formats --all-errors`
Expected: `examples/3-man-weave.ocf.json valid`

- [ ] **Step 3: Commit**

```bash
git add examples/3-man-weave.ocf.json
git commit -m "feat: rewrite 3-man-weave example in action model"
```

---

## Task 8: Rewrite transition-3v2 example (with a branch)

**Files:**
- Rewrite: `examples/transition-3v2.ocf.json`

Use this example to exercise `branches` (a shot that either scores or is rebounded).

- [ ] **Step 1: Rewrite `examples/transition-3v2.ocf.json` in the new model**

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
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
    { "type": "offense", "nr": 1, "x": 0.0, "y": -12.0 },
    { "type": "offense", "nr": 2, "x": -4.0, "y": -10.0 },
    { "type": "offense", "nr": 3, "x": 4.0, "y": -10.0 },
    { "type": "defense", "nr": 1, "x": -2.0, "y": 2.0 },
    { "type": "defense", "nr": 2, "x": 2.0, "y": 2.0 }
  ],
  "balls": [ { "id": "ball_1", "carried_by": "offense_1" } ],
  "frames": [
    {
      "id": "frame_1",
      "label": "Push",
      "description": "offense_1 pushes the ball up the middle; offense_2 and offense_3 fill the wings at full speed.",
      "duration_ms": 2000,
      "actions": [
        { "player": "offense_1", "type": "dribble", "ball_id": "ball_1", "moves": [ { "variant": "speed", "to": { "x": 0.0, "y": 1.0 } } ] },
        { "player": "offense_2", "type": "move", "moves": [ { "to": { "named": "left_wing" } } ] },
        { "player": "offense_3", "type": "move", "moves": [ { "to": { "named": "right_wing" } } ] }
      ],
      "end_state": {
        "offense_1": { "x": 0.0, "y": 1.0 },
        "offense_2": { "named": "left_wing" },
        "offense_3": { "named": "right_wing" },
        "balls": { "ball_1": { "carried_by": "offense_1" } }
      }
    },
    {
      "id": "frame_2",
      "label": "Draw and Kick",
      "description": "offense_1 attacks defense_1 to commit the help, then kicks to offense_3 in the right corner for the shot.",
      "duration_ms": 2000,
      "actions": [
        { "player": "offense_1", "type": "dribble", "ball_id": "ball_1", "moves": [ { "to": { "named": "left_elbow" }, "around_player": "defense_1" } ] },
        { "player": "offense_3", "type": "cut", "variant": "fade", "moves": [ { "to": { "named": "right_corner" } } ] },
        { "player": "offense_1", "type": "pass", "to_player": "offense_3", "ball_id": "ball_1", "variant": "overhead", "after": "offense_1.dribble" },
        { "player": "offense_3", "type": "shoot", "ball_id": "ball_1", "variant": "three", "on_catch": true }
      ],
      "end_state": {
        "offense_1": { "named": "left_elbow" },
        "offense_3": { "named": "right_corner" },
        "balls": { "ball_1": { "at": { "named": "basket" } } }
      },
      "branches": {
        "make": "frame_reset",
        "miss": "frame_oreb"
      }
    },
    {
      "id": "frame_oreb",
      "label": "Offensive Rebound",
      "description": "On a miss, offense_2 crashes from the left wing for the offensive rebound and finishes.",
      "duration_ms": 1500,
      "start_state": {
        "offense_2": { "named": "left_wing" },
        "balls": { "ball_1": { "at": { "named": "basket" } } }
      },
      "actions": [
        { "player": "offense_2", "type": "rebound", "ball_id": "ball_1", "variant": "offensive", "tags": ["put_back"] },
        { "player": "offense_2", "type": "shoot", "ball_id": "ball_1", "variant": "layup", "result": "make", "after": "offense_2.rebound" }
      ],
      "end_state": {
        "offense_2": { "named": "basket" },
        "balls": { "ball_1": { "dead": true } }
      }
    },
    {
      "id": "frame_reset",
      "label": "Reset",
      "description": "On a make, the ball is dead and the rep ends.",
      "actions": [],
      "end_state": { "balls": { "ball_1": { "dead": true } } }
    }
  ]
}
```

- [ ] **Step 2: Validate this example in isolation**

Run: `npx ajv validate --spec=draft7 -s schema/v1.json -d examples/transition-3v2.ocf.json -c ajv-formats --all-errors`
Expected: `examples/transition-3v2.ocf.json valid`

- [ ] **Step 3: Commit**

```bash
git add examples/transition-3v2.ocf.json
git commit -m "feat: rewrite transition-3v2 example with outcome branches"
```

---

## Task 9: Quick-mode example (proves all-optional)

**Files:**
- Create: `examples/quick-mode.ocf.json`

A minimal "fast sketch" drill using no variants, no tags, no timing, no start_state — only the required fields. Proves the progressive-detail principle (spec §9).

- [ ] **Step 1: Create `examples/quick-mode.ocf.json`**

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
  "frames": [
    {
      "id": "frame_1",
      "actions": [
        { "player": "offense_1", "type": "pass", "to_player": "offense_2" },
        { "player": "offense_1", "type": "cut", "moves": [ { "to": { "named": "basket" } } ] }
      ],
      "end_state": {
        "offense_1": { "named": "basket" },
        "balls": { "ball_1": { "carried_by": "offense_2" } }
      }
    },
    {
      "id": "frame_2",
      "actions": [
        { "player": "offense_2", "type": "pass", "to_player": "offense_1" },
        { "player": "offense_1", "type": "shoot" }
      ],
      "end_state": {
        "balls": { "ball_1": { "dead": true } }
      }
    }
  ]
}
```

- [ ] **Step 2: Run the full test suite (all four examples + invalid fixtures)**

Run: `npm test`
Expected: PASS — all of `pick-and-roll`, `3-man-weave`, `transition-3v2`, `quick-mode` validate; all invalid fixtures correctly rejected.

- [ ] **Step 3: Commit**

```bash
git add examples/quick-mode.ocf.json
git commit -m "feat: add quick-mode example proving all-optional fields"
```

---

## Task 10: Wire CI to run the full test suite

**Files:**
- Modify: `.github/workflows/validate.yml`

- [ ] **Step 1: Replace `.github/workflows/validate.yml`**

```yaml
name: Validate OCF Examples

on:
  push:
    paths:
      - 'schema/**'
      - 'examples/**'
      - 'scripts/**'
      - 'package.json'
  pull_request:
    paths:
      - 'schema/**'
      - 'examples/**'
      - 'scripts/**'
      - 'package.json'

jobs:
  validate:
    runs-on: ubuntu-latest
    name: Validate examples (valid pass, invalid rejected)
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Run schema test suite
        run: npm test
```

- [ ] **Step 2: Verify the suite passes locally (proxy for CI)**

Run: `npm test`
Expected: PASS — same as Task 9 Step 2.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/validate.yml
git commit -m "ci: run full npm test suite (valid + invalid fixtures)"
```

---

## Task 11: Update the AsciiDoc specification

**Files:**
- Modify: `docs/specification-v1.adoc`

The spec is prose describing the format. Sections that describe the old geometric model must be replaced. This task rewrites the affected sections; coordinate-system / named-position / ruleset / color sections stay as-is.

- [ ] **Step 1: Replace the "Entities → Ball" subsection**

Find the `==== Ball` subsection (around line 398). Replace it with a new top-level ball section. Replace the block from `==== Ball` up to (but not including) `==== Coach` with:

```asciidoc
==== Balls

Balls are no longer entities. They live in the top-level `balls` array and each
holds exactly one lifecycle state:

[cols="1,3", options="header"]
|===
| State | Meaning
| `carried_by` | An entity ref (player or `coach`) currently holding the ball.
| `at` | A coordinate where the ball rests (floor, rim after a miss). Still in play — can be `pickup` or `rebound`.
| `dead` | `true`. Out of play (made basket with no rebound, or out of bounds).
|===

[source,json]
----
"balls": [
  { "id": "ball_1", "carried_by": "offense_1" },
  { "id": "ball_2", "carried_by": "coach" },
  { "id": "ball_3", "at": { "named": "right_corner" } }
]
----

Ball possession moves automatically: `pass`, `shoot`, `pickup` and `rebound`
actions transfer the ball. After a `shoot` with no following `rebound`/`pickup`
on the same ball, the ball becomes `dead`.
```

- [ ] **Step 2: Replace the entire "Lines" section with an "Actions" section**

Find `== Lines` (around line 455) and replace everything from `== Lines` up to (but not including) `== Frames` with:

```asciidoc
== Actions

Movement and ball events are expressed as semantic *actions*, not geometric
lines. A renderer derives the drawn arrows/paths from the actions. Every action
has a required `player` and `type`; everything else is optional, so a coach can
sketch quickly or annotate in full detail.

=== Action Types

[cols="1,1,2,3", options="header"]
|===
| Type | Ball? | Required | Optional (variant enum / references)
| `move` | no | `moves[]` | —
| `cut` | no | `moves[]` | `variant` (backdoor, give_and_go, flash, v_cut, l_cut, curl, flare, fade, basket); per-move `around_player`, `off_screen_by`
| `screen` | no | `for_player` | `on_player`, `at`, `variant` (ball_screen, back_screen, down_screen, flare_screen, cross_screen, pin_down)
| `defend` | no | `guards_player` | `variant` (on_ball, deny, help, hedge, switch, box_out)
| `dribble` | yes | `moves[]` | `ball_id`, `variant` (speed, hesitation, crossover, behind_back, between_legs, spin, retreat)
| `pass` | yes | `to_player` | `ball_id`, `variant` (chest, bounce, overhead, lob, baseball, hand_off, outlet)
| `shoot` | yes | `player` | `ball_id`, `variant` (jumper, three, layup, floater, dunk, hook, free_throw), `result` (make/miss)
| `rebound` | becomes carrier | `player` | `ball_id`, `variant` (offensive, defensive)
| `pickup` | becomes carrier | `ball_id` | —
|===

Any action may also carry a free `tags` array (e.g. `eurostep`, `reverse`,
`left_handed`). Curated `variant` values are what a renderer can distinguish
visually; tags are open coaching metadata that need no schema change.

=== Movement Sequences

`move`, `cut` and `dribble` carry a `moves[]` sequence. A move *without* `to` is
a move on the spot (ball handling / fake); a move *with* `to` carries the player
(and ball, for `dribble`) to a waypoint. The final `to` must match the player's
position in the frame `end_state`. Reference fields (`around_player`,
`off_screen_by`) may sit on an individual move and override the action level.

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

- [ ] **Step 3: Replace the "Frames" section body**

Find `== Frames` (around line 555). Replace everything from `== Frames` up to (but not including) `== Areas and Labels` with:

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
| `duration_ms` | no | Suggested animation duration for the phase.
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

- [ ] **Step 4: Replace the "Complete Example" code block**

Find `=== Pick & Roll — Half Court, FIBA` (around line 931). Replace the JSON code block under it with the new contents of `examples/pick-and-roll.ocf.json` (copy the exact file from Task 6 Step 2 between `[source,json]\n----` and `----`).

- [ ] **Step 5: Update "Schema Reference → Top-Level Structure" and "Enums Summary"**

In `=== Top-Level Structure` (around line 1065): change the `entities` description to "non-ball entities" and add a `balls` row. In `=== Enums Summary` (around line 1186): remove the line-type enum, add the action `type` enum and each action `variant` enum and the `outcome` enum, matching Task 4/5.

Replace the line-types enum entry with:

```asciidoc
| Action `type` | move, cut, screen, defend, dribble, pass, shoot, rebound, pickup
| Cut `variant` | backdoor, give_and_go, flash, v_cut, l_cut, curl, flare, fade, basket
| Screen `variant` | ball_screen, back_screen, down_screen, flare_screen, cross_screen, pin_down
| Defend `variant` | on_ball, deny, help, hedge, switch, box_out
| Dribble `variant` | speed, hesitation, crossover, behind_back, between_legs, spin, retreat
| Pass `variant` | chest, bounce, overhead, lob, baseball, hand_off, outlet
| Shoot `variant` | jumper, three, layup, floater, dunk, hook, free_throw
| Rebound `variant` | offensive, defensive
| Frame `outcome` | make, miss, turnover, steal, foul
```

- [ ] **Step 6: Update the "LLM Generation Guide" tips**

In `=== LLM Output Tips` (around line 1234), replace any guidance referring to lines/ball coordinates with: actions express intent; leave optional fields out when the description is vague; set ball `dead` after a made shot with no rebound; every frame needs `end_state`.

- [ ] **Step 7: Add a changelog entry**

In `== Changelog`, add above the existing `=== v1.0.0` entry:

```asciidoc
=== v2.0.0

Semantic action model. Replaces line-based frames with per-player actions
(move, cut, screen, defend, dribble, pass, shoot, rebound, pickup). The ball
entity is replaced by a top-level `balls` array with a carried_by/at/dead
lifecycle and automatic possession transfer. Frames gain explicit
`start_state`/`end_state` anchors and outcome `branches`. The `lines` array and
`entity_states` are removed.
```

- [ ] **Step 8: Sanity-check the doc has no remaining references to the removed model**

Run: `grep -n "entity_states\|\"type\": \"passing\"\|\"type\": \"dribbling\"\|\"type\": \"movement\"\|entity_ball" docs/specification-v1.adoc`
Expected: no matches (empty output). If any remain, update that text to the action model.

- [ ] **Step 9: Commit**

```bash
git add docs/specification-v1.adoc
git commit -m "docs: rewrite spec sections for the semantic action model"
```

---

## Task 12: Update README + record next-steps TODO

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Inspect the README to find the sections that describe the model**

Run: `grep -n "ball\|line\|entity_states\|frame\|action\|## " README.md`
Expected: a list of headings and any inline model references.

- [ ] **Step 2: Update the feature/overview text**

In `README.md`, update the format-overview bullets and any inline example so they describe: semantic actions, automatic ball possession via `balls[]`, hybrid frames with anchors, and outcome branches. Replace any old line-based snippet with the quick-mode snippet from `examples/quick-mode.ocf.json` (frame_1 only is enough for a teaser).

- [ ] **Step 3: Add a roadmap / next-steps note near the end of the README**

Append this section to `README.md`:

```markdown
## Roadmap

This repository defines the **schema and standard**. Planned companion projects
(separate repos):

1. **Validator** — semantic rules JSON Schema can't express: ball-possession
   consistency (only the carrier may `pass`/`shoot`/`dribble`), branch target
   integrity, and `end_state` agreement with action endpoints.
2. **Renderer** — draw drills and animate them from the JSON.
3. **Editor** — visual authoring on top of the renderer.

End goal: generate drills and set plays from natural language (LLM) and render
them directly, plus video overlay for practice analysis and video → play
extraction.
```

- [ ] **Step 4: Run the full suite once more to confirm nothing regressed**

Run: `npm test`
Expected: PASS — all examples valid, all invalid fixtures rejected.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: update README for action model and add roadmap"
```

---

## Final verification

- [ ] **Step 1: Full suite green**

Run: `npm test`
Expected: PASS — 4 valid examples validate; all 6 invalid fixtures rejected.

- [ ] **Step 2: No leftover references to the old model anywhere**

Run: `grep -rn "entity_states\|entity_ball\|\"passing\"\|\"dribbling\"\|\"movement\"" schema/ examples/ docs/specification-v1.adoc README.md`
Expected: no matches (the action `move`/`dribble`/`pass` keywords appear as action `type` consts, but the *line-type* strings `"passing"`, `"dribbling"`, `"movement"` and `entity_states`/`entity_ball` must be gone).

- [ ] **Step 3: Confirm invalid-fixture count**

Run: `ls examples/invalid/*.json | wc -l`
Expected: `6` (ball-carried-and-at, state-bad-ball-key, action-pass-missing-receiver, action-unknown-type, frame-bad-branch-key, frame-missing-end-state).
```
