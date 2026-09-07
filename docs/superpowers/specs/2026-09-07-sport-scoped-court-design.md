# Sport-Scoped Court & Ruleset Design

## Status

Draft — brainstormed 2026-09-07, not yet approved for implementation.

## Problem

`court.ruleset` is a pure-basketball enum (`["fiba", "nba", "ncaa", "nfhs", "custom"]`,
`schema/v1.json:13`) with basketball-named `custom_dimensions` fields
(`basket_from_baseline`, `three_point_distance`, `paint_width`, `paint_depth`,
`free_throw_distance` — all required when `ruleset: "custom"`). Nothing in the
schema, either validator (TS/Python), or the renderer cross-checks `sport`
against `court.ruleset`. A document declaring `sport: "soccer"` with
`court.ruleset: "fiba"` is schema-valid today, even though it's nonsensical.

This was already recognized as a gap: RFC 0003 (Sport Scoping, Accepted)
listed "rulesets + named-position catalogs" as sport-scoped in its own design
table, but the implementation only ever built the `actions[].type` whitelist
gating — the ruleset/court-dimensions coupling was never built. The user's own
`v2-program-strategy` memory independently flagged this as a known, deferred
v2 topic.

**Confirmed via research** (a fresh subagent read the validator, positions
files, renderer, and one checked-in non-basketball example — see "Evidence"
below): a `sports/<sport>-v*.json` registry already exists and already
declares a `rulesets` array per sport (e.g. `basketball-v1.json` →
`["fiba","nba","ncaa","nfhs"]`, every provisional sport → `[]`). It is dead
data — read only by a convention test and the site build, never consulted by
`schema/v1.json` or either validator runtime.

## Evidence (from research, not assumption)

- **Validator (TS + Python)**: `court-dimensions.ts` / the Python equivalent
  hold a hardcoded `{fiba, nba, ncaa, nfhs}` → `{length, width}` map, used
  only for the `ENTITY_OFFCOURT` quality check — a pure axis-aligned
  rectangle bound test, not basketball-zone-aware. `ruleset` is read from
  `court.ruleset`; `sport` is never cross-checked against it anywhere in
  either validator's source.
- **`positions/*.json`** (`fiba-v1.json`, `nba-v1.json`, `ncaa-v1.json`,
  `nfhs-v1.json`): one file per ruleset, 1:1, each a flat static map of
  `{registry_id, ruleset, unit, court: {length, width}, positions: {name:
  {x,y}, ...}}`. Basketball position names (`top_of_the_key`, `left_wing`,
  `paint_center`, `high_post_left`, `backcourt.*`, `inbound.*`, ~35 entries
  per file) are hardcoded JSON keys, not derived from any naming convention.
  `resolve-position.mjs:6` hardcodes `RULESETS = ["fiba","nba","ncaa","nfhs"]`
  and throws on anything else — `custom` and any future ruleset are entirely
  unsupported by this loader today.
- **Renderer**: fully basketball-hardcoded court drawing
  (`build-court.ts:28-95` draws paint rectangle, free-throw circle,
  three-point arc, backboard — no abstraction for "sport court markings"
  exists). Independently of this design's scope, the renderer also
  currently ignores `court.ruleset` entirely for dimensions
  (`coordinate-transformer.ts:8-16` always uses `FIBA_DEFAULTS` unless
  `custom_dimensions` is explicitly present) — a real, separate bug, noted
  here for awareness but out of scope for this design.
- **`sports/basketball-v1.json`** (full content):
  ```json
  {
    "sport": "basketball", "version": "1.0.0", "status": "defined",
    "action_types": ["move","cut","screen","defend","dribble","pass","shoot","rebound","pickup"],
    "variants": { "cut": [...], "screen": [...], "defend": [...], "pass": [...], "shoot": [...], "rebound": [...] },
    "outcomes": ["make","miss","turnover","steal","foul"],
    "rulesets": ["fiba","nba","ncaa","nfhs"]
  }
  ```
  Contains **zero** geometric information — no court dimensions, no zone
  names. All geometry lives in `positions/*.json`, entirely ruleset-scoped.
- **`sports/soccer-v0.0.1.json`** (full content): `action_types` set,
  `variants: {}`, `outcomes: []`, `rulesets: []`.
- **The concrete workaround this gap produces today** —
  `examples/sport-soccer.ocf.json`:
  ```json
  "sport": "soccer",
  "court": { "ruleset": "custom", "type": "full_court", "custom_dimensions": {
    "unit": "m", "length": 105, "width": 68,
    "basket_from_baseline": 0, "three_point_distance": 0,
    "paint_width": 40.3, "paint_depth": 16.5, "free_throw_distance": 11
  }}
  ```
  `paint_width`/`paint_depth` are repurposed to mean the penalty-box
  width/depth (40.3m × 16.5m matches a real penalty area); `basket_from_baseline`
  and `three_point_distance` are zeroed out as meaningless.
  This is the exact modeling awkwardness this design fixes.
- **`$schema` URLs are placeholders**: every `sports/*.json` and
  `positions/*.json` file declares a `$schema` pointing at
  `https://opencoachingformat.org/registry/{sports,positions}/*-schema-v1.json`
  — neither file exists anywhere in the repo or has ever been published.
  These were aspirational from the start, not a regression.

## Decision

### 1. `sport` gates `court.ruleset` (whitelist, additive)

The existing `allOf` pattern that gates `actions[].type` per `sport`
(`schema/v1.json:822-914`) gets a parallel block gating `court.ruleset`,
sourced from each `sports/<sport>-v*.json`'s (now load-bearing, not dead)
`rulesets` array:

- `sport` absent or `"basketball"` → `court.ruleset` must be one of
  `["fiba","nba","ncaa","nfhs","custom"]` (today's behavior, unchanged).
- `sport: "soccer"` (and every other currently-provisional sport, whose
  registry entry has `rulesets: []`) → `court.ruleset` must be `"custom"`.
  This already validates the checked-in `sport-soccer.ocf.json` correctly
  as-is (it already uses `"custom"`).
- Adding a real ruleset for soccer later (e.g. a future `"fifa"` entry) is
  purely additive: append to the registry array, add the matching schema
  `allOf` case and a `positions/fifa-v1.json` — no breaking change.

### 2. Ruleset = one member of a sport's family, not a top-level concept

A ruleset always belongs to exactly one sport. A new *variant* within
basketball (e.g. a hypothetical "hot-zone" ruleset with an extra scoring
zone) is just another entry in `sports/basketball-v1.json`'s `rulesets`
array plus its own `positions/hot-zone-v1.json` — no new schema construct.
This deliberately keeps rule-level basketball variants (which the user
raised, e.g. a temporary 4-point hot zone) inside the existing
sport→ruleset→positions layering rather than inventing a fourth concept.

### 3. `court_contract`: sport defines a dimension vocabulary, ruleset fills it

New field on `sports/<sport>-v*.json`:

```json
"court_contract": {
  "required_dimensions": ["length", "width"]
}
```

Deliberately minimal — only what's geometrically load-bearing for the
existing `ENTITY_OFFCOURT` bounding-box check and for the renderer to draw
*something*. This is NOT a mandate that every ruleset must define
`basket_from_baseline`/`three_point_distance`/etc.; those stay
basketball-specific fields on `court.custom_dimensions`, gated by `sport`
the same way `actions[].type` already is (see point 4). A future sport can
declare additional `required_dimensions` its own rulesets must supply
(e.g. soccer might eventually require `goal_width`), but this is scoped
narrowly now rather than over-designed for hypothetical future sports.

### 4. `custom` = "this sport's structure, different numbers" — not "anything goes"

`court.custom_dimensions` becomes sport-scoped, mirroring the
`actions[].type` `allOf` pattern:

- `sport` absent or `"basketball"` → `custom_dimensions` requires today's
  exact basketball field set (`unit`, `length`, `width`,
  `basket_from_baseline`, `three_point_distance`, `paint_width`,
  `paint_depth`, `free_throw_distance`) — unchanged from today.
- `sport: "soccer"` → `custom_dimensions` requires a **soccer-specific**
  field set instead (e.g. `unit`, `length`, `width`, `goal_width`,
  `penalty_box_width`, `penalty_box_depth`, `penalty_spot_distance` — exact
  field list is a follow-up detail, not decided here). Critically:
  `custom_dimensions` for a soccer document would **never offer**
  `paint_width`/`basket_from_baseline` as valid keys at all — the
  basketball-vocabulary reuse the current soccer example is forced into
  goes away entirely, replaced by `additionalProperties: false` soccer-shaped
  object.
- This makes `custom` mean exactly what the user described: "a special
  court within a given sport" (e.g. a scaled-down youth court, still
  structurally a basketball court), never a sport-agnostic free-form
  object.

### 5. Named positions: sport-vocabulary / ruleset-fill / ruleset-exclude

Three distinct states per named position, replacing today's flat
per-ruleset-file-only model:

1. **Sport vocabulary** — the open set of names meaningful for a sport
   (basketball's ~35 names today). Not enumerated anywhere new; stays
   implicit as "whatever any basketball ruleset happens to define," since
   closing this list isn't needed for the problem at hand and would add
   rigidity without a clear benefit.
2. **Ruleset fill** — a `positions/<ruleset>-v1.json` file supplies
   coordinates for a subset of the vocabulary, exactly as today.
3. **Ruleset exclusion** — NEW: a ruleset can list names it deliberately
   does not support, distinguishing "not applicable here" from "typo /
   genuinely unknown":
   ```json
   {
     "ruleset": "minibasketball",
     "positions": { "basket": {...}, "paint_center": {...}, ... },
     "not_applicable": ["left_wing", "right_wing", "left_corner", "right_corner"]
   }
   ```
   A document under `ruleset: "minibasketball"` referencing `left_wing`
   gets a distinct error (position not applicable under this ruleset) —
   not the generic "unknown named position" a real typo would also
   produce. `resolve-position.mjs` (and the validator's equivalent) needs
   to check `not_applicable` before falling through to "unknown."

## Explicitly out of scope

- **Funino / multi-goal topology** (4 goals in soccer, 4 baskets in
  basketball): a fundamentally different court topology assumption ("one
  primary target per half") is baked into named positions and the
  renderer today. Solving this requires its own design pass, not a detail
  bolted onto this one.
- **Rule-driven scoring changes** (e.g. minibasketball: all shots outside
  the paint count as 3 points regardless of the arc). This is a scoring/
  rules concept, not a court-geometry concept, and is out of scope here.
- **Renderer's existing ruleset-blindness bug** (always draws FIBA
  dimensions unless `custom_dimensions` is explicitly set, ignoring
  nba/ncaa/nfhs distinctions) — a real, pre-existing, separate bug,
  independent of this design; worth its own fix, not folded in here.

## Open questions (not yet resolved)

- Exact `court_contract`/`custom_dimensions` field list for soccer and the
  other provisional sports — deferred until a sport actually needs to be
  promoted past `"provisional"` status, per this session's own
  scope-decision heuristic (don't design for hypothetical future
  requirements the current work doesn't need).
- Whether `court_contract.required_dimensions` should also gate the
  renderer's rendering-capability check (e.g. refuse to render a sport
  with no registered geometry), or stay purely a schema/validator concern.
- Whether `not_applicable` on `positions/*.json` should be validated
  against the sport's vocabulary at the registry level (catch a typo in
  the exclusion list itself), or left unchecked since these are
  maintainer-authored, not user-authored, files.
- Whether this is additive enough to land inside the still-open v2.0.0
  program (per `v2-program-strategy` memory: no final v2.0.0 release until
  all breaking changes land) or deserves its own v2.x follow-up — needs a
  breaking-change audit once the exact schema diff is drafted (the
  `custom_dimensions` field-set change for non-basketball sports is
  additive since no non-basketball document currently validates
  correctly anyway; the basketball path is unchanged).

## Non-goals of this document

This is a design record of a brainstorming session, not an implementation
plan. No schema, validator, or renderer code changes have been made. Next
step (if approved) is `superpowers:writing-plans` for a task-by-task
implementation plan, likely split across the `spec` repo (schema +
registry files) and the `ocf-validator` repo (positions-loader / resolve
logic in both languages).
