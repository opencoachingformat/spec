# Plan 1 — Schema Version Signals (Strang A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the document/schema version signals a version-aware validator needs — optional `meta.min_schema_version`, a machine-readable `x-ocf-version` on the schema, and a published `versions.json` manifest — released as spec v1.4.0.

**Architecture:** Purely additive JSON-Schema draft-07 changes plus one CI step. `min_schema_version` reuses the exact SemVer `pattern` already in the schema (`based_on_formation.source_version`). `x-ocf-version` is a custom root keyword (ignored by validation). `versions.json` is assembled at release time from the existing `v*` gh-pages dirs plus the new tag. RFC 0005 gates it.

**Tech Stack:** JSON Schema draft-07, ajv-cli + ajv-formats, GitHub Actions, `node --test`.

**Design ref:** `docs/superpowers/specs/2026-08-28-version-aware-validator-design.md` (Strand A).

---

### Task 1: RFC 0005 — Schema Version Signals

**Files:**
- Create: `rfcs/0005-schema-version-signals.md`

- [ ] **Step 1: Write the RFC**

Copy the structure from `rfcs/0004-around-player-arc.md`. Content:

```markdown
# RFC 0005 — Schema Version Signals (meta.min_schema_version, x-ocf-version, versions.json)

| Field       | Value                                     |
|-------------|-------------------------------------------|
| RFC Number  | 0005                                      |
| Title       | Schema Version Signals                    |
| Author(s)   | opencoachingformat maintainers            |
| Created     | 2026-08-28                                |
| Status      | Draft                                     |
| Affects     | Schema + Spec + Release CI                |
| Version     | Targets OCF v1.4.0                        |

## Summary

Adds the version signals a version-aware validator needs, all additive:
- meta.min_schema_version (optional SemVer string): the minimum schema version
  required to validate the document correctly. Lets a validator tell "the
  document is wrong" from "I am out of date."
- x-ocf-version (root custom keyword): a machine-readable schema version, so
  tools read it instead of parsing the free-text $comment.
- versions.json: a published manifest of all released schema versions + latest,
  the single authority for update checks.

Additive -> minor (v1.4.0).

## Motivation

The published playground silently served an outdated validator after v1.3.0, and
even once fixed, a validator cannot today distinguish a document using a
newer-minor field from a genuinely invalid document — additionalProperties:false
rejects both identically. These signals give tooling the information to diagnose
version skew instead of guessing.

## Detailed Design

### meta.min_schema_version
Optional string on meta, validated by the same SemVer pattern already used for
based_on_formation.source_version. Absent -> no minimum (today's behavior).

### x-ocf-version
A string keyword at the schema root carrying the exact version (e.g. "1.4.0").
JSON Schema ignores unknown keywords, so validation is unchanged.

### versions.json
Emitted by the release workflow to /schema/versions.json:
{ latest, major, versions[], schema_url }.

## Backwards Compatibility
- [x] No breaking changes (additive only). Documents without the new field are
  unchanged; x-ocf-version does not affect validation.

## Testing / Regression
- valid: a doc with meta.min_schema_version "1.4.0" validates.
- invalid: meta.min_schema_version "1.4" (bad SemVer) is rejected.
- x-ocf-version is present and equals the release version.
- versions.json has the documented shape and includes the new version.

## References
- Design: docs/superpowers/specs/2026-08-28-version-aware-validator-design.md
- Related: RFC 0002 (SemVer pattern reused), the v0.1.0->0.1.1 validator skew incident.
```

- [ ] **Step 2: Commit**

```bash
git add rfcs/0005-schema-version-signals.md
git commit -m "rfc: 0005 schema version signals (min_schema_version, x-ocf-version, versions.json)"
```

---

### Task 2: Add `meta.min_schema_version` to the schema

**Files:**
- Modify: `schema/v1.json` (`meta` definition, ~line 656–674)
- Create: `examples/min-schema-version.ocf.json`

- [ ] **Step 1: Write the valid fixture first (TDD)**

Create `examples/min-schema-version.ocf.json`:

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  "sport": "basketball",
  "meta": {
    "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    "title": "Declares a minimum schema version",
    "min_schema_version": "1.4.0"
  },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [
    { "type": "offense", "nr": 2, "x": -6.75, "y": 13.98 }
  ],
  "frames": [
    {
      "id": "f1",
      "label": "Static",
      "actions": [
        { "player": "offense_2", "type": "move", "moves": [ { "to": { "named": "right_wing" } } ] }
      ],
      "end_state": { "offense_2": { "named": "right_wing" } }
    }
  ]
}
```

- [ ] **Step 2: Run validate — expect FAIL (field not yet allowed)**

Run: `npx ajv validate --spec=draft7 -s schema/v1.json -d examples/min-schema-version.ocf.json --all-errors -c ajv-formats`
Expected: FAIL — `meta must NOT have additional properties`.

- [ ] **Step 3: Add the property to `meta`**

In `schema/v1.json`, inside the `meta` properties (change the `based_on_play`
line to add `min_schema_version` after it):

```json
        "based_on_play": { "$ref": "#/definitions/based_on_play" },
        "min_schema_version": {
          "type": "string",
          "description": "Minimum OCF schema version required to validate this document correctly. Optional; when present MUST be valid SemVer. A validator whose bundled schema is older SHOULD warn that it may be out of date rather than treat unknown newer fields as errors.",
          "pattern": "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$"
        }
```

(Exact SemVer pattern already used by `based_on_formation.source_version`.)

- [ ] **Step 4: Run validate — expect PASS**

Run: `npx ajv validate --spec=draft7 -s schema/v1.json -d examples/min-schema-version.ocf.json --all-errors -c ajv-formats`
Expected: PASS — `examples/min-schema-version.ocf.json valid`.

- [ ] **Step 5: Compile-check schema stays strict-clean**

Run: `npx ajv compile --spec=draft7 -s schema/v1.json -c ajv-formats`
Expected: `schema schema/v1.json is valid`, no new strict warnings.

- [ ] **Step 6: Commit**

```bash
git add schema/v1.json examples/min-schema-version.ocf.json
git commit -m "feat(schema): add optional meta.min_schema_version (RFC 0005)"
```

---

### Task 3: Invalid fixture — bad SemVer is rejected

**Files:**
- Create: `examples/invalid/min-schema-version-bad.json`

- [ ] **Step 1: Write the invalid fixture** (`"1.4"` is not full SemVer):

```json
{
  "sport": "basketball",
  "meta": { "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", "title": "Bad min version", "min_schema_version": "1.4" },
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [ { "type": "offense", "nr": 2, "x": -6, "y": 13 } ],
  "frames": [ { "id": "f", "actions": [ { "player": "offense_2", "type": "move", "moves": [ { "to": { "named": "right_wing" } } ] } ], "end_state": { "offense_2": { "named": "right_wing" } } } ]
}
```

- [ ] **Step 2: Confirm it rejects on the pattern**

Run: `npx ajv validate --spec=draft7 -s schema/v1.json -d examples/invalid/min-schema-version-bad.json --all-errors -c ajv-formats`
Expected: FAIL; error set includes `.../meta/min_schema_version must match pattern`.

- [ ] **Step 3: Run the invalid-fixtures suite**

Run: `npm run test:invalid`
Expected: includes `ok: examples/invalid/min-schema-version-bad.json correctly rejected.`

- [ ] **Step 4: Commit**

```bash
git add examples/invalid/min-schema-version-bad.json
git commit -m "test(schema): reject malformed meta.min_schema_version"
```

---

### Task 4: Machine-readable `x-ocf-version`

**Files:**
- Modify: `schema/v1.json` (root, near `$comment` ~line 4)
- Create: `test/schema-version.test.mjs`

- [ ] **Step 1: Write the failing test**

`test/schema-version.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../schema/v1.json", import.meta.url)));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));

test("schema carries a machine-readable x-ocf-version", () => {
  assert.equal(typeof schema["x-ocf-version"], "string");
});

test("x-ocf-version matches package.json version", () => {
  assert.equal(schema["x-ocf-version"], pkg.version);
});

test("x-ocf-version matches the $comment prose version", () => {
  const m = /Schema version (\d+\.\d+\.\d+)/.exec(schema.$comment ?? "");
  assert.ok(m, "$comment should state 'Schema version X.Y.Z'");
  assert.equal(schema["x-ocf-version"], m[1]);
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `node --test test/schema-version.test.mjs`
Expected: FAIL — `x-ocf-version` undefined; version mismatch (package.json still 1.3.0).

- [ ] **Step 3: Add `x-ocf-version` to the schema root**

In `schema/v1.json`, immediately after the `$comment` line (line 4), add a line:

```json
  "x-ocf-version": "1.3.0",
```

Keep its value equal to the `$comment` version at every step. Task 6 bumps
`$comment`, `x-ocf-version`, and `package.json` together to 1.4.0.

- [ ] **Step 4: Run it — partial pass expected mid-plan**

Run: `node --test test/schema-version.test.mjs`
Expected: the "is a string" and "$comment prose" tests PASS; the
"matches package.json" test still FAILS until Task 6 bumps package.json. This is
expected; Task 6 Step 4 re-runs it fully green.

- [ ] **Step 5: Commit**

```bash
git add schema/v1.json test/schema-version.test.mjs
git commit -m "feat(schema): add machine-readable x-ocf-version keyword (RFC 0005)"
```

---

### Task 5: `versions.json` manifest at release time

**Files:**
- Create: `scripts/build-versions-manifest.mjs`
- Modify: `.github/workflows/release-spec.yml` (after Step A2, ~line 124)
- Create: `test/versions-manifest.test.mjs`

- [ ] **Step 1: Write the failing test for the generator**

`test/versions-manifest.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVersionsManifest } from "../scripts/build-versions-manifest.mjs";

test("manifest lists sorted versions with latest + major + schema_url", () => {
  const m = buildVersionsManifest({
    existing: ["v1.0.0", "v1.2.0", "v1.10.0"],
    current: "v1.4.0",
  });
  assert.equal(m.major, "v1");
  assert.equal(m.schema_url, "https://opencoachingformat.org/schema/v1.json");
  assert.deepEqual(m.versions, ["1.0.0", "1.2.0", "1.4.0", "1.10.0"]);
  assert.equal(m.latest, "1.10.0");
});

test("current version is included even if not in existing", () => {
  const m = buildVersionsManifest({ existing: ["v1.0.0"], current: "v1.4.0" });
  assert.ok(m.versions.includes("1.4.0"));
  assert.equal(m.latest, "1.4.0");
});
```

- [ ] **Step 2: Run it — expect FAIL (module missing)**

Run: `node --test test/versions-manifest.test.mjs`
Expected: FAIL — cannot find the module.

- [ ] **Step 3: Implement the generator**

`scripts/build-versions-manifest.mjs`:

```js
// Pure, testable manifest builder. The workflow feeds it the existing v* dirs
// from gh-pages plus the current release tag.
const SCHEMA_URL = "https://opencoachingformat.org/schema/v1.json";

function semverKey(v) {
  return v.split(".").map((n) => parseInt(n, 10));
}
function cmp(a, b) {
  const [aa, ab, ac] = semverKey(a);
  const [ba, bb, bc] = semverKey(b);
  return aa - ba || ab - bb || ac - bc;
}

export function buildVersionsManifest({ existing, current }) {
  const all = [...existing, current]
    .map((t) => t.replace(/^v/, ""))
    .filter((v) => /^\d+\.\d+\.\d+$/.test(v));
  const unique = [...new Set(all)].sort(cmp);
  const latest = unique[unique.length - 1];
  const major = "v" + semverKey(latest)[0];
  return { latest, major, versions: unique, schema_url: SCHEMA_URL };
}

const invokedDirectly = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  const existing = (process.argv[2] || "").split(/\s+/).filter(Boolean);
  const current = process.argv[3];
  process.stdout.write(JSON.stringify(buildVersionsManifest({ existing, current }), null, 2) + "\n");
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `node --test test/versions-manifest.test.mjs`
Expected: PASS (both tests).

- [ ] **Step 5: Wire it into the release workflow**

In `.github/workflows/release-spec.yml`, after the "Publish canonical schema
(Step A2)" step (~line 124), add:

```yaml
      - name: Publish versions manifest (Step A3)
        env:
          VERSION: ${{ github.ref_name }}
        run: |
          mkdir -p dist/schema
          git fetch origin gh-pages --depth=1 || true
          EXISTING=$(git ls-tree -r origin/gh-pages --name-only 2>/dev/null \
            | grep -oE '^v[0-9]+\.[0-9]+\.[0-9]+/ocf-action-v1.json' \
            | sed 's#/ocf-action-v1.json##' | sort -u | tr '\n' ' ')
          node scripts/build-versions-manifest.mjs "$EXISTING" "$VERSION" > dist/schema/versions.json
          echo "Published versions.json:"; cat dist/schema/versions.json
```

- [ ] **Step 6: Commit**

```bash
git add scripts/build-versions-manifest.mjs test/versions-manifest.test.mjs .github/workflows/release-spec.yml
git commit -m "feat(release): publish schema/versions.json manifest (RFC 0005)"
```

---

### Task 6: Docs, version bump to 1.4.0, RFC accept

**Files:**
- Modify: `docs/specification-v1.adoc` (`:version:`, changelog, meta-field docs)
- Modify: `package.json` (version → 1.4.0)
- Modify: `schema/v1.json` (`$comment` + `x-ocf-version` → 1.4.0)
- Modify: `rfcs/0005-schema-version-signals.md` (Status → Accepted)
- Modify: `README.md` (badge → v1.4.0)

- [ ] **Step 1: Document `meta.min_schema_version` in the spec doc**

Find the meta field section in `docs/specification-v1.adoc` (search for
`source_format`). Add:

```asciidoc
`min_schema_version` (optional, SemVer) declares the minimum schema version
needed to validate the document correctly. A validator whose bundled schema is
older should warn that it may be out of date rather than reporting the newer
fields as errors. Omit it unless the document uses a field newer than the base
version it targets.
```

- [ ] **Step 2: Bump version to 1.4.0 in all five places**

- `package.json`: `"version": "1.4.0"`
- `schema/v1.json` `$comment`: `Schema version 1.4.0. ...`
- `schema/v1.json` `x-ocf-version`: `"1.4.0"`
- `docs/specification-v1.adoc` `:version:`: `1.4.0`
- `README.md` badge: `schema-v1.4.0-blue`

- [ ] **Step 3: Add changelog entry at the TOP of the changelog**

```asciidoc
=== v1.4.0

Adds schema version signals (RFC 0005): optional `min_schema_version` in meta, a
machine-readable `x-ocf-version` keyword, and a published `versions.json`
manifest. All additive and backwards-compatible; documents without the new field
are unchanged.
```

- [ ] **Step 4: Set RFC 0005 Status to Accepted; run full suites**

Change `rfcs/0005-schema-version-signals.md` Status `Draft` → `Accepted`.

Run: `node --test test/schema-version.test.mjs`
Expected: PASS (package.json == x-ocf-version == 1.4.0 now).

Run: `npm test`
Expected: validate + test:invalid + test:positions + test:sport all pass.

Run: `node --test test/versions-manifest.test.mjs`
Expected: PASS.

- [ ] **Step 5: Verify version consistency**

Run:
```bash
grep -H '"version"' package.json; grep -H 'x-ocf-version' schema/v1.json; grep -H 'Schema version' schema/v1.json; grep -H ':version:' docs/specification-v1.adoc; grep -H 'schema-v1' README.md
```
Expected: every line shows 1.4.0.

- [ ] **Step 6: Commit**

```bash
git add docs/specification-v1.adoc package.json schema/v1.json rfcs/0005-schema-version-signals.md README.md
git commit -m "docs: document version signals; bump to 1.4.0; accept RFC 0005"
```

---

### Task 7: Site build + package-lock + PR + release

**Files:**
- Modify: `package-lock.json` (version sync)

- [ ] **Step 1: Sync package-lock version**

Run: `npm install --package-lock-only`
Verify: `grep -m2 '"version": "1.4.0"' package-lock.json` shows both root + `""` entries.

- [ ] **Step 2: Build the site (asciidoctor parses new prose + changelog)**

Run: `cd site && npm ci && npm run build:adoc && cd ..`
Expected: `Generated site/src/generated/spec.html ...` with no error.

- [ ] **Step 3: Commit the lockfile**

```bash
git add package-lock.json
git commit -m "chore: sync package-lock to 1.4.0"
```

- [ ] **Step 4: Push branch, open PR, merge after CI green, tag release**

```bash
git push -u origin <branch>
gh pr create --repo opencoachingformat/spec --base main --title "RFC 0005: schema version signals (v1.4.0)" --body "Implements RFC 0005 — meta.min_schema_version, x-ocf-version, versions.json. Additive, minor."
gh pr merge <n> --repo opencoachingformat/spec --squash --delete-branch
```

Then on synced main:
```bash
git checkout main && git pull origin main
git tag -a v1.4.0 -m "v1.4.0 — schema version signals (RFC 0005)"
git push origin v1.4.0
```

- [ ] **Step 5: Verify the release published live**

```bash
npm view @opencoachingformat/spec version
curl -s https://opencoachingformat.org/schema/v1.json | grep -o 'x-ocf-version[^,]*'
curl -s https://opencoachingformat.org/schema/versions.json | python3 -m json.tool
curl -s -o /dev/null -w '%{http_code}\n' https://opencoachingformat.org/v1.4.0/ocf-action-v1.json
```
Expected: 1.4.0 / `"x-ocf-version": "1.4.0"` / manifest latest 1.4.0 / 200.

- [ ] **Step 6: Confirm the validator auto-sync PR opened**

```bash
gh pr list --repo opencoachingformat/ocf-validator --state open
```
Expected: `auto/schema-sync-v1.4.0`. (Handled by Plan 2 — carries the auto-republish bump added there.)

---

## Self-Review Notes

- **Spec coverage (Strand A):** A1 → Task 2/3; A2 → Task 4; A3 → Task 5; RFC → Task 1/6; release → Task 7.
- **Reused SemVer pattern** (DRY): identical to `based_on_formation.source_version`.
- **Version consistency:** five locations in Task 6 + lockfile in Task 7; `x-ocf-version` kept equal to package.json/`$comment` at every step.
- **`versions.json` generator is pure + unit-tested** (Task 5) apart from the workflow, verifying sort/dedup (incl. 1.10.0 > 1.2.0) without CI.
- **Additive only:** no field removed/required; `x-ocf-version` is a no-op for validation; `$id`/filename stays v1.json.
