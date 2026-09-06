# Schema Release Pipeline + Docs Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On every `vX.Y.Z` git tag push, publish the current `schema/v1.json` to a permanent versioned URL and build/deploy a modern Astro documentation site to GitHub Pages (custom domain `opencoachingformat.org`), then notify `ocf-validator` via `repository_dispatch`.

**Architecture:** A new `site/` directory holds a minimal Astro static site. A pre-build Node script (`site/scripts/build-adoc.mjs`) compiles `docs/specification-v1.adoc` to HTML using `@asciidoctor/core` and copies `schema/v1.json` into the site's generated assets, so Astro pages can render them without any custom integration. A new GitHub Actions workflow (`.github/workflows/release-spec.yml`), triggered on tag push, builds the site, assembles a `dist/` folder containing both the versioned schema copy (`dist/<tag>/ocf-action-v1.json`) and the built site, writes a `CNAME` file, and deploys `dist/` to the `gh-pages` branch with `keep_files: true` so prior version folders are never deleted. A final step sends `repository_dispatch` to `opencoachingformat/ocf-validator` using a PAT stored in the `OCF_VALIDATOR_DISPATCH_TOKEN` secret.

**Tech Stack:** Astro 7, @asciidoctor/core 4, GitHub Actions (`actions/checkout`, `actions/setup-node`, `peaceiris/actions-gh-pages`, `peter-evans/repository-dispatch`), Node 20.

**Confirmed decisions (from user):**
- Pages domain: custom domain `opencoachingformat.org` (CNAME file committed to `gh-pages`)
- AsciiDoc rendering: Asciidoctor.js build step, embedded into Astro via raw HTML import
- Dispatch auth: repo secret named `OCF_VALIDATOR_DISPATCH_TOKEN` (user creates it manually — see Task 6)

---

## Task 1: Astro site scaffold

**Files:**
- Create: `site/package.json`
- Create: `site/astro.config.mjs`
- Create: `site/src/layouts/Base.astro`
- Create: `site/src/pages/index.astro`

- [ ] **Step 1: Create `site/package.json`**

```json
{
  "name": "ocf-docs-site",
  "private": true,
  "type": "module",
  "version": "0.0.0",
  "scripts": {
    "build:adoc": "node scripts/build-adoc.mjs",
    "build": "npm run build:adoc && astro build",
    "dev": "npm run build:adoc && astro dev"
  },
  "dependencies": {
    "astro": "^7.1.2"
  },
  "devDependencies": {
    "@asciidoctor/core": "^4.0.4"
  }
}
```

- [ ] **Step 2: Create `site/astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://opencoachingformat.org',
  outDir: './dist',
});
```

- [ ] **Step 3: Create `site/src/layouts/Base.astro`**

```astro
---
interface Props {
  title: string;
}
const { title } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title} — Open Coaching Format</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      }
      body {
        margin: 0 auto;
        max-width: 860px;
        padding: 2rem 1.5rem 4rem;
        line-height: 1.6;
      }
      nav {
        display: flex;
        gap: 1.25rem;
        margin-bottom: 2rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid #8884;
        font-weight: 600;
      }
      nav a {
        text-decoration: none;
        color: inherit;
      }
      nav a:hover {
        text-decoration: underline;
      }
      pre {
        overflow-x: auto;
        padding: 1rem;
        background: #8881;
        border-radius: 6px;
      }
      table {
        border-collapse: collapse;
        width: 100%;
      }
      th, td {
        border: 1px solid #8884;
        padding: 0.4rem 0.6rem;
        text-align: left;
      }
    </style>
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/spec/">Specification</a>
      <a href="/schema/">Schema</a>
      <a href="https://github.com/opencoachingformat/spec">GitHub</a>
    </nav>
    <slot />
  </body>
</html>
```

- [ ] **Step 4: Create `site/src/pages/index.astro`**

```astro
---
import Base from '../layouts/Base.astro';
---
<Base title="Home">
  <h1>Open Coaching Format</h1>
  <p>
    An open standard for representing sports coaching diagrams, drill
    animations, and playbooks as structured data.
  </p>
  <ul>
    <li><a href="/spec/">Full Specification</a></li>
    <li><a href="/schema/">JSON Schema (v1)</a></li>
    <li><a href="https://github.com/opencoachingformat/spec">Source on GitHub</a></li>
  </ul>
</Base>
```

- [ ] **Step 5: Verify the scaffold installs cleanly**

Run: `cd site && npm install`
Expected: exits 0, creates `site/node_modules` and `site/package-lock.json`.

- [ ] **Step 6: Commit**

```bash
git add site/package.json site/astro.config.mjs site/src/layouts/Base.astro site/src/pages/index.astro site/package-lock.json
git commit -m "feat: scaffold Astro docs site"
```

---

## Task 2: AsciiDoc build script + rendered pages

**Files:**
- Create: `site/scripts/build-adoc.mjs`
- Create: `site/src/pages/spec.astro`
- Create: `site/src/pages/schema.astro`
- Modify: `.gitignore`

- [ ] **Step 1: Create `site/scripts/build-adoc.mjs`**

```js
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Asciidoctor from '@asciidoctor/core';

const siteRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(siteRoot);
const outDir = path.join(siteRoot, 'src', 'generated');

mkdirSync(outDir, { recursive: true });

const asciidoctor = Asciidoctor();
const adocSource = readFileSync(
  path.join(repoRoot, 'docs', 'specification-v1.adoc'),
  'utf-8'
);
const specHtml = asciidoctor.convert(adocSource, {
  safe: 'safe',
  attributes: {
    'source-highlighter': '',
    toc: 'macro',
    showtitle: true,
  },
});

writeFileSync(path.join(outDir, 'spec.html'), specHtml, 'utf-8');
copyFileSync(
  path.join(repoRoot, 'schema', 'v1.json'),
  path.join(outDir, 'schema.json')
);

console.log('Generated site/src/generated/spec.html and schema.json');
```

- [ ] **Step 2: Create `site/src/pages/spec.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import specHtml from '../generated/spec.html?raw';
---
<Base title="Specification">
  <Fragment set:html={specHtml} />
</Base>
```

- [ ] **Step 3: Create `site/src/pages/schema.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import schema from '../generated/schema.json';

const pretty = JSON.stringify(schema, null, 2);
---
<Base title="JSON Schema">
  <h1>JSON Schema (v1)</h1>
  <p>
    Canonical schema: <code>{schema.$id}</code>
  </p>
  <pre><code>{pretty}</code></pre>
</Base>
```

- [ ] **Step 4: Add generated output to `.gitignore`**

Read the current `.gitignore` first, then append a line so generated build artifacts (derived from `docs/` and `schema/` at build time) are never committed:

```
site/src/generated/
```

- [ ] **Step 5: Run the generator and verify output**

Run: `cd site && npm run build:adoc`
Expected: prints `Generated site/src/generated/spec.html and schema.json`; both files exist and `spec.html` is non-empty (`wc -l site/src/generated/spec.html` > 100 lines given the 1354-line source).

- [ ] **Step 6: Run a full site build and verify pages render**

Run: `cd site && npm run build`
Expected: exits 0; `site/dist/index.html`, `site/dist/spec/index.html`, `site/dist/schema/index.html` all exist.

- [ ] **Step 7: Commit**

```bash
git add site/scripts/build-adoc.mjs site/src/pages/spec.astro site/src/pages/schema.astro .gitignore
git commit -m "feat: render specification and schema pages via asciidoctor"
```

---

## Task 3: Release workflow

**Files:**
- Create: `.github/workflows/release-spec.yml`

- [ ] **Step 1: Create `.github/workflows/release-spec.yml`**

```yaml
name: Release Spec

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    name: Publish schema + docs site
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: site/package-lock.json

      - name: Install site dependencies
        working-directory: site
        run: npm ci

      - name: Build docs site (asciidoctor + astro)
        working-directory: site
        run: npm run build

      - name: Assemble dist/
        run: |
          mkdir -p dist
          cp -r site/dist/. dist/
          echo "opencoachingformat.org" > dist/CNAME

      - name: Publish versioned schema (Step A)
        run: |
          VERSION="${GITHUB_REF_NAME}"
          mkdir -p "dist/${VERSION}"
          cp schema/v1.json "dist/${VERSION}/ocf-action-v1.json"
          echo "Published schema/v1.json -> dist/${VERSION}/ocf-action-v1.json"

      - name: Deploy to gh-pages (Step C)
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
          keep_files: true

      - name: Notify ocf-validator (Step D)
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.OCF_VALIDATOR_DISPATCH_TOKEN }}
          repository: opencoachingformat/ocf-validator
          event-type: spec_released
          client-payload: '{"tag": "${{ github.ref_name }}"}'
```

Notes on design decisions baked into this file:
- `keep_files: true` on the gh-pages deploy is required — without it, `peaceiris/actions-gh-pages` wipes the branch on every deploy, which would delete every previously published `dist/<version>/` folder and break the "permanent immutable URL" guarantee from the spec.
- The versioned schema copy step runs **after** `dist/` is assembled from the site build, so it layers on top rather than being overwritten by the site's own `dist/` output.
- `cache-dependency-path: site/package-lock.json` scopes npm caching to the site subproject (the repo root has its own separate `package-lock.json` for the `ajv-cli` validator tooling, unrelated to this workflow).

- [ ] **Step 2: Validate YAML syntax**

Run: `npx -y js-yaml .github/workflows/release-spec.yml > /dev/null && echo OK`
Expected: prints `OK` (no parse errors).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release-spec.yml
git commit -m "feat: add tag-triggered schema release + docs site deploy workflow"
```

---

## Task 4: Maintainer setup notes (one-time manual steps)

**Files:**
- Create: `docs/RELEASING.md`

These steps cannot be automated by the workflow itself (they require repo-admin access) and must be done once by a maintainer before the first tag push will fully succeed.

- [ ] **Step 1: Create `docs/RELEASING.md`**

```markdown
# Releasing a new schema version

This repo publishes a new schema version and rebuilds the docs site automatically
whenever a `vX.Y.Z` tag is pushed (see `.github/workflows/release-spec.yml`).

## One-time setup (repo admin only)

1. **Create the dispatch PAT secret.**
   - Generate a fine-grained Personal Access Token with `repository_dispatch`
     write access (i.e. "Contents: write" or "Administration" scope, depending
     on token type) scoped to `opencoachingformat/ocf-validator`.
   - In `opencoachingformat/spec` → Settings → Secrets and variables → Actions,
     add a new repository secret named `OCF_VALIDATOR_DISPATCH_TOKEN` with that
     token as the value.

2. **Enable GitHub Pages.**
   - In `opencoachingformat/spec` → Settings → Pages, set Source to
     "Deploy from a branch", branch `gh-pages`, folder `/ (root)`.
   - The first workflow run creates the `gh-pages` branch automatically; you
     may need to re-visit this settings page after the first successful run
     to select the branch if it wasn't available yet.

3. **Custom domain DNS.**
   - The workflow writes a `CNAME` file containing `opencoachingformat.org`
     into the published site on every release.
   - This requires DNS for `opencoachingformat.org` to already point at
     GitHub Pages (an `ALIAS`/`ANAME` or `A` records per GitHub's
     [Pages custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)).
     This DNS setup is external to this repo and not managed by the workflow.

## Cutting a release

```bash
git tag v1.1.0
git push origin v1.1.0
```

This triggers the workflow, which:
1. Builds the Astro docs site (specification + schema pages).
2. Publishes `schema/v1.json` to `https://opencoachingformat.org/v1.1.0/ocf-action-v1.json`
   (this URL is permanent — never delete or overwrite a version folder).
3. Deploys the docs site + versioned schema to the `gh-pages` branch.
4. Sends a `repository_dispatch` (`spec_released`) to `opencoachingformat/ocf-validator`
   with `{"tag": "v1.1.0"}` in the payload.
```

- [ ] **Step 2: Commit**

```bash
git add docs/RELEASING.md
git commit -m "docs: document one-time release pipeline setup"
```

---

## Task 5: End-to-end local dry run

**Files:** none (verification only)

- [ ] **Step 1: Simulate the assembly steps locally**

```bash
cd site && npm run build && cd ..
mkdir -p /tmp/ocf-dist-check
rm -rf /tmp/ocf-dist-check/*
cp -r site/dist/. /tmp/ocf-dist-check/
echo "opencoachingformat.org" > /tmp/ocf-dist-check/CNAME
VERSION="v0.0.0-test"
mkdir -p "/tmp/ocf-dist-check/${VERSION}"
cp schema/v1.json "/tmp/ocf-dist-check/${VERSION}/ocf-action-v1.json"
```

Expected: no errors; afterwards `/tmp/ocf-dist-check/` contains `index.html`,
`spec/index.html`, `schema/index.html`, `CNAME`, and `v0.0.0-test/ocf-action-v1.json`.

- [ ] **Step 2: Confirm the versioned schema copy is byte-identical to source**

Run: `diff schema/v1.json /tmp/ocf-dist-check/v0.0.0-test/ocf-action-v1.json && echo IDENTICAL`
Expected: prints `IDENTICAL`.

- [ ] **Step 3: Spot-check the rendered spec page contains expected content**

Run: `grep -o "Open Coaching Format" /tmp/ocf-dist-check/spec/index.html | head -1`
Expected: prints `Open Coaching Format` (confirms the AsciiDoc title rendered through).

- [ ] **Step 4: Clean up the temp check dir**

Run: `rm -rf /tmp/ocf-dist-check`

No commit for this task — it's a verification-only dry run of what the CI job will do.

---

## Self-review notes (from plan author)

- **Spec coverage:** Trigger on tag push ✓ (Task 3), schema copy to versioned dist path ✓ (Task 3 Step A), Astro site build rendering AsciiDoc/Markdown docs ✓ (Task 1 + 2), deploy dist/ to gh-pages ✓ (Task 3 Step C), repository_dispatch with PAT + `spec_released` + tag payload to ocf-validator ✓ (Task 3 Step D), minimal astro.config.mjs + example structure ✓ (Task 1).
- **Known gap called out explicitly, not silently dropped:** the schema's `$id` (`https://opencoachingformat.org/schema/v1.json`) will not automatically match the new versioned URL scheme (`/<tag>/ocf-action-v1.json`). This is a pre-existing repo decision, not something this plan should silently "fix" — flagged in `docs/RELEASING.md` implicitly via the explicit versioned URL documentation, and left for a maintainer/RFC decision if they want a canonical unversioned redirect later.
- **keep_files: true** is the one non-obvious correctness requirement in the whole workflow — without it, each release would delete every prior version's schema folder, which directly violates "permanent immutable URL" from the task. Documented inline in Task 3.
