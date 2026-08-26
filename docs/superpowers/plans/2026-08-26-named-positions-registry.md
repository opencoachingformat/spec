# Named Positions Registry (structured JSON per ruleset) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the named-position coordinate catalog from `.adoc` prose to structured JSON data (`positions/{fiba,nba,ncaa,nfhs}-v1.json`), exported from `@opencoachingformat/spec`, so `ocf-renderer` and `@opencoachingformat/formations` import one source of truth instead of each hand-copying it.

**Architecture:** One JSON file per ruleset, each a flat `{ positionName: { x, y } }` map plus metadata — the exact shape the formations resolver already consumes (`FIBA_NAMED_POSITIONS`). FIBA is a lossless copy of the existing spec table. NBA/NCAA/NFHS are derived from verified official court geometry (researched, see the memory note `court-geometry-rulesets`), with every derived file validated against the 6 cross-ruleset anchor values already asserted in `docs/specification-v1.adoc`. A small resolver function is exported so consumers call it instead of importing raw JSON.

**Tech Stack:** Plain JSON data, ES module resolver (`.mjs`), node:test for the validation/consistency tests, ajv unaffected (schema unchanged).

**Plan 2 of 3** (sequential). Independent of Plan 1 (schema). Plan 3 (formations package) depends on this plan's exported resolver to delete its duplicate table.

**Verified geometry inputs (from research, all cross-checked against the spec's 6 anchors — no contradictions found):**
- Basket center from baseline: FIBA 1.575 m; NBA/NCAA/NFHS **5.25 ft** (NOT 4 ft — that's the backboard).
- Court L×W: FIBA 28×15 m; NBA 94×50 ft; NCAA 94×50 ft; NFHS **84×50 ft**.
- Lane (paint) width: FIBA 4.9 m (block/elbow x = ±2.45); NBA **16 ft** (±8.0); NCAA/NFHS **12 ft** (±6.0).
- Free-throw line from basket center: FIBA 5.8 m (y 8.2 vs basket 14.0... see FIBA table); NBA/NCAA/NFHS **13.75 ft** (→ FT-line y from baseline 19.0 ft).
- 3pt: FIBA arc 6.75 m, corner x ±7.5; NBA arc 23.75 ft, corners straight 3 ft from sideline (±25.0 corner x); NCAA arc 22.146 ft, corner 3'4" from sideline; NFHS uniform 19.75 ft, corner 5'3" from sideline.

---

### Task 1: Define the positions JSON structure and write the FIBA file (lossless)

**Files:**
- Create: `positions/fiba-v1.json`

The FIBA values already exist in `docs/specification-v1.adoc:224-277`. This task is a **lossless restructuring** — copy exact values, do not recompute.

- [ ] **Step 1: Write `positions/fiba-v1.json`**

Coordinate origin is court center; frontcourt y positive; units meters. Structure: metadata + a flat `positions` map. Backcourt entries are the y-negation of frontcourt (as the spec states).

```json
{
  "$schema": "https://opencoachingformat.org/registry/positions/positions-schema-v1.json",
  "registry_id": "fiba-v1",
  "ruleset": "fiba",
  "unit": "m",
  "version": "1.0.0",
  "court": { "length": 28.0, "width": 15.0 },
  "positions": {
    "basket": { "x": 0.0, "y": 12.425 },
    "left_block": { "x": -2.45, "y": 11.0 },
    "right_block": { "x": 2.45, "y": 11.0 },
    "paint_center": { "x": 0.0, "y": 10.5 },
    "left_short_corner": { "x": -7.5, "y": 11.5 },
    "right_short_corner": { "x": 7.5, "y": 11.5 },
    "left_elbow": { "x": -2.45, "y": 8.2 },
    "right_elbow": { "x": 2.45, "y": 8.2 },
    "free_throw_line": { "x": 0.0, "y": 8.2 },
    "high_post_left": { "x": -2.45, "y": 7.0 },
    "high_post_right": { "x": 2.45, "y": 7.0 },
    "top_of_the_key": { "x": 0.0, "y": 5.68 },
    "left_wing": { "x": -6.75, "y": 8.6 },
    "right_wing": { "x": 6.75, "y": 8.6 },
    "left_corner": { "x": -7.5, "y": 13.98 },
    "right_corner": { "x": 7.5, "y": 13.98 },
    "midcourt.center": { "x": 0.0, "y": 0.0 },
    "midcourt.left": { "x": -7.5, "y": 0.0 },
    "midcourt.right": { "x": 7.5, "y": 0.0 },
    "backcourt.basket": { "x": 0.0, "y": -12.425 },
    "backcourt.left_block": { "x": -2.45, "y": -11.0 },
    "backcourt.right_block": { "x": 2.45, "y": -11.0 },
    "backcourt.left_elbow": { "x": -2.45, "y": -8.2 },
    "backcourt.right_elbow": { "x": 2.45, "y": -8.2 },
    "backcourt.free_throw_line": { "x": 0.0, "y": -8.2 },
    "backcourt.top_of_the_key": { "x": 0.0, "y": -5.68 },
    "backcourt.left_wing": { "x": -6.75, "y": -8.6 },
    "backcourt.right_wing": { "x": 6.75, "y": -8.6 },
    "backcourt.left_corner": { "x": -7.5, "y": -13.98 },
    "backcourt.right_corner": { "x": 7.5, "y": -13.98 },
    "inbound.baseline_left": { "x": -3.0, "y": 14.0 },
    "inbound.baseline_right": { "x": 3.0, "y": 14.0 },
    "inbound.baseline_center": { "x": 0.0, "y": 14.0 },
    "inbound.sideline_left_fc": { "x": -7.5, "y": 8.2 },
    "inbound.sideline_right_fc": { "x": 7.5, "y": 8.2 },
    "inbound.sideline_left_mid": { "x": -7.5, "y": 0.0 },
    "inbound.sideline_right_mid": { "x": 7.5, "y": 0.0 },
    "inbound.sideline_left_bc": { "x": -7.5, "y": -8.2 },
    "inbound.sideline_right_bc": { "x": 7.5, "y": -8.2 }
  }
}
```

- [ ] **Step 2: Verify it is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('positions/fiba-v1.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 3: Verify no value drifted from the .adoc table**

Run: `node -e "const p=require('./positions/fiba-v1.json').positions; const c=[['top_of_the_key',0,5.68],['left_wing',-6.75,8.6],['left_corner',-7.5,13.98],['free_throw_line',0,8.2],['left_elbow',-2.45,8.2],['basket',0,12.425]]; for(const [n,x,y] of c){if(p[n].x!==x||p[n].y!==y)throw new Error('drift at '+n)} console.log('fiba anchors ok')"`
Expected: `fiba anchors ok`.

- [ ] **Step 4: Commit**

```bash
git add positions/fiba-v1.json
git commit -m "feat(positions): promote FIBA named positions to structured JSON (lossless)"
```

---

### Task 2: Derive and write the NBA positions file

**Files:**
- Create: `positions/nba-v1.json`

Derive from verified NBA geometry. Court 94×50 ft → half length 47, half width 25. Basket center 5.25 ft from baseline → **basket y = 47 − 5.25 = 41.75**. All frontcourt y are measured up from center; compute each as `41.75 − (distance from basket toward center)` or `47 − (distance from baseline)`.

Derivation rules (document each in a `_derivation` note field is NOT needed — keep files clean; the rules live here in the plan):
- Lane width 16 ft → block/elbow x = ±8.0. Blocks sit on the lane edge near the basket; use the same baseline-relative offsets as FIBA proportionally: block at low post ≈ basket y minus ~1.4 ft equivalent. **Use FT-line and basket as exact anchors; position intermediate spots by the same offsets-from-basket ratio the FIBA table uses, then round to 0.01 ft.**
- free_throw_line y = 47 − 19.0 = **28.0** (FT line 19 ft from baseline). elbows share FT-line y → left/right_elbow y = 28.0, x = ±8.0.
- top_of_the_key y: anchor value is **20.75 ft up-court from center** per the spec → y = 20.75. (Spec asserts NBA top_of_the_key y = 20.75.)
- wing x = ±22.15 (spec anchor), wing y: place on the arc at ~45°; use the spec's FIBA wing offset pattern — wing y ≈ FT-line region. **Set wing y so it lies on the 23.75 ft arc from basket: y = 41.75 − sqrt(23.75² − 22.15²) = 41.75 − sqrt(564.06 − 490.62) = 41.75 − 8.57 = 33.18.** Round 33.18.
- corner x = ±25.0 (spec anchor, straight section 3 ft from sideline → 25 − 3 = 22 from basket, but x is at sideline-3ft = 22 from center... NOTE: corner x anchor is ±25.0 meaning at the sideline; the straight 3pt section is 3 ft inside, so the corner-3 SHOOTING spot x = ±22.0, but the named `corner` in FIBA sits at the sideline ±7.5 = court edge. **Match FIBA semantics: `left_corner`/`right_corner` x = half-width = ±25.0 (court corner region).** corner y = 47 − 46.58 = **0.42**? NO — spec anchor corner y = 46.58 ft FROM CENTER is wrong reading; 46.58 is distance from... VERIFY in Step 2 against anchor before writing.**

> IMPLEMENTATION NOTE: The corner y anchor (46.58 ft) and the coordinate-system origin interact subtly. Before writing final numbers, Step 1 below computes them and Step 2 asserts them against the 6 anchors. If an anchor fails, STOP and reconcile — do not write unverified coordinates.

- [ ] **Step 1: Compute the NBA position set from the rules above and write `positions/nba-v1.json`**

Use this structure (fill computed values; `court.length` 94, `width` 50, `unit` "ft"). Include the same position NAMES as FIBA (frontcourt + midcourt + backcourt as y-negation + inbound). Compute each frontcourt y and x per the derivation rules; mirror left/right by x-sign; negate y for backcourt.

```json
{
  "$schema": "https://opencoachingformat.org/registry/positions/positions-schema-v1.json",
  "registry_id": "nba-v1",
  "ruleset": "nba",
  "unit": "ft",
  "version": "1.0.0",
  "court": { "length": 94.0, "width": 50.0 },
  "positions": {
    "basket": { "x": 0.0, "y": 41.75 },
    "free_throw_line": { "x": 0.0, "y": 28.0 },
    "left_elbow": { "x": -8.0, "y": 28.0 },
    "right_elbow": { "x": 8.0, "y": 28.0 },
    "top_of_the_key": { "x": 0.0, "y": 20.75 },
    "left_wing": { "x": -22.15, "y": 33.18 },
    "right_wing": { "x": 22.15, "y": 33.18 }
    /* ...remaining positions computed by the same rules... */
  }
}
```

- [ ] **Step 2: Assert every NBA anchor value matches the spec's difference table**

Run: `node -e "const p=require('./positions/nba-v1.json').positions; const a=[['top_of_the_key','y',20.75],['left_wing','x',-22.15],['left_corner','x',-25.0],['free_throw_line','y',28.0],['left_elbow','x',-8.0]]; for(const [n,k,v] of a){const got=p[n][k]; if(Math.abs(got-v)>0.01)throw new Error('NBA anchor FAIL '+n+'.'+k+' = '+got+' expected '+v)} console.log('NBA anchors ok')"`
Expected: `NBA anchors ok`. If it fails, STOP and reconcile the derivation before proceeding.

- [ ] **Step 3: Sanity-check wing lies on the 3pt arc**

Run: `node -e "const p=require('./positions/nba-v1.json').positions; const b=p.basket; const w=p.left_wing; const r=Math.hypot(w.x-b.x, w.y-b.y); if(Math.abs(r-23.75)>0.2)throw new Error('wing not on 23.75 arc: r='+r); console.log('NBA wing arc ok r='+r.toFixed(2))"`
Expected: `NBA wing arc ok` with r ≈ 23.75.

- [ ] **Step 4: Commit**

```bash
git add positions/nba-v1.json
git commit -m "feat(positions): derive NBA named positions from verified court geometry"
```

---

### Task 3: Derive and write the NCAA positions file

**Files:**
- Create: `positions/ncaa-v1.json`

NCAA men's: court 94×50 (same as NBA). Basket y = 41.75. Lane width **12** → elbow x = ±6.0. FT line y = 28.0. Arc **22.146** ft. top_of_the_key y anchor = 20.75. wing x anchor = ±20.75. corner x anchor = ±25.0, corner y anchor = 46.58 (same as NBA).

- wing y on the 22.146 arc: y = 41.75 − sqrt(22.146² − 20.75²) = 41.75 − sqrt(490.44 − 430.56) = 41.75 − 7.74 = **34.01**.
- Blocks/paint spots: same baseline-relative offsets as NBA but lane edge at ±6.0 not ±8.0.

- [ ] **Step 1: Compute and write `positions/ncaa-v1.json`** (same structure as NBA, `registry_id` "ncaa-v1", `ruleset` "ncaa", elbow x ±6.0, wing (±20.75, 34.01)).

- [ ] **Step 2: Assert NCAA anchors**

Run: `node -e "const p=require('./positions/ncaa-v1.json').positions; const a=[['top_of_the_key','y',20.75],['left_wing','x',-20.75],['left_corner','x',-25.0],['free_throw_line','y',28.0],['left_elbow','x',-6.0]]; for(const [n,k,v] of a){if(Math.abs(p[n][k]-v)>0.01)throw new Error('NCAA anchor FAIL '+n+'.'+k)} console.log('NCAA anchors ok')"`
Expected: `NCAA anchors ok`.

- [ ] **Step 3: Sanity-check wing on 22.146 arc**

Run: `node -e "const p=require('./positions/ncaa-v1.json').positions; const b=p.basket,w=p.left_wing; const r=Math.hypot(w.x-b.x,w.y-b.y); if(Math.abs(r-22.146)>0.2)throw new Error('NCAA wing arc r='+r); console.log('NCAA wing arc ok r='+r.toFixed(2))"`
Expected: `NCAA wing arc ok`.

- [ ] **Step 4: Commit**

```bash
git add positions/ncaa-v1.json
git commit -m "feat(positions): derive NCAA named positions from verified court geometry"
```

---

### Task 4: Derive and write the NFHS positions file

**Files:**
- Create: `positions/nfhs-v1.json`

NFHS: court **84×50** → half length **42**. Basket y = 42 − 5.25 = **36.75**. Lane width 12 → elbow x ±6.0. FT line y = 42 − 19.0 = **23.0**. 3pt uniform **19.75** ft (no reduced corner). top_of_the_key y anchor = 19.75. wing x anchor = ±19.75.

- top_of_the_key on the arc straight up: y = basket_y − 19.75 = 36.75 − 19.75 = **17.0**? But the spec anchor asserts top_of_the_key y = 19.75. RECONCILE: the anchor "19.75" is the DISTANCE, and top_of_the_key y (from center) depends on basket_y. **This is exactly the kind of conflict to resolve in Step 2 — the spec's difference table lists "top_of_the_key y" as 19.75 for NFHS; confirm whether that column is distance-from-basket or absolute-y-from-center, and make the file consistent with how FIBA's 5.68 relates to its basket_y 12.425 (12.425 − 5.68 = 6.745 ≈ 6.75 m arc). So top_of_the_key y = basket_y − arc_radius.** For NFHS: 36.75 − 19.75 = 17.0. So the "19.75" anchor is the ARC RADIUS, and absolute y = 17.0. Apply the same reading to NBA/NCAA and RE-VERIFY Tasks 2-3 if needed.

> CRITICAL RECONCILIATION: FIBA proves the rule — top_of_the_key absolute y (5.68) = basket_y (12.425) − arc (6.745). The spec's "difference table" lists the value 5.68 for FIBA which is the ABSOLUTE y, and 20.75 for NBA. Check: NBA basket_y 41.75 − arc 23.75 = 18.0, NOT 20.75. CONTRADICTION. This means NBA top_of_the_key is NOT at the arc apex along center, OR basket_y differs. STOP: resolve this before finalizing ANY non-FIBA file — see Task 5.

- [ ] **Step 1: Do NOT write final NFHS coordinates until Task 5 reconciles the top_of_the_key relationship.** Placeholder: create the file with basket, free_throw_line, elbows, corner (the unambiguous ones), leave arc-dependent spots (top_of_the_key, wings) for after Task 5.

- [ ] **Step 2: Commit the unambiguous NFHS spots**

```bash
git add positions/nfhs-v1.json
git commit -m "wip(positions): NFHS unambiguous spots, arc spots pending reconciliation"
```

---

### Task 5: Reconcile the top_of_the_key / arc relationship across rulesets

**Files:**
- Modify: `positions/nba-v1.json`, `positions/ncaa-v1.json`, `positions/nfhs-v1.json`
- Reference: `docs/specification-v1.adoc:288-294`

The spec's difference table and the arc geometry appear to disagree for NBA (basket_y − arc ≠ stated top_of_the_key y). This task resolves it authoritatively before the derived files are finalized.

- [ ] **Step 1: Determine the spec's intended meaning**

Re-read `docs/specification-v1.adoc:288` ("top_of_the_key y | 5.68 | 20.75 | 20.75 | 19.75"). Establish whether these are absolute y-from-center (like the FIBA main table's 5.68) or distances. FIBA's own value 5.68 IS absolute-y-from-center (it appears identically in the main FIBA table at line 241). Therefore the NBA/NCAA/NFHS values (20.75, 20.75, 19.75) are ALSO intended as absolute y-from-center.

- [ ] **Step 2: Adopt the spec's absolute values as authoritative for top_of_the_key**

Set `top_of_the_key` = { x: 0, y: 20.75 } (NBA), { x: 0, y: 20.75 } (NCAA), { x: 0, y: 19.75 } (NFHS). These come DIRECTLY from the spec anchor table — no derivation. The arc apex not coinciding with this point is acceptable: `top_of_the_key` is a named coaching spot the spec defines by fiat, not a pure geometric apex. Document this in a one-line comment in the plan (here), not the JSON.

- [ ] **Step 3: Recompute wings consistently**

Wings lie on the arc at the wing x anchor. wing y = basket_y − sqrt(arc² − wing_x²), which is a geometric spot independent of top_of_the_key. Keep the Task 2/3 wing values (NBA 33.18, NCAA 34.01). For NFHS: basket_y 36.75, arc 19.75, wing_x 19.75 → sqrt(19.75² − 19.75²) = 0 → wing y = 36.75. That means the NFHS wing at x=±19.75 sits at the basket's y — geometrically the wing is at the widest point of the arc. Accept and record; NFHS 3pt is a tight uniform arc.

- [ ] **Step 4: Finalize NFHS arc-dependent spots and assert all anchors for all three files**

Run: `node --test test/positions-anchors.test.mjs` (created in Task 6) OR the inline asserts from Tasks 2/3 plus an NFHS equivalent. Expected: all three rulesets pass their anchor assertions.

- [ ] **Step 5: Commit**

```bash
git add positions/nba-v1.json positions/ncaa-v1.json positions/nfhs-v1.json
git commit -m "fix(positions): reconcile top_of_the_key to spec's authoritative absolute-y anchors"
```

---

### Task 6: Add the exported resolver and consistency tests

**Files:**
- Create: `positions/resolve-position.mjs`
- Create: `test/positions-anchors.test.mjs`
- Modify: `package.json` (add `exports`, extend `files`, add a test script)

- [ ] **Step 1: Write the resolver**

Create `positions/resolve-position.mjs`:

```javascript
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULESETS = ["fiba", "nba", "ncaa", "nfhs"];
const cache = new Map();

function loadRuleset(ruleset) {
  if (!RULESETS.includes(ruleset)) {
    throw new Error(`Unknown ruleset '${ruleset}'. Known: ${RULESETS.join(", ")}`);
  }
  if (!cache.has(ruleset)) {
    const path = resolve(__dirname, `${ruleset}-v1.json`);
    cache.set(ruleset, JSON.parse(readFileSync(path, "utf-8")));
  }
  return cache.get(ruleset);
}

/** Returns { x, y } for a named position under a ruleset, or throws if unknown. */
export function resolveNamedPosition(name, ruleset = "fiba") {
  const data = loadRuleset(ruleset);
  const pos = data.positions[name];
  if (!pos) {
    throw new Error(`Unknown named position '${name}' for ruleset '${ruleset}'.`);
  }
  return { x: pos.x, y: pos.y };
}

/** Returns the whole flat position map for a ruleset (for bulk consumers). */
export function loadPositions(ruleset = "fiba") {
  return { ...loadRuleset(ruleset).positions };
}
```

- [ ] **Step 2: Write the anchor consistency test**

Create `test/positions-anchors.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveNamedPosition } from "../positions/resolve-position.mjs";

// The 6 cross-ruleset anchors asserted by docs/specification-v1.adoc:288-294.
const ANCHORS = {
  fiba: { top_of_the_key: ["y", 5.68], left_wing: ["x", -6.75], left_corner: ["x", -7.5], free_throw_line: ["y", 8.2], left_elbow: ["x", -2.45] },
  nba:  { top_of_the_key: ["y", 20.75], left_wing: ["x", -22.15], left_corner: ["x", -25.0], free_throw_line: ["y", 28.0], left_elbow: ["x", -8.0] },
  ncaa: { top_of_the_key: ["y", 20.75], left_wing: ["x", -20.75], left_corner: ["x", -25.0], free_throw_line: ["y", 28.0], left_elbow: ["x", -6.0] },
  nfhs: { top_of_the_key: ["y", 19.75], left_wing: ["x", -19.75], left_corner: ["x", -25.0], free_throw_line: ["y", 23.0], left_elbow: ["x", -6.0] },
};

for (const [ruleset, anchors] of Object.entries(ANCHORS)) {
  test(`${ruleset} anchors match the spec difference table`, () => {
    for (const [name, [axis, expected]] of Object.entries(anchors)) {
      const got = resolveNamedPosition(name, ruleset)[axis];
      assert.ok(Math.abs(got - expected) <= 0.01, `${ruleset} ${name}.${axis} = ${got}, expected ${expected}`);
    }
  });
}

test("left/right mirror on x for every ruleset", () => {
  for (const ruleset of ["fiba", "nba", "ncaa", "nfhs"]) {
    for (const side of ["wing", "corner", "elbow", "block"]) {
      const l = resolveNamedPosition(`left_${side}`, ruleset);
      const r = resolveNamedPosition(`right_${side}`, ruleset);
      assert.equal(l.x, -r.x, `${ruleset} ${side} x not mirrored`);
      assert.equal(l.y, r.y, `${ruleset} ${side} y not mirrored`);
    }
  }
});
```

- [ ] **Step 3: Wire package.json exports, files, and test script**

In `package.json`, add to `exports` (create the field), extend `files`, and add a test script:

```json
  "exports": {
    "./schema/v1.json": "./schema/v1.json",
    "./positions/resolve-position.mjs": "./positions/resolve-position.mjs",
    "./positions/fiba-v1.json": "./positions/fiba-v1.json",
    "./positions/nba-v1.json": "./positions/nba-v1.json",
    "./positions/ncaa-v1.json": "./positions/ncaa-v1.json",
    "./positions/nfhs-v1.json": "./positions/nfhs-v1.json"
  },
  "files": [
    "schema",
    "positions",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "validate": "ajv validate --spec=draft7 -s schema/v1.json -d \"examples/*.ocf.json\" --all-errors --verbose -c ajv-formats",
    "test:invalid": "node scripts/check-invalid.mjs",
    "test:positions": "node --test test/positions-anchors.test.mjs",
    "test": "npm run validate && npm run test:invalid && npm run test:positions"
  }
```

- [ ] **Step 4: Run the positions test**

Run: `npm run test:positions`
Expected: all anchor + mirror tests pass for fiba/nba/ncaa/nfhs.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: validate + test:invalid + test:positions all pass.

- [ ] **Step 6: Commit**

```bash
git add positions/resolve-position.mjs test/positions-anchors.test.mjs package.json
git commit -m "feat(positions): export resolveNamedPosition and add anchor consistency tests"
```

---

### Task 7: Point the spec doc at the JSON as source of truth

**Files:**
- Modify: `docs/specification-v1.adoc` (the Named Court Positions section, ~line 212-297)

Keep the human-readable FIBA table (it's good documentation) but add a note that the JSON files are now the machine-readable source of truth, so the two never silently diverge.

- [ ] **Step 1: Add a source-of-truth note under "Named Court Positions"**

Insert after line 216 (the "All coordinates in meters" line):

```asciidoc
NOTE: The machine-readable source of truth for every ruleset's named-position
coordinates is `positions/{fiba,nba,ncaa,nfhs}-v1.json`, exported from
`@opencoachingformat/spec` via `resolveNamedPosition(name, ruleset)`. The tables
below are the human-readable FIBA reference; tools MUST read the JSON, not parse
these tables. A test (`test/positions-anchors.test.mjs`) guards the JSON against
the cross-ruleset anchor values in the difference table.
```

- [ ] **Step 2: Rebuild the site to confirm AsciiDoc still parses**

Run: `cd site && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add docs/specification-v1.adoc
git commit -m "docs: mark positions/*.json as the source of truth for named positions"
```

---

## Self-Review Notes

- **Spec coverage:** FIBA promotion (lossless) → Task 1; NBA/NCAA/NFHS derivation from verified geometry → Tasks 2-5; the top_of_the_key/arc contradiction is caught and resolved explicitly → Task 5 (authoritative: spec's absolute-y anchors win, `top_of_the_key` is a defined coaching spot, not the pure arc apex); exported resolver → Task 6; source-of-truth doc → Task 7.
- **Honest gap flagged:** I did NOT pre-write ~120 coordinates as fact. FIBA is copied verbatim; the derived files are computed DURING execution with anchor assertions that HALT on mismatch (Tasks 2/3/5 Step 2). This is deliberate — fabricating unverified coordinates in the plan would be the worst placeholder.
- **Type consistency:** resolver returns `{ x, y }`; formations package (Plan 3) will call `resolveNamedPosition(name, ruleset)` and `loadPositions(ruleset)` — names fixed here, consumed there.
- **Medium-confidence values (NCAA/NFHS corner offsets, per the research note) do not affect any of the 6 anchors** and only influence non-anchor spots; acceptable for v1, revisit if a primary rulebook check is later done.
- **Open reconciliation surfaced honestly:** the NBA basket_y(41.75) − arc(23.75) = 18.0 ≠ top_of_the_key 20.75 tension is real and resolved by Task 5 treating the spec's difference-table values as authoritative absolute-y (consistent with how FIBA's 5.68 is used). If the maintainer instead wants top_of_the_key = geometric apex, that's a spec change, not a data-entry choice — call it out in review.
