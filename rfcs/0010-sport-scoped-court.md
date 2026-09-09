# RFC 0010 — Sport-Scoped Court & `court_profile`

| Field       | Value                                             |
|-------------|----------------------------------------------------|
| RFC Number  | 0010                                              |
| Title       | Sport-scoped `court.court_profile` and `custom_dimensions`; named-position exclusion; `sports/<sport>/` registry bundle |
| Author(s)   | opencoachingformat maintainers                    |
| Created     | 2026-09-07 (revised 2026-09-10 — see Amendments)  |
| Status      | Accepted (implemented)                            |
| Affects     | Schema + Spec + Validator (TS + Python) + registry data (replaces `sports/*.json` and `positions/*.json` with `sports/<sport>/` bundles) |
| Version     | Targets OCF v2.0.0 (program item 6 of 7 — see the [v2.0.0 program overview](../docs/superpowers/specs/2026-09-07-v2-program-overview.md)) |

This RFC delivers the sport→court/named-position coupling RFC 0003's own
Detailed Design table specified but never implemented (see RFC 0003
Amendments, 2026-09-07). It depends on RFC 0012 (rename `ruleset` to
`court_profile`) and is written entirely in the post-rename terminology.

---

## Amendments (2026-09-10)

The original 2026-09-07 design used `ruleset` throughout and proposed
flat `sports/<sport>-v*.json` + `positions/<ruleset>-v1.json` registry
files. A same-day follow-up design session (2026-09-10) revised both:

1. **Terminology**: `ruleset` → `court_profile` everywhere (see RFC
   0012 — the old name promised game rules the field never held; it was
   always pure court geometry).
2. **Registry structure**: flat files replaced with a per-sport bundle
   directory, `sports/<sport>/`, containing `sport.json` (the manifest)
   plus one file per court profile under `court_profiles/<name>.json`.
   A sport-level `positions.json` was considered and explicitly
   rejected — see "Registry Structure" below for why.
3. Two extension points were added to the sport manifest — `equipment`
   and `coordinate_system` — as placeholders for future work (e.g.
   puck-based sports, non-Cartesian court layouts for a sport like
   American football), deliberately unimplemented beyond declaring the
   field exists. See "Explicitly Out of Scope."

The rest of this document reflects the revised design.

---

## Summary

Today, `court.ruleset` (soon `court.court_profile`, see RFC 0012) is a
pure-basketball enum (`fiba`/`nba`/`ncaa`/`nfhs`/`custom`) and
`court.custom_dimensions` has only basketball-named required fields, with
no mechanism anywhere (schema, either validator, or the renderer)
cross-checking `sport` against the court profile. A document declaring
`sport: "soccer"` with `court.court_profile: "fiba"` is schema-valid
today. This RFC makes `sport` gate `court.court_profile`, makes
`custom_dimensions` sport-scoped instead of basketball-only, adds a
mechanism for a court profile to explicitly exclude named positions that
don't apply to it, and restructures the registry data these mechanisms
read from a flat file-per-ruleset layout into a `sports/<sport>/` bundle
per sport.

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
activates that dead data rather than inventing a new mechanism, and — per
the 2026-09-10 design session — restructures it into a proper bundle
while doing so, rather than growing the existing flat-file layout further.

Sequenced last among the v2.0.0 program's items (after RFC 0007 and RFC
0012) because it depends on `sport` reliably being present (RFC 0007) to
be meaningful as a gating mechanism, and is written in terms of
`court_profile` (RFC 0012), not the field's current name.

---

## Detailed Design

### 1. Registry structure: `sports/<sport>/` bundle

Replaces today's flat `sports/<sport>-v*.json` + `positions/<ruleset>-v1.json`
files with one directory per sport:

```
sports/
  basketball/
    sport.json                    # manifest — see below
    actions.json                  # optional extraction of sport.json's
                                   # "actions" field, if it grows large
                                   # enough to warrant its own file
    court_profiles/
      fiba.json
      nba.json
      ncaa.json
      nfhs.json
  soccer/
    sport.json
    court_profiles/                # empty today — soccer has no
                                    # promoted court profiles yet
```

**Naming rule**: a field extracted out of `sport.json` into its own file
is named after its JSON path within the manifest, not an arbitrary
label — `court_profiles.fiba` extracted becomes
`court_profiles/fiba.json`; `actions` extracted becomes `actions.json`.
This keeps the bundle self-documenting: the directory listing mirrors
the manifest's own shape.

`sport.json` manifest shape:

```jsonc
{
  "sport": "basketball",
  "version": "2.0.0",
  "status": "defined",

  // Attribution/provenance metadata — new in this RFC. Purely
  // descriptive, no validator behavior depends on these fields.
  "source": "https://www.fiba.basketball/documents/official-basketball-rules.pdf",
  "maintainers": ["opencoachingformat maintainers"],
  "reviewed_by": null,
  "review_date": null,

  // Extension points for future work (RFC 0013/0014 territory, and
  // beyond) — declared now, not yet given any behavior beyond their
  // default. See "Explicitly Out of Scope."
  "equipment": { "type": "ball" },
  "coordinate_system": { "type": "cartesian_2d" },

  "actions": {
    "types": ["move", "cut", "screen", "..."],
    "variants": { "cut": ["backdoor", "..."], "...": ["..."] },
    "outcomes": ["make", "miss", "..."]
  },

  "court_contract": { "required_dimensions": ["length", "width"] },

  "court_profiles": {
    "fiba": {},   // presence-only if extracted to court_profiles/fiba.json;
    "nba": {},    // inline object here if not extracted
    "ncaa": {},
    "nfhs": {}
  }
}
```

**Attribution fields** (`source`, `maintainers`, `reviewed_by`,
`review_date`): new in this RFC, purely descriptive metadata with no
validator behavior attached. `source` points at whatever official
reference the sport/court-profile data was derived from (a rulebook PDF,
a federation's published dimensions page, etc.) — optional, since a
provisional sport may not have one yet. `maintainers` lists who
authored/maintains this bundle in this repo (attribution for community
contributions, not a governance mechanism). `reviewed_by`/`review_date`
are `null` until someone with relevant standing has reviewed the data;
this RFC does not define who qualifies as a reviewer or what "reviewed"
means beyond the field's presence — see RFC 0015 (Sport/Court-Profile
Verification Tiers) for the larger trust-hierarchy concept these fields
are a simpler precursor to, deliberately kept separate and out of this
RFC's scope.

**Why no sport-level `positions.json`**: considered and rejected.
RFC 0003/0010's original design already established that a sport's
named-position *vocabulary* is deliberately implicit — "whatever any
court profile of this sport happens to define," not a separately
enumerated list, because closing that list adds rigidity without a
clear benefit. Given that, there is no sport-wide *data* to hold in a
`positions.json`: coordinates belong to a specific court profile (item 4
below), and `not_applicable` exclusion (item 5 below) is a statement one
court profile makes about itself, not something the sport as a whole
asserts. A file with no content of its own has no reason to exist.

### 2. `sport` gates `court.court_profile` (whitelist, additive)

A new `allOf` block, parallel to the existing `actions[].type` gating
(`schema/v1.json:822-914`), sourced from each sport bundle's
`court_profiles` keys:

```jsonc
// sport absent or "basketball" (unchanged from today):
{ "if": { /* sport absent or basketball */ },
  "then": { "properties": { "court": { "properties": { "court_profile": {
    "enum": ["fiba","nba","ncaa","nfhs","custom"] } } } } } }

// sport: "soccer" (and every other currently-provisional sport, whose
// bundle has no court_profiles yet):
{ "if": { "properties": { "sport": { "const": "soccer" } } },
  "then": { "properties": { "court": { "properties": { "court_profile": {
    "const": "custom" } } } } } }
```

This already validates `sport-soccer.ocf.json` correctly as-is (it
already uses `"custom"`, and only needs the field renamed per RFC 0012).
Adding a real court profile for soccer later is purely additive: add a
key under `sports/soccer/court_profiles`, add the matching `allOf` case.

### 3. Court profile = one member of a sport's family

A court profile always belongs to exactly one sport. A new *variant*
within an existing sport (e.g. a hypothetical alternate-scoring
basketball court profile) is just another entry in that sport's
`court_profiles` — no new schema construct. This deliberately keeps
sport-court-profile variants inside the existing sport→court_profile
layering rather than inventing a fourth concept.

### 4. `court_contract`: sport defines a minimal dimension vocabulary

On `sports/<sport>/sport.json`:

```json
"court_contract": { "required_dimensions": ["length", "width"] }
```

Deliberately minimal — only what's geometrically load-bearing for the
existing `ENTITY_OFFCOURT` bounding-box check. Not a mandate that every
court profile must define `basket_from_baseline`/`three_point_distance`/
etc.; those stay basketball-specific fields on `custom_dimensions`
(point 5). A future sport can declare additional `required_dimensions`
its own court profiles must supply. Confirmed schema/validator-only
(2026-09-10 decision) — does not gate any renderer capability check,
consistent with RFC 0011's separation of spec/validator concerns from
rendering.

### 5. `custom_dimensions` becomes sport-scoped

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

### 6. Named positions: sport-vocabulary / court-profile-fill / court-profile-exclude

Three distinct states, replacing today's flat per-file-only model:

1. **Sport vocabulary** — the open set of names meaningful for a sport
   (basketball's ~35 names today). Stays implicit (not enumerated
   separately) — closing this list adds rigidity without a clear benefit
   for the problem at hand.
2. **Court-profile fill** — a `sports/<sport>/court_profiles/<name>.json`
   file supplies coordinates for a subset, exactly as today's
   `positions/<ruleset>-v1.json` did.
3. **Court-profile exclusion** — NEW: a court profile can list names it
   deliberately does not support, distinguishing "not applicable here"
   from "typo / genuinely unknown":
   ```json
   { "court_profile": "minibasketball",
     "positions": { "basket": {}, "paint_center": {} },
     "not_applicable": ["left_wing", "right_wing", "left_corner", "right_corner"] }
   ```
   A document under a court profile referencing an excluded name gets a
   distinct error, not the generic "unknown named position" a real typo
   would also produce. `resolve-position.mjs` (and the validator's
   equivalent in both languages) needs to check `not_applicable` before
   falling through to "unknown."

   `not_applicable` itself stays unchecked against the sport's own
   vocabulary (decision, 2026-09-10) — these files are
   maintainer-authored, not end-user content, so a typo surfaces quickly
   through normal use/testing rather than needing its own validation
   layer (YAGNI).

---

## Drawbacks

- `custom_dimensions` becoming sport-scoped is a breaking shape change for
  any existing non-basketball `custom` document — but the research
  confirmed exactly one such document exists in this codebase
  (`sport-soccer.ocf.json`) and it needs migrating either way, since it's
  currently modeling penalty-box dimensions as basketball paint dimensions.
- Adds a second `allOf` gating axis (court profile, alongside the existing
  action-type one) — more conditional-schema surface area to keep in sync
  as sports are added, though the pattern is already established and
  proven for actions.
- The registry bundle restructure touches every consumer that reads
  `sports/*.json`/`positions/*.json` by path or by naming convention —
  confirmed via a full cross-repo audit (2026-09-10) to be entirely
  contained within the spec repo itself (`positions/resolve-position.mjs`,
  `package.json`'s `files`/`exports` maps, `test/sport-branches.test.mjs`,
  `site/scripts/build-sports.mjs`). Neither the validator nor the
  renderer repo reads these files directly — both maintain independent,
  hand-authored copies of the same data (a separate, pre-existing drift
  risk, out of scope for this RFC; see the `cross-repo-position-data-drift`
  memory note).

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
- **Keep the flat `sports/<sport>-v*.json` + `positions/<ruleset>-v1.json`
  file layout, only add the whitelist/exclusion mechanisms**: considered
  during the 2026-09-10 revision, rejected in favor of the bundle
  restructure — the user's stated goal was a single, self-documenting
  location containing everything needed to add a new sport, which a
  scattered flat-file layout across two top-level directories does not
  achieve as clearly as a per-sport bundle directory.
- **Full physical nesting** (court profile coordinates embedded directly
  inside `sport.json` rather than extracted to
  `court_profiles/<name>.json`): considered, rejected — would make
  `sport.json` grow to hundreds of lines per sport (each court profile
  carries ~35-40 coordinate entries), hurting git-diff readability and
  coupling a single coordinate correction to the whole sport manifest's
  version history. The bundle directory with a naming-convention rule
  (item 1) achieves the same "one place, self-documenting" goal without
  this cost.

---

## Backwards Compatibility

- [ ] No breaking changes (additive only)
- [x] Breaking change — requires major version bump (the `custom_dimensions`
      field-set change for non-basketball sports; the `court.ruleset` →
      `court.court_profile` rename per RFC 0012; the registry file-layout
      restructure, which is an internal-consumer-facing break, not an
      OCF-document-facing one — no OCF document references registry file
      paths directly)
- [ ] Deprecates existing fields (list them)

---

## Explicitly Out of Scope

- **Funino / multi-goal topology** (4 goals in soccer, 4 baskets in
  basketball) — a fundamentally different court topology assumption ("one
  primary target per half") is baked into named positions and the renderer
  today. Needs its own design pass.
- **Rule-driven scoring changes** (e.g. minibasketball: all shots outside
  the paint count as 3 points) — a scoring/rules concept, not court
  geometry. This is exactly the kind of concept RFC 0012 frees the
  `ruleset` name for, but designing it is not this RFC's job.
- **The renderer's existing court-profile-blindness bug** (always draws
  FIBA dimensions unless `custom_dimensions` is explicitly set, ignoring
  nba/ncaa/nfhs distinctions) — a real, pre-existing, separate bug,
  independent of this RFC.
- **`equipment` and `coordinate_system` beyond their declared default** —
  both fields are added to the `sport.json` manifest shape as forward-
  looking extension points (e.g. a future puck-based sport, or a
  non-Cartesian court layout for something like American football), but
  this RFC does not implement any behavior beyond `equipment.type: "ball"`
  and `coordinate_system.type: "cartesian_2d"` as the only currently-valid
  values. Actually supporting a different equipment type or coordinate
  system is future work; if it turns out too large to fit inside the
  still-open v2.0.0 window when attempted, it becomes its own numbered
  program item at that point.
- **Sport-specific entity roles** (e.g. goalkeeper), **sport-bound start
  templates/formations**, and **verification tiers for sport/court-profile
  data** — raised during this RFC's design session, filed separately as
  RFC 0013, RFC 0014, and RFC 0015 respectively (all Draft, no detailed
  design, not yet assigned to a program window). All three would
  naturally live in the `sports/<sport>/sport.json` bundle this RFC
  introduces, but none are part of this RFC's scope.

---

## Open Questions

1. **Partially resolved during implementation** (2026-09-10): a concrete
   `custom_dimensions` field set was needed to migrate the checked-in
   `sport-soccer.ocf.json` fixture and make the implementation's own test
   suite pass — `unit`/`length`/`width`/`goal_width`/`penalty_box_width`/
   `penalty_box_depth`/`penalty_spot_distance`, shared across soccer/
   handball/hockey/futsal (all currently restricted to
   `court_profile: "custom"`, none has a promoted court profile yet).
   This is treated as a placeholder shape, not expert-reviewed —
   revisit once any of these sports is actually promoted past
   "provisional" status.
2. Resolved: this RFC lands inside the still-open v2.0.0 program window
   (implemented 2026-09-10; the program itself has not shipped a final
   v2.0.0 release yet — RFC 0008 and RFC 0011 remain pending).
3. Resolved: a sport's `actions` field stays inline in `sport.json` for
   now (see Detailed Design item 1) — no sport's `actions` block has yet
   grown large enough to justify extraction to its own `actions.json`.

---

## References

- RFC 0003 (Sport Scoping) — this RFC delivers the court-profile/named-
  position sport-scoping RFC 0003's own design table specified but never
  implemented; see RFC 0003 Amendments.
- RFC 0007 (`sport` Required) — this RFC's whitelist mechanism depends on
  `sport` reliably being present.
- RFC 0012 (Rename `ruleset` to `court_profile`) — this RFC is written
  entirely in terms of `court_profile`; RFC 0012 must land first.
- RFC 0013 (Sport-Specific Entity Roles), RFC 0014 (Sport Start
  Templates), RFC 0015 (Sport/Court-Profile Verification Tiers) —
  related ideas raised during this RFC's design session, filed
  separately, not part of this RFC's scope.
- Design doc: `docs/superpowers/specs/2026-09-07-sport-scoped-court-design.md`
  (full research evidence and original design rationale — predates the
  2026-09-10 revision recorded in this RFC's Amendments).
- `v2-program-strategy` memory — "Custom-court is a v2 multisport topic,"
  the original decision to fold this into v2 sport-scoping work.
- `cross-repo-position-data-drift` memory — the pre-existing, separate
  data-drift risk this RFC's bundle restructure does not fix (validator
  and renderer each hand-maintain their own copy of position/dimension
  data rather than reading these registry files).
