# RFC 0003 — Sport Scoping: a `sport` field with per-sport action vocabularies

| Field       | Value                                             |
|-------------|---------------------------------------------------|
| RFC Number  | 0003                                              |
| Title       | Sport Scoping: `sport` field + per-sport action vocabularies |
| Author(s)   | opencoachingformat maintainers                    |
| Created     | 2026-08-27                                        |
| Status      | Accepted                                           |
| Affects     | Schema + Spec                                     |
| Version     | Targets OCF v1.2.0                                |

---

## Summary

OCF is named and marketed as a *coaching* format for team sports, but its action
model is entirely basketball: the action `variant` enums, several action *types*
(`screen`, `rebound`), the `outcome` enum, and the rulesets are all
basketball-specific. This RFC makes the sport explicit and scopes the
sport-specific vocabulary to it, so OCF can grow to the broader class of
**invasion team sports** (basketball, soccer, handball, hockey, futsal, …)
without a rewrite — while defining **only basketball** concretely now.

It adds an optional top-level `sport` field (default `"basketball"`,
back-compatible) and a per-sport conditional whitelist that restricts which
action types and variants are valid for the declared sport. The neutral core
(entities, coordinates, frames, states, ball model, areas, labels, `move`,
external references) is unchanged. Additive → **minor (v1.2.0)**.

---

## Motivation

The schema markets broadly but is single-sport:

- Name: "Open **Coaching** Format"; README: "sports coaching diagrams".
- Schema `description`: "basketball drill diagrams".
- Reality: basketball throughout.

A classification of the current `definitions` shows the sport-specificity is
**clustered**, not spread: ~70% of the schema is sport-neutral (coordinates,
entities, frames, states, ball possession `carried_by/at/dead` — which even
covers a puck, areas, labels, `move`, `pass`, external references). The
basketball-specific parts are concentrated in:

- action `variant` enums (cut: backdoor/curl/flare/fade/…; screen:
  ball_screen/pin_down/…; shoot: jumper/dunk/free_throw/…; pass:
  chest/bounce/hand_off/…; defend: hedge/switch/box_out/…),
- two action *types* that are basketball-only: `screen`, `rebound`,
- the `outcome` enum (make/miss/turnover/steal/foul),
- the rulesets (fiba/nba/ncaa/nfhs).

Because the specificity is clustered, a small, additive scoping mechanism —
rather than a rewrite — lets OCF honour its stated multi-sport framing while
staying focused on basketball as the first (and, for now, only) fully-defined
sport.

Scope of the target class: **invasion team sports** — two teams, a shared
field/court, ball/puck possession, and off-ball player movement. Net-divided
sports (volleyball) and down-based sports (American football) are structurally
different and are **out of scope**.

---

## Detailed Design

### The `sport` field

A new optional top-level field:

```json
"sport": "basketball"
```

- **Optional**, default `"basketball"`. Every existing document (all basketball,
  none carrying `sport`) stays valid → this is additive/back-compatible.
- **Deprecation notice:** the optional-with-default behaviour is transitional.
  `sport` is intended to become **required in v2.0.0**; authors should start
  emitting it now.
- Enum: `["basketball", "soccer", "handball", "hockey", "futsal"]`. Basketball is
  **fully defined**; the other invasion sports are **reserved with a minimal,
  provisional whitelist branch** so every enum value has a real branch (no sport
  is ever valid without a vocabulary). Their branches allow only the action
  types that are universal across invasion sports plus a few obvious own ones,
  and are explicitly marked provisional pending sport-expert review.

  **Provisional minimal whitelists** (structure, not sport-authoritative):
  - universal set (in every target sport): `move`, `pass`, `shoot`, `defend`
  - soccer / futsal: universal + `dribble`, `tackle`, `clear`
  - handball: universal + `cut`, `screen`, `pickup` (basketball-like)
  - hockey: universal + `dribble`, `clear`, `faceoff`, `check`

  These non-basketball sets are **derived structurally, not validated by a
  domain expert** — they exist to make the mechanism real and testable, and are
  expected to be refined (and get variant enums) before those sports are
  promoted from provisional to fully-defined.

### Per-sport conditional whitelist (validated approach)

The core keeps the full `action` `oneOf` and the `action_ref` pattern intact
(no cross-file split, so their coupling stays simple). Validity is narrowed by
`sport` via `allOf` + `if/then`:

```json
"allOf": [
  {
    "if": {
      "anyOf": [
        { "not": { "required": ["sport"] } },
        { "properties": { "sport": { "const": "basketball" } } }
      ]
    },
    "then": {
      "properties": {
        "frames": {
          "items": {
            "properties": {
              "actions": {
                "items": { "properties": { "type": {
                  "enum": ["move","cut","screen","defend","dribble","pass","shoot","rebound","pickup"]
                } } }
              }
            }
          }
        }
      }
    }
  }
]
```

**Critical back-compat detail (verified against ajv):** the basketball branch's
`if` matches when `sport` is **absent OR** `"basketball"`. JSON Schema's `default`
is a non-validating annotation — it is *not* applied during validation — so a
document with no `sport` field would otherwise match no branch and have its
actions rejected. The `anyOf[ not-required-sport, sport==basketball ]` guard is
what keeps every existing (sport-less) basketball document valid. All other
sports' branches require `sport` to be present and equal to that sport.

Variant enums are likewise gated per sport (the basketball branch keeps today's
variant lists; other sports' branches will define their own).

This is toolchain-proven with ajv/draft-07:
- `sport: basketball` + `screen` → valid;
- `sport: soccer` + `screen` → rejected (once soccer is added and `screen` is not
  in its whitelist);
- a `sport` value with no branch is prevented by the enum (every enum value has a
  branch — enforced by convention + a regression test, see Testing).

### Action types: core superset, variants per sport

All invasion-sport action *types* live in the core `oneOf`. Basketball's are
already there. Types needed by reserved sports are added as **skeleton
definitions** now — present in the core, but carrying a `$comment` that no
variants are defined yet:

```json
"action_tackle": {
  "type": "object",
  "$comment": "Reserved for invasion sports (soccer/hockey). No variants defined yet; to be specified per sport before 'tackle' enters any sport's action whitelist.",
  "required": ["player", "type"],
  "properties": {
    "player": { "$ref": "#/definitions/entity_ref" },
    "type": { "const": "tackle" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "after": { "$ref": "#/definitions/action_ref" },
    "with": { "$ref": "#/definitions/action_ref" }
  },
  "additionalProperties": false
}
```

Reserved types to add as skeletons (variants TBD, and **not** in basketball's
whitelist, so they can't be used under `sport: basketball`): `tackle`, `clear`,
`faceoff`, `check`. They *are* allowed under the provisional branches of the
sports that list them (e.g. `tackle` under soccer/futsal, `faceoff`/`check`
under hockey). Kept minimal; more can be added additively.

The `action_ref` pattern is extended to include the reserved types so
cross-references remain expressible:
`…\.(move|cut|screen|defend|dribble|pass|shoot|rebound|pickup|tackle|clear|faceoff|check)$`

### External sport skeletons (`sports/<sport>-v0.0.1.json`)

To seed the reserved sports and let contributors flesh them out, add skeleton
vocabulary files:

```
sports/
├── basketball-v1.json     ← the defined basketball vocabulary
├── soccer-v0.0.1.json     ← skeleton: structure only, variants/whitelist TBD
├── handball-v0.0.1.json   ← skeleton
└── hockey-v0.0.1.json     ← skeleton
```

Each skeleton declares the sport's identity and empty/placeholder vocabulary
sections (action whitelist, variant enums, rulesets, outcomes) for others to
define. `basketball-v1.json` is the only complete one. Whether the core schema
eventually pulls whitelists from these files via `$ref` (proven to work in ajv
when resolvable) or keeps them inline is deferred — inline is used now because a
new sport is then an additive minor (new enum value + new branch), never
breaking.

### Neutral vs. sport-scoped (summary)

| Neutral core (unchanged) | Sport-scoped (gated by `sport`) |
|---|---|
| entities, coordinates, frames, `state`/`ball_state` | action `variant` enums |
| ball model (`carried_by`/`at`/`dead`) | which action *types* are valid |
| `move`, `pass` (generic to invasion games) | `outcome` enum (scoring events) |
| areas, labels, external references, formations | rulesets + named-position catalogs |

### Schema Changes

```json
// Before (top-level properties) — no sport field, actions unrestricted
{ "properties": { "meta": ..., "court": ..., "entities": ..., "frames": ... } }

// After
{
  "properties": {
    "sport": {
      "type": "string",
      "enum": ["basketball", "soccer", "handball", "hockey", "futsal"],
      "default": "basketball",
      "$comment": "Optional, default basketball, for back-compat. Intended to become required in v2.0.0. basketball is fully defined; soccer/handball/hockey/futsal carry provisional minimal whitelists pending sport-expert review."
    },
    "...": "..."
  },
  "allOf": [ { "if": { "properties": { "sport": { "const": "basketball" } } }, "then": { "...": "basketball action + variant whitelist" } } ]
}
```

`meta`/`court`/`entities`/`frames` stay required; `sport` is **not** added to
`required` in v1.x.

---

## Drawbacks

- The core schema grows a conditional layer and (over time) one `if/then` branch
  per sport. Mitigated: branches are additive and localized; the neutral core is
  untouched.
- Reserved action-type skeletons add definitions with no variants yet — they are
  inert (excluded from every current whitelist) until a sport defines them, but
  they do enlarge the schema slightly.
- `sport` being optional-with-default is a transitional compromise; until v2 a
  document can omit it and be treated as basketball, which is implicit.
- Per-sport validity means a validator's error for a wrong action reports an
  enum mismatch rather than "not valid for this sport"; error ergonomics could
  be improved later.

---

## Alternatives Considered

- **Accept basketball-only, drop the multi-sport framing.** Rejected: forecloses
  the stated vision; the neutral core is already large enough that scoping is cheap.
- **Physically split actions across core + external sport schemas** (`screen`/
  `rebound` leave the core). Rejected: breaks the `action` `oneOf` and the
  `action_ref` pattern across files, complicating validation and tooling for no
  gain over the conditional-whitelist approach.
- **Fully externalize per-sport vocabularies via `$ref` now.** Deferred: works in
  ajv but makes validation depend on the external schema being resolvable
  (validation-relevant, not best-effort). Inline keeps a new sport an additive
  minor; the `$ref` form remains a future option.
- **Make `sport` required immediately (v2).** Rejected for now: breaking for
  existing documents; revisited at v2 when `sport` becomes required.

---

## Backwards Compatibility

- [x] No breaking changes (additive only)
- [ ] Breaking change — requires major version bump
- [ ] Deprecates existing fields (list them)

Additive: `sport` is optional with default `"basketball"`; the conditional
whitelist matches exactly today's basketball action set, so every existing
document validates unchanged. **Version impact: MINOR → v1.2.0.**

Forward note: `sport` is planned to become **required in v2.0.0** (breaking);
this RFC introduces it early so authors can adopt it before then.

---

## Testing / Regression

Because validity now depends on `sport`, add fixtures:

- **valid:** a basketball document with `sport: "basketball"` using `screen`/
  `rebound` (gated types) — must validate.
- **valid:** an existing basketball document with **no** `sport` field — must
  still validate (default behaviour).
- **valid:** a `sport: "soccer"` document using only its provisional whitelist
  (e.g. `move`/`pass`/`tackle`) — must validate.
- **invalid:** `sport` set to a value not in the enum (e.g. `"volleyball"`) —
  must be rejected.
- **invalid:** `screen` used under `sport: "soccer"` — must be rejected
  (not in soccer's whitelist).
- **invalid:** `tackle` used under `sport: "basketball"` — must be rejected
  (reserved type not in basketball's whitelist).
- **convention test:** every value in the `sport` enum has a corresponding
  `if/then` whitelist branch (guards against adding a sport without a vocabulary).

---

## Open Questions

1. Exact set of reserved action-type skeletons to seed now (`tackle`/`clear`/
   `faceoff` proposed; more can be added additively).
2. When to switch the per-sport whitelists from inline to external `$ref`
   (`sports/<sport>-v*.json`) — likely once a second sport is fully defined.
3. Reconcile the schema `description` and README wording to "invasion team
   sports, basketball first" (doc-only, can land with this RFC).
4. Does any target invasion sport need the ball model generalized (multi-ball)?
   Current `carried_by/at/dead` covers single ball and puck.

---

## References

- Related RFC: #0002 (External References — precedent for externalizing
  sport content like formations/positions).
- Internal analysis (private): sport-neutrality architecture decision.
