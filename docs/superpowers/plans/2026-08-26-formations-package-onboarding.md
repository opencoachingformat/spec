# Formations Package Onboarding (@opencoachingformat/formations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the existing `@opencoachingformat/formations` package (currently in `ocf-formations.zip`) into its own git repo, delete its two hand-maintained duplicates of named-position data by importing `@opencoachingformat/spec`'s new `resolveNamedPosition`, make the resolver ruleset-aware, and publish it via the same OIDC trusted-publishing pipeline as the spec.

**Architecture:** The package stays a standalone repo with `@opencoachingformat/spec` as a peer dependency (mirrors the `ocf-renderer`/`ocf-editor` split). Two duplicated copies of named-position knowledge are removed: `FIBA_NAMED_POSITIONS` in `src/resolve-formation.mjs` and `extractNamedPositions()`'s inline allowlist in `scripts/validate-registry.mjs`. Both are replaced with calls into the spec package. The resolver gains a `ruleset` option that actually works (today it throws for anything but FIBA).

**Tech Stack:** ES modules, vitest (existing), the spec package's exported `resolveNamedPosition`/`loadPositions` (from Plan 2), GitHub Actions OIDC publishing (from the spec's existing `release-spec.yml`).

**Plan 3 of 3** (sequential). DEPENDS ON: Plan 1 (schema fields, so produced documents validate) AND Plan 2 (`resolveNamedPosition` export, to delete the duplicates). Do not start until both are merged and the spec is published at a version this package can depend on (>= 1.1.0).

**Prerequisite:** `ocf-formations.zip` extracted to the target repo location. Contents: `basketball-v1.json` (10 formations), `src/resolve-formation.mjs`, `src/__tests__/resolve-formation.test.mjs`, `scripts/validate-registry.mjs`, `README.md`, `package.json`, `.gitignore`.

---

### Task 1: Initialize the formations repo from the zip

**Files:**
- Create: new repo directory (sibling to `spec/`, e.g. `open-coaching-format/ocf-formations/`)

- [ ] **Step 1: Extract the zip to the sibling location**

Run:
```bash
cd /Users/oliver-marcuseder/01-vibe-coding/00-Basektball/open-coaching-format
unzip -o ocf-formations.zip -d .
```
Expected: `ocf-formations/` directory created with the 8 files listed above.

- [ ] **Step 2: Initialize git and make the baseline commit**

Run:
```bash
cd /Users/oliver-marcuseder/01-vibe-coding/00-Basektball/open-coaching-format/ocf-formations
git init
git add .
git commit -m "chore: import @opencoachingformat/formations package baseline"
```
Expected: a clean initial commit; `.gitignore` already ignores `node_modules/`.

- [ ] **Step 3: Install dependencies and confirm the baseline tests pass as-is**

Run:
```bash
npm install
npm test
```
Expected: `[validate-registry] OK` (pretest) then vitest reports the existing suite passing (README states 11/11). This confirms the imported baseline works before we change it. If `@opencoachingformat/spec` is not yet published at the needed version, the peer dependency may warn — note it and continue; Task 3 pins it.

---

### Task 2: Make the resolver ruleset-aware by importing the spec's position resolver

**Files:**
- Modify: `src/resolve-formation.mjs` (remove `FIBA_NAMED_POSITIONS` const ~line 40-56; change `resolveFormation` ~line 66-124)
- Test: `src/__tests__/resolve-formation.test.mjs`

- [ ] **Step 1: Write a failing test for multi-ruleset resolution**

Add to `src/__tests__/resolve-formation.test.mjs` inside the `resolveFormation` describe block:

```javascript
  it("resolves the same formation in nba units, different coordinates than fiba", () => {
    const fiba = resolveFormation("5_out", [], { ruleset: "fiba" });
    const nba = resolveFormation("5_out", [], { ruleset: "nba" });
    // top_of_the_key differs by ruleset: fiba y 5.68 (m), nba y 20.75 (ft)
    const fibaPG = fiba.entities.find((e) => e.nr === 1);
    const nbaPG = nba.entities.find((e) => e.nr === 1);
    expect(fibaPG.y).toBeCloseTo(5.68, 2);
    expect(nbaPG.y).toBeCloseTo(20.75, 2);
  });

  it("still defaults to fiba when no ruleset is given", () => {
    const def = resolveFormation("5_out");
    const fiba = resolveFormation("5_out", [], { ruleset: "fiba" });
    expect(def.entities).toEqual(fiba.entities);
  });
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run -t "resolves the same formation in nba units"`
Expected: FAIL — current resolver throws for `ruleset: "nba"` ("only 'fiba' is supported").

- [ ] **Step 3: Rewrite the resolver to use the spec's position resolver**

Replace the `FIBA_NAMED_POSITIONS` const AND the resolution logic. New `src/resolve-formation.mjs` resolution core:

```javascript
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveNamedPosition } from "@opencoachingformat/spec/positions/resolve-position.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

let _registryCache = null;
function loadRegistry() {
  if (_registryCache) return _registryCache;
  const path = resolve(__dirname, "../basketball-v1.json");
  _registryCache = JSON.parse(readFileSync(path, "utf-8"));
  return _registryCache;
}

function entityRef(entity) {
  return `${entity.type}_${entity.nr}`;
}

export function resolveFormation(formationId, adjustments = [], options = {}) {
  const ruleset = options.ruleset ?? "fiba";
  const registry = loadRegistry();
  const formation = registry.formations[formationId];
  if (!formation) {
    const available = Object.keys(registry.formations).join(", ");
    throw new Error(`Unknown formation id '${formationId}'. Available: ${available}`);
  }

  const adjustmentsByEntity = new Map(adjustments.map((a) => [a.entity, a]));

  const entities = formation.entities.map((e) => {
    // resolveNamedPosition throws with a clear message if the name is unknown
    // for the ruleset — no local coordinate table, no drift.
    const base = resolveNamedPosition(e.named, ruleset);
    const ref = entityRef(e);
    const adj = adjustmentsByEntity.get(ref);
    return {
      type: e.type,
      nr: e.nr,
      x: base.x + (adj?.dx ?? 0),
      y: base.y + (adj?.dy ?? 0),
    };
  });

  return {
    entities,
    meta: {
      based_on_formation: {
        id: formationId,
        title: formation.title,
        source: `https://opencoachingformat.org/registry/formations/${registry.registry_id}.json`,
        source_version: registry.version,
        ...(adjustments.length > 0 ? { adjustments } : {}),
      },
    },
  };
}
```

Keep `listFormations` exactly as-is (it never touched coordinates).

- [ ] **Step 4: Run the new tests plus the whole suite**

Run: `npx vitest run`
Expected: the two new tests PASS and all pre-existing tests still PASS (resolution now goes through the spec package but FIBA values are identical to the old hardcoded table).

- [ ] **Step 5: Commit**

```bash
git add src/resolve-formation.mjs src/__tests__/resolve-formation.test.mjs
git commit -m "feat: resolve formations via @opencoachingformat/spec positions (multi-ruleset, no duplicate table)"
```

---

### Task 3: Remove the validator's duplicate named-position allowlist

**Files:**
- Modify: `scripts/validate-registry.mjs` (replace `extractNamedPositions()` ~line 38-63 and its call site)

- [ ] **Step 1: Replace the inline allowlist with the spec's position data**

In `scripts/validate-registry.mjs`, replace the `extractNamedPositions` function and how `knownNamed` is built. Import `loadPositions` and derive the known set from it:

```javascript
import { loadPositions } from "@opencoachingformat/spec/positions/resolve-position.mjs";

// ...

function knownNamedFor(ruleset) {
  // The set of valid named positions IS the key set of the spec's position
  // data for that ruleset — single source of truth, no hand-maintained copy.
  return new Set(Object.keys(loadPositions(ruleset)));
}
```

Then in `main()`, replace the schema-reading block with:

```javascript
function main() {
  let knownNamed;
  try {
    // Registry formations are expressed via FIBA named positions (the base
    // catalog); every ruleset shares the same position NAMES, so validating
    // against fiba's key set is sufficient and ruleset-independent.
    knownNamed = knownNamedFor("fiba");
  } catch (e) {
    console.error(`[validate-registry] Could not load spec positions: ${e.message}`);
    process.exit(1);
  }

  const files = readdirSync(REGISTRY_DIR).filter((f) => f.endsWith(".json") && f !== "package.json");
  let allErrors = [];
  for (const file of files) {
    const errors = validateRegistryFile(resolve(REGISTRY_DIR, file), knownNamed);
    allErrors = allErrors.concat(errors);
  }

  if (allErrors.length > 0) {
    console.error(`[validate-registry] ${allErrors.length} error(s):`);
    for (const e of allErrors) console.error("  -", e);
    process.exit(1);
  }

  console.log(`[validate-registry] OK — validated ${files.length} registry file(s).`);
}
```

Remove the now-unused `resolveSchemaPath`, the schema `readFileSync`, and the `extractNamedPositions` function entirely.

- [ ] **Step 2: Run the validator**

Run: `npm run validate`
Expected: `[validate-registry] OK — validated 1 registry file(s).` — every `basketball-v1.json` named position now checked against the spec's actual position key set. If any formation references a name NOT in `positions/fiba-v1.json`, this now catches it (the whole point).

- [ ] **Step 3: Run the full suite (pretest runs validate)**

Run: `npm test`
Expected: validate OK, then all vitest tests pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/validate-registry.mjs
git commit -m "refactor: validate registry against spec's position data, drop duplicate allowlist"
```

---

### Task 4: Pin the spec peer dependency and update the README

**Files:**
- Modify: `package.json` (`peerDependencies`)
- Modify: `README.md` (remove the "Known gap" section — the gap is now closed)

- [ ] **Step 1: Bump the peer dependency to the version that ships positions**

In `package.json`, change:

```json
  "peerDependencies": {
    "@opencoachingformat/spec": "^1.0.0"
  },
```

to (Plan 1 bumped the spec to 1.1.0; positions ship in Plan 2 within that line — confirm the actual published version and pin its minor floor):

```json
  "peerDependencies": {
    "@opencoachingformat/spec": "^1.1.0"
  },
```

Also add it as a devDependency so local `npm test` resolves it without a separate install:

```json
  "devDependencies": {
    "@opencoachingformat/spec": "^1.1.0",
    "vitest": "^4.1.11"
  }
```

- [ ] **Step 2: Install and re-run to confirm resolution works via the published/pinned dep**

Run: `npm install && npm test`
Expected: dependency resolves, all tests pass.

- [ ] **Step 3: Remove the now-obsolete "Known gap" section from the README**

In `README.md`, delete the entire "## Known gap: named-position coordinates are duplicated, not imported" section. Replace the Status bullet that referenced it with:

```markdown
- **Resolver** (`src/resolve-formation.mjs`): resolves via
  `@opencoachingformat/spec`'s `resolveNamedPosition(name, ruleset)` — no
  duplicated coordinate table. Supports all rulesets the spec ships
  (fiba, nba, ncaa, nfhs).
```

- [ ] **Step 4: Commit**

```bash
git add package.json README.md
git commit -m "chore: pin spec >=1.1.0, remove closed 'known gap' from README"
```

---

### Task 5: Add the OIDC publishing workflow

**Files:**
- Create: `.github/workflows/release.yml`

Mirror the spec's `release-spec.yml` publish job (OIDC trusted publishing, no NPM_TOKEN). Only the npm-publish job is needed here (no docs site).

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  publish-npm:
    runs-on: ubuntu-latest
    name: Publish @opencoachingformat/formations to npm
    permissions:
      contents: read
      id-token: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'

      - name: Check tag matches package.json version
        env:
          VERSION: ${{ github.ref_name }}
        run: |
          PKG_VERSION="v$(node -p "require('./package.json').version")"
          if [ "$VERSION" != "$PKG_VERSION" ]; then
            echo "::error::tag $VERSION does not match package.json version $PKG_VERSION"
            exit 1
          fi

      - name: Install dependencies
        run: npm ci

      - name: Run tests before publishing
        run: npm test

      # OIDC trusted publishing (npm CLI >=11.5.1 via setup-node@v6 Node 22).
      # Requires a trusted publisher configured on the npm package pointing at
      # this repo + this workflow file; the package must already exist (a
      # one-time manual `npm publish` bootstraps it). Provenance is automatic.
      - name: Publish to npm
        run: npm publish
```

- [ ] **Step 2: Ensure `package.json` has public publish access**

In `package.json`, add (the spec package has this; scoped packages default to restricted otherwise):

```json
  "publishConfig": {
    "access": "public"
  },
```

- [ ] **Step 3: Add a package-lock so `npm ci` works in CI**

Run: `npm install` (generates/updates `package-lock.json`), then:

```bash
git add package.json package-lock.json .github/workflows/release.yml
git commit -m "ci: add OIDC npm publishing workflow for formations package"
```

Expected: `package-lock.json` present and committed so CI's `npm ci` resolves.

---

### Task 6: Document the bootstrap-publish step and cross-link

**Files:**
- Modify: `README.md` (add a "Releasing" section)

- [ ] **Step 1: Add a Releasing section**

Append to `README.md`:

```markdown
## Releasing

Published to npm via GitHub Actions OIDC trusted publishing (no NPM_TOKEN),
same mechanism as `@opencoachingformat/spec`.

1. First release only: a maintainer runs `npm publish --access public` once
   locally to create the package, then configures a trusted publisher on npm
   pointing at this repo + `.github/workflows/release.yml`.
2. Thereafter: bump `version` in `package.json`, commit, tag `vX.Y.Z`
   (tag MUST match `package.json` version), and push the tag. The workflow
   runs the test suite and publishes.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document OIDC release process for formations package"
```

---

## Self-Review Notes

- **Duplicate elimination (the whole point):** both copies removed — `FIBA_NAMED_POSITIONS` (Task 2) and `extractNamedPositions`'s inline allowlist (Task 3), each replaced by a call into `@opencoachingformat/spec`. The README's "Known gap" section is deleted in Task 4 because it no longer applies.
- **Dependency ordering enforced:** the plan header states Plan 3 needs Plans 1 (schema) + 2 (positions export) merged and published first; Task 4 pins `^1.1.0`.
- **Type consistency:** calls `resolveNamedPosition(name, ruleset)` → `{ x, y }` and `loadPositions(ruleset)` → flat map — exactly the exports Plan 2 Task 6 defines. `based_on_formation` output shape matches Plan 1's schema field (id/title/source/source_version/adjustments).
- **Behavior preserved:** FIBA resolution values are unchanged (spec's `fiba-v1.json` is a lossless copy of the same table the old `FIBA_NAMED_POSITIONS` mirrored), so all pre-existing tests still pass — verified in Task 2 Step 4.
- **New capability:** resolver now works for nba/ncaa/nfhs, tested in Task 2. The old "only fiba supported" throw is gone.
- **Publishing consistent with the project:** OIDC trusted publishing mirrors `release-spec.yml`, including the tag==version guard and the one-time bootstrap-publish caveat.
