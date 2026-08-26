# RFC 0002 — External References: Named Formations & Play Lineage

| Field       | Value                                             |
|-------------|---------------------------------------------------|
| RFC Number  | 0002                                              |
| Title       | External References: Named Formations & Play Lineage |
| Author(s)   | opencoachingformat maintainers                    |
| Created     | 2026-08-26                                        |
| Status      | Draft                                             |
| Affects     | Schema + Spec                                     |
| Version     | Targets OCF v1.1.0                                |

---

## Summary

Introduces one shared **External Reference** convention — a small, uniform
shape for pointing at something that lives outside an OCF document (versioned,
resolved best-effort) — and applies it twice under `meta`:

- `based_on_formation` — the play's starting formation, looked up from an
  external, versioned formation registry instead of being hand-authored as raw
  coordinates, with optional per-entity `adjustments`.
- `based_on_play` — records that this play is a `variant`, `progression`, or
  `counter` of another play in a playbook.

All additions are optional. This is an additive, backwards-compatible change
(minor version bump).

---

## Motivation

Two independent needs surfaced while designing the LLM-based play generator:

1. A play's **starting formation** (5 Out, 4-Out-1-In, Princeton, …) currently
   has to be spelled out as raw `entities` coordinates by hand. Nothing in OCF
   captures "this play starts from a standard formation." Re-deriving five
   players' absolute coordinates from prose was the single least reliable part
   of LLM generation (the "Pick the Picker" generation test) — un-anchored
   spatial reasoning is exactly what a lookup should replace.
2. A play is often a **variant, progression, or counter of another play**
   already in a playbook. Nothing captures that lineage, so playbooks
   accumulate near-duplicates that are hard to browse as a family, and an
   LLM-assisted editor has no way to notice "this resembles a play you already
   have — link it?"

Both share the same shape: *a reference to something outside this document,
versioned, with an optional local override or annotation.* Rather than two
unrelated one-off fields, this RFC defines one convention and applies it twice.
A documented convention now also saves a bespoke fourth reference shape later.

---

## Detailed Design

### The convention: External Reference

An external reference is any field shaped like:

```json
{
  "id": "<stable identifier in the external source>",
  "title": "<human-readable label, convenience only>",
  "source": "<stable URI identifying the external collection>",
  "source_version": "<SemVer of that collection, if versioned>"
}
```

Rules:

- **`id` is the only field with normative meaning.** `title` is a redundant,
  human-readable convenience copy — useful when a human reads the raw document,
  or when `source` is unreachable — but tools MUST resolve references by `id`,
  never by matching on `title`.
- **`source` identifies a stable collection, not a specific document
  location** — a registry index or a playbook manifest, not a path that changes
  when an entry inside is renamed or reorganized. Resolution logic (fetching,
  caching, following redirects inside the collection) lives at that one stable
  place, not in every referencing document.
- **`source` may be any URI.** The project hosts an official, recommended
  registry under `opencoachingformat.org`, but third-party registries are
  first-class: `source` carries no host allow-list. (See Decision: Registry
  governance.)
- **`source_version` is optional; when present it MUST be valid SemVer**, so a
  resolver can compare compatibility and a document can pin what its author saw.
- **Resolution is best-effort, not a validity requirement.** A document whose
  `source` is unreachable — offline, private, or not yet built — is still a
  *valid* OCF document. The validator checks reference *shape* (fields, types,
  the SemVer pattern) but MUST NOT require fetching `source`. This keeps
  validation usable offline and keeps a third party's downtime from
  invalidating documents that reference their catalog.
- **References resolve at authoring time where possible, not at render time.**
  Where a reference stands in for concrete data the renderer needs (a
  formation's coordinates), that data is resolved into the document's normal
  fields (`entities[].x/y`) when the document is created/saved. The reference
  field then remains purely as *provenance* — a renderer never needs to know
  about registries, playbooks, or resolution at all. This keeps `ocf-renderer`
  narrow (render what's in `entities`/`frames`) instead of growing a second,
  renderer-side resolution path.

### Application A — Named Formations (`meta.based_on_formation`)

Formations live in an **external, versioned registry**, not embedded in
`schema/v1.json` — for the same reason `named_positions.custom` is an escape
hatch: a fixed catalog baked into the schema means every new formation needs a
schema version bump, disproportionate for a growing *content* set that is not a
structural change to what makes a document valid.

```json
"meta": {
  "based_on_formation": {
    "id": "4_out_1_in",
    "title": "4 Out 1 In",
    "source": "https://opencoachingformat.org/registry/formations/basketball-v1.json",
    "source_version": "1.0.0",
    "adjustments": [
      { "entity": "offense_5", "dx": -0.5, "dy": 0.0, "note": "tighter to the block for this play" }
    ]
  }
}
```

- `adjustments` is a list of per-entity deltas from the registry's stored
  position. `dx`/`dy` are in the document's **court units** (`m`/`ft`), the
  same units used everywhere else in the schema (coordinates are real court
  units, not normalized — a deliberate readability choice).
- **`adjustments` deltas are anchored to the resolved formation position of
  that entity**, *not* to a named position. This is intentionally a different
  anchor from `coordinate_relative` (which requires `relative_to`), so
  `adjustments` deliberately omit `relative_to`. The spec documents this so the
  two are not conflated.
- **Formations are authoring-time convenience, not a runtime concept.**
  `based_on_formation` resolves to concrete `entities[].x/y` at authoring time;
  the field then remains pure provenance metadata per the general rule above.
- For LLM generation: the model selects a formation *name* from a closed list
  drawn from the registry (no invented formation names, exactly as with action
  types and named positions) and expresses any spacing tweak as a small
  `adjustments` delta relative to a known anchor — far more reliable than
  generating five absolute coordinates from nothing.

#### When an "adjustment" is really a different formation (editor UX, not schema)

Large or numerous adjustments stop being a spacing tweak and start being a
distinct formation. This is a **UX nudge implemented in the editor/generation
loop, not the validator** — nothing about it enters `schema/v1.json`.

Thresholds are expressed in **court units, one value per unit** (consistent with
the schema keeping coordinates in real units rather than normalizing them):

```
adjustment_threshold    = { "m": 0.7, "ft": 2.3 }   # "many small adjustments"
new_formation_threshold = { "m": 1.5, "ft": 4.9 }   # "really a new formation"

t_new  = new_formation_threshold[doc.unit]
t_many = adjustment_threshold[doc.unit]
distance(a) = sqrt(a.dx**2 + a.dy**2)                # in doc.unit — no conversion

warn_as_new_formation =
  any(distance(a) > t_new  for a in adjustments)
  OR count(a for a in adjustments if distance(a) > t_many) > 2
```

Rationale: 0.3–0.7 m is typical spacing fine-tuning; 1.5 m approaches the
spacing between adjacent named positions on a FIBA half court (wing↔corner),
beyond which a player has effectively moved to a different spot. The `ft` values
are the same spatial thresholds in feet — stored, not derived at runtime, so
each unit is retunable independently. Both are editor config, not hardcoded.
When triggered, the editor offers to save the result as a new `custom`
formation rather than as adjustments to an existing one.

### Application B — Play Lineage (`meta.based_on_play`)

```json
"meta": {
  "based_on_play": {
    "id": "7c9e4f2a-1b3d-4a6e-8f0c-2d5e9a1b3c7f",
    "title": "Pick the Picker BLOB",
    "source": "https://opencoachingformat.org/playbooks/hoopsgeek-classics/index.json",
    "relationship": "variant"
  }
}
```

- Same External Reference shape. `source` points at a **playbook
  index/manifest**, so a play can be renamed or moved within its playbook
  without breaking the reference — resolution goes through the index by `id`.
- `relationship` is a closed enum: `variant` (tactical variation on the same
  base play), `progression` (a training step built from the base play),
  `counter` (a response to a specific defense against the base play). Extend
  centrally, not per-document, for the same interoperability reason action
  types aren't freely inventable.
- **Direction is fixed:** the referenced play is always the *base*; the document
  carrying `based_on_play` is always the derivative — for every enum value,
  including `progression`. Not separately encoded. A playbook browser can always
  draw the edge base → this play and render families as directed trees.
- **Single optional reference, not an array.** Multi-parentage is a real but
  secondary case; a lone object is forward-compatible with becoming a
  one-element array later (the reverse would be breaking), so there's no cost to
  deferring it.
- No local override: unlike a formation (which supplies only coordinates), a
  referenced play is already a complete, standalone payload — the reference
  itself *is* the whole relationship, so there is nothing to override.

### Schema Changes

All changes are inside `meta` (which is `additionalProperties: false`, so new
fields must be listed). Two new `definitions` plus two new `meta` properties.

```json
// New definitions
"external_reference": {
  "type": "object",
  "required": ["id"],
  "properties": {
    "id": { "type": "string", "description": "Stable identifier in the external source. The only field with normative meaning; resolve by id, never by title." },
    "title": { "type": "string", "description": "Human-readable label, convenience only." },
    "source": { "type": "string", "format": "uri", "description": "Stable URI of the external collection (registry index / playbook manifest). Any URI; not restricted to a host." },
    "source_version": {
      "type": "string",
      "description": "SemVer of the referenced collection. Optional; when present MUST be valid SemVer.",
      "pattern": "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$"
    }
  }
},

"formation_adjustment": {
  "type": "object",
  "description": "Per-entity delta from the resolved formation position. dx/dy are in court units, anchored to that entity's registry position (not a named position — no relative_to).",
  "required": ["entity", "dx", "dy"],
  "properties": {
    "entity": { "$ref": "#/definitions/entity_ref" },
    "dx": { "type": "number" },
    "dy": { "type": "number" },
    "note": { "type": "string" }
  },
  "additionalProperties": false
}

// meta.properties — additions (existing fields unchanged)
"based_on_formation": {
  "allOf": [ { "$ref": "#/definitions/external_reference" } ],
  "type": "object",
  "properties": {
    "adjustments": { "type": "array", "items": { "$ref": "#/definitions/formation_adjustment" } }
  }
},
"based_on_play": {
  "allOf": [ { "$ref": "#/definitions/external_reference" } ],
  "type": "object",
  "properties": {
    "relationship": { "type": "string", "enum": ["variant", "progression", "counter"] }
  }
}
```

> Implementation note for the PR: because draft-07 `additionalProperties: false`
> does not "see through" `allOf`, `based_on_formation`/`based_on_play` should be
> written as self-contained objects that inline the four External Reference
> fields plus their own field, rather than composing via `allOf` — otherwise
> the base fields would be rejected as additional. The `allOf` form above is
> shown for readability; the merged, inlined form is what ships.

---

## Drawbacks

- **A referenced registry may not exist yet.** The official formation registry
  is a follow-up deliverable. Until it ships, `based_on_formation.source` can
  point at something unresolvable. Mitigated by best-effort resolution: such
  documents are still valid, and `id`/`title` stay useful.
- **SemVer enforcement excludes non-SemVer registries from pinning a version.**
  A third-party registry versioned as a date or git hash cannot populate
  `source_version`. Accepted deliberately (see Alternatives) — the field is
  optional, so such registries omit it and still resolve by `id` + `source`.
- **A second reference-anchoring concept.** `adjustments` deltas are anchored to
  the resolved formation position, not a named position, which is a different
  anchor from `coordinate_relative`. Mitigated by documenting it explicitly.

---

## Alternatives Considered

- **Two bespoke fields instead of one convention.** Rejected: they share the
  same shape; a documented convention prevents a third/fourth divergent
  reference shape later.
- **Embed formations in the schema as a fixed enum.** Rejected: every new
  formation would force a schema version bump for what is a growing content set,
  not a structural change (same reasoning as `named_positions.custom`).
- **Normalize coordinates to −1..+1 so thresholds are unit-free.** Rejected:
  the schema deliberately keeps real court units for readability and to avoid
  conversion. Thresholds are instead defined per unit.
- **Free-text `relationship`.** Rejected: inconsistent with every other
  closed-vocabulary decision (action types, variants, branch outcomes).
- **`source_version` as an opaque string.** Rejected: interoperable
  compatibility logic needs an ordered, comparable grammar; SemVer is it.
- **`based_on_play` as an array from day one.** Deferred: single object is
  forward-compatible with an array; the reverse is breaking.

---

## Backwards Compatibility

All additions are new **optional** fields under `meta`. No existing field is
changed, removed, or made required. A document that omits
`based_on_formation`/`based_on_play` validates identically before and after.
The field names are unused anywhere in the current schema, examples, or docs
(verified), so no existing document can collide with the new property
definitions.

- [x] No breaking changes (additive only)
- [ ] Breaking change — requires major version bump
- [ ] Deprecates existing fields (list them)

**Version impact:** MINOR. Per SemVer this is new, backwards-compatible
functionality → OCF **v1.1.0** (schema stays at `$id` `.../schema/v1.json`;
the v1 line is unbroken).

---

## Open Questions

1. Official registry index format + seed basketball formation set — specified
   in a follow-up, not blocking this schema change.
2. Concrete resolver compatibility rule (e.g. "same major = compatible"). Now
   well-defined-able because `source_version` ordering is SemVer; out of scope
   for the schema PR.

---

## References

- Companion working notes: `rfc-external-references.md`,
  `rfc-external-references-decisions.md` (resolved open points)
- Related RFC: #0001 (initial standard — coordinate system, `named_positions`)
- SemVer 2.0.0 — https://semver.org
