# RFC 0005 — Schema Version Signals (`meta.min_schema_version`, `x-ocf-version`, `versions.json`)

| Field       | Value                                     |
|-------------|-------------------------------------------|
| RFC Number  | 0005                                      |
| Title       | Schema Version Signals                    |
| Author(s)   | opencoachingformat maintainers            |
| Created     | 2026-08-28                                |
| Status      | Accepted                                  |
| Affects     | Schema + Spec + Release CI                |
| Version     | Targets OCF v1.4.0                        |

---

## Summary

Adds the version signals a version-aware validator needs, all additive:

- **`meta.min_schema_version`** (optional SemVer string): the minimum schema
  version required to validate the document correctly. Lets a validator
  distinguish *"the document is wrong"* from *"I am out of date."*
- **`x-ocf-version`** (root custom keyword): a machine-readable schema version, so
  tools read it instead of parsing the free-text `$comment`.
- **`versions.json`**: a published manifest of all released schema versions plus
  `latest`, the single authority for update checks.

Additive → **minor (v1.4.0)**.

---

## Motivation

The published playground silently served an outdated validator after v1.3.0
shipped (`@opencoachingformat/validator@0.1.0` bundled the v1.2.0 schema), so
every play using the new `side`/`arc` fields was rejected via
`additionalProperties: false`. A patch release fixed the acute case, but a deeper
gap remains: a validator today cannot tell a document that uses a *newer-minor*
field from a genuinely invalid document — `additionalProperties: false` rejects
both identically, with an identically misleading "field not allowed" message.

These three signals give tooling the information to diagnose version skew instead
of guessing:

- `min_schema_version` lets the validator say *"this document needs ≥ 1.4.0, I
  bundle 1.3.0 — I may be out of date"* instead of blaming the document.
- `x-ocf-version` gives the validator a reliable read of its own bundled version.
- `versions.json` lets the validator/playground check whether a newer version
  exists at all.

---

## Detailed Design

### `meta.min_schema_version`

Optional string on `meta`, validated by the **same SemVer pattern already used**
for `based_on_formation.source_version` / `based_on_play.source_version` (RFC
0002). Absent → no minimum (today's behavior, fully backwards-compatible). An
authoring tool sets it when it emits a field introduced in a specific minor.

`meta` keeps `additionalProperties: false` (the new key is listed).

### `x-ocf-version`

A string keyword at the schema root carrying the exact version (e.g. `"1.4.0"`).
JSON Schema ignores unknown keywords, so validation behavior is unchanged. The
release version-consistency sweep gains a fifth location beside `package.json`,
`$comment`, `:version:`, and the changelog.

### `versions.json`

Emitted by the release workflow to `https://opencoachingformat.org/schema/versions.json`:

```json
{
  "latest": "1.4.0",
  "major": "v1",
  "versions": ["1.0.0", "1.0.1", "1.1.0", "1.1.1", "1.2.0", "1.3.0", "1.4.0"],
  "schema_url": "https://opencoachingformat.org/schema/v1.json"
}
```

Assembled from the existing `v*` schema directories already on gh-pages plus the
current release tag. CORS is already `access-control-allow-origin: *` on the
schema host, so validators and browsers can fetch it.

---

## Drawbacks

- Two more optional/metadata additions to understand. Mitigated: both are inert
  for existing documents (`min_schema_version` is optional; `x-ocf-version` does
  not affect validation).
- `versions.json` is a new published artifact the release must keep correct;
  covered by a unit-tested generator.

---

## Alternatives Considered

- **Parse the version from `$comment` prose.** Rejected: brittle string parsing
  of a human-facing comment; `x-ocf-version` is explicit and stable.
- **A required `schema_version` on every document.** Rejected: breaking, and
  redundant with `$schema` (which already pins the major line). The minimum-version
  signal is only needed when a document uses newer-than-base fields, so it is
  optional.
- **`min_minor_version` as a bare integer.** Rejected: less self-describing and
  harder to extend; a full SemVer string reuses the existing pattern and tooling.

---

## Backwards Compatibility

- [x] No breaking changes (additive only)
- [ ] Breaking change — requires major version bump
- [ ] Deprecates existing fields

Documents without `min_schema_version` are unchanged; `x-ocf-version` is a no-op
for validation; `$id`/filename stays `v1.json`. **Version impact: MINOR → v1.4.0.**

---

## Testing / Regression

- **valid:** a doc with `meta.min_schema_version: "1.4.0"` validates.
- **invalid:** `meta.min_schema_version: "1.4"` (not full SemVer) is rejected on
  the pattern.
- **schema:** `x-ocf-version` is present, a string, and equals both `package.json`
  and the `$comment` prose version.
- **manifest:** `versions.json` has the documented shape, sorts SemVer correctly
  (e.g. `1.10.0` after `1.2.0`), and includes the new version.

Validator-side consumption of these signals (major guard, minor-gap warning +
on-demand fetch, `Result.schema`) is a **separate** effort (Plan 2), not part of
this schema RFC.

---

## References

- Design: `docs/superpowers/specs/2026-08-28-version-aware-validator-design.md`
- Related: RFC 0002 (External References — SemVer pattern reused); the
  v0.1.0 → 0.1.1 validator skew incident that motivated this.
