# RFC 0010 — Sport-Scoped Court & Ruleset

| Field       | Value                                             |
|-------------|----------------------------------------------------|
| RFC Number  | 0010                                              |
| Title       | Sport-scoped `court.ruleset` and `custom_dimensions`; named-position exclusion |
| Author(s)   | opencoachingformat maintainers                    |
| Created     | 2026-09-07                                        |
| Status      | Draft — brainstormed and recorded, not yet approved for implementation |
| Affects     | Schema + Spec + Validator (TS + Python) + registry data (`sports/*.json`, `positions/*.json`) |
| Version     | Targets OCF v2.0.0 (program item 5 of 5 — see the v2.0.0 program overview) |

This RFC delivers the sport→ruleset/named-position coupling RFC 0003's own
Detailed Design table specified but never implemented (see RFC 0003
Amendments, 2026-09-07).

---

## Summary

Today, `court.ruleset` is a pure-basketball enum (`fiba`/`nba`/`ncaa`/`nfhs`/
`custom`) and `court.custom_dimensions` has only basketball-named required
fields, with no mechanism anywhere (schema, either validator, or the
renderer) cross-checking `sport` against `court.ruleset`. A document
declaring `sport: "soccer"` with `court.ruleset: "fiba"` is schema-valid
today. This RFC makes `sport` gate `court.ruleset` (via the already-existing
but currently-dead `sports/*.json` registry `rulesets` array), makes
`custom_dimensions` sport-scoped instead of basketball-only, and adds a
mechanism for a ruleset to explicitly exclude named positions that don't
apply to it.

---

## Motivation

RFC 0003's Detailed Design table classified "rulesets + named-position
catalogs" as sport-scoped concepts, alongside the action-type whitelist it
did implement. That classification was never followed through. This
produces a real, checked-in modeling problem today:
`examples/sport-soccer.ocf.json` must declare `court.ruleset: "custom"` and
populate the basketball-shaped `custom_dimensions` object by repurposing
basketball fields for soccer semantics — `paint_width`/`paint_depth`
(40.3m × 16.5m) mean the penalty-box width/depth, `basket_from_baseline`/
`three_point_distance` are zeroed out as meaningless.

A `sports/<sport>-v*.json` registry already exists and already declares a
`rulesets` array per sport (`basketball-v1.json` →
`["fiba","nba","ncaa","nfhs"]`; every provisional sport → `[]`) — confirmed
via research to be read only by a convention test and the site build,
never consulted by `schema/v1.json` or either validator runtime. This RFC
activates that dead data rather than inventing a new mechanism.

Sequenced last (item 5) among the v2.0.0 program's five items because it
depends on `sport` reliably being present (RFC 0007) to be meaningful as a
gating mechanism — a `sport`-less document defaulting silently to
basketball would undermine a whitelist keyed on `sport`.

---

## Detailed Design

### 1. `sport` gates `court.ruleset` (whitelist, additive)

A new `allOf` block, parallel to the existing `actions[].type` gating
(`schema/v1.json:822-914`), sourced from each `sports/<sport>-v*.json`'s
`rulesets` array:

```jsonc
// sport absent or "basketball" (unchanged from today):
{ "if": { /* sport absent or basketball */ },
  "then": { "properties": { "court": { "properties": { "ruleset": {
    "enum": ["fiba","nba","ncaa","nfhs","custom"] } } } } } }

// sport: "soccer" (and every other currently-provisional sport, whose
// registry rulesets array is []):
{ "if": { "properties": { "sport": { "const": "soccer" } } },
  "then": { "properties": { "court": { "properties": { "ruleset": {
    "const": "custom" } } } } } }
```

This already validates `sport-soccer.ocf.json` correctly as-is (it already
uses `"custom"`). Adding a real ruleset for soccer later is purely additive:
append to the registry array, add the matching `allOf` case, add a
`positions/<name>-v1.json`.

### 2. Ruleset = one member of a sport's family

A ruleset always belongs to exactly one sport. A new *variant* within an
existing sport (e.g. a hypothetical alternate-scoring basketball ruleset) is
just another entry in that sport's `rulesets` array plus its own
`positions/<name>-v1.json` — no new schema construct. This deliberately
keeps rule-level sport variants inside the existing
sport→ruleset→positions layering rather than inventing a fourth concept.

### 3. `court_contract`: sport defines a minimal dimension vocabulary

New field on `sports/<sport>-v*.json`:

```json
"court_contract": { "required_dimensions": ["length", "width"] }
```

Deliberately minimal — only what's geometrically load-bearing for the
existing `ENTITY_OFFCOURT` bounding-box check and for a renderer to draw
*something*. Not a mandate that every ruleset must define
`basket_from_baseline`/`three_point_distance`/etc.; those stay
basketball-specific fields on `custom_dimensions` (point 4). A future sport
can declare additional `required_dimensions` its own rulesets must supply.

### 4. `custom_dimensions` becomes sport-scoped

Mirrors the `actions[].type` `allOf` pattern:

- `sport` absent or `"basketball"` → today's exact basketball field set,
  unchanged (`unit`, `length`, `width`, `basket_from_baseline`,
  `three_point_distance`, `paint_width`, `paint_depth`,
  `free_throw_distance`).
- `sport: "soccer"` → a **soccer-specific** field set instead (exact field
  list not decided in this RFC — e.g. `unit`, `length`, `width`,
  `goal_width`, `penalty_box_width`, `penalty_box_depth`,
  `penalty_spot_distance`). Critically: a soccer document's
  `custom_dimensions` would never offer `paint_width`/`basket_from_baseline`
  as valid keys at all (`additionalProperties: false`, soccer-shaped
  object) — the basketball-vocabulary reuse in today's example goes away.
- This makes `custom` mean "a special court within a given sport" (e.g. a
  scaled-down youth basketball court, still structurally a basketball
  court), never a sport-agnostic free-form object.

### 5. Named positions: sport-vocabulary / ruleset-fill / ruleset-exclude

Three distinct states, replacing today's flat per-ruleset-file-only model:

1. **Sport vocabulary** — the open set of names meaningful for a sport
   (basketball's ~35 names today). Stays implicit (not enumerated
   separately) — closing this list adds rigidity without a clear benefit
   for the problem at hand.
2. **Ruleset fill** — a `positions/<ruleset>-v1.json` file supplies
   coordinates for a subset, exactly as today.
3. **Ruleset exclusion** — NEW: a ruleset can list names it deliberately
   does not support, distinguishing "not applicable here" from "typo /
   genuinely unknown":
   ```json
   { "ruleset": "minibasketball",
     "positions": { "basket": {...}, "paint_center": {...} },
     "not_applicable": ["left_wing", "right_wing", "left_corner", "right_corner"] }
   ```
   A document under a ruleset referencing an excluded name gets a distinct
   error, not the generic "unknown named position" a real typo would also
   produce. `resolve-position.mjs` (and the validator's equivalent in both
   languages) needs to check `not_applicable` before falling through to
   "unknown."

---

## Drawbacks

- `custom_dimensions` becoming sport-scoped is a breaking shape change for
  any existing non-basketball `custom` document — but the research
  confirmed exactly one such document exists in this codebase
  (`sport-soccer.ocf.json`) and it needs migrating either way, since it's
  currently modeling penalty-box dimensions as basketball paint dimensions.
- Adds a second `allOf` gating axis (ruleset, alongside the existing
  action-type one) — more conditional-schema surface area to keep in sync
  as sports are added, though the pattern is already established and
  proven for actions.

---

## Alternatives Considered

- **Leave `custom_dimensions` as one shared basketball-shaped object with
  optional sport-specific extra fields bolted on**: considered and
  rejected per explicit user feedback — this would still let a soccer
  document technically choose basketball fields, and doesn't match the
  user's stated model that `custom` means "special court *within* a sport,"
  not "a pool of every sport's fields to pick from."
- **A generic `zones[]`/coordinate-list structure instead of fixed named
  fields**, to future-proof for hot-zone-style rule variants or Funino-style
  multi-goal topology: considered, explicitly deferred (see "Explicitly out
  of scope" below) — over-designing for hypothetical future requirements
  this RFC doesn't need to solve now, per this project's own
  scope-decision heuristic.

---

## Backwards Compatibility

- [ ] No breaking changes (additive only)
- [x] Breaking change — requires major version bump (the `custom_dimensions`
      field-set change for non-basketball sports; the basketball path is
      unchanged, and no other non-basketball document currently validates
      meaningfully anyway)
- [ ] Deprecates existing fields (list them)

---

## Explicitly Out of Scope

- **Funino / multi-goal topology** (4 goals in soccer, 4 baskets in
  basketball) — a fundamentally different court topology assumption ("one
  primary target per half") is baked into named positions and the renderer
  today. Needs its own design pass.
- **Rule-driven scoring changes** (e.g. minibasketball: all shots outside
  the paint count as 3 points) — a scoring/rules concept, not court
  geometry.
- **The renderer's existing ruleset-blindness bug** (always draws FIBA
  dimensions unless `custom_dimensions` is explicitly set, ignoring
  nba/ncaa/nfhs distinctions) — a real, pre-existing, separate bug,
  independent of this RFC.

---

## Open Questions

1. Exact `court_contract`/`custom_dimensions` field list for soccer and
   other provisional sports — deferred until a sport is actually promoted
   past "provisional" status.
2. Whether `court_contract.required_dimensions` should also gate a
   renderer's rendering-capability check, or stay a schema/validator-only
   concern.
3. Whether `not_applicable` on `positions/*.json` should itself be
   validated against the sport's vocabulary (catch a typo in the exclusion
   list), or left unchecked since these are maintainer-authored files.
4. Whether this lands inside the still-open v2.0.0 program window or
   deserves its own v2.x follow-up — needs a breaking-change audit once the
   exact schema diff is drafted.

---

## References

- RFC 0003 (Sport Scoping) — this RFC delivers the ruleset/named-position
  sport-scoping RFC 0003's own design table specified but never
  implemented; see RFC 0003 Amendments.
- RFC 0007 (`sport` Required) — this RFC's whitelist mechanism depends on
  `sport` reliably being present.
- Design doc: `docs/superpowers/specs/2026-09-07-sport-scoped-court-design.md`
  (full research evidence and design rationale).
- `v2-program-strategy` memory — "Custom-court is a v2 multisport topic,"
  the original decision to fold this into v2 sport-scoping work.
