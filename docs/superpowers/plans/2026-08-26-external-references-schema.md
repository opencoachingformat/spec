# External References Schema (based_on_formation / based_on_play) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the two optional External Reference fields (`meta.based_on_formation`, `meta.based_on_play`) to `schema/v1.json` per RFC 0002, with valid/invalid fixtures and a spec-doc section, as a backwards-compatible minor release (v1.1.0).

**Architecture:** Purely additive schema change inside `meta`. Because `meta` is `additionalProperties: false` and draft-07 `additionalProperties` does not see through `allOf`, the two new objects inline the four shared External Reference fields rather than composing via `$ref`. Validator scope stays "shape only" — no fetching of `source`. A version bump to 1.1.0 is required or the release workflow's tag/version check fails.

**Tech Stack:** JSON Schema draft-07, ajv-cli + ajv-formats (existing test harness), AsciiDoc spec doc.

**Plan 1 of 3** (sequential): this is the dependency root — Plan 3 (formations package) needs these fields to validate `based_on_formation`. Plan 2 (named-positions JSON) is independent of this one.

---

### Task 1: Add External Reference definitions and meta fields to the schema

**Files:**
- Modify: `schema/v1.json` (definitions block ~line 9-516; meta.properties ~line 525-536)

- [ ] **Step 1: Add two new definitions inside the `definitions` object**

Insert after the `custom_position` definition (ends `schema/v1.json:428`), before `color_scheme`:

```json
    "formation_adjustment": {
      "type": "object",
      "description": "Per-entity delta from the resolved formation position. dx/dy are in court units, anchored to that entity's registry position (not a named position, so no relative_to).",
      "required": ["entity", "dx", "dy"],
      "properties": {
        "entity": { "$ref": "#/definitions/entity_ref" },
        "dx": { "type": "number" },
        "dy": { "type": "number" },
        "note": { "type": "string" }
      },
      "additionalProperties": false
    },

    "based_on_formation": {
      "type": "object",
      "description": "External reference to a starting formation in a versioned registry, resolved to entities at authoring time; pure provenance thereafter. Resolve by id, never by title.",
      "required": ["id"],
      "properties": {
        "id": { "type": "string", "description": "Stable formation id in the registry. Only field with normative meaning." },
        "title": { "type": "string", "description": "Human-readable label, convenience only." },
        "source": { "type": "string", "format": "uri", "description": "Stable URI of the formation registry index. Any URI; not host-restricted." },
        "source_version": {
          "type": "string",
          "description": "SemVer of the referenced registry. Optional; when present MUST be valid SemVer.",
          "pattern": "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$"
        },
        "adjustments": { "type": "array", "items": { "$ref": "#/definitions/formation_adjustment" } }
      },
      "additionalProperties": false
    },

    "based_on_play": {
      "type": "object",
      "description": "External reference to another play this one derives from. The referenced play is always the base; this document is the derivative. Resolve by id, never by title.",
      "required": ["id"],
      "properties": {
        "id": { "type": "string", "description": "Stable play id in the referenced playbook index. Only field with normative meaning." },
        "title": { "type": "string", "description": "Human-readable label, convenience only." },
        "source": { "type": "string", "format": "uri", "description": "Stable URI of the playbook index/manifest. Any URI; not host-restricted." },
        "source_version": {
          "type": "string",
          "description": "SemVer of the referenced playbook. Optional; when present MUST be valid SemVer.",
          "pattern": "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$"
        },
        "relationship": {
          "type": "string",
          "enum": ["variant", "progression", "counter"],
          "description": "How this play relates to the base. Direction is fixed: this play derives from the referenced base."
        }
      },
      "additionalProperties": false
    },
```

- [ ] **Step 2: Reference the new definitions from meta.properties**

In `schema/v1.json`, inside `properties.meta.properties` (after `source_url`, `schema/v1.json:535`), add:

```json
        "source_url": { "type": "string", "format": "uri" },
        "based_on_formation": { "$ref": "#/definitions/based_on_formation" },
        "based_on_play": { "$ref": "#/definitions/based_on_play" }
```

(The `source_url` line already exists; the two new lines follow it. `meta` keeps `additionalProperties: false`, so listing them here is what makes them permitted.)

- [ ] **Step 3: Verify the schema itself is valid JSON and ajv can compile it**

Run: `npx ajv compile --spec=draft7 -s schema/v1.json -c ajv-formats`
Expected: `schema/v1.json is valid` (ajv compiles without error).

- [ ] **Step 4: Verify existing examples still validate (no regression)**

Run: `npm run validate`
Expected: all `examples/*.ocf.json` report `valid`. No existing example uses the new fields, so all must still pass unchanged.

- [ ] **Step 5: Commit**

```bash
git add schema/v1.json
git commit -m "feat(schema): add based_on_formation and based_on_play external references (RFC 0002)"
```

---

### Task 2: Add a valid fixture exercising both new fields

**Files:**
- Create: `examples/based-on-references.ocf.json`

- [ ] **Step 1: Write the valid fixture**

Create `examples/based-on-references.ocf.json`:

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "meta": {
    "id": "9f8b7c6d-5e4a-4b3c-2d1e-0f9a8b7c6d5e",
    "title": "4-Out-1-In Variant with Lineage",
    "description": "Starts from the 4 Out 1 In formation with a tighter big, recorded as a variant of an existing play.",
    "author": "OCF Examples",
    "tags": ["example", "external-references"],
    "difficulty": "intermediate",
    "created": "2026-08-26T10:00:00Z",
    "source_format": "open",
    "based_on_formation": {
      "id": "4_out_1_in",
      "title": "4 Out 1 In",
      "source": "https://opencoachingformat.org/registry/formations/basketball-v1.json",
      "source_version": "1.0.0",
      "adjustments": [
        { "entity": "offense_5", "dx": -0.5, "dy": 0.0, "note": "tighter to the block for this play" }
      ]
    },
    "based_on_play": {
      "id": "7c9e4f2a-1b3d-4a6e-8f0c-2d5e9a1b3c7f",
      "title": "Pick the Picker BLOB",
      "source": "https://opencoachingformat.org/playbooks/hoopsgeek-classics/index.json",
      "relationship": "variant"
    }
  },
  "court": { "ruleset": "fiba", "type": "half_court", "drill_focus": "offense" },
  "entities": [
    { "type": "offense", "nr": 1, "x": 0.0, "y": 5.68 },
    { "type": "offense", "nr": 2, "x": -6.75, "y": 8.6 },
    { "type": "offense", "nr": 3, "x": 6.75, "y": 8.6 },
    { "type": "offense", "nr": 4, "x": -7.5, "y": 13.98 },
    { "type": "offense", "nr": 5, "x": -0.5, "y": 10.5 }
  ],
  "balls": [ { "id": "ball_1", "carried_by": "offense_1" } ],
  "frames": [
    {
      "id": "frame_1",
      "label": "Set",
      "description": "Players hold the adjusted 4 Out 1 In shape.",
      "actions": [],
      "end_state": {
        "offense_1": { "named": "top_of_the_key" },
        "offense_5": { "x": -0.5, "y": 10.5 }
      }
    }
  ]
}
```

- [ ] **Step 2: Verify the fixture validates**

Run: `npx ajv validate --spec=draft7 -s schema/v1.json -d examples/based-on-references.ocf.json --all-errors -c ajv-formats`
Expected: `examples/based-on-references.ocf.json valid`.

- [ ] **Step 3: Run the full validate script to confirm it's picked up**

Run: `npm run validate`
Expected: all examples including the new one report `valid`.

- [ ] **Step 4: Commit**

```bash
git add examples/based-on-references.ocf.json
git commit -m "test(schema): add valid fixture for based_on_formation and based_on_play"
```

---

### Task 3: Add invalid fixtures (shape enforcement)

**Files:**
- Create: `examples/invalid/based-on-play-bad-relationship.json`
- Create: `examples/invalid/based-on-formation-bad-source-version.json`
- Create: `examples/invalid/based-on-formation-adjustment-missing-dx.json`

These lock in three enforcement points: the `relationship` enum, the SemVer pattern on `source_version`, and the required `dx` on an adjustment.

- [ ] **Step 1: Write the three invalid fixtures**

Create `examples/invalid/based-on-play-bad-relationship.json`:

```json
{
  "meta": {
    "id": "9f8b7c6d-5e4a-4b3c-2d1e-0f9a8b7c6d5e",
    "title": "Bad relationship",
    "based_on_play": { "id": "x", "relationship": "remix" }
  },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [],
  "frames": [ { "id": "f1", "actions": [], "end_state": {} } ]
}
```

Create `examples/invalid/based-on-formation-bad-source-version.json`:

```json
{
  "meta": {
    "id": "9f8b7c6d-5e4a-4b3c-2d1e-0f9a8b7c6d5e",
    "title": "Bad source_version",
    "based_on_formation": { "id": "4_out_1_in", "source_version": "2024-08" }
  },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [],
  "frames": [ { "id": "f1", "actions": [], "end_state": {} } ]
}
```

Create `examples/invalid/based-on-formation-adjustment-missing-dx.json`:

```json
{
  "meta": {
    "id": "9f8b7c6d-5e4a-4b3c-2d1e-0f9a8b7c6d5e",
    "title": "Adjustment missing dx",
    "based_on_formation": {
      "id": "4_out_1_in",
      "adjustments": [ { "entity": "offense_5", "dy": 0.0 } ]
    }
  },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [],
  "frames": [ { "id": "f1", "actions": [], "end_state": {} } ]
}
```

- [ ] **Step 2: Run the invalid-fixture check — all three must be rejected**

Run: `npm run test:invalid`
Expected: output includes `ok: examples/invalid/based-on-play-bad-relationship.json correctly rejected.`, the same for the other two new files, and ends with `All N invalid fixture(s) correctly rejected.` (N is the new total).

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: `npm run validate` passes (all valid examples) AND `npm run test:invalid` passes (all invalid fixtures rejected).

- [ ] **Step 4: Commit**

```bash
git add examples/invalid/based-on-play-bad-relationship.json examples/invalid/based-on-formation-bad-source-version.json examples/invalid/based-on-formation-adjustment-missing-dx.json
git commit -m "test(schema): add invalid fixtures for external reference shape enforcement"
```

---

### Task 4: Document External References in the spec doc

**Files:**
- Modify: `docs/specification-v1.adoc` (add a new section; the Custom Positions section ends around line 320 — place the new section after the named-position material and before the schema-reference/class-diagram material near line 1051)

- [ ] **Step 1: Add an "External References" section to the spec doc**

Insert a new `==` section. Choose a location after the coordinate/named-position sections and before the JSON-schema class reference. Content:

```asciidoc
== External References

Some `meta` fields point at content that lives *outside* the document — in a
versioned registry or playbook. They all share one shape, the **External
Reference**:

[cols="1,3", options="header"]
|===
| Field | Meaning
| `id` | Stable identifier in the external source. The **only** field with normative meaning — tools resolve by `id`, never by matching `title`.
| `title` | Human-readable label, convenience only (useful when `source` is unreachable).
| `source` | Stable URI of the external *collection* (a registry index or playbook manifest), not a document path. Any URI; the official registry under `opencoachingformat.org` is recommended, third-party registries are first-class.
| `source_version` | SemVer of that collection. Optional; when present it MUST be valid SemVer so resolvers can compare compatibility.
|===

Resolution is **best-effort, not a validity requirement**: a document whose
`source` is unreachable is still valid — `id`/`title` remain useful. Validators
check reference *shape* only and never fetch `source`.

Where a reference stands in for concrete data the renderer needs, it is
resolved into the document's normal fields at **authoring time**, and the
reference remains as pure provenance. Renderers never resolve references.

=== `meta.based_on_formation`

Records the standard starting formation a play begins from, looked up from a
versioned formation registry instead of being hand-authored. Resolved to
concrete `entities[].x/y` at authoring time.

`adjustments` is an optional list of per-entity deltas from the registry's
stored position. `dx`/`dy` are in court units and are anchored to that
entity's *resolved formation position* — this is a different anchor from a
relative coordinate (`relative_to`), so `adjustments` carry no `relative_to`.

[source,json]
----
"based_on_formation": {
  "id": "4_out_1_in",
  "title": "4 Out 1 In",
  "source": "https://opencoachingformat.org/registry/formations/basketball-v1.json",
  "source_version": "1.0.0",
  "adjustments": [
    { "entity": "offense_5", "dx": -0.5, "dy": 0.0, "note": "tighter to the block" }
  ]
}
----

=== `meta.based_on_play`

Records that this play is a `variant`, `progression`, or `counter` of another
play. Direction is fixed: the referenced play is always the base; this document
is the derivative. A single optional reference (not an array).

[cols="1,3", options="header"]
|===
| `relationship` | Meaning (read as "*this* play is …")
| `variant` | a tactical variation of the base play
| `progression` | a training step built from the base play
| `counter` | a response to a specific defense against the base play
|===

[source,json]
----
"based_on_play": {
  "id": "7c9e4f2a-1b3d-4a6e-8f0c-2d5e9a1b3c7f",
  "title": "Pick the Picker BLOB",
  "source": "https://opencoachingformat.org/playbooks/hoopsgeek-classics/index.json",
  "relationship": "variant"
}
----
```

- [ ] **Step 2: Verify the AsciiDoc still builds (site build uses asciidoctor)**

Run: `cd site && npm ci && npm run build`
Expected: build completes without asciidoctor errors. (If `site` deps are already installed, `npm run build` alone suffices.)

- [ ] **Step 3: Commit**

```bash
git add docs/specification-v1.adoc
git commit -m "docs: document External References convention (based_on_formation, based_on_play)"
```

---

### Task 5: Bump package version to 1.1.0

**Files:**
- Modify: `package.json:3` (`"version": "1.0.1"` → `"version": "1.1.0"`)

The release workflow (`.github/workflows/release-spec.yml`) fails the publish if the git tag does not match `package.json` version. A new optional-field addition is a minor bump per SemVer.

- [ ] **Step 1: Update the version**

In `package.json`, change:

```json
  "version": "1.0.1",
```

to:

```json
  "version": "1.1.0",
```

- [ ] **Step 2: Verify the full test suite still passes at the new version**

Run: `npm test`
Expected: both `validate` and `test:invalid` pass.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: bump spec to 1.1.0 for external references (RFC 0002)"
```

---

### Task 6: Mark RFC 0002 as accepted and cross-link

**Files:**
- Modify: `rfcs/0002-external-references.md:9` (Status: Draft → Accepted)

- [ ] **Step 1: Update RFC status**

In `rfcs/0002-external-references.md`, change the Status row from `Draft` to `Accepted`.

- [ ] **Step 2: Commit**

```bash
git add rfcs/0002-external-references.md
git commit -m "docs(rfc): mark RFC 0002 external references as accepted"
```

---

## Self-Review Notes

- **Spec coverage (RFC 0002):** external_reference shape → Task 1; `based_on_formation` + `adjustments` → Task 1/2; `based_on_play` + `relationship` enum → Task 1/2; SemVer enforcement → Task 1 (pattern) + Task 3 (invalid fixture); shape-only validation → Tasks 2/3; docs → Task 4; minor version bump → Task 5; RFC status → Task 6. The §3.3 warn heuristic is intentionally NOT here — it is editor UX, not schema (per RFC 0002).
- **Inline vs allOf:** Task 1 uses fully inlined objects (not `allOf`) deliberately — draft-07 `additionalProperties: false` does not see through `allOf`, so composed base fields would be rejected. This is the "merged, inlined form" the RFC's implementation note calls for.
- **Type consistency:** field names (`id`, `title`, `source`, `source_version`, `adjustments`, `entity`, `dx`, `dy`, `note`, `relationship`) match RFC 0002 and the `@opencoachingformat/formations` resolver's expected `based_on_formation` shape exactly, so Plan 3 can consume documents produced here without a mismatch.
