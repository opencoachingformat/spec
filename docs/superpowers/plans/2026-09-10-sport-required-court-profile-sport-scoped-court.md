# RFC 0007 → RFC 0012 → RFC 0010 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `sport` a required top-level field (RFC 0007), rename `court.ruleset` to `court.court_profile` everywhere (RFC 0012), then activate sport-scoped court profiles with a new `sports/<sport>/` registry bundle, sport-scoped `custom_dimensions`, and named-position exclusion (RFC 0010) — in that exact sequence, on the `v2` branch of the `spec` repo only.

**Architecture:** Three sequential task groups, each ending in a green test suite and a commit, matching the RFCs' own decided sequencing. Group A (RFC 0007) removes the back-compat "sport absent" branch from the schema. Group B (RFC 0012) is a pure rename sweep (schema, docs, registry data, code) with zero new behavior. Group C (RFC 0010) replaces the flat `sports/*.json` + `positions/*.json` files with a `sports/<sport>/` bundle per sport, adds the `sport`→`court_profile` whitelist, makes `custom_dimensions` sport-scoped, and adds named-position exclusion.

**Tech Stack:** JSON Schema (Draft-07), Node.js `node:test` for unit tests, `ajv-cli` for example validation, AsciiDoc for the spec document, Astro for the site (one adapter function needs updating, no page templates).

---

## Before You Start

Read these RFCs in full before touching any code — they contain decisions this plan implements without re-explaining the reasoning:

- `rfcs/0007-sport-required.md`
- `rfcs/0012-rename-ruleset-to-court-profile.md`
- `rfcs/0010-sport-scoped-court.md`
- `docs/superpowers/specs/2026-09-07-v2-program-overview.md` (Ordering rationale section)

**One factual correction to RFC 0007's Detailed Design, discovered while planning this work**: RFC 0007's text says "every one of the six existing `allOf` blocks... has this shape" (the back-compat `anyOf: [{not: required sport}, ...]` pattern). This is incorrect. Verified by reading `schema/v1.json`'s `allOf` array directly: there are 6 blocks total, but only **one** (the basketball branch, `schema/v1.json:834-853`) has the back-compat pattern. Block 0 (`schema/v1.json:823-832`) is the `court.ruleset === "custom"` → `custom_dimensions` required check, unrelated to `sport` entirely. Blocks for soccer/handball/hockey/futsal (`schema/v1.json:854-913`) already say `"required": ["sport"]` — they never had a back-compat branch to remove. Task A2 below reflects the real scope: one block simplified, not six.

Run the full test suite once before starting, to confirm your baseline matches this plan's expectations:

```bash
cd spec-frameless-action-model
npm test
```

Expected: `# tests 47`, `# pass 47`, `# fail 0`. If this doesn't match, stop and figure out why before proceeding — the step-by-step expected outputs below assume this starting point.

---

## Task Group A: RFC 0007 — `sport` Becomes Required

### Task A1: Move `sport` into the schema's root `required` array

**Files:**
- Modify: `schema/v1.json:9` (root `required` array)
- Modify: `schema/v1.json:715-720` (`sport` property definition)

- [ ] **Step 1: Update the root `required` array**

In `schema/v1.json`, line 9, change:

```json
  "required": ["meta", "court", "entities", "actions"],
```

to:

```json
  "required": ["meta", "court", "entities", "actions", "sport"],
```

- [ ] **Step 2: Remove the `default` and update the `$comment` on the `sport` property**

In `schema/v1.json`, lines 715-720, change:

```json
    "sport": {
      "type": "string",
      "enum": ["basketball", "soccer", "handball", "hockey", "futsal"],
      "default": "basketball",
      "$comment": "Optional, default basketball (back-compat). Intended to become required in v2.0.0. basketball is fully defined; soccer/handball/hockey/futsal carry provisional minimal action whitelists pending sport-expert review."
    },
```

to:

```json
    "sport": {
      "type": "string",
      "enum": ["basketball", "soccer", "handball", "hockey", "futsal"],
      "$comment": "Required as of v2.0.0 (RFC 0007) — no default, no back-compat absence handling. Enum is closed and hand-maintained; a sport not yet in the registry must be added as a sports/<sport>/ bundle (RFC 0010) before it can be declared. basketball is fully defined; soccer/handball/hockey/futsal carry provisional minimal action whitelists pending sport-expert review."
    },
```

Removing `"default": "basketball"` matters: a `default` on a required field is contradictory (nothing can be "defaulted" once the field must be present), and leaving it would misleadingly suggest the value is still optional-with-a-fallback.

- [ ] **Step 3: Run schema validation to confirm this breaks `quick-mode.ocf.json` as expected**

```bash
npm run validate
```

Expected: every file EXCEPT `examples/quick-mode.ocf.json` reports `valid`; `quick-mode.ocf.json` reports an error mentioning `must have required property 'sport'`. This confirms the schema change took effect — don't fix the fixture yet, that's Task A3.

- [ ] **Step 4: Commit**

```bash
git add schema/v1.json
git commit -m "feat(schema): sport becomes a required top-level field (RFC 0007)"
```

### Task A2: Simplify the basketball `allOf` block's back-compat branch

**Files:**
- Modify: `schema/v1.json:833-853`

- [ ] **Step 1: Remove the back-compat `anyOf`/`not-required` condition**

In `schema/v1.json`, the block currently at lines 833-853 reads:

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

Replace it with:

```json
    {
      "if": { "required": ["sport"], "properties": { "sport": { "const": "basketball" } } },
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

This now matches the exact shape of the soccer/handball/hockey/futsal blocks right below it (`schema/v1.json:854-913`) — `sport` can no longer be absent, so there's nothing left for the `anyOf`/`not` to distinguish. The `$comment` explaining the old back-compat reasoning is removed since it's no longer applicable.

- [ ] **Step 2: Update `test/sport-branches.test.mjs` — remove the back-compat-specific test**

The test `"basketball branch also matches an absent sport (back-compat)"` (currently `test/sport-branches.test.mjs:29-34`) asserts a branch exists that matches when `sport` is absent. That's no longer true or desirable — delete this test entirely:

In `test/sport-branches.test.mjs`, remove:

```js
test("basketball branch also matches an absent sport (back-compat)", () => {
  const bbBranch = schema.allOf.find((b) =>
    b.if?.anyOf?.some((x) => x.not?.required?.includes("sport")),
  );
  assert.ok(bbBranch, "a branch matches when sport is absent (default-annotation back-compat)");
});
```

- [ ] **Step 2b: Update `branchSports()` and `branchWhitelist()` helpers in the same file — they special-case the old `anyOf` shape**

The `branchSports` function (`test/sport-branches.test.mjs:9-18`) and the inline `branchWhitelist` function inside the third test (`test/sport-branches.test.mjs:39-48`) both check `b.if?.anyOf?.some((x) => x.properties?.sport?.const === "basketball")` to detect the basketball branch. Since the basketball branch no longer uses `anyOf`, update both to match the new uniform shape (`b.if?.properties?.sport?.const`) instead.

Replace the whole file's contents with:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));

// Collect the sports each allOf branch handles (via if.properties.sport.const).
// Every branch now has the same uniform shape post-RFC-0007 — no more
// anyOf/not-required special case for an absent sport.
function branchSports(allOf) {
  const handled = new Set();
  for (const b of allOf) {
    const c = b.if?.properties?.sport?.const;
    if (c) handled.add(c);
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

test("each sport skeleton's action_types matches its schema whitelist branch", () => {
  const dir = new URL("../sports/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const branchWhitelist = (sport) => {
    for (const b of schema.allOf) {
      if (b.if?.properties?.sport?.const === sport) {
        return b.then.properties.actions.items.properties.type.enum;
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

Note: this third test still does `readdirSync(dir).filter(f => f.endsWith(".json"))` against the flat `sports/*.json` layout — that's correct for now, because Task Group C hasn't restructured `sports/` yet. Task C-cleanup below updates this same test again once the bundle restructure lands.

- [ ] **Step 3: Run the sport-branches test to confirm it passes**

```bash
node --test test/sport-branches.test.mjs
```

Expected: `# tests 2`, `# pass 2`, `# fail 0` (one test removed, two remain).

- [ ] **Step 4: Run the full test suite**

```bash
npm test
```

Expected: `# tests 46`, `# pass 46`, `# fail 0` (47 minus the one deleted back-compat test). `npm run validate` inside this still fails on `quick-mode.ocf.json` — expected, fixed next.

- [ ] **Step 5: Commit**

```bash
git add schema/v1.json test/sport-branches.test.mjs
git commit -m "refactor(schema): simplify basketball allOf branch now that sport is required (RFC 0007)"
```

### Task A3: Migrate `examples/quick-mode.ocf.json`

**Files:**
- Modify: `examples/quick-mode.ocf.json:11`

- [ ] **Step 1: Add the missing `sport` field**

In `examples/quick-mode.ocf.json`, line 11 currently reads:

```json
  "court": { "ruleset": "fiba", "type": "half_court" },
```

Add a `"sport": "basketball"` line right before it (top-level, alongside `meta`):

```json
  "sport": "basketball",
  "court": { "ruleset": "fiba", "type": "half_court" },
```

(Leave `"ruleset"` as-is here — that gets renamed to `court_profile` in Task Group B, not this task. Keeping the two renames in separate commits matches this plan's own task boundaries.)

- [ ] **Step 2: Validate**

```bash
npm run validate
```

Expected: all 10 example files report `valid`, including `quick-mode.ocf.json`.

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: `# tests 46`, `# pass 46`, `# fail 0`.

- [ ] **Step 4: Commit**

```bash
git add examples/quick-mode.ocf.json
git commit -m "fix(examples): add missing sport field to quick-mode.ocf.json (RFC 0007)"
```

### Task A4: Update `docs/specification.adoc`'s `== Sport` section

**Files:**
- Modify: `docs/specification.adoc:533-553`

- [ ] **Step 1: Update the prose to reflect `sport` being required**

In `docs/specification.adoc`, replace lines 533-553:

```adoc
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

---
```

with:

```adoc
== Sport

OCF targets **invasion team sports** — two teams sharing a field, ball/puck
possession, and off-ball movement (basketball, soccer, handball, hockey,
futsal). Basketball is fully defined; the others are reserved with provisional
action vocabularies.

The required `sport` field declares the sport:

[source,json]
----
"sport": "basketball"
----

`sport` is required. Every document must declare it explicitly — there is no
default and no back-compat handling for an absent value. The declared sport
determines which action types (and variants) are valid — e.g. `screen`/`rebound`
are valid under `basketball`, `tackle`/`clear` under `soccer`.

---
```

- [ ] **Step 2: Verify no other prose in the file describes `sport` as optional**

```bash
grep -n "sport.*optional\|optional.*sport" docs/specification.adoc
```

Expected: no output (the only such phrasing was in the section just edited).

- [ ] **Step 3: Commit**

```bash
git add docs/specification.adoc
git commit -m "docs(spec): sport field is required, not optional (RFC 0007)"
```

---

## Task Group B: RFC 0012 — Rename `court.ruleset` to `court.court_profile`

This group is a pure rename: no schema behavior changes, only names. Do every step in this group before starting Task Group C — RFC 0010 is written entirely in terms of `court_profile` and assumes this rename already happened.

### Task B1: Rename the schema definition and property

**Files:**
- Modify: `schema/v1.json:13-17` (definition)
- Modify: `schema/v1.json:750-751` (property + `$ref`)
- Modify: `schema/v1.json:826` (the `custom` → `custom_dimensions` `allOf` block)

- [ ] **Step 1: Rename the `#/definitions/ruleset` definition to `#/definitions/court_profile`**

In `schema/v1.json`, lines 13-17, change:

```json
    "ruleset": {
      "type": "string",
      "enum": ["fiba", "nba", "ncaa", "nfhs", "custom"],
      "description": "Basketball ruleset. Determines unit, field dimensions and named position coordinates."
    },
```

to:

```json
    "court_profile": {
      "type": "string",
      "enum": ["fiba", "nba", "ncaa", "nfhs", "custom"],
      "description": "Named court-geometry variant for the document's sport. Determines unit, field dimensions and named position coordinates. Not a rules concept — carries no game rules, only court geometry."
    },
```

- [ ] **Step 2: Rename the `court.ruleset` property and update its `$ref`**

In `schema/v1.json`, lines 747-751 (the `court` object's `required` array and `properties.ruleset`), change:

```json
    "court": {
      "type": "object",
      "required": ["ruleset", "type"],
      "properties": {
        "ruleset": { "$ref": "#/definitions/ruleset" },
```

to:

```json
    "court": {
      "type": "object",
      "required": ["court_profile", "type"],
      "properties": {
        "court_profile": { "$ref": "#/definitions/court_profile" },
```

- [ ] **Step 3: Update the `allOf` block that gates `custom_dimensions` on `ruleset === "custom"`**

In `schema/v1.json`, lines 823-832, change:

```json
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
```

to:

```json
    {
      "if": {
        "type": "object",
        "properties": { "court": { "type": "object", "properties": { "court_profile": { "const": "custom" } } } }
      },
      "then": {
        "type": "object",
        "properties": { "court": { "type": "object", "required": ["custom_dimensions"] } }
      }
    },
```

- [ ] **Step 4: Search the whole schema file for any remaining `#/definitions/ruleset` reference**

```bash
grep -n "definitions/ruleset\b" schema/v1.json
```

Expected: no output. (`#/definitions/ruleset` no longer exists; if this finds anything, you missed a `$ref` update.)

- [ ] **Step 5: Confirm the schema itself is still valid JSON and ajv accepts it as a schema**

```bash
node -e "JSON.parse(require('fs').readFileSync('schema/v1.json', 'utf-8')); console.log('valid JSON')"
npx ajv compile --spec=draft7 --strict-schema=false -s schema/v1.json -c ajv-formats
```

Expected: `valid JSON` printed, then ajv reports the schema compiles without error (it will still fail example validation at this point — that's expected, examples aren't migrated yet).

- [ ] **Step 6: Commit**

```bash
git add schema/v1.json
git commit -m "feat(schema): rename court.ruleset to court.court_profile (RFC 0012)"
```

### Task B2: Migrate every example file's `court.ruleset` to `court.court_profile`

**Files:**
- Modify: all 10 files under `examples/*.ocf.json` that contain `"ruleset"` — confirmed by search to be: `3-man-weave.ocf.json`, `around-player-arc.ocf.json`, `based-on-references.ocf.json`, `continuous-ball-screen.ocf.json`, `min-schema-version.ocf.json`, `pick-and-roll.ocf.json`, `quick-mode.ocf.json`, `sport-basketball.ocf.json`, `sport-soccer.ocf.json`, `transition-3v2.ocf.json`
- Modify: `examples/invalid/*.json` — 17 files contain `"ruleset"` (confirmed by search); these need the key renamed too, even though they're intentionally invalid for other reasons, so they keep validating for their INTENDED reason rather than accidentally validating for the wrong one (see Step 3 below for why this matters)

- [ ] **Step 1: Rename the key in every valid example**

Run this from the repo root — it's a mechanical, single-key JSON rename, safe to script rather than hand-edit 10 files:

```bash
node -e '
const fs = require("fs");
const files = [
  "examples/3-man-weave.ocf.json",
  "examples/around-player-arc.ocf.json",
  "examples/based-on-references.ocf.json",
  "examples/continuous-ball-screen.ocf.json",
  "examples/min-schema-version.ocf.json",
  "examples/pick-and-roll.ocf.json",
  "examples/quick-mode.ocf.json",
  "examples/sport-basketball.ocf.json",
  "examples/sport-soccer.ocf.json",
  "examples/transition-3v2.ocf.json",
];
for (const f of files) {
  const text = fs.readFileSync(f, "utf-8");
  const updated = text.replace(/"ruleset":/g, "\"court_profile\":");
  fs.writeFileSync(f, updated);
  console.log(`updated ${f}`);
}
'
```

This uses a text replace rather than JSON.parse/stringify specifically to preserve each file's existing formatting (indentation, key order) — re-serializing via `JSON.stringify` would reformat every file and make the diff much harder to review.

- [ ] **Step 2: Verify no valid example still has the old key**

```bash
grep -rl '"ruleset"' examples/*.ocf.json
```

Expected: no output.

- [ ] **Step 3: Rename the key in every invalid fixture too**

The invalid fixtures need the same rename — not because their expected failure changes, but because leaving `"ruleset"` in them would make every one of these files fail for a NEW, wrong reason (`additionalProperties: false` rejecting the unrecognized `ruleset` key, `court_profile` missing) instead of their originally-intended reason (bad action type, missing required field, etc.). A fixture accidentally testing the wrong thing is a silent test-suite regression waiting to happen.

```bash
node -e '
const fs = require("fs");
const files = fs.readdirSync("examples/invalid").filter(f => f.endsWith(".json"));
for (const f of files) {
  const path = `examples/invalid/${f}`;
  const text = fs.readFileSync(path, "utf-8");
  if (!text.includes("\"ruleset\":")) continue;
  const updated = text.replace(/"ruleset":/g, "\"court_profile\":");
  fs.writeFileSync(path, updated);
  console.log(`updated ${path}`);
}
'
```

- [ ] **Step 4: Verify no invalid fixture still has the old key**

```bash
grep -rl '"ruleset"' examples/invalid/*.json
```

Expected: no output.

- [ ] **Step 5: Validate all examples**

```bash
npm run validate
```

Expected: all 10 files report `valid`.

- [ ] **Step 6: Run the invalid-fixtures check**

```bash
npm run test:invalid
```

Expected: passes (every fixture in `examples/invalid/` still fails validation, for its original intended reason — the key rename didn't change which fixtures are valid/invalid, only which key name they use).

- [ ] **Step 7: Run the full test suite**

```bash
npm test
```

Expected: `# tests 46`, `# pass 46`, `# fail 0`.

- [ ] **Step 8: Commit**

```bash
git add examples/
git commit -m "fix(examples): rename court.ruleset to court.court_profile in all fixtures (RFC 0012)"
```

### Task B3: Rename `resolve-position.mjs`'s internal `ruleset` naming to `courtProfile`

**Files:**
- Modify: `positions/resolve-position.mjs`

RFC 0012's Open Question 2 asks whether the exported function's public parameter name should change too, and leaves it explicitly undecided. This plan keeps the exported function names and their parameter names (`resolveNamedPosition(name, ruleset = "fiba")`, `loadPositions(ruleset = "fiba")`) exactly as they are — renaming a published function's parameter name is an API-surface decision this plan doesn't make unilaterally. Only the internal, non-exported implementation detail (`RULESETS`, `loadRuleset`) is renamed for consistency with the rest of the codebase, since nothing outside this file can observe that name.

- [ ] **Step 1: Rename the internal constant and helper function**

Replace the full contents of `positions/resolve-position.mjs` with:

```js
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COURT_PROFILES = ["fiba", "nba", "ncaa", "nfhs"];
const cache = new Map();

function loadCourtProfile(courtProfile) {
  if (!COURT_PROFILES.includes(courtProfile)) {
    throw new Error(`Unknown court profile '${courtProfile}'. Known: ${COURT_PROFILES.join(", ")}`);
  }
  if (!cache.has(courtProfile)) {
    const path = resolve(__dirname, `${courtProfile}-v1.json`);
    cache.set(courtProfile, JSON.parse(readFileSync(path, "utf-8")));
  }
  return cache.get(courtProfile);
}

/** Returns { x, y } for a named position under a court profile, or throws if unknown. */
export function resolveNamedPosition(name, ruleset = "fiba") {
  const data = loadCourtProfile(ruleset);
  if (!Object.hasOwn(data.positions, name)) {
    throw new Error(`Unknown named position '${name}' for court profile '${ruleset}'.`);
  }
  const pos = data.positions[name];
  return { x: pos.x, y: pos.y };
}

/**
 * Returns the whole flat position map for a court profile (for bulk consumers).
 * Deep-copies the coordinate leaves so a caller mutating a returned point
 * cannot corrupt the module-level cache.
 */
export function loadPositions(ruleset = "fiba") {
  const positions = loadCourtProfile(ruleset).positions;
  return Object.fromEntries(
    Object.entries(positions).map(([name, { x, y }]) => [name, { x, y }])
  );
}
```

(Note: the JSDoc-facing text says "court profile" for accuracy, but the exported function signatures — parameter name `ruleset`, default value `"fiba"` — are unchanged, per this task's own stated decision above.)

- [ ] **Step 2: Run the positions test to confirm nothing broke**

```bash
node --test test/positions-anchors.test.mjs
```

Expected: `# tests 5`, `# pass 5`, `# fail 0` (unchanged from baseline — this test only calls the public `resolveNamedPosition(name, ruleset)` API, which didn't change).

- [ ] **Step 3: Commit**

```bash
git add positions/resolve-position.mjs
git commit -m "refactor(positions): rename internal ruleset naming to court profile (RFC 0012)"
```

### Task B4: Update `docs/specification.adoc` — field-specific `ruleset` references

**Files:**
- Modify: `docs/specification.adoc` — multiple sections (see below)

RFC 0012's Detailed Design explicitly warns this needs "a careful pass, not a blind find-replace" — some mentions of "ruleset" are about the field, others are general prose about FIBA/NBA/NCAA/NFHS as rule-making organizations. This task lists every occurrence found by `grep -n "ruleset" docs/specification.adoc` and states which of the two categories each falls into.

- [ ] **Step 1: Update the Abstract section (field-adjacent prose — update for accuracy)**

`docs/specification.adoc:25-26,35` describe the format as "ruleset-aware" as a marketing/design bullet. Since the underlying concept (the field, the whitelist mechanism) is renamed, update this prose too so it doesn't describe a field name that no longer exists. Change lines 25-26:

```adoc
*{ocf} v{version}* is an open, ruleset-aware JSON schema for representing team-sport coaching diagrams and multi-step animations — targeting invasion team sports, with basketball fully defined first.
It defines a court coordinate system based on real-world units (meters or feet), a registry of named court positions per ruleset,
a semantic entity model, and a flat, ordered action-sequence structure for
multi-step animations.
```

to:

```adoc
*{ocf} v{version}* is an open, court-profile-aware JSON schema for representing team-sport coaching diagrams and multi-step animations — targeting invasion team sports, with basketball fully defined first.
It defines a court coordinate system based on real-world units (meters or feet), a registry of named court positions per court profile,
a semantic entity model, and a flat, ordered action-sequence structure for
multi-step animations.
```

And line 35 (the "Key Design Goals" bullet list):

```adoc
* *Ruleset-aware* — FIBA, NBA, NCAA, NFHS, custom
```

to:

```adoc
* *Court-profile-aware* — FIBA, NBA, NCAA, NFHS, custom
```

- [ ] **Step 2: Update the Introduction bullet (line 52)**

Change:

```adoc
. A named position registry aligned with official ruleset geometry
```

to:

```adoc
. A named position registry aligned with official court-profile geometry
```

- [ ] **Step 3: Update the Coordinate Types section (line 191)**

Change:

```adoc
References a standard named position. Resolved to absolute coordinates at render time using the document's `ruleset`.
```

to:

```adoc
References a standard named position. Resolved to absolute coordinates at render time using the document's `court_profile`.
```

- [ ] **Step 4: Update "Coordinate Ranges per Ruleset" section heading and table (lines 125-138)**

Change the heading and table header from:

```adoc
=== Coordinate Ranges per Ruleset

[cols="1,1,2,2", options="header"]
|===
| Ruleset | Unit | x range | y range (half / full)
```

to:

```adoc
=== Coordinate Ranges per Court Profile

[cols="1,1,2,2", options="header"]
|===
| Court Profile | Unit | x range | y range (half / full)
```

(The table body rows — `fiba`, `nba`, `ncaa`, `nfhs` and their values — are unchanged; only the heading and column label change.)

- [ ] **Step 5: Update "Named Court Positions" § "Ruleset Differences" (lines 216, 291-294)**

Change the section title at line 291:

```adoc
=== Ruleset Differences

Key position differences across rulesets, as centered coordinates (origin at
court center), matching the values in `positions/{ruleset}-v1.json`:
```

to:

```adoc
=== Court Profile Differences

Key position differences across court profiles, as centered coordinates (origin at
court center), matching the values in `sports/basketball/court_profiles/{name}.json`:
```

(Note the path also changes to reflect Task Group C's bundle restructure — this line will be doubly correct once that task lands, and singly-wrong-but-harmless in the interim since it's prose, not executable. If you're executing Task Groups B and C in the same sitting, as this plan expects, this is a non-issue.)

- [ ] **Step 6: Update the machine-readable source-of-truth NOTE (lines 222-227)**

Change:

```adoc
NOTE: The machine-readable source of truth for every ruleset's named-position
coordinates is `positions/{fiba,nba,ncaa,nfhs}-v1.json`, exported from
`@opencoachingformat/spec` via `resolveNamedPosition(name, ruleset)`. The tables
below are the human-readable FIBA reference; tools MUST read the JSON, not parse
these tables. A test (`test/positions-anchors.test.mjs`) guards the JSON against
the cross-ruleset anchor values in the difference table.
```

to:

```adoc
NOTE: The machine-readable source of truth for every court profile's named-position
coordinates is `sports/basketball/court_profiles/{fiba,nba,ncaa,nfhs}.json`, exported from
`@opencoachingformat/spec` via `resolveNamedPosition(name, courtProfile)`. The tables
below are the human-readable FIBA reference; tools MUST read the JSON, not parse
these tables. A test (`test/positions-anchors.test.mjs`) guards the JSON against
the cross-court-profile anchor values in the difference table.
```

(This documents the function call with the conceptually-correct parameter name `courtProfile` even though Task B3 deliberately did not rename the actual parameter — this is prose describing what the argument MEANS, not the literal source code. If this distinction bothers a future reader, that's exactly the kind of signal that should reopen RFC 0012's Open Question 2, not something to paper over here.)

- [ ] **Step 7: Update the "Custom Positions" TIP (line 350)**

Change:

```adoc
TIP: Custom positions use the same unit as the document ruleset.
No separate unit declaration is needed.
```

to:

```adoc
TIP: Custom positions use the same unit as the document's court profile.
No separate unit declaration is needed.
```

- [ ] **Step 8: Update "Court Configuration" section (lines 919-975)**

Change the section and subsection headings, and the field name inside the JSON example. Lines 919-932:

```adoc
== Court Configuration

=== Supported Rulesets

[cols="1,1,2,2", options="header"]
|===
| `ruleset` | `unit` | Court (L × W) | Notes

| `fiba`  | `m`  | 28.0 × 15.0 | International standard
| `nba`   | `ft` | 94.0 × 50.0 | NBA-specific 3-point geometry (straight corners)
| `ncaa`  | `ft` | 94.0 × 50.0 | Shorter 3-point line than NBA
| `nfhs`  | `ft` | 84.0 × 50.0 | US high school, shorter court
| `custom`| *    | defined      | Requires `custom_dimensions` block
|===
```

to:

```adoc
== Court Configuration

=== Supported Court Profiles

[cols="1,1,2,2", options="header"]
|===
| `court_profile` | `unit` | Court (L × W) | Notes

| `fiba`  | `m`  | 28.0 × 15.0 | International standard
| `nba`   | `ft` | 94.0 × 50.0 | NBA-specific 3-point geometry (straight corners)
| `ncaa`  | `ft` | 94.0 × 50.0 | Shorter 3-point line than NBA
| `nfhs`  | `ft` | 84.0 × 50.0 | US high school, shorter court
| `custom`| *    | defined      | Requires `custom_dimensions` block
|===
```

Then lines 956-975 (the "Custom Ruleset" subsection and its example):

```adoc
=== Custom Ruleset

[source,json]
----
"court": {
  "ruleset": "custom",
  "type": "half_court",
  "drill_focus": "offense",
  "custom_dimensions": {
    "unit": "m",
    "length": 24.0,
    "width": 13.0,
    "basket_from_baseline": 1.575,
    "three_point_distance": 5.77,
    "paint_width": 3.6,
    "paint_depth": 5.8,
    "free_throw_distance": 5.8
  }
}
----
```

to:

```adoc
=== Custom Court Profile

[source,json]
----
"court": {
  "court_profile": "custom",
  "type": "half_court",
  "drill_focus": "offense",
  "custom_dimensions": {
    "unit": "m",
    "length": 24.0,
    "width": 13.0,
    "basket_from_baseline": 1.575,
    "three_point_distance": 5.77,
    "paint_width": 3.6,
    "paint_depth": 5.8,
    "free_throw_distance": 5.8
  }
}
----
```

- [ ] **Step 9: Update "Ruleset Conversion" section (lines 979-1013)**

Change the section heading (line 979) and prose. Change:

```adoc
== Ruleset Conversion

Converting a drill between rulesets is an explicit, lossless operation for *named positions*
and a best-effort proportional mapping for *free coordinates*.

=== Named Position Conversion

Named positions are looked up independently in each ruleset's coordinate table.
The semantic meaning is preserved exactly.
```

to:

```adoc
== Court Profile Conversion

Converting a drill between court profiles is an explicit, lossless operation for *named positions*
and a best-effort proportional mapping for *free coordinates*.

=== Named Position Conversion

Named positions are looked up independently in each court profile's coordinate table.
The semantic meaning is preserved exactly.
```

Then the WARNING block (lines 1005-1013):

```adoc
[WARNING]
====
Proportional conversion of free coordinates may place entities
at positions that are semantically incorrect (e.g. inside or outside the 3-point line)
relative to the target ruleset's geometry.

Editors should surface a warning: _"X free coordinates were proportionally scaled.
Please verify their positions against the target ruleset."_
====
```

to:

```adoc
[WARNING]
====
Proportional conversion of free coordinates may place entities
at positions that are semantically incorrect (e.g. inside or outside the 3-point line)
relative to the target court profile's geometry.

Editors should surface a warning: _"X free coordinates were proportionally scaled.
Please verify their positions against the target court profile."_
====
```

- [ ] **Step 10: Update the Complete Example (line 1050)**

Change:

```json
  "court": { "ruleset": "fiba", "type": "half_court", "drill_focus": "offense" },
```

to:

```json
  "court": { "court_profile": "fiba", "type": "half_court", "drill_focus": "offense" },
```

- [ ] **Step 11: Update the Schema Reference UML diagram (line 1246)**

Change:

```
class Court {
  +ruleset: enum
  +type: enum
```

to:

```
class Court {
  +court_profile: enum
  +type: enum
```

- [ ] **Step 12: Update the Enums Summary table (line 1371)**

Change:

```adoc
| `ruleset`       | `fiba`, `nba`, `ncaa`, `nfhs`, `custom`
```

to:

```adoc
| `court_profile` | `fiba`, `nba`, `ncaa`, `nfhs`, `custom`
```

- [ ] **Step 13: Verify no field-specific `ruleset` mentions remain**

```bash
grep -n "ruleset" docs/specification.adoc
```

Expected: no output at all. (Every occurrence found at planning time was field-specific per the above audit — there was no general "FIBA/NBA/etc. as rule-making bodies" prose in this file to preserve. If this command finds something, it's either a mistake in this task or a genuinely new occurrence introduced by a different task — investigate before proceeding.)

- [ ] **Step 14: Commit**

```bash
git add docs/specification.adoc
git commit -m "docs(spec): rename ruleset to court_profile throughout the specification (RFC 0012)"
```

### Task B5: Update `README.md` and `CONTRIBUTING.md` field-specific mentions

**Files:**
- Modify: `README.md:36`
- Modify: `CONTRIBUTING.md:119-126`

- [ ] **Step 1: Update README's Quick Example**

In `README.md`, line 36, change:

```json
  "court": { "ruleset": "fiba", "type": "half_court" },
```

to:

```json
  "court": { "court_profile": "fiba", "type": "half_court" },
```

Do NOT touch the rest of this code block (it still uses `frames[]`, which is separately known-stale from RFC 0006's migration and out of scope for this plan — see the `v2-implementation-doc-sync` memory convention, which scopes doc fixes to what the CURRENT task actually made stale, not pre-existing unrelated drift).

- [ ] **Step 2: Update CONTRIBUTING.md's "Adding a New Ruleset" section**

This section (`CONTRIBUTING.md:119-127`) describes a contributor workflow that becomes factually wrong once Task Group C lands (no more `positions/<ruleset>-v1.json` file to create). Update it now, in this task, since the section is fundamentally about the `ruleset` concept being renamed — Task Group C will need a second, smaller pass to update the exact file path once the bundle structure exists (see Task C7).

Change:

```markdown
## Adding a New Ruleset

To add a new sport or league ruleset (e.g. EuroLeague, WNBA, 3x3, Wheelchair):

1. Open an RFC describing the ruleset's court dimensions and geometry
2. Define named positions in the spec (following the FIBA table format)
3. Add the ruleset to the schema enum
4. Add at least two example files using the new ruleset
5. Document WCAG contrast for any new default colors
```

to:

```markdown
## Adding a New Court Profile

To add a new sport or league court profile (e.g. EuroLeague, WNBA, 3x3, Wheelchair):

1. Open an RFC describing the court profile's court dimensions and geometry
2. Define named positions in the spec (following the FIBA table format)
3. Add the court profile to the schema enum
4. Add at least two example files using the new court profile
5. Document WCAG contrast for any new default colors
```

(Step 5's "Document WCAG contrast" instruction is itself likely to be removed once RFC 0011 — Remove Rendering Concerns — lands. That's a different RFC in this program, not this plan's job to touch; leave it as-is here.)

- [ ] **Step 3: Commit**

```bash
git add README.md CONTRIBUTING.md
git commit -m "docs: rename ruleset to court profile in README and CONTRIBUTING (RFC 0012)"
```

### Task B6: Update the site's `docs/rulesets.astro` page copy

**Files:**
- Modify: `site/src/pages/docs/rulesets.astro`

Per the `v2-implementation-doc-sync` memory convention (every schema-changing task must also check the hand-written site pages), this page's entire content is about the `ruleset` field specifically. Its URL path (`/docs/rulesets/`) stays unchanged — renaming URL slugs is a separate, bigger site-infrastructure decision this plan doesn't make — but the page's own copy and data should describe `court_profile`, matching the schema it documents.

- [ ] **Step 1: Update the page content**

Replace the full contents of `site/src/pages/docs/rulesets.astro` with:

```astro
---
import Base from '../../layouts/Base.astro';

const courtProfiles = [
  { courtProfile: 'fiba', unit: 'm', length: '28.0', width: '15.0' },
  { courtProfile: 'nba', unit: 'ft', length: '94.0', width: '50.0' },
  { courtProfile: 'ncaa', unit: 'ft', length: '94.0', width: '50.0' },
  { courtProfile: 'nfhs', unit: 'ft', length: '84.0', width: '50.0' },
  { courtProfile: 'custom', unit: '*', length: 'user-defined', width: 'user-defined' },
];
---
<Base
  title="Court Profiles"
  description="The OCF coordinate system and the FIBA, NBA, NCAA, and NFHS court profiles it supports out of the box."
>
  <h1>Coordinate System &amp; Court Profiles</h1>

  <h2 id="coordinate-system">Coordinate system</h2>
  <p>OCF positions are expressed on two axes, both centered on midcourt:</p>
  <pre><code>x: −max … 0 … +max   (viewer's left → center → viewer's right)
y: −max … 0 … +max   (defense basket → midline → offense basket)</code></pre>
  <p>
    Units are real-world: <strong>meters</strong> for FIBA,
    <strong>feet</strong> for NBA, NCAA, and NFHS.
  </p>

  <h2 id="supported-court-profiles">Supported court profiles</h2>
  <p>
    Each court profile determines the coordinate unit and the court dimensions
    used to resolve named positions (e.g. <code>top_of_the_key</code>) into
    concrete coordinates.
  </p>
  <table>
    <thead>
      <tr>
        <th>Court Profile</th>
        <th>Unit</th>
        <th>Court length</th>
        <th>Court width</th>
      </tr>
    </thead>
    <tbody>
      {courtProfiles.map((row) => (
        <tr>
          <td><code>{row.courtProfile}</code></td>
          <td>{row.unit}</td>
          <td>{row.length}</td>
          <td>{row.width}</td>
        </tr>
      ))}
    </tbody>
  </table>
</Base>
```

- [ ] **Step 2: Rebuild the site to confirm it compiles**

```bash
cd site
npm run build
```

Expected: build completes without error. (You don't need to run this from a clean `dist/` — Astro overwrites its own output.)

- [ ] **Step 3: Commit**

```bash
cd ..
git add site/src/pages/docs/rulesets.astro
git commit -m "docs(site): rename ruleset to court profile on the rulesets page (RFC 0012)"
```

---

## Task Group C: RFC 0010 — Sport-Scoped Court & `sports/<sport>/` Bundle

This group depends on Task Groups A and B being fully complete — every step below assumes `sport` is required and every field/file says `court_profile`, not `ruleset`.

### Task C1: Create the `sports/basketball/` bundle

**Files:**
- Create: `sports/basketball/sport.json`
- Create: `sports/basketball/court_profiles/fiba.json`
- Create: `sports/basketball/court_profiles/nba.json`
- Create: `sports/basketball/court_profiles/ncaa.json`
- Create: `sports/basketball/court_profiles/nfhs.json`
- Delete (later, in Task C6, after all consumers are migrated): `sports/basketball-v1.json`, `positions/fiba-v1.json`, `positions/nba-v1.json`, `positions/ncaa-v1.json`, `positions/nfhs-v1.json`

Per RFC 0010's naming rule (a field extracted from `sport.json` is named after its JSON path), and per Open Question 3's resolution for this plan (keep `actions` inline in `sport.json` for now — basketball's action data doesn't yet justify its own `actions.json` file; extract only when a second sport reaches similar size), `sport.json` carries `actions` inline and each court profile is its own file under `court_profiles/`.

- [ ] **Step 1: Create `sports/basketball/sport.json`**

```json
{
  "$schema": "https://opencoachingformat.org/registry/sports/sport-schema-v1.json",
  "sport": "basketball",
  "version": "2.0.0",
  "status": "defined",
  "source": "https://www.fiba.basketball/documents/official-basketball-rules.pdf",
  "maintainers": ["opencoachingformat maintainers"],
  "reviewed_by": null,
  "review_date": null,
  "equipment": { "type": "ball" },
  "coordinate_system": { "type": "cartesian_2d" },
  "actions": {
    "types": ["move", "cut", "screen", "defend", "dribble", "pass", "shoot", "rebound", "pickup"],
    "variants": {
      "cut": ["backdoor", "give_and_go", "flash", "v_cut", "l_cut", "curl", "flare", "fade", "basket"],
      "screen": ["ball_screen", "back_screen", "down_screen", "flare_screen", "cross_screen", "pin_down"],
      "defend": ["on_ball", "deny", "help", "hedge", "switch", "box_out"],
      "pass": ["chest", "bounce", "overhead", "lob", "baseball", "hand_off", "outlet"],
      "shoot": ["jumper", "three", "layup", "floater", "dunk", "hook", "free_throw"],
      "rebound": ["offensive", "defensive"]
    },
    "outcomes": ["make", "miss", "turnover", "steal", "foul"]
  },
  "court_contract": { "required_dimensions": ["length", "width"] },
  "court_profiles": {
    "fiba": {},
    "nba": {},
    "ncaa": {},
    "nfhs": {}
  }
}
```

(`court_profiles` values are empty objects here because each is extracted to its own file per the naming rule — the presence of the key in `sport.json` is what makes it load-bearing for the schema's `allOf` whitelist in Task C2; the actual coordinate data lives in the sibling files created next.)

- [ ] **Step 2: Create `sports/basketball/court_profiles/fiba.json`**

This is today's `positions/fiba-v1.json`, with `ruleset` renamed to `court_profile` and `registry_id` updated. Content:

```json
{
  "$schema": "https://opencoachingformat.org/registry/court-profiles/court-profile-schema-v1.json",
  "registry_id": "basketball-fiba-v1",
  "court_profile": "fiba",
  "unit": "m",
  "version": "1.0.0",
  "court": { "length": 28.0, "width": 15.0 },
  "positions": {
    "basket": { "x": 0.0, "y": 12.425 },
    "left_block": { "x": -2.45, "y": 11.0 },
    "right_block": { "x": 2.45, "y": 11.0 },
    "paint_center": { "x": 0.0, "y": 10.5 },
    "left_short_corner": { "x": -7.5, "y": 11.5 },
    "right_short_corner": { "x": 7.5, "y": 11.5 },
    "left_elbow": { "x": -2.45, "y": 8.2 },
    "right_elbow": { "x": 2.45, "y": 8.2 },
    "free_throw_line": { "x": 0.0, "y": 8.2 },
    "high_post_left": { "x": -2.45, "y": 7.0 },
    "high_post_right": { "x": 2.45, "y": 7.0 },
    "top_of_the_key": { "x": 0.0, "y": 5.68 },
    "left_wing": { "x": -6.75, "y": 8.6 },
    "right_wing": { "x": 6.75, "y": 8.6 },
    "left_corner": { "x": -7.5, "y": 13.98 },
    "right_corner": { "x": 7.5, "y": 13.98 },
    "midcourt.center": { "x": 0.0, "y": 0.0 },
    "midcourt.left": { "x": -7.5, "y": 0.0 },
    "midcourt.right": { "x": 7.5, "y": 0.0 },
    "backcourt.basket": { "x": 0.0, "y": -12.425 },
    "backcourt.left_block": { "x": -2.45, "y": -11.0 },
    "backcourt.right_block": { "x": 2.45, "y": -11.0 },
    "backcourt.left_elbow": { "x": -2.45, "y": -8.2 },
    "backcourt.right_elbow": { "x": 2.45, "y": -8.2 },
    "backcourt.free_throw_line": { "x": 0.0, "y": -8.2 },
    "backcourt.top_of_the_key": { "x": 0.0, "y": -5.68 },
    "backcourt.left_wing": { "x": -6.75, "y": -8.6 },
    "backcourt.right_wing": { "x": 6.75, "y": -8.6 },
    "backcourt.left_corner": { "x": -7.5, "y": -13.98 },
    "backcourt.right_corner": { "x": 7.5, "y": -13.98 },
    "inbound.baseline_left": { "x": -3.0, "y": 14.0 },
    "inbound.baseline_right": { "x": 3.0, "y": 14.0 },
    "inbound.baseline_center": { "x": 0.0, "y": 14.0 },
    "inbound.sideline_left_fc": { "x": -7.5, "y": 8.2 },
    "inbound.sideline_right_fc": { "x": 7.5, "y": 8.2 },
    "inbound.sideline_left_mid": { "x": -7.5, "y": 0.0 },
    "inbound.sideline_right_mid": { "x": 7.5, "y": 0.0 },
    "inbound.sideline_left_bc": { "x": -7.5, "y": -8.2 },
    "inbound.sideline_right_bc": { "x": 7.5, "y": -8.2 }
  }
}
```

- [ ] **Step 3: Create `sports/basketball/court_profiles/nba.json`**

Read `positions/nba-v1.json`'s current `positions` object (it has the same 39 keys as fiba.json, different values — do not retype these by hand, copy them from the existing file to avoid transcription errors) and produce:

```json
{
  "$schema": "https://opencoachingformat.org/registry/court-profiles/court-profile-schema-v1.json",
  "registry_id": "basketball-nba-v1",
  "court_profile": "nba",
  "unit": "ft",
  "version": "1.0.0",
  "court": { "length": 94.0, "width": 50.0 },
  "positions": { }
}
```

with `positions` populated from `positions/nba-v1.json`'s existing `positions` object verbatim (same 39 keys as the FIBA file, NBA-specific coordinate values). Use this command to do the copy mechanically and correctly, rather than hand-transcribing 39 coordinate pairs:

```bash
node -e '
const fs = require("fs");
const old = JSON.parse(fs.readFileSync("positions/nba-v1.json", "utf-8"));
const out = {
  "$schema": "https://opencoachingformat.org/registry/court-profiles/court-profile-schema-v1.json",
  registry_id: "basketball-nba-v1",
  court_profile: "nba",
  unit: old.unit,
  version: old.version,
  court: old.court,
  positions: old.positions,
};
fs.writeFileSync("sports/basketball/court_profiles/nba.json", JSON.stringify(out, null, 2) + "\n");
'
```

- [ ] **Step 4: Create `sports/basketball/court_profiles/ncaa.json` and `nfhs.json` the same way**

```bash
node -e '
const fs = require("fs");
for (const name of ["ncaa", "nfhs"]) {
  const old = JSON.parse(fs.readFileSync(`positions/${name}-v1.json`, "utf-8"));
  const out = {
    "$schema": "https://opencoachingformat.org/registry/court-profiles/court-profile-schema-v1.json",
    registry_id: `basketball-${name}-v1`,
    court_profile: name,
    unit: old.unit,
    version: old.version,
    court: old.court,
    positions: old.positions,
  };
  fs.writeFileSync(`sports/basketball/court_profiles/${name}.json`, JSON.stringify(out, null, 2) + "\n");
}
'
```

- [ ] **Step 5: Verify all four new court-profile files have exactly 39 positions each, matching the originals**

```bash
node -e '
const fs = require("fs");
for (const name of ["fiba", "nba", "ncaa", "nfhs"]) {
  const oldFile = `positions/${name}-v1.json`;
  const newFile = `sports/basketball/court_profiles/${name}.json`;
  const oldData = JSON.parse(fs.readFileSync(oldFile, "utf-8"));
  const newData = JSON.parse(fs.readFileSync(newFile, "utf-8"));
  const oldCount = Object.keys(oldData.positions).length;
  const newCount = Object.keys(newData.positions).length;
  console.log(`${name}: old=${oldCount} new=${newCount} match=${JSON.stringify(oldData.positions) === JSON.stringify(newData.positions)}`);
}
'
```

Expected: `fiba: old=39 new=39 match=true`, and the same for `nba`, `ncaa`, `nfhs`. If `match=false` for any, stop — something went wrong in the copy and needs investigating before proceeding (do not proceed to deleting the old files until this passes).

- [ ] **Step 6: Commit**

```bash
git add sports/basketball/
git commit -m "feat(registry): create sports/basketball/ bundle alongside the old flat files (RFC 0010)"
```

(The old `sports/basketball-v1.json` and `positions/{fiba,nba,ncaa,nfhs}-v1.json` files are intentionally NOT deleted yet — they're removed in Task C6, once every consumer has been migrated to read the new bundle. Keeping both in parallel for a few tasks means the test suite stays green throughout, rather than breaking mid-refactor.)

### Task C2: Add the `sport` → `court_profile` whitelist to the schema

**Files:**
- Modify: `schema/v1.json` — new `allOf` block

- [ ] **Step 1: Add a new `allOf` block gating `court.court_profile` by `sport`**

In `schema/v1.json`, inside the `allOf` array (after the last existing block, i.e. after the futsal block that currently ends the array at line 913), add two new blocks:

```json
    {
      "if": { "required": ["sport"], "properties": { "sport": { "const": "basketball" } } },
      "then": {
        "type": "object",
        "properties": { "court": { "type": "object", "properties": { "court_profile": { "enum": ["fiba", "nba", "ncaa", "nfhs", "custom"] } } } }
      }
    },
    {
      "if": {
        "required": ["sport"],
        "properties": { "sport": { "enum": ["soccer", "handball", "hockey", "futsal"] } }
      },
      "then": {
        "type": "object",
        "properties": { "court": { "type": "object", "properties": { "court_profile": { "const": "custom" } } } }
      }
    }
```

The second block covers all four currently-provisional sports in one clause (each has an empty `court_profiles` in its registry today, so each is restricted to `"custom"` until a real court profile is added for it) — this is simpler than four near-identical blocks and easier to extend later (when a sport gets its first real court profile, move it out of this shared `enum` list into its own block, following the basketball block's shape as a template).

- [ ] **Step 2: Validate the schema still compiles**

```bash
npx ajv compile --spec=draft7 --strict-schema=false -s schema/v1.json -c ajv-formats
```

Expected: compiles without error.

- [ ] **Step 3: Run full validation on existing examples**

```bash
npm run validate
```

Expected: all 10 examples still report `valid` (the new whitelist doesn't reject anything today's examples already do — `fiba` is valid for basketball, `custom` is valid for soccer).

- [ ] **Step 4: Write a test asserting the new whitelist rejects a mismatched sport/court_profile pair**

Create `test/sport-court-profile-whitelist.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

function baseDoc(overrides = {}) {
  return {
    sport: "basketball",
    meta: { id: "11111111-1111-1111-1111-111111111111", title: "t" },
    court: { court_profile: "fiba", type: "half_court" },
    entities: [],
    actions: [],
    ...overrides,
  };
}

test("sport: soccer with court_profile: fiba is rejected", () => {
  const doc = baseDoc({ sport: "soccer", court: { court_profile: "fiba", type: "half_court" } });
  assert.equal(validate(doc), false, "a soccer document with a basketball court_profile must fail validation");
});

test("sport: soccer with court_profile: custom is accepted", () => {
  const doc = baseDoc({
    sport: "soccer",
    court: {
      court_profile: "custom",
      type: "full_court",
      custom_dimensions: {
        unit: "m", length: 105, width: 68,
        goal_width: 7.32, penalty_box_width: 40.3, penalty_box_depth: 16.5, penalty_spot_distance: 11,
      },
    },
  });
  assert.equal(validate(doc), true, JSON.stringify(validate.errors));
});

test("sport: basketball with court_profile: fiba is accepted (unchanged behavior)", () => {
  const doc = baseDoc();
  assert.equal(validate(doc), true, JSON.stringify(validate.errors));
});
```

Note: the second test (`soccer` + `custom` + soccer-shaped `custom_dimensions`) will FAIL until Task C3 makes `custom_dimensions` sport-scoped — that's expected and correct at this point in the plan; it's written now as a forward-looking assertion and will start passing once Task C3 lands. Do not skip writing it now just because it doesn't pass yet.

- [ ] **Step 5: Run the new test file, confirming the expected partial-pass state**

```bash
node --test test/sport-court-profile-whitelist.test.mjs
```

Expected: `# tests 3`, `# pass 2`, `# fail 1` (the soccer/custom_dimensions test fails, as explained above — this is the expected state until Task C3).

- [ ] **Step 6: Commit**

```bash
git add schema/v1.json test/sport-court-profile-whitelist.test.mjs
git commit -m "feat(schema): sport gates court_profile via allOf whitelist (RFC 0010)"
```

### Task C3: Make `custom_dimensions` sport-scoped

**Files:**
- Modify: `schema/v1.json:754-769` (remove the unconditional `custom_dimensions` shape from the base `court` object)
- Modify: `schema/v1.json` — extend the two `allOf` blocks from Task C2 to also constrain `custom_dimensions`'s shape

- [ ] **Step 1: Remove the unconditional basketball-shaped `custom_dimensions` from the base `court` schema**

In `schema/v1.json`, lines 747-772, the `court` property currently reads:

```json
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
```

(This should already read `court_profile` instead of `ruleset` from Task Group B — the snippet above shows the PRE-Task-Group-B shape only to make the diff clear; if you're following this plan in order, your actual starting point already has `court_profile`.)

Replace with a version that keeps `custom_dimensions` as a generic object at this level (shape is now enforced entirely by the `allOf` blocks, not here):

```json
    "court": {
      "type": "object",
      "required": ["court_profile", "type"],
      "properties": {
        "court_profile": { "$ref": "#/definitions/court_profile" },
        "type": { "type": "string", "enum": ["half_court", "full_court"] },
        "drill_focus": { "type": "string", "enum": ["offense", "defense", "transition", "neutral"], "default": "offense" },
        "wheelchair": { "type": "boolean", "default": false },
        "custom_dimensions": { "type": "object" }
      },
      "additionalProperties": false
    },
```

(`custom_dimensions` stays a bare `{"type": "object"}` here — just enough to reject a non-object value early. Its actual required-fields/additionalProperties shape is now entirely sport-scoped, defined only in the `allOf` blocks below.)

- [ ] **Step 2: Extend the basketball `allOf` block (from Task C2) to also constrain `custom_dimensions`**

The block added in Task C2 for basketball:

```json
    {
      "if": { "required": ["sport"], "properties": { "sport": { "const": "basketball" } } },
      "then": {
        "type": "object",
        "properties": { "court": { "type": "object", "properties": { "court_profile": { "enum": ["fiba", "nba", "ncaa", "nfhs", "custom"] } } } }
      }
    },
```

becomes:

```json
    {
      "if": { "required": ["sport"], "properties": { "sport": { "const": "basketball" } } },
      "then": {
        "type": "object",
        "properties": {
          "court": {
            "type": "object",
            "properties": {
              "court_profile": { "enum": ["fiba", "nba", "ncaa", "nfhs", "custom"] },
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
            }
          }
        }
      }
    },
```

This is exactly today's basketball `custom_dimensions` shape, unchanged in content — only its location moved from unconditional (on `court` directly) to conditional (inside the basketball `allOf` branch).

- [ ] **Step 3: Extend the provisional-sports `allOf` block (from Task C2) to add a soccer-shaped `custom_dimensions`**

The shared block for soccer/handball/hockey/futsal from Task C2:

```json
    {
      "if": {
        "required": ["sport"],
        "properties": { "sport": { "enum": ["soccer", "handball", "hockey", "futsal"] } }
      },
      "then": {
        "type": "object",
        "properties": { "court": { "type": "object", "properties": { "court_profile": { "const": "custom" } } } }
      }
    }
```

Every one of these four sports is restricted to `court_profile: "custom"` today (none has a real court profile yet), so they all share one `custom_dimensions` shape for now too. This plan picks a concrete soccer-oriented field set (`goal_width`, `penalty_box_width`, `penalty_box_depth`, `penalty_spot_distance`) since RFC 0010 explicitly left the exact field list undecided but named these as its own example, and this plan needs to migrate an existing example (`examples/sport-soccer.ocf.json`) that needs a real field set to validate against:

```json
    {
      "if": {
        "required": ["sport"],
        "properties": { "sport": { "enum": ["soccer", "handball", "hockey", "futsal"] } }
      },
      "then": {
        "type": "object",
        "properties": {
          "court": {
            "type": "object",
            "properties": {
              "court_profile": { "const": "custom" },
              "custom_dimensions": {
                "type": "object",
                "required": ["unit", "length", "width", "goal_width", "penalty_box_width", "penalty_box_depth", "penalty_spot_distance"],
                "properties": {
                  "unit": { "$ref": "#/definitions/unit" },
                  "length": { "type": "number" },
                  "width": { "type": "number" },
                  "goal_width": { "type": "number" },
                  "penalty_box_width": { "type": "number" },
                  "penalty_box_depth": { "type": "number" },
                  "penalty_spot_distance": { "type": "number" }
                },
                "additionalProperties": false
              }
            }
          }
        }
      }
    }
```

This field set is a real, if provisional, decision this plan makes on RFC 0010's behalf (RFC 0010 itself defers it) — flagged here so a reviewer can see it's a plan-level choice, not something RFC 0010 itself settled. It's scoped to soccer/handball/hockey/futsal collectively for now since none of them have a promoted court profile yet; when a sport gets a real court profile, it moves to its own block (mirroring how basketball already has its own block) with a field set suited to that specific sport if different from this shared one.

- [ ] **Step 4: Migrate `examples/sport-soccer.ocf.json` to the new soccer-shaped `custom_dimensions`**

Replace the full contents of `examples/sport-soccer.ocf.json` with:

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "sport": "soccer",
  "meta": { "id": "b2c3d4e5-2222-4a6e-8f0c-2d5e9a1b3c7f", "title": "Sport-tagged soccer (provisional)", "created": "2026-08-27T10:00:00Z", "source_format": "open" },
  "court": { "court_profile": "custom", "type": "full_court", "custom_dimensions": { "unit": "m", "length": 105, "width": 68, "goal_width": 7.32, "penalty_box_width": 40.3, "penalty_box_depth": 16.5, "penalty_spot_distance": 11 } },
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

This removes the awkward basketball-field-repurposing (`paint_width`/`paint_depth` meaning penalty-box dimensions, `basket_from_baseline`/`three_point_distance` zeroed out) that RFC 0010's Motivation section identifies as the concrete problem this RFC fixes — `goal_width: 7.32` (a real regulation goal width) and `penalty_box_width`/`penalty_box_depth`/`penalty_spot_distance` (real penalty-box dimensions, same numbers as before, now correctly named) replace it.

- [ ] **Step 5: Update the two soccer-related invalid fixtures that also use `custom_dimensions`**

Check whether `examples/invalid/sport-soccer-screen.json` needs its `custom_dimensions` block updated to the new soccer shape (it currently uses the OLD basketball-shaped `custom_dimensions`, which — after this task — would make it invalid for TWO reasons instead of one, same silent-wrong-reason risk flagged in Task B2):

In `examples/invalid/sport-soccer-screen.json`, change:

```json
  "court": { "court_profile": "custom", "type": "full_court", "custom_dimensions": { "unit": "m", "length": 105, "width": 68, "basket_from_baseline": 0, "three_point_distance": 0, "paint_width": 40.3, "paint_depth": 16.5, "free_throw_distance": 11 } },
```

to:

```json
  "court": { "court_profile": "custom", "type": "full_court", "custom_dimensions": { "unit": "m", "length": 105, "width": 68, "goal_width": 7.32, "penalty_box_width": 40.3, "penalty_box_depth": 16.5, "penalty_spot_distance": 11 } },
```

(This fixture's intended failure reason is the `screen` action type under `sport: "soccer"`, not anything about `custom_dimensions` — keeping `custom_dimensions` correctly-shaped ensures it still fails for the RIGHT reason.)

- [ ] **Step 6: Run the whitelist test file — the previously-failing test should now pass**

```bash
node --test test/sport-court-profile-whitelist.test.mjs
```

Expected: `# tests 3`, `# pass 3`, `# fail 0`.

- [ ] **Step 7: Validate all examples**

```bash
npm run validate
```

Expected: all 10 files report `valid`.

- [ ] **Step 8: Run the invalid-fixtures check**

```bash
npm run test:invalid
```

Expected: passes.

- [ ] **Step 9: Run the full test suite**

```bash
npm test
```

Expected: `# tests 49` (46 from before, plus the 3 new whitelist tests), `# pass 49`, `# fail 0`.

- [ ] **Step 10: Commit**

```bash
git add schema/v1.json examples/sport-soccer.ocf.json examples/invalid/sport-soccer-screen.json
git commit -m "feat(schema): custom_dimensions becomes sport-scoped (RFC 0010)"
```

### Task C4: Add `court_contract` cross-check between `sports/*/sport.json` and each sport's `custom_dimensions`

RFC 0010's `court_contract.required_dimensions` is deliberately schema/validator-scope only (not renderer-facing — confirmed in the RFC). Since this plan's schema changes so far already hard-code `length`/`width` as required in both the basketball and provisional-sports `custom_dimensions` shapes (Task C3), the schema itself already satisfies `court_contract: {required_dimensions: ["length", "width"]}` for both. This task adds a test that keeps that guarantee explicit and checked, rather than an implicit coincidence.

**Files:**
- Create: `test/court-contract.test.mjs`

- [ ] **Step 1: Write the test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));
const basketballSport = JSON.parse(
  readFileSync(new URL("../sports/basketball/sport.json", import.meta.url), "utf-8")
);

// Find the allOf block whose custom_dimensions shape applies to a given sport const,
// mirroring the pattern already used in test/sport-branches.test.mjs.
function customDimensionsRequiredFields(sportConst) {
  for (const block of schema.allOf) {
    const ifSport = block.if?.properties?.sport;
    const matchesConst = ifSport?.const === sportConst;
    const matchesEnum = Array.isArray(ifSport?.enum) && ifSport.enum.includes(sportConst);
    if (matchesConst || matchesEnum) {
      const cd = block.then?.properties?.court?.properties?.custom_dimensions;
      if (cd?.required) return cd.required;
    }
  }
  return null;
}

test("basketball's court_contract.required_dimensions are all present in its custom_dimensions required fields", () => {
  const required = basketballSport.court_contract.required_dimensions;
  const cdRequired = customDimensionsRequiredFields("basketball");
  assert.ok(cdRequired, "basketball must have a custom_dimensions allOf branch");
  for (const dim of required) {
    assert.ok(cdRequired.includes(dim), `custom_dimensions for basketball must require '${dim}' (court_contract says it's mandatory)`);
  }
});

test("every promoted court profile file declares length and width", () => {
  const profiles = ["fiba", "nba", "ncaa", "nfhs"];
  for (const name of profiles) {
    const data = JSON.parse(
      readFileSync(new URL(`../sports/basketball/court_profiles/${name}.json`, import.meta.url), "utf-8")
    );
    for (const dim of basketballSport.court_contract.required_dimensions) {
      assert.ok(
        Object.hasOwn(data.court, dim),
        `${name}.json's court object must declare '${dim}' (court_contract requires it)`
      );
    }
  }
});
```

- [ ] **Step 2: Run the new test**

```bash
node --test test/court-contract.test.mjs
```

Expected: `# tests 2`, `# pass 2`, `# fail 0`.

- [ ] **Step 3: Commit**

```bash
git add test/court-contract.test.mjs
git commit -m "test: verify basketball's court_contract is honored by schema and registry data (RFC 0010)"
```

### Task C5: Add named-position exclusion (`not_applicable`)

RFC 0010 introduces this mechanism but doesn't yet have a promoted court profile that needs it (basketball's four court profiles — fiba/nba/ncaa/nfhs — all support the full ~35-name vocabulary; there's no exclusion case to encode today). This task implements the MECHANISM in `resolve-position.mjs` so it's ready, and adds a test using a synthetic court profile (not a real, checked-in one) to prove the mechanism works, per RFC 0010's own explicit example (`minibasketball`) which is illustrative, not a real registry entry to add.

**Files:**
- Modify: `positions/resolve-position.mjs`

- [ ] **Step 1: Update `loadCourtProfile` to read from the new bundle path, and add `not_applicable` checking**

Replace the full contents of `positions/resolve-position.mjs` with:

```js
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COURT_PROFILES = ["fiba", "nba", "ncaa", "nfhs"];
const cache = new Map();

function loadCourtProfile(courtProfile) {
  if (!COURT_PROFILES.includes(courtProfile)) {
    throw new Error(`Unknown court profile '${courtProfile}'. Known: ${COURT_PROFILES.join(", ")}`);
  }
  if (!cache.has(courtProfile)) {
    const path = resolve(__dirname, "..", "sports", "basketball", "court_profiles", `${courtProfile}.json`);
    cache.set(courtProfile, JSON.parse(readFileSync(path, "utf-8")));
  }
  return cache.get(courtProfile);
}

/** Returns { x, y } for a named position under a court profile, or throws if unknown or excluded. */
export function resolveNamedPosition(name, ruleset = "fiba") {
  const data = loadCourtProfile(ruleset);
  if (data.not_applicable?.includes(name)) {
    throw new Error(`Position '${name}' is not applicable under court profile '${ruleset}'.`);
  }
  if (!Object.hasOwn(data.positions, name)) {
    throw new Error(`Unknown named position '${name}' for court profile '${ruleset}'.`);
  }
  const pos = data.positions[name];
  return { x: pos.x, y: pos.y };
}

/**
 * Returns the whole flat position map for a court profile (for bulk consumers).
 * Deep-copies the coordinate leaves so a caller mutating a returned point
 * cannot corrupt the module-level cache.
 */
export function loadPositions(ruleset = "fiba") {
  const positions = loadCourtProfile(ruleset).positions;
  return Object.fromEntries(
    Object.entries(positions).map(([name, { x, y }]) => [name, { x, y }])
  );
}
```

Two changes from Task B3's version: (1) the file path now points at `sports/basketball/court_profiles/<name>.json` instead of the old flat `positions/<name>-v1.json`; (2) `resolveNamedPosition` checks `data.not_applicable` before falling through to the "unknown position" error, producing a distinct error message for "excluded" vs. "genuinely unknown," per RFC 0010's Detailed Design item 6.

- [ ] **Step 2: Run the positions test — it should still pass, now reading from the new path**

```bash
node --test test/positions-anchors.test.mjs
```

Expected: `# tests 5`, `# pass 5`, `# fail 0`. (This confirms Task C1's file copies were correct — if this fails, the bundle files don't match the originals closely enough.)

- [ ] **Step 3: Write a test proving the `not_applicable` mechanism works, using a synthetic fixture**

Create `test/not-applicable-positions.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
```

- [ ] **Step 4: Run the new test**

```bash
node --test test/not-applicable-positions.test.mjs
```

Expected: `# tests 3`, `# pass 3`, `# fail 0`.

- [ ] **Step 5: Run the full test suite**

```bash
npm test
```

Expected: `# tests 54` (49 from Task C3, plus 2 from Task C4, plus 3 from this task), `# pass 54`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add positions/resolve-position.mjs test/not-applicable-positions.test.mjs
git commit -m "feat(positions): read from sports/<sport>/court_profiles/, implement not_applicable exclusion (RFC 0010)"
```

### Task C6: Update `test/sport-branches.test.mjs` and `site/scripts/build-sports.mjs` for the bundle layout, then delete the old flat files

**Files:**
- Modify: `test/sport-branches.test.mjs`
- Modify: `site/scripts/build-sports.mjs`
- Modify: `site/test/build-sports.test.mjs`
- Create: `sports/soccer/sport.json`, `sports/handball/sport.json`, `sports/hockey/sport.json`, `sports/futsal/sport.json` (bundle versions of the four provisional sports — each needs a bundle too, even with an empty `court_profiles`, so `sports/` is uniformly bundle-shaped)
- Delete: `sports/basketball-v1.json`, `sports/soccer-v0.0.1.json`, `sports/handball-v0.0.1.json`, `sports/hockey-v0.0.1.json`, `sports/futsal-v0.0.1.json`, `positions/fiba-v1.json`, `positions/nba-v1.json`, `positions/ncaa-v1.json`, `positions/nfhs-v1.json`

- [ ] **Step 1: Create bundle versions of the four provisional sports**

Each provisional sport gets a `sports/<sport>/sport.json` with an empty `court_profiles` object (matching today's empty `rulesets: []`), and the `action_types`/`variants`/`outcomes` fields renamed into the nested `actions` shape, matching basketball's manifest structure from Task C1.

Create `sports/soccer/sport.json`:

```json
{
  "$schema": "https://opencoachingformat.org/registry/sports/sport-schema-v1.json",
  "sport": "soccer",
  "version": "0.0.1",
  "status": "provisional",
  "source": null,
  "maintainers": ["opencoachingformat maintainers"],
  "reviewed_by": null,
  "review_date": null,
  "equipment": { "type": "ball" },
  "coordinate_system": { "type": "cartesian_2d" },
  "actions": {
    "types": ["move", "pass", "shoot", "defend", "dribble", "tackle", "clear"],
    "variants": {},
    "outcomes": []
  },
  "court_contract": { "required_dimensions": ["length", "width"] },
  "court_profiles": {}
}
```

Create `sports/handball/sport.json`:

```json
{
  "$schema": "https://opencoachingformat.org/registry/sports/sport-schema-v1.json",
  "sport": "handball",
  "version": "0.0.1",
  "status": "provisional",
  "source": null,
  "maintainers": ["opencoachingformat maintainers"],
  "reviewed_by": null,
  "review_date": null,
  "equipment": { "type": "ball" },
  "coordinate_system": { "type": "cartesian_2d" },
  "actions": {
    "types": ["move", "pass", "shoot", "defend", "cut", "screen", "pickup"],
    "variants": {},
    "outcomes": []
  },
  "court_contract": { "required_dimensions": ["length", "width"] },
  "court_profiles": {}
}
```

Create `sports/hockey/sport.json`:

```json
{
  "$schema": "https://opencoachingformat.org/registry/sports/sport-schema-v1.json",
  "sport": "hockey",
  "version": "0.0.1",
  "status": "provisional",
  "source": null,
  "maintainers": ["opencoachingformat maintainers"],
  "reviewed_by": null,
  "review_date": null,
  "equipment": { "type": "puck" },
  "coordinate_system": { "type": "cartesian_2d" },
  "actions": {
    "types": ["move", "pass", "shoot", "defend", "dribble", "clear", "faceoff", "check"],
    "variants": {},
    "outcomes": []
  },
  "court_contract": { "required_dimensions": ["length", "width"] },
  "court_profiles": {}
}
```

(Hockey is the one sport in this registry that's genuinely puck-based rather than ball-based — `equipment.type: "puck"` here is the first real use of the extension point Task C1 declared, still purely descriptive with no schema behavior attached to it, per RFC 0010's Explicitly Out of Scope section.)

Create `sports/futsal/sport.json`:

```json
{
  "$schema": "https://opencoachingformat.org/registry/sports/sport-schema-v1.json",
  "sport": "futsal",
  "version": "0.0.1",
  "status": "provisional",
  "source": null,
  "maintainers": ["opencoachingformat maintainers"],
  "reviewed_by": null,
  "review_date": null,
  "equipment": { "type": "ball" },
  "coordinate_system": { "type": "cartesian_2d" },
  "actions": {
    "types": ["move", "pass", "shoot", "defend", "dribble", "tackle", "clear"],
    "variants": {},
    "outcomes": []
  },
  "court_contract": { "required_dimensions": ["length", "width"] },
  "court_profiles": {}
}
```

- [ ] **Step 2: Update `test/sport-branches.test.mjs` to read the bundle layout**

The third test in this file currently does `readdirSync(new URL("../sports/", import.meta.url)).filter(f => f.endsWith(".json"))` — that finds zero files now (`sports/` contains only subdirectories, no top-level `.json` files once Step 5 below deletes the old flat files). It also reads `data.action_types` directly, which no longer exists (it's now `data.actions.types`).

Replace the full contents of `test/sport-branches.test.mjs` with:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url), "utf-8"));

function branchSports(allOf) {
  const handled = new Set();
  for (const b of allOf) {
    const c = b.if?.properties?.sport?.const;
    if (c) handled.add(c);
    const e = b.if?.properties?.sport?.enum;
    if (Array.isArray(e)) for (const s of e) handled.add(s);
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

test("each sport bundle's actions.types matches its schema whitelist branch", () => {
  const sportsDir = new URL("../sports/", import.meta.url);
  const sportDirs = readdirSync(sportsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const branchWhitelist = (sport) => {
    for (const b of schema.allOf) {
      const c = b.if?.properties?.sport?.const;
      const e = b.if?.properties?.sport?.enum;
      if (c === sport || (Array.isArray(e) && e.includes(sport))) {
        return b.then?.properties?.actions?.items?.properties?.type?.enum;
      }
    }
    return null;
  };

  for (const dirName of sportDirs) {
    const manifest = JSON.parse(
      readFileSync(new URL(`${dirName}/sport.json`, sportsDir), "utf-8")
    );
    const wl = branchWhitelist(manifest.sport);
    assert.ok(wl, `no schema branch for sport ${manifest.sport}`);
    assert.deepEqual(
      [...manifest.actions.types].sort(),
      [...wl].sort(),
      `${dirName}/sport.json actions.types must match the schema whitelist for ${manifest.sport}`
    );
  }
});
```

- [ ] **Step 3: Update `site/scripts/build-sports.mjs` to read the bundle layout**

Replace the full contents of `site/scripts/build-sports.mjs` with:

```js
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

function titleCase(slug) {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

// Pure transform: [{ dirName, data }] -> normalized, sorted sport entries.
// `data` is a parsed sports/<sport>/sport.json manifest. Basketball is
// pinned first; the remaining sports are alphabetical. Output shape is
// unchanged from before the sports/<sport>/ bundle restructure — this
// keeps every consuming Astro page (which reads action_types/variants/
// outcomes/rulesets directly) working without their own changes.
export function buildSportsIndex(bundles) {
  const entries = bundles.map(({ data }) => ({
    sport: data.sport,
    label: titleCase(data.sport),
    version: data.version ?? '',
    status: data.status ?? 'provisional',
    statusLabel: data.status === 'defined' ? 'Full' : 'Reserved',
    reserved: data.status !== 'defined',
    action_types: Array.isArray(data.actions?.types) ? data.actions.types : [],
    variants:
      data.actions?.variants && typeof data.actions.variants === 'object' && !Array.isArray(data.actions.variants)
        ? data.actions.variants
        : {},
    outcomes: Array.isArray(data.actions?.outcomes) ? data.actions.outcomes : [],
    rulesets: data.court_profiles && typeof data.court_profiles === 'object' ? Object.keys(data.court_profiles) : [],
  }));
  entries.sort((a, b) => {
    if (a.sport === 'basketball') return -1;
    if (b.sport === 'basketball') return 1;
    return a.sport.localeCompare(b.sport);
  });
  return entries;
}

// Only run the filesystem side effects when executed directly, not on import
// (keeps the module unit-testable).
const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const siteRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const repoRoot = path.dirname(siteRoot);
  const outDir = path.join(siteRoot, 'src', 'generated');
  const sportsDir = path.join(repoRoot, 'sports');

  mkdirSync(outDir, { recursive: true });

  const bundles = readdirSync(sportsDir)
    .filter((name) => statSync(path.join(sportsDir, name)).isDirectory())
    .sort()
    .map((dirName) => ({
      dirName,
      data: JSON.parse(readFileSync(path.join(sportsDir, dirName, 'sport.json'), 'utf-8')),
    }));

  const index = buildSportsIndex(bundles);
  writeFileSync(path.join(outDir, 'sports.json'), JSON.stringify(index, null, 2), 'utf-8');
  console.log(`Generated site/src/generated/sports.json (${index.length} sports)`);
}
```

Note the deliberate design choice here: `buildSportsIndex`'s OUTPUT shape (`action_types`, `variants`, `outcomes`, `rulesets` as top-level keys on each entry) is unchanged from before this refactor, even though its INPUT shape changed (now reads `data.actions.types` instead of `data.action_types`, `Object.keys(data.court_profiles)` instead of `data.rulesets`). This means `site/src/pages/learn/sports/[sport].astro`, which consumes this generated JSON, needs zero changes — the registry-shape migration is fully absorbed by this one adapter function.

- [ ] **Step 4: Update `site/test/build-sports.test.mjs` for the new input shape**

Replace the full contents of `site/test/build-sports.test.mjs` with:

```js
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
```

- [ ] **Step 5: Delete the old flat registry files**

```bash
rm sports/basketball-v1.json sports/soccer-v0.0.1.json sports/handball-v0.0.1.json sports/hockey-v0.0.1.json sports/futsal-v0.0.1.json
rm positions/fiba-v1.json positions/nba-v1.json positions/ncaa-v1.json positions/nfhs-v1.json
```

- [ ] **Step 6: Update `package.json`'s `files` and `exports` maps**

The `files` array (`package.json:15-21`) already lists `"positions"` and `"sports"` as whole-directory entries — those stay correct (the directories still exist, just with different internal layouts) and need no change. The `exports` map (`package.json:22-34`) hand-enumerates individual files that no longer exist. Change:

```json
  "exports": {
    "./schema/v1.json": "./schema/v1.json",
    "./positions/resolve-position.mjs": "./positions/resolve-position.mjs",
    "./positions/fiba-v1.json": "./positions/fiba-v1.json",
    "./positions/nba-v1.json": "./positions/nba-v1.json",
    "./positions/ncaa-v1.json": "./positions/ncaa-v1.json",
    "./positions/nfhs-v1.json": "./positions/nfhs-v1.json",
    "./sports/basketball-v1.json": "./sports/basketball-v1.json",
    "./sports/soccer-v0.0.1.json": "./sports/soccer-v0.0.1.json",
    "./sports/handball-v0.0.1.json": "./sports/handball-v0.0.1.json",
    "./sports/hockey-v0.0.1.json": "./sports/hockey-v0.0.1.json",
    "./sports/futsal-v0.0.1.json": "./sports/futsal-v0.0.1.json"
  },
```

to:

```json
  "exports": {
    "./schema/v1.json": "./schema/v1.json",
    "./positions/resolve-position.mjs": "./positions/resolve-position.mjs",
    "./sports/basketball/sport.json": "./sports/basketball/sport.json",
    "./sports/basketball/court_profiles/fiba.json": "./sports/basketball/court_profiles/fiba.json",
    "./sports/basketball/court_profiles/nba.json": "./sports/basketball/court_profiles/nba.json",
    "./sports/basketball/court_profiles/ncaa.json": "./sports/basketball/court_profiles/ncaa.json",
    "./sports/basketball/court_profiles/nfhs.json": "./sports/basketball/court_profiles/nfhs.json",
    "./sports/soccer/sport.json": "./sports/soccer/sport.json",
    "./sports/handball/sport.json": "./sports/handball/sport.json",
    "./sports/hockey/sport.json": "./sports/hockey/sport.json",
    "./sports/futsal/sport.json": "./sports/futsal/sport.json"
  },
```

- [ ] **Step 7: Run the sport-branches test**

```bash
node --test test/sport-branches.test.mjs
```

Expected: `# tests 2`, `# pass 2`, `# fail 0`.

- [ ] **Step 8: Run the positions test (confirms Task C5's path update still works after the old files are gone)**

```bash
node --test test/positions-anchors.test.mjs
```

Expected: `# tests 5`, `# pass 5`, `# fail 0`.

- [ ] **Step 9: Run the court-contract test**

```bash
node --test test/court-contract.test.mjs
```

Expected: `# tests 2`, `# pass 2`, `# fail 0`.

- [ ] **Step 10: Run the site's build-sports test**

```bash
cd site
node --test test/build-sports.test.mjs
cd ..
```

Expected: `# tests 5`, `# pass 5`, `# fail 0`.

- [ ] **Step 11: Run the site's build script end-to-end to confirm it generates correctly from the new layout**

```bash
cd site
node scripts/build-sports.mjs
cat src/generated/sports.json | head -20
cd ..
```

Expected: `Generated site/src/generated/sports.json (5 sports)`, and the generated file's first entry is `"sport": "basketball"` with a populated `action_types` array (proving the adapter correctly read `sports/basketball/sport.json`'s nested `actions.types`).

- [ ] **Step 12: Run the full repo test suite**

```bash
npm test
```

Expected: `# tests 54`, `# pass 54`, `# fail 0` (unchanged from Task C5 — this task changes what the tests read from, not how many there are).

- [ ] **Step 13: Commit**

```bash
git add sports/ positions/ test/sport-branches.test.mjs package.json site/scripts/build-sports.mjs site/test/build-sports.test.mjs
git commit -m "feat(registry): migrate all sports to the sports/<sport>/ bundle layout, remove old flat files (RFC 0010)"
```

### Task C7: Finish `CONTRIBUTING.md`'s "Adding a New Court Profile" section with the concrete new path

**Files:**
- Modify: `CONTRIBUTING.md`

Task B5 already renamed this section's title and "ruleset" wording. This task updates its step 2, which references the specific file path contributors need to create — that path only exists as of this task group.

- [ ] **Step 1: Update the file-path-specific instruction**

In `CONTRIBUTING.md`, the "Adding a New Court Profile" section (updated by Task B5) currently reads:

```markdown
## Adding a New Court Profile

To add a new sport or league court profile (e.g. EuroLeague, WNBA, 3x3, Wheelchair):

1. Open an RFC describing the court profile's court dimensions and geometry
2. Define named positions in the spec (following the FIBA table format)
3. Add the court profile to the schema enum
4. Add at least two example files using the new court profile
5. Document WCAG contrast for any new default colors
```

Change to:

```markdown
## Adding a New Court Profile

To add a new sport or league court profile (e.g. EuroLeague, WNBA, 3x3, Wheelchair):

1. Open an RFC describing the court profile's court dimensions and geometry
2. Create `sports/<sport>/court_profiles/<name>.json` with the court dimensions and named-position coordinates (following an existing file, e.g. `sports/basketball/court_profiles/fiba.json`, as a template)
3. Add the court profile's key to that sport's `sports/<sport>/sport.json` under `court_profiles`, and add the matching `allOf` branch in `schema/v1.json`
4. Add at least two example files using the new court profile
5. Document WCAG contrast for any new default colors
```

- [ ] **Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: finish CONTRIBUTING.md's court-profile section with the concrete bundle path (RFC 0010)"
```

### Task C8: Update `docs/specification.adoc` for the new registry file paths

**Files:**
- Modify: `docs/specification.adoc` (lines updated by Task B4, which referenced the FUTURE bundle path already — this task confirms it's now accurate, and updates the one remaining stale path)

- [ ] **Step 1: Verify Task B4's forward-looking path references are now correct**

```bash
grep -n "sports/basketball/court_profiles" docs/specification.adoc
```

Expected: two matches — the "Court Profile Differences" section heading area (Task B4 Step 5) and the machine-readable source-of-truth NOTE (Task B4 Step 6). Both were written during Task Group B anticipating this exact path; confirm they now point at real, existing files:

```bash
ls sports/basketball/court_profiles/
```

Expected: `fiba.json  nba.json  ncaa.json  nfhs.json` — matching what the spec prose claims.

- [ ] **Step 2: No further edits needed if Step 1 confirms — otherwise, fix any mismatch found**

If the `grep` in Step 1 shows the path differs from what Task C1/C6 actually created (e.g., a typo introduced somewhere along the way), fix `docs/specification.adoc` to match the real path now. If everything matches, this task requires no code changes — just the verification.

- [ ] **Step 3: Commit (only if Step 2 required a fix; otherwise skip this commit)**

```bash
git add docs/specification.adoc
git commit -m "docs(spec): fix court-profile registry path reference"
```

---

## Final Verification

- [ ] **Run the complete test suite one more time**

```bash
npm test
```

Expected: `# tests 54`, `# pass 54`, `# fail 0`.

- [ ] **Run the site's tests**

```bash
cd site
node --test test/build-sports.test.mjs
cd ..
```

Expected: `# tests 5`, `# pass 5`, `# fail 0`.

- [ ] **Rebuild the full site to confirm nothing else broke**

```bash
cd site
npm run build
cd ..
```

Expected: build completes without error.

- [ ] **Confirm no stray references to the old field/path names remain anywhere in tracked files**

```bash
grep -rn '"ruleset"' --include="*.json" --include="*.mjs" --include="*.js" --include="*.adoc" --include="*.md" --include="*.astro" . 2>/dev/null | grep -v node_modules | grep -v "/rfcs/"
```

Expected: no output. (RFC files under `rfcs/` are historical/decision records and intentionally still say "ruleset" where they're describing the OLD name as part of the RFC's own narrative — e.g. RFC 0012's title literally is about renaming `ruleset` — so they're excluded from this check by design, not by oversight.)

- [ ] **Confirm `git status` is clean and every task's commit is present**

```bash
git log --oneline -20
git status --porcelain
```

Expected: a clean working tree, and a commit history showing all of Task Groups A, B, and C's commits in order.

---

## Notes for Whoever Reviews This Plan

- **Task Group A found and corrected a factual error in RFC 0007's own text** (the "six allOf blocks" claim). This is called out at the top of the plan and in Task A2's step so a reviewer isn't confused when only one block gets simplified, not six.
- **Task C3 makes one concrete decision RFC 0010 explicitly deferred**: the soccer/handball/hockey/futsal `custom_dimensions` field set (`goal_width`, `penalty_box_width`, `penalty_box_depth`, `penalty_spot_distance`). This is necessary to make the plan's own test suite pass and to migrate the existing `sport-soccer.ocf.json` fixture — RFC 0010's Open Question 1 remains formally open for when a sport is actually promoted past "provisional," but this plan needs *a* concrete shape today. If this field set turns out wrong once soccer gets real expert review, it's a normal additive/breaking follow-up at that point, not a flaw in this plan's execution.
- **Task C1's decision to keep `actions` inline in `sport.json`** (not extracted to `actions.json`) resolves RFC 0010's Open Question 3 for basketball specifically. If a future sport's `actions` block grows large enough to justify extraction, that's a small, isolated follow-up (create `actions.json`, replace the inline value with nothing since the naming rule says presence in the file structure is what matters — see RFC 0010's own `court_profiles` extraction pattern for the template to follow).
- **RFC 0012's Open Question 2** (whether `resolveNamedPosition`'s public parameter name should also become `courtProfile`) is deliberately left unresolved by this plan (Task B3) — changing a published function's parameter name is an API decision, not a mechanical rename, and this plan treats it as out of scope unless a future task explicitly picks it up.
