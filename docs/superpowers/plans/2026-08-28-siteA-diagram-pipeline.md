# Site Plan A — Diagram Pipeline (Kroki/PlantUML) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the spec page's PlantUML blocks as inline SVG at build time (they currently show as raw `@startuml` text), via a small, tested diagram façade backed by Kroki.

**Architecture:** A façade `renderDiagram(type, source)` dispatches by type; Plan A implements only the `plantuml` branch (POST to Kroki, returns SVG). `build-adoc.mjs` post-processes the asciidoctor HTML: every `literalblock` whose `<pre>` starts with `@startuml` is replaced by the rendered SVG. Mermaid (arc42) comes in Plan D.

**Tech Stack:** Node (ESM), Astro build, `@asciidoctor/core` (existing), Kroki public API, `node --test`.

**Design ref:** `docs/superpowers/specs/2026-08-28-site-redesign-design.md` (Diagram rendering pipeline).

**Verified facts:** public `kroki.io` returns 200+SVG for PlantUML via POST `text/plain`; the spec `.adoc` produces exactly 2 `literalblock` `<pre>@startuml…</pre>` blocks in `site/src/generated/spec.html`; the spec page imports `spec.html?raw` and renders it via `<Fragment set:html>`.

---

### Task 1: Diagram façade — the `plantuml` branch

**Files:**
- Create: `site/src/lib/diagram.mjs`
- Create: `site/test/diagram.test.mjs`
- Modify: `site/package.json` (add a `test` script)

- [ ] **Step 1: Write the failing test (fetch injected — no real network)**

`site/test/diagram.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderDiagram } from "../src/lib/diagram.mjs";

test("plantuml: posts source to Kroki and returns the SVG body", async () => {
  const calls = [];
  const fakeFetch = async (url, opts) => {
    calls.push({ url, body: opts.body, method: opts.method });
    return { ok: true, status: 200, text: async () => "<svg>ok</svg>" };
  };
  const svg = await renderDiagram("plantuml", "@startuml\nA -> B\n@enduml", { fetchImpl: fakeFetch });
  assert.equal(svg, "<svg>ok</svg>");
  assert.match(calls[0].url, /\/plantuml\/svg$/);
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].body, "@startuml\nA -> B\n@enduml");
});

test("plantuml: a non-OK Kroki response throws (build-fails-loud)", async () => {
  const fakeFetch = async () => ({ ok: false, status: 500, text: async () => "boom" });
  await assert.rejects(
    () => renderDiagram("plantuml", "@startuml\n@enduml", { fetchImpl: fakeFetch }),
    /kroki.*500/i,
  );
});

test("unknown diagram type throws", async () => {
  await assert.rejects(() => renderDiagram("nope", "x"), /unsupported diagram type/i);
});
```

- [ ] **Step 2: Run it — expect FAIL (module missing)**

Run: `cd site && node --test test/diagram.test.mjs`
Expected: FAIL — cannot resolve `../src/lib/diagram.mjs`.

- [ ] **Step 3: Implement the façade**

`site/src/lib/diagram.mjs`:

```js
// Build-time diagram rendering. One façade, dispatch by type.
// PlantUML -> Kroki (public kroki.io renders PlantUML fine).
// Mermaid  -> added in Plan D (local mmdc; kroki.io 500s on Mermaid).
export const KROKI_BASE = "https://kroki.io";

async function renderPlantumlViaKroki(source, fetchImpl) {
  const doFetch = fetchImpl ?? fetch;
  const res = await doFetch(`${KROKI_BASE}/plantuml/svg`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: source,
  });
  if (!res.ok) {
    throw new Error(`Kroki PlantUML render failed: ${res.status}`);
  }
  return await res.text();
}

export async function renderDiagram(type, source, opts = {}) {
  if (type === "plantuml") return renderPlantumlViaKroki(source, opts.fetchImpl);
  throw new Error(`Unsupported diagram type: ${type}`);
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `cd site && node --test test/diagram.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Add a `test` script to the site package**

In `site/package.json` scripts, add:
```json
    "test:diagram": "node --test test/diagram.test.mjs",
```
(Keep existing scripts; this gives CI a hook. The repo's existing
`test:renderer-*` scripts stay.)

- [ ] **Step 6: Commit**

```bash
git add site/src/lib/diagram.mjs site/test/diagram.test.mjs site/package.json
git commit -m "feat(site): diagram façade with Kroki PlantUML renderer"
```

---

### Task 2: Post-process spec HTML — replace `@startuml` literalblocks with SVG

**Files:**
- Modify: `site/scripts/build-adoc.mjs`
- Create: `site/test/replace-plantuml.test.mjs`

- [ ] **Step 1: Write the failing test for the pure replacer**

`site/test/replace-plantuml.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { replacePlantumlBlocks } from "../scripts/build-adoc.mjs";

test("replaces a literalblock whose pre starts with @startuml", async () => {
  const html =
    `<h3>x</h3>\n<div class="literalblock">\n<div class="content">\n` +
    `<pre>@startuml\nA -> B\n@enduml</pre>\n</div>\n</div>\n<p>after</p>`;
  const fakeRender = async (type, src) => {
    assert.equal(type, "plantuml");
    assert.match(src, /@startuml/);
    return "<svg>DIAGRAM</svg>";
  };
  const out = await replacePlantumlBlocks(html, fakeRender);
  assert.match(out, /<svg>DIAGRAM<\/svg>/);
  assert.doesNotMatch(out, /@startuml/);
  assert.match(out, /<p>after<\/p>/); // surrounding content preserved
  assert.match(out, /diagram-svg/); // wrapped for styling
});

test("leaves non-diagram literalblocks untouched", async () => {
  const html = `<div class="literalblock"><div class="content"><pre>just text</pre></div></div>`;
  const out = await replacePlantumlBlocks(html, async () => "<svg>NO</svg>");
  assert.equal(out, html);
});
```

- [ ] **Step 2: Run it — expect FAIL (export missing)**

Run: `cd site && node --test test/replace-plantuml.test.mjs`
Expected: FAIL — `replacePlantumlBlocks` is not exported.

- [ ] **Step 3: Add the pure replacer + export it from build-adoc.mjs**

In `site/scripts/build-adoc.mjs`, add this exported function (near the top,
after imports) and import the façade:

```js
import { renderDiagram } from '../src/lib/diagram.mjs';

// Replace asciidoctor literalblocks that hold a PlantUML source
// (<pre>@startuml…</pre>) with rendered inline SVG. Pure w.r.t. I/O: the
// renderer is injected so it is unit-testable without network.
export async function replacePlantumlBlocks(html, render = renderDiagram) {
  const blockRe =
    /<div class="literalblock">\s*<div class="content">\s*<pre>(@startuml[\s\S]*?)<\/pre>\s*<\/div>\s*<\/div>/g;
  const matches = [...html.matchAll(blockRe)];
  let out = html;
  for (const m of matches) {
    const source = decodeHtmlEntities(m[1]);
    const svg = await render('plantuml', source);
    out = out.replace(m[0], `<div class="diagram-svg">${svg}</div>`);
  }
  return out;
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#8217;/g, '’')
    .replace(/&amp;/g, '&');
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `cd site && node --test test/replace-plantuml.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the replacer into the build (after `doc.convert()`)**

In `build-adoc.mjs`, change the spec-HTML generation so the converted HTML is
post-processed before it's written:

```js
const specHtmlRaw = await doc.convert();
const specHtml = await replacePlantumlBlocks(specHtmlRaw);
```
(Leave the rest — `writeFileSync(... 'spec.html', specHtml ...)` — unchanged; it
now writes the SVG-embedded HTML.)

- [ ] **Step 6: Commit**

```bash
git add site/scripts/build-adoc.mjs site/test/replace-plantuml.test.mjs
git commit -m "feat(site): replace PlantUML literalblocks with inline SVG at build"
```

---

### Task 3: Style the embedded diagrams (large, responsive)

**Files:**
- Modify: `site/src/pages/docs/spec.astro` (or the shared style used by the spec page)

- [ ] **Step 1: Add CSS for `.diagram-svg`**

Find the `<style>` block in `site/src/pages/docs/spec.astro`. Add a rule so the
inline SVG scales to the content width and is centered (replacing the tiny
default size):

```css
.diagram-svg {
  margin: 1.5rem 0;
  text-align: center;
}
.diagram-svg svg {
  max-width: 100%;
  height: auto;
}
```

If `spec.astro` has no local `<style>`, add one inside the component.

- [ ] **Step 2: Build and verify SVG is present + no raw @startuml**

Run: `cd site && npm run build:adoc`
Then:
```bash
node -e "const h=require('fs').readFileSync('src/generated/spec.html','utf8'); console.log('svg blocks:', (h.match(/diagram-svg/g)||[]).length); console.log('leftover @startuml:', (h.match(/@startuml/g)||[]).length)"
```
Expected: `svg blocks: 2` (or however many literalblocks existed), `leftover @startuml: 0`.

- [ ] **Step 3: Full site build succeeds**

Run: `cd site && npm run build`
Expected: build completes; `/docs/spec` page generated with embedded SVG.

- [ ] **Step 4: Commit**

```bash
git add site/src/pages/docs/spec.astro
git commit -m "style(site): large, responsive inline diagrams on the spec page"
```

---

### Task 4: CI wiring + PR (no merge — user merges)

**Files:**
- Modify: `.github/workflows/deploy-site.yml` (or the site CI) — run the new tests

- [ ] **Step 1: Find the site CI workflow and add the diagram test**

Run: `grep -rl "build:adoc\|npm run build" .github/workflows/`
In the workflow that builds the site, add a step (before the build) running the
new unit tests:
```yaml
      - name: Diagram pipeline unit tests
        working-directory: site
        run: node --test test/diagram.test.mjs test/replace-plantuml.test.mjs
```
If the site build already runs on PRs, this is enough; the build itself
exercises the Kroki call (fails loud if Kroki is down).

- [ ] **Step 2: Validate YAML**

Run: `python3 -c "import yaml,glob; [yaml.safe_load(open(f)) for f in glob.glob('.github/workflows/*.yml')]; print('YAML OK')"`
Expected: `YAML OK`.

- [ ] **Step 3: Commit, push, open PR — DO NOT MERGE**

```bash
git add .github/workflows/
git commit -m "ci(site): run diagram pipeline unit tests"
git push -u origin <branch>
gh pr create --repo opencoachingformat/spec --base main --title "Site A: render PlantUML diagrams on the spec page" --body "Plan A of the site redesign — a tested diagram façade (Kroki/PlantUML) that replaces the spec page's raw @startuml blocks with inline, responsive SVG. Mermaid/arc42 come in Plan D. Leaves merge to the maintainer."
```
Stop here. Report the PR URL; the user performs the merge.

---

## Self-Review Notes

- **Spec coverage:** diagram façade (`renderDiagram`) → Task 1; PlantUML→SVG in spec page → Task 2; large/responsive → Task 3; CI + PR (no merge) → Task 4. Mermaid is explicitly out (Plan D).
- **Fail-loud contract:** non-OK Kroki throws (Task 1 test); build has no try/catch swallowing it.
- **Injected renderer/fetch** in both test files → no network in unit tests; the real build does hit Kroki (verified reachable).
- **Naming consistency:** `renderDiagram(type, source, {fetchImpl})` and `replacePlantumlBlocks(html, render)` used identically across tasks.
- **User merges:** Task 4 explicitly stops at an open PR.
