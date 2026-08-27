# around_player Arc Schema (RFC 0004) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement RFC 0004 — add optional `side` (`left`/`right`) and `arc` (`tight`/`normal`/`wide`) fields to `move_step` and `action_cut` in `schema/v1.json`, with fixtures, docs, and a minor version bump to 1.3.0.

**Architecture:** Purely additive, draft-07. Two optional string-enum fields are added to `move_step` (shared by move/cut/dribble) and mirrored on `action_cut` (where `around_player` already lives at action level). Sport-neutral — no per-sport gating (RFC 0003 gates the *actions* that use them). `additionalProperties: false` is preserved. Verified against ajv during RFC authoring.

**Tech Stack:** JSON Schema draft-07, ajv-cli + ajv-formats (existing harness).

**Plan for RFC 0004** (accepted). Current version 1.2.0 → 1.3.0.

---

### Task 1: Add `side` + `arc` to `move_step` and `action_cut`

**Files:**
- Modify: `schema/v1.json` (`move_step` definition; `action_cut` definition)

- [ ] **Step 1: Add `side` + `arc` to `move_step`**

The `move_step.properties` currently ends with `intensity`. Add the two fields after it:

```json
    "move_step": {
      "type": "object",
      "description": "One step in a movement sequence. Without 'to' = a move on the spot. Reference fields override the action-level ones.",
      "properties": {
        "variant": { "type": "string" },
        "to": { "$ref": "#/definitions/coordinate" },
        "around_player": { "$ref": "#/definitions/entity_ref" },
        "off_screen_by": { "$ref": "#/definitions/entity_ref" },
        "intensity": { "$ref": "#/definitions/movement_intensity" },
        "side": { "type": "string", "enum": ["left", "right"], "description": "Which side to pass an around_player obstacle on, relative to the moving player's direction of travel. Optional; renderer chooses when absent." },
        "arc": { "type": "string", "enum": ["tight", "normal", "wide"], "description": "How closely the path wraps an around_player obstacle: tight (curl), normal, wide (flare). Optional; renderer default when absent." }
      },
      "additionalProperties": false
    },
```

- [ ] **Step 2: Add the same two fields to `action_cut`**

`action_cut` already has action-level `around_player`. Add `side`/`arc` as action-level defaults. In the `action_cut` properties (after `around_player`/`off_screen_by`, alongside the other action-level fields), add:

```json
        "side": { "type": "string", "enum": ["left", "right"], "description": "Default side for this cut's around_player steps; overridden per move_step." },
        "arc": { "type": "string", "enum": ["tight", "normal", "wide"], "description": "Default arc for this cut's around_player steps; overridden per move_step." },
```

Place them consistently (e.g. right after the existing `off_screen_by`). Keep `additionalProperties: false` on `action_cut`.

- [ ] **Step 3: Verify schema compiles (strict) and existing examples still validate**

Run: `npx ajv compile --spec=draft7 -s schema/v1.json -c ajv-formats`
Expected: `schema schema/v1.json is valid`, no new strictTypes warnings (these are simple property additions, not nested conditionals).

Run: `npm run validate`
Expected: all `examples/*.ocf.json` valid (no example uses side/arc yet — additive, no regression).

- [ ] **Step 4: Commit**

```bash
git add schema/v1.json
git commit -m "feat(schema): add optional side + arc to move_step and cut (RFC 0004)"
```

---

### Task 2: Valid fixture exercising side/arc + override

**Files:**
- Create: `examples/around-player-arc.ocf.json`

- [ ] **Step 1: Write the valid fixture**

A cut with action-level `side`/`arc` defaults, overridden by a per-`move_step` value, around a screener:

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
  "frames": [
    {
      "id": "f1",
      "label": "Curl",
      "description": "offense_2 curls tightly around offense_5's screen, passing on the right of the screener.",
      "actions": [
        { "player": "offense_2", "type": "cut", "variant": "curl", "side": "left", "arc": "normal",
          "moves": [ { "to": { "named": "right_elbow" }, "around_player": "offense_5", "side": "right", "arc": "tight", "intensity": "fast" } ] }
      ],
      "end_state": { "offense_2": { "named": "right_elbow" } }
    }
  ]
}
```

- [ ] **Step 2: Validate**

Run: `npm run validate`
Expected: the new fixture reports valid (plus all existing).

- [ ] **Step 3: Commit**

```bash
git add examples/around-player-arc.ocf.json
git commit -m "test(schema): add valid fixture for around_player side + arc"
```

---

### Task 3: Invalid fixtures (enum enforcement)

**Files:**
- Create: `examples/invalid/arc-bad-value.json`
- Create: `examples/invalid/side-bad-value.json`

- [ ] **Step 1: Write the two invalid fixtures**

`examples/invalid/arc-bad-value.json` (`arc` not in enum):
```json
{
  "sport": "basketball",
  "meta": { "id": "3c9f7a2e-4b1d-4e6f-8a0c-2d5e9a1b3c7f", "title": "Bad arc" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "offense", "nr": 2, "x": -6, "y": 13 }, { "type": "offense", "nr": 5, "x": -2, "y": 8 } ],
  "frames": [ { "id": "f", "actions": [ { "player": "offense_2", "type": "cut", "moves": [ { "to": { "named": "right_elbow" }, "around_player": "offense_5", "arc": "loopy" } ] } ], "end_state": {} } ]
}
```

`examples/invalid/side-bad-value.json` (`side` not in enum):
```json
{
  "sport": "basketball",
  "meta": { "id": "3c9f7a2e-4b1d-4e6f-8a0c-2d5e9a1b3c7f", "title": "Bad side" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "offense", "nr": 2, "x": -6, "y": 13 }, { "type": "offense", "nr": 5, "x": -2, "y": 8 } ],
  "frames": [ { "id": "f", "actions": [ { "player": "offense_2", "type": "cut", "moves": [ { "to": { "named": "right_elbow" }, "around_player": "offense_5", "side": "middle" } ] } ], "end_state": {} } ]
}
```

- [ ] **Step 2: Confirm each is rejected for the right reason**

For each, reason that fixing ONLY the bad value (`loopy`→`tight`, `middle`→`left`) makes it valid; if unsure, test a corrected copy in /tmp and delete it. Then run:
Run: `npm run test:invalid`
Expected: output includes `ok: examples/invalid/arc-bad-value.json correctly rejected.` and the same for `side-bad-value.json`, ending with `All N invalid fixture(s) correctly rejected.`

Note: because `action` is a `oneOf`, the raw ajv error may cite a `oneOf` branch mismatch; verify with `--all-errors` that the error set includes the `#/properties/arc/enum` (or `side/enum`) path, i.e. the intended cause.

- [ ] **Step 3: Full suite**

Run: `npm test`
Expected: validate + test:invalid + test:positions + test:sport all pass.

- [ ] **Step 4: Commit**

```bash
git add examples/invalid/arc-bad-value.json examples/invalid/side-bad-value.json
git commit -m "test(schema): add invalid fixtures for side/arc enum enforcement"
```

---

### Task 4: Add side/arc to the existing examples that use around_player

Two existing examples already use `around_player` (both on a `dribble` step) but
carry no `side`/`arc`. Update them so the example set demonstrates the new fields
as best practice (and shows they work on `dribble`, not only `cut`).

**Files:**
- Modify: `examples/pick-and-roll.ocf.json`
- Modify: `examples/transition-3v2.ocf.json`

- [ ] **Step 1: Add `side` + `arc` to the `around_player` dribble step in each**

In each file, find the `dribble` action whose `moves[]` step has
`"around_player": "defense_1"` and add `side` + `arc` to that same step. Choose
values that fit the play:
- `examples/pick-and-roll.ocf.json` — the ball handler uses the screen and turns
  the corner; add `"side": "left"`, `"arc": "tight"` (a tight turn off the
  screen). Keep the existing `to`, `around_player`, and `intensity`.
- `examples/transition-3v2.ocf.json` — a fast-break attack of the defender; add
  `"side": "right"`, `"arc": "wide"` (attacking wide at speed). Keep existing fields.

Only add the two keys to that one step in each file; do not change anything else.

- [ ] **Step 2: Validate**

Run: `npm run validate`
Expected: both modified examples (and all others) report valid.

- [ ] **Step 3: Confirm the fields are actually present on the right step**

Run:
`node -e "for(const f of ['pick-and-roll','transition-3v2']){const d=require('./examples/'+f+'.ocf.json'); const step=d.frames.flatMap(fr=>fr.actions).filter(a=>a.type==='dribble').flatMap(a=>a.moves||[]).find(m=>m.around_player); console.log(f+': side='+step.side+' arc='+step.arc);}"`
Expected: pick-and-roll → `side=left arc=tight`; transition-3v2 → `side=right arc=wide`.

- [ ] **Step 4: Commit**

```bash
git add examples/pick-and-roll.ocf.json examples/transition-3v2.ocf.json
git commit -m "docs: demonstrate side/arc on the around_player steps in existing examples"
```

---

### Task 5: Docs + version bump 1.3.0 + RFC accepted

**Files:**
- Modify: `docs/specification-v1.adoc` (document side/arc under the movement/cut section; changelog; `:version:`)
- Modify: `package.json` (version → 1.3.0)
- Modify: `schema/v1.json` (`$comment` version → 1.3.0)
- Modify: `rfcs/0004-around-player-arc.md` (verify Status: Accepted)

- [ ] **Step 1: Document side/arc in the spec doc**

Find where `move_step` / `around_player` is documented (search for `around_player` in `docs/specification-v1.adoc`). Add a short paragraph:

```asciidoc
When a movement step goes `around_player`, two optional fields shape the detour:
`side` (`left`/`right`, relative to the player's direction of travel) chooses
which side to pass on, and `arc` (`tight`/`normal`/`wide`) how closely the path
wraps the obstacle — `tight` reads as a curl, `wide` as a flare. Both may be set
on the `cut` action as defaults and overridden per step. When omitted, the
renderer chooses (for a `cut`, it may derive the arc from the `variant` —
`curl`→tight, `flare`/`fade`→wide). `arc` is a semantic enum, not a radius; the
renderer owns the enum-to-distance mapping and may expose it as configuration.
```

- [ ] **Step 2: Bump version to 1.3.0 in all four places**

- `package.json`: `"version": "1.3.0"`
- `schema/v1.json` `$comment`: change the version number to `1.3.0` (keep the rest of the sentence)
- `docs/specification-v1.adoc` `:version:`: `1.3.0`
- Add a changelog entry at the TOP of the changelog (above v1.2.0):
```asciidoc
=== v1.3.0

Adds optional `side` (`left`/`right`) and `arc` (`tight`/`normal`/`wide`) fields
to movement steps (and the `cut` action) to make an `around_player` detour's
side and tightness explicit instead of renderer-guessed (RFC 0004). Additive and
backwards-compatible.
```

- [ ] **Step 3: Verify RFC status**

`rfcs/0004-around-player-arc.md` Status should already say Accepted (set before merge). Verify; if Draft, change to Accepted.

- [ ] **Step 4: Build site + full suite**

Run: `cd site && npm run build` → asciidoctor parses the new prose + changelog; build succeeds. Return to root.
Run: `npm test` → all sub-suites pass.

- [ ] **Step 5: Commit**

```bash
git add docs/specification-v1.adoc package.json schema/v1.json rfcs/0004-around-player-arc.md
git commit -m "docs: document side/arc; bump to 1.3.0; accept RFC 0004"
```

---

## Self-Review Notes

- **Spec coverage (RFC 0004):** side/arc on move_step → Task 1 Step 1; on action_cut → Task 1 Step 2; sport-neutral (no gating) → inherent (no conditional added); valid fixture with override → Task 2; enum enforcement (invalid fixtures) → Task 3; **existing around_player examples updated to demonstrate side/arc (on dribble) → Task 4**; docs + variant-default recommendation → Task 5; version bump → Task 5.
- **Placement matches RFC:** fields live on `move_step` (shared by move/cut/dribble) + `action_cut` action level, mirroring `around_player`. The RFC's override semantics ("move_step overrides action-level") come for free from where the fields sit — no extra schema logic.
- **The oneOf error-message caveat** (Task 3) is called out so the implementer verifies the *real* rejection cause via `--all-errors`, as was needed during RFC validation.
- **No renderer work here:** honoring side/arc + variant defaults + replacing the hardcoded 0.6 is renderer work, tracked separately (renderer task list). This plan is schema + docs only.
- **Version consistency:** all four locations (package.json, $comment, :version:, changelog) → 1.3.0; `$id`/filename stays v1.json (additive, v1 line).
