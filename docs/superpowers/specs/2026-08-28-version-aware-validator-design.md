# Design: Version-Aware Validator, Auto-Republish & Playground Transparency

| Field    | Value                                                        |
|----------|--------------------------------------------------------------|
| Date     | 2026-08-28                                                   |
| Status   | Draft (design)                                               |
| Repos    | `opencoachingformat/spec`, `opencoachingformat/ocf-validator` |
| Sibling  | Site multi-sport redesign — *separate*, later spec (Strang C) |

## Problem

The playground on opencoachingformat.org silently served an outdated validator
(`@opencoachingformat/validator@0.1.0`, bundling schema v1.2.0) after spec
v1.3.0 shipped, so every play using the new `side`/`arc` fields was rejected via
`additionalProperties: false`. A patch release (0.1.1) fixed the acute case, but
the underlying architecture has three gaps:

1. **The validator has no version awareness.** It statically imports exactly one
   schema copy (`import schema from ".../ocf-action-v1.json"`), has zero
   `version`/`major`/`schemaVersion` handling, and its semantic rules hard-code
   the v1 document shape (`.frames`, `.actions`, `.end_state`, `.balls`,
   `.carried_by`, …). It is stable *within* the additive v1 line but is **not**
   major-stable: a v2 document would be silently mis-validated as v1.

2. **The "outdated validator" case is indistinguishable from a bad document.**
   If a document uses a field from a *newer* minor (e.g. a hypothetical 1.4.0
   `move_step.spin`) but the loaded validator only knows 1.3.0,
   `additionalProperties: false` rejects it with a misleading "`spin` is not
   allowed" — when the real cause is that the validator is stale. The validator
   cannot tell "document is wrong" from "I am out of date."

3. **No forcing function keeps the published validator current.** The spec
   release does not bump/republish the validator, and there is no version
   manifest for anyone (validator or playground) to check against.

## Goals

- The validator is **honest** about which schema version it validated against and
  whether that matches what the document declares/requires.
- A document that requires a **newer minor** than the bundled schema triggers a
  clear warning (not a misleading hard-fail) and, when reachable, an on-demand
  fetch of the current schema so it can validate correctly anyway.
- A document targeting a **different major** is deliberately rejected with a
  dedicated code instead of silently mis-validated.
- Spec releases **auto-republish** the validator as a patch, so the playground
  never silently goes stale again.
- The playground **always demonstrates the latest** validator and surfaces the
  active schema version + an "update available" hint.

## Non-Goals

- Real multi-major validation (loading v2 semantics). v2 does not exist; building
  for its unknown shape is speculative (YAGNI). We build **v1-only but
  major-ready**: a thin boundary that refuses non-v1 documents cleanly.
- Per-minor historical validation (validating against 1.1.0 vs 1.2.0
  individually). Within v1 everything is additive, so an old document already
  validates against the newest v1 schema — granular minor selection has no real
  payoff and would force bundling every historical schema.
- The site multi-sport content redesign — tracked as its own later spec.

---

## Strand A — Spec / schema changes (`opencoachingformat/spec`)

All additive → **MINOR bump** (targets v1.4.0), gated by an RFC.

### A1. `meta.min_schema_version` (new, optional)

An optional SemVer string on the existing `meta` object:

```json
"meta": { "min_schema_version": "1.4.0", ... }
```

Semantics: "correctly validating this document requires schema **>= this
version**." Absent → no minimum (today's behavior; fully backwards-compatible).
An authoring tool sets it when it emits a field introduced in a specific minor.
This is the signal that lets a validator distinguish "I am outdated" from "the
document is wrong."

Schema: add to `meta.properties` as `{ "type": "string", "pattern": "<semver>" }`,
`meta` keeps `additionalProperties: false` (the key is now listed).

### A2. Machine-readable schema version

Today the version lives only as free text in the root `$comment`
("Schema version 1.3.0. …"). Add a robust machine-readable keyword at the schema
root:

```json
"x-ocf-version": "1.4.0"
```

JSON Schema ignores unknown keywords, so validation is unaffected. The validator
reads its bundled version from `x-ocf-version` instead of parsing prose. The
release version-consistency sweep gains a 5th location (`x-ocf-version`) beside
`package.json`, `$comment`, `:version:`, and the changelog.

### A3. `versions.json` manifest

`release-spec.yml` generates/updates `dist/schema/versions.json`, deployed to
`https://opencoachingformat.org/schema/versions.json`:

```json
{
  "latest": "1.4.0",
  "major": "v1",
  "versions": ["1.0.0","1.0.1","1.1.0","1.1.1","1.2.0","1.3.0","1.4.0"],
  "schema_url": "https://opencoachingformat.org/schema/v1.json"
}
```

CORS is already `access-control-allow-origin: *` on the schema host, so both the
validator and the browser playground can fetch it. This is the single authority
for update checks.

---

## Strand B — Validator + site (`ocf-validator`, `spec/site`)

### B1. `schemaInfo` export

The validator reads `x-ocf-version` from its bundled schema and exports:

```ts
export const schemaInfo = { version: "1.4.0", major: "v1", id: "https://opencoachingformat.org/schema/v1.json" };
```

### B2. Major guard

On validate, read `doc.$schema`. If it points at a **different major** than the
bundled schema (e.g. `.../schema/v2.json` under a v1 validator), stop with a
dedicated error `SCHEMA_MAJOR_UNSUPPORTED` — never silently run v1 semantics on a
v2 document. Absent `$schema` or matching major → proceed as today.

### B3. Minor-gap handling (the core scenario)

When `meta.min_schema_version` is **higher** than the bundled version:

- **Sync path (`validate`)**: emit warning `VALIDATOR_MAYBE_OUTDATED`
  ("document requires >= 1.4.0; this validator bundles 1.3.0 — the errors below
  may be caused by an out-of-date validator") and best-effort validate against
  the bundled schema. Nothing is silently swallowed. No network in the sync path.
- **Async path (`validateAsync`)**: attempt a **one-time** fetch of the current
  schema from the `$schema` URL.
  - Fetch OK → validate against the fetched newer schema; `Result.schema.validatedAgainst` = fetched version.
  - Fetch fails / offline → fall back to the sync behavior (warning + best-effort).

### B4. API shape (backwards-compatible)

- `validate(doc): Result` stays **synchronous** and offline — unchanged
  signature. Minor-gap → warning, never a fetch.
- `validateAsync(doc, { fetchLatestSchema = true }): Promise<Result>` is new and
  may fetch on demand (B3). The existing sync API is not broken.

### B5. `Result.schema` (additive)

```ts
Result.schema = {
  validatedAgainst: "1.3.0",           // version actually used
  documentDeclared: "https://.../schema/v1.json" | null, // doc's $schema
  requiredByDoc: "1.4.0" | null,       // doc's meta.min_schema_version
  match: true                          // major matches AND validatedAgainst >= requiredByDoc
};
```

`match` is computed against `validatedAgainst` (the version actually used), not
against the bundled version — so after a successful on-demand fetch (B3),
`validatedAgainst` may exceed the bundled version and `match` is `true`.

Existing `valid`/`errors`/`warnings`/`summary` fields are untouched.

### B6. New codes

- `SCHEMA_MAJOR_UNSUPPORTED` (error) — document targets a different schema major.
- `VALIDATOR_MAYBE_OUTDATED` (warning) — document requires a newer minor than
  bundled and the current schema could not be used.

Both added to `shared/error-codes.json` (TS + Python mirrors) with spec_refs.

### B7. Auto-republish (CI)

Extend `sync-from-spec.yml`: after syncing the schema, **also** bump the patch
version of `packages/ts/package.json` (+ lockfile) in the same PR. This is a
**patch** because a pure schema sync changes only the bundled (additive) schema
bytes, not validator logic. On merge of the `auto/schema-sync-*` PR, a workflow
**auto-tags** `vX.Y.Z`, which triggers the existing `release-ts.yml` → npm
publish. So: spec release ⇒ schema-sync PR (human-reviewed) ⇒ merge ⇒ auto-tag ⇒
auto npm release, with no manual step.

**Boundary:** auto-republish covers only the pure-patch case (schema bytes
changed, validator code unchanged). If a sync ever needs a validator *code*
change (e.g. a new error code, a breaking schema shape), CI surfaces that (the
bundle/tests) and a human handles the non-patch release deliberately.

### B8. Playground transparency (`spec/site`)

- Show "validated against **1.3.0**" + "document declares **v1** ✓/✗" from
  `Result.schema`.
- On load, compare the validator version to `versions.json`'s `latest`; if newer,
  show a discreet "newer schema version X available" hint.
- Change the pin from exact `0.1.1` to **`@latest`** (`OCF_VALIDATOR_VERSION`
  becomes `latest`) so the playground always demonstrates the newest validator,
  backed by the update hint.

---

## Data flow (validate, async path)

```
doc ──> read $schema (major?) ──mismatch──> SCHEMA_MAJOR_UNSUPPORTED (stop)
   └─match/absent─> read meta.min_schema_version
        ├─ <= bundled ──> validate against bundled schema
        └─ >  bundled ──> try fetch current schema
                 ├─ ok   ──> validate against fetched schema
                 └─ fail ──> VALIDATOR_MAYBE_OUTDATED + best-effort bundled
   ──> assemble Result (+ Result.schema block)
```

## Testing

- **A (schema):** valid fixture with `meta.min_schema_version`; invalid fixture
  with a malformed version string; `x-ocf-version` present & machine-read;
  `versions.json` shape asserted in the release build.
- **B2 guard:** a doc with `$schema` = `.../v2.json` → `SCHEMA_MAJOR_UNSUPPORTED`,
  no v1 semantic errors leaking.
- **B3 sync:** doc with `min_schema_version` above bundled → `VALIDATOR_MAYBE_OUTDATED`
  warning + best-effort; **async** with a stubbed fetch returning a newer schema
  → validates clean; stubbed fetch failure → falls back to the warning.
- **B4 compat:** existing `validate(doc)` call sites unchanged; TS + Python
  conformance parity maintained.
- **B7 CI:** the sync workflow produces a patch bump; the auto-tag triggers a
  release (dry-run/asserted in CI where possible).
- **B8:** playground renders the schema block + update hint; `@latest` resolves.

## Rollout order

1. Strand A RFC + schema/manifest (spec v1.4.0), released.
2. Strand B validator (schemaInfo, guard, gap handling, codes, API) → validator
   minor release (new public API = a minor, e.g. 0.2.0).
3. B7 auto-republish wiring (verified end-to-end on the next sync).
4. B8 playground transparency + `@latest` pin.

Python mirror (`packages/py`) tracks B2/B3/B5/B6 for conformance parity.
