# RFC 0011 — Remove Rendering Concerns from the Spec

| Field       | Value                                             |
|-------------|----------------------------------------------------|
| RFC Number  | 0011                                              |
| Title       | Remove `color_scheme`, `color_role`, and `color` (entities/`area`/`label`) from the spec; retire `CONTRAST_LOW` |
| Author(s)   | opencoachingformat maintainers                    |
| Created     | 2026-09-07                                        |
| Status      | Draft — decision recorded, not yet implemented    |
| Affects     | Schema + Spec + Validator (TS + Python)           |
| Version     | Targets OCF v2.0.0 (program item 6 of 6 — see the [v2.0.0 program overview](../docs/superpowers/specs/2026-09-07-v2-program-overview.md)) |

---

## Summary

Removes every rendering-only concept from `schema/v1.json`: the root
`color_scheme` field (11 hex-value fields), the `color_role` enum it
resolves, the `color` field on `entity_offense`/`entity_defense`, `area`,
and `label`, and the `CONTRAST_LOW` validator rule (both languages, v1 and
v2 rule modules) that depends on `color_scheme`. The spec should describe
only a play's semantic content — who does what, when, where, with what ball
— never how it is drawn. Breaking → **major (v2.0.0 program item)**.

---

## Motivation

OCF's own north star (established during the v2.0.0 program's design work,
see `v2-program-strategy` memory) already states: *"the spec contains
everything a renderer needs; the renderer does ZERO validation."* This RFC
is the direct corollary, made explicit: the spec should also carry
**nothing** a renderer doesn't need to determine a play's meaning. Whether
offense is drawn as a circle or an X, whether a dribble path uses a
different stroke than a cut, whether a 2D diagram or a 3D animation is
produced — none of this is a fact about the play. Keeping it out of the
spec leaves room for competing/differentiating renderer products built on
one shared format, which is exactly the kind of ecosystem this project
wants to enable.

A WCAG accessibility check (`CONTRAST_LOW`) on the *specification* —
divorced from any actual rendering, with no real pixels ever drawn — was
independently identified as not making sense at this layer: contrast is a
property of an actual rendered output, not an abstract semantic document.

A full inventory of every `"color"` property in `schema/v1.json` (not
assumed, read directly) found four distinct usages, two of which needed
correcting an initial misreading during this RFC's own design session:

1. **`color_scheme`** (root, optional) — pure rendering configuration
   (hex values per semantic role).
2. **`color_role`** (enum) — the semantic-name vocabulary `color_scheme`
   resolves; exists only to serve `color_scheme` and the `color` fields
   below.
3. **`entity_offense.color` / `entity_defense.color`** — confirmed to be a
   **separate, optional override field**, not the entity's role itself.
   The role is already fully carried by `type: "offense"`/`"defense"`
   (required, `additionalProperties: false`). `color` here has no
   independent meaning today — `type: "offense"` + `color: "red"` is valid
   and changes nothing semantically.
4. **`area.color` / `label.color`** — different in kind from (3): `area`
   (`{form, color, opacity, x, y, width, height, rotation, coords}`) has
   **no other field carrying meaning**. Confirmed against the one real
   usage in this codebase (`examples/pick-and-roll.ocf.json`, a yellow
   20%-opacity rectangle over the paint) that color is currently the
   *only* thing distinguishing what an area is for.

---

## Detailed Design

### Schema Changes

```jsonc
// Removed from definitions entirely:
"color_scheme": { /* 11 hex-value fields */ }
"color_role": { "enum": ["offense","defense","black","grey","yellow","green","red","blue","white"] }

// Removed from root properties:
"color_scheme": { "$ref": "#/definitions/color_scheme" }

// entity_offense / entity_defense: "color" property removed
// area: "color" property removed
// label: "color" property removed
```

`area` and `label` are **not** otherwise redesigned by this RFC — they keep
every other field (`form`/`opacity`/`x`/`y`/`width`/`height`/`rotation`/
`coords` for `area`; `text`/`x`/`y` for `label`). This RFC only removes
`color`; it does not add a replacement semantic field.

### Validator Changes (both languages, v1 and v2 rule modules)

`CONTRAST_LOW` is removed entirely. This retires a check that was ported
into the v2 rule set only in the immediately preceding session (Plan 3,
Task 16) — noted explicitly so a future reader of that history understands
this is a deliberate removal following this RFC's decision, not an
oversight or regression in that earlier work.

### Example

```jsonc
// Before
{
  "entities": [{ "type": "offense", "nr": 1, "x": 0, "y": 5, "color": "offense" }],
  "areas": [{ "form": "rectangle", "color": "yellow", "opacity": 0.2, "x": 0, "y": 10.5, "width": 4.9, "height": 4 }],
  "color_scheme": { "offense_fill": "#003366", "offense_stroke": "#ffffff", ... }
}

// After
{
  "entities": [{ "type": "offense", "nr": 1, "x": 0, "y": 5 }],
  "areas": [{ "form": "rectangle", "opacity": 0.2, "x": 0, "y": 10.5, "width": 4.9, "height": 4 }]
}
```

---

## Drawbacks

- `area` loses its only distinguishing property today. An author can no
  longer express *why* an area is drawn (a passing lane? a landing zone? a
  danger area?) — only *where* and *what shape*. This is a real, disclosed
  regression in expressiveness, not an oversight (see Open Questions).
- Retires a validator rule (`CONTRAST_LOW`) shipped in the immediately
  preceding session — wasted, if brief, implementation effort. Accepted as
  the honest cost of the design correction; not worth keeping a
  since-recognized-as-wrong check just because it was recently built.

---

## Alternatives Considered

- **Keep `color` on `area`/`label` as a "sonderfall" while removing it
  everywhere else**: considered and explicitly rejected — `color` on
  `area`/`label` is exactly as much a rendering decision as `color_scheme`
  itself; keeping it would be inconsistent with this RFC's own stated
  principle, even though it currently carries the only distinguishing
  information those objects have.
- **Add a semantic `role`/`kind` replacement field on `area`/`label` as
  part of this RFC**, so nothing is lost: considered and explicitly
  deferred. This is confirmed (see Backwards Compatibility) to be an
  additive, non-breaking change independent of this RFC's breaking
  removal, and the exact shape of that semantic field is a genuinely open
  design question the maintainers want public input on before committing
  a schema shape — see the open GitHub Discussion
  (opencoachingformat/spec#53). Bundling it into this RFC would force a
  premature decision on a question this RFC doesn't need to answer to
  remove rendering-only fields.
- **Leave a renderer-hint tag/property on actions** (signaling "this
  action should be rendered specially") as part of this RFC: considered
  and rejected for now — no concrete need identified; if one emerges
  later, it would be an additive optional field requiring no breaking
  change, so there is no reason to design it speculatively now.

---

## Backwards Compatibility

- [ ] No breaking changes (additive only)
- [x] Breaking change — requires major version bump
- [x] Deprecates existing fields: `color_scheme`, `color_role`,
      `entity_offense.color`, `entity_defense.color`, `area.color`,
      `label.color`

**Note on sequencing with a future `area`/`label` semantic field**: adding
a `role`/`kind`-style field to `area`/`label` later (per the open GitHub
Discussion) would itself be additive — a new optional property does not
require another major bump, since `additionalProperties: false` only
constrains what a document may already contain, not what future schema
versions may add. This RFC's removal and any future semantic addition are
independent breaking/non-breaking changes and do not need to ship together.

---

## Open Questions

1. Should `area`/`label` eventually gain a `role`/`kind` field carrying
   real semantic meaning (e.g. `target_zone`, `restricted_zone`), letting a
   renderer choose its own visual treatment per role — mirroring how
   `entity.type` already separates role from appearance? Tracked in
   **opencoachingformat/spec Discussion #53** (public, open for community
   input), not decided by this RFC.
2. If pursued, does that require its own reference-integrity validation
   concept (e.g. a `REF_ZONE_UNKNOWN`-style check) for actions that would
   target a zone rather than an actor? Same discussion, same non-decision
   here.
3. Whether the `ocf-renderer` reference implementation keeps an internal
   (non-spec) color-configuration concept of its own — out of scope for
   this RFC, a renderer-repo decision.

---

## References

- Design doc: `docs/superpowers/specs/2026-09-07-rendering-concerns-out-of-spec-design.md`
- Open GitHub Discussion: opencoachingformat/spec#53 — "Should `area`/
  `label` carry semantic meaning (e.g. referenceable 'zones'), or stay pure
  rendering decoration?"
- `docs/superpowers/specs/2026-09-07-v2-program-overview.md` — the umbrella
  v2.0.0 program this RFC is item 6 of.
- `v2-program-strategy` memory — the spec-carries-everything-a-renderer-
  needs north star this RFC's motivation extends.
- Implementation to be removed: `shared/schema/ocf-action-v1.json`/
  `ocf-action-v2.json` (`ocf-validator` repo, vendored copies),
  `packages/ts/src/v1/rules/quality.ts` + `v2/rules/quality.ts`,
  `packages/py/ocf_validator/v1/rules.py` + `v2/quality_rules.py`
  (`CONTRAST_LOW` implementations, both languages).
