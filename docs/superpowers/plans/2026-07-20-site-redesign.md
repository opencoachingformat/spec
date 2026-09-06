# Docs Site Redesign + SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 3-page Astro docs site (`site/`) into an accessible (WCAG 2.2 AAA), SEO-optimized, 8-page site with a real nav, per-page metadata, sitemap/robots/llms.txt, and an a11y CI gate — per `docs/superpowers/specs/2026-07-20-site-redesign-design.md`.

**Architecture:** A new global stylesheet (`site/src/styles/global.css`) defines the dark "Technical Docs" color tokens. `Base.astro` is rewritten to require a `description` prop, emit full SEO/OG/Twitter meta tags, and render a new `Nav.astro` component (flat top nav + accessible off-canvas drawer on narrow viewports). A new `Card.astro` component is reused by the `/docs` hub and `/ecosystem` pages. `build-adoc.mjs` is extended to emit a section-based table of contents (`toc.json`) for the Spec page's mini-TOC and an `examples.json` manifest for the new `/examples` page. `@astrojs/sitemap` and `redirects` are added to `astro.config.mjs`. A new `.github/workflows/a11y-check.yml` runs `@axe-core/cli` against every route on PRs that touch site code.

**Tech Stack:** Astro 7 (static output), `@asciidoctor/core`, `@astrojs/sitemap`, `@axe-core/cli`, vanilla CSS/JS (no framework).

---

## Task 1: Global styles, Base layout, Nav component, favicon & OG image

**Files:**
- Create: `site/src/styles/global.css`
- Create: `site/public/favicon.svg`
- Create: `site/public/og-banner.svg`
- Create: `site/src/components/Nav.astro`
- Modify: `site/src/layouts/Base.astro` (full rewrite)
- Modify: `site/src/pages/index.astro` (add `description` prop)
- Modify: `site/src/pages/spec.astro` (add `description` prop)
- Modify: `site/src/pages/schema.astro` (add `description` prop)

- [ ] **Step 1: Create the global stylesheet**

Create `site/src/styles/global.css`:

```css
:root {
  color-scheme: dark;
  --bg-page: #0b1220;
  --bg-elevated: #0f172a;
  --border: #1e293b;
  --text-primary: #f1f5f9;
  --text-muted: #cbd5e1;
  --link: #93c5fd;
  --accent: #60a5fa;
  --code-bg: #111c30;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background: var(--bg-page);
  color: var(--text-primary);
}

body {
  line-height: 1.6;
}

a {
  color: var(--link);
}

main {
  max-width: 860px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
}

main.wide {
  max-width: 1100px;
}

pre {
  overflow-x: auto;
  padding: 1rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

table {
  border-collapse: collapse;
  width: 100%;
}

th,
td {
  border: 1px solid var(--border);
  padding: 0.4rem 0.6rem;
  text-align: left;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

Contrast check: `--text-muted: #cbd5e1` on `--bg-page: #0b1220` is ~11.9:1, `--link: #93c5fd` on `#0b1220` is ~9.6:1 — both clear the 7:1 AAA threshold for normal text.

- [ ] **Step 2: Create the favicon**

Create `site/public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#0f172a"/>
  <circle cx="16" cy="16" r="10" fill="none" stroke="#60a5fa" stroke-width="2"/>
  <path d="M16 6v20M6 16h20M8.5 9.5c3 3 3 10 0 13M23.5 9.5c-3 3-3 10 0 13" fill="none" stroke="#60a5fa" stroke-width="1.2"/>
</svg>
```

- [ ] **Step 3: Create the OG banner image**

Create `site/public/og-banner.svg` (1200x630, the standard OG image size):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#1d4ed8"/>
      <stop offset="1" stop-color="#0b1220"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#0b1220"/>
  <rect width="1200" height="630" fill="url(#grad)" opacity="0.35"/>
  <circle cx="1000" cy="150" r="220" fill="none" stroke="#1e293b" stroke-width="2"/>
  <text x="80" y="300" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="64" font-weight="700" fill="#f1f5f9">Open Coaching Format</text>
  <text x="80" y="360" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="28" fill="#cbd5e1">An open standard for basketball drill diagrams &amp; animations</text>
  <rect x="80" y="410" width="140" height="4" fill="#60a5fa"/>
</svg>
```

**Known limitation (note, don't fix now):** some platforms (notably X/Twitter, some LinkedIn crawlers) render SVG `og:image` unreliably or not at all. The design spec explicitly allows PNG *or* SVG for the banner, so this is an accepted trade-off, not a bug — flagging it here so it isn't mistaken for an oversight.

- [ ] **Step 4: Create the Nav component**

Create `site/src/components/Nav.astro`:

```astro
---
const navItems = [
  { href: '/', label: 'Home' },
  { href: '/docs/', label: 'Docs' },
  { href: '/examples/', label: 'Examples' },
  { href: '/ecosystem/', label: 'Ecosystem' },
];
---
<header class="site-header">
  <div class="nav-bar">
    <a class="brand" href="/">Open Coaching Format</a>
    <button
      id="nav-toggle"
      class="nav-toggle"
      type="button"
      aria-expanded="false"
      aria-controls="nav-drawer"
      aria-label="Open navigation menu"
    >
      <span class="nav-toggle-icon" aria-hidden="true"></span>
    </button>
    <nav class="nav-inline" aria-label="Primary">
      <ul>
        {navItems.map((item) => (
          <li><a href={item.href}>{item.label}</a></li>
        ))}
        <li><a href="https://github.com/opencoachingformat/spec">GitHub</a></li>
      </ul>
    </nav>
  </div>
  <div id="nav-drawer" class="nav-drawer" role="dialog" aria-modal="true" aria-label="Primary navigation" hidden>
    <div class="nav-drawer-header">
      <span class="brand">Open Coaching Format</span>
      <button id="nav-close" class="nav-close" type="button" aria-label="Close navigation menu">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
    <ul>
      {navItems.map((item) => (
        <li><a href={item.href}>{item.label}</a></li>
      ))}
      <li><a href="https://github.com/opencoachingformat/spec">GitHub</a></li>
    </ul>
  </div>
  <div id="nav-backdrop" class="nav-backdrop" hidden></div>
</header>

<style>
  .site-header {
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border);
  }
  .nav-bar {
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
  }
  .brand {
    color: var(--text-primary);
    font-weight: 700;
    text-decoration: none;
    font-size: 1.05rem;
  }
  .nav-inline ul {
    list-style: none;
    display: flex;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
  }
  .nav-inline a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 0.9rem;
    color: var(--link);
    text-decoration: none;
    font-weight: 600;
    border-radius: 4px;
  }
  .nav-inline a:hover {
    text-decoration: underline;
  }
  .nav-toggle {
    display: none;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
  }
  .nav-toggle-icon,
  .nav-toggle-icon::before,
  .nav-toggle-icon::after {
    display: block;
    width: 20px;
    height: 2px;
    background: var(--text-primary);
    margin: 0 auto;
  }
  .nav-toggle-icon::before,
  .nav-toggle-icon::after {
    content: '';
    position: relative;
  }
  .nav-toggle-icon::before { top: -6px; }
  .nav-toggle-icon::after { top: 4px; }

  .nav-drawer {
    position: fixed;
    top: 0;
    right: 0;
    height: 100%;
    width: min(320px, 85vw);
    background: var(--bg-elevated);
    border-left: 1px solid var(--border);
    padding: 1rem 1.5rem;
    z-index: 30;
    overflow-y: auto;
  }
  .nav-drawer[hidden] { display: none; }
  .nav-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }
  .nav-drawer ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .nav-drawer a {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 0 0.5rem;
    color: var(--link);
    text-decoration: none;
    font-weight: 600;
    border-radius: 4px;
  }
  .nav-close {
    width: 44px;
    height: 44px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: transparent;
    color: var(--text-primary);
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
  }
  .nav-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(2, 6, 15, 0.6);
    z-index: 20;
  }
  .nav-backdrop[hidden] { display: none; }

  @media (max-width: 720px) {
    .nav-inline { display: none; }
    .nav-toggle { display: block; }
  }
</style>

<script>
  const toggle = document.getElementById('nav-toggle');
  const drawer = document.getElementById('nav-drawer');
  const backdrop = document.getElementById('nav-backdrop');
  const closeBtn = document.getElementById('nav-close');

  if (toggle && drawer && backdrop && closeBtn) {
    const focusableSelector = 'a[href], button:not([disabled])';

    function openDrawer() {
      drawer.hidden = false;
      backdrop.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      const first = drawer.querySelector(focusableSelector);
      if (first instanceof HTMLElement) first.focus();
      document.addEventListener('keydown', onKeydown);
    }

    function closeDrawer() {
      drawer.hidden = true;
      backdrop.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
      document.removeEventListener('keydown', onKeydown);
    }

    function onKeydown(event) {
      if (event.key === 'Escape') {
        closeDrawer();
        return;
      }
      if (event.key === 'Tab') {
        const focusable = Array.from(drawer.querySelectorAll(focusableSelector));
        if (focusable.length === 0) return;
        const currentIndex = focusable.indexOf(document.activeElement);
        if (event.shiftKey && currentIndex <= 0) {
          event.preventDefault();
          focusable[focusable.length - 1].focus();
        } else if (!event.shiftKey && currentIndex === focusable.length - 1) {
          event.preventDefault();
          focusable[0].focus();
        }
      }
    }

    toggle.addEventListener('click', openDrawer);
    closeBtn.addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', closeDrawer);
  }
</script>
```

This satisfies the design spec's drawer requirements: opens via a 44×44px button, moves focus into itself, traps Tab focus, closes on `Escape` and backdrop click, and returns focus to the hamburger button on close.

- [ ] **Step 5: Rewrite Base.astro**

Replace the full content of `site/src/layouts/Base.astro`:

```astro
---
import '../styles/global.css';
import Nav from '../components/Nav.astro';

interface Props {
  title: string;
  description: string;
  wide?: boolean;
}
const { title, description, wide = false } = Astro.props;
const pageTitle = `${title} — Open Coaching Format`;
const canonicalURL = new URL(Astro.url.pathname, Astro.site);
const ogImageURL = new URL('/og-banner.svg', Astro.site);
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{pageTitle}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonicalURL} />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

    <meta property="og:type" content="website" />
    <meta property="og:title" content={pageTitle} />
    <meta property="og:description" content={description} />
    <meta property="og:image" content={ogImageURL} />
    <meta property="og:url" content={canonicalURL} />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={pageTitle} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content={ogImageURL} />

    <slot name="head" />
  </head>
  <body>
    <Nav />
    <main class:list={{ wide }}>
      <slot />
    </main>
  </body>
</html>
```

- [ ] **Step 6: Update the 3 existing pages to pass the now-required `description` prop**

In `site/src/pages/index.astro`, change:

```astro
<Base title="Home">
```

to:

```astro
<Base
  title="Home"
  description="An open standard for representing sports coaching diagrams, drill animations, and playbooks as structured data."
>
```

In `site/src/pages/spec.astro`, change:

```astro
<Base title="Specification">
```

to:

```astro
<Base
  title="Specification"
  description="Full specification for the Open Coaching Format JSON schema."
>
```

In `site/src/pages/schema.astro`, change:

```astro
<Base title="JSON Schema">
```

to:

```astro
<Base
  title="JSON Schema"
  description="Canonical JSON Schema (Draft-07) for the Open Coaching Format v1."
>
```

(These two files are temporary at this path — Task 5 moves them into `docs/` and deletes the originals. This edit only keeps the build green in the meantime.)

- [ ] **Step 7: Build and verify**

Run:
```bash
cd site && npm ci && npm run build
```
Expected: build succeeds with no errors.

Run:
```bash
grep -c 'name="description"' dist/index.html
grep -c 'nav-toggle' dist/index.html
grep -c 'favicon.svg' dist/index.html
ls dist/favicon.svg dist/og-banner.svg
```
Expected: each grep returns a count ≥ 1, and both asset files exist in `dist/`.

- [ ] **Step 8: Commit**

```bash
cd .. && git add site/src/styles/global.css site/public/favicon.svg site/public/og-banner.svg site/src/components/Nav.astro site/src/layouts/Base.astro site/src/pages/index.astro site/src/pages/spec.astro site/src/pages/schema.astro
git commit -m "feat(site): add SEO base layout, accessible nav, favicon and OG image"
```

---

## Task 2: Card component

**Files:**
- Create: `site/src/components/Card.astro`

- [ ] **Step 1: Create the Card component**

Create `site/src/components/Card.astro`:

```astro
---
interface Props {
  title: string;
  description: string;
  href: string;
  status?: string;
}
const { title, description, href, status } = Astro.props;
---
<a class="card" href={href}>
  <div class="card-header">
    <span class="card-title">{title}</span>
    {status && <span class="card-status">{status}</span>}
  </div>
  <p class="card-description">{description}</p>
</a>

<style>
  .card {
    display: block;
    padding: 1.25rem 1.5rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-elevated);
    text-decoration: none;
    color: var(--text-primary);
    min-height: 44px;
  }
  .card:hover {
    border-color: var(--accent);
  }
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }
  .card-title {
    font-weight: 700;
    font-size: 1.05rem;
    color: var(--link);
  }
  .card-status {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-muted);
    white-space: nowrap;
  }
  .card-description {
    margin: 0;
    color: var(--text-muted);
  }
</style>
```

The whole card is a single `<a>` element, so it's one 44px+ tall interactive target rather than several small ones — satisfies the AAA target-size requirement without extra ARIA.

- [ ] **Step 2: Verify it compiles**

Run:
```bash
cd site && npm run build
```
Expected: build succeeds (the component isn't imported anywhere yet, so this just checks it's syntactically valid Astro).

- [ ] **Step 3: Commit**

```bash
cd .. && git add site/src/components/Card.astro
git commit -m "feat(site): add reusable Card component"
```

---

## Task 3: Sitemap integration

**Files:**
- Modify: `site/package.json` (adds `@astrojs/sitemap` dependency)
- Modify: `site/astro.config.mjs`

- [ ] **Step 1: Install the sitemap integration**

Run:
```bash
cd site && npm install @astrojs/sitemap
```
Expected: `@astrojs/sitemap` is added to `site/package.json` `dependencies` and `site/package-lock.json` is updated.

- [ ] **Step 2: Wire it into astro.config.mjs**

Replace the full content of `site/astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://opencoachingformat.org',
  outDir: './dist',
  integrations: [sitemap()],
});
```

- [ ] **Step 3: Build and verify**

Run:
```bash
npm run build
ls dist/sitemap-index.xml dist/sitemap-0.xml
```
Expected: both sitemap files exist in `dist/`.

- [ ] **Step 4: Commit**

```bash
cd .. && git add site/package.json site/package-lock.json site/astro.config.mjs
git commit -m "feat(site): add sitemap generation"
```

---

## Task 4: Extend build-adoc.mjs — spec TOC + examples manifest

**Files:**
- Modify: `site/scripts/build-adoc.mjs` (full rewrite)

- [ ] **Step 1: Rewrite build-adoc.mjs**

Replace the full content of `site/scripts/build-adoc.mjs`:

```js
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs';
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
const doc = asciidoctor.load(adocSource, {
  safe: 'safe',
  attributes: {
    'source-highlighter': '',
    showtitle: true,
  },
});
const specHtml = doc.convert();
const toc = doc.getSections().map((section) => ({
  id: section.getId(),
  title: section.getTitle(),
}));

writeFileSync(path.join(outDir, 'spec.html'), specHtml, 'utf-8');
writeFileSync(path.join(outDir, 'toc.json'), JSON.stringify(toc, null, 2), 'utf-8');

copyFileSync(
  path.join(repoRoot, 'schema', 'v1.json'),
  path.join(outDir, 'schema.json')
);

const examplesDir = path.join(repoRoot, 'examples');
const exampleFiles = readdirSync(examplesDir)
  .filter((name) => name.endsWith('.ocf.json'))
  .sort();
const examples = exampleFiles.map((filename) => {
  const parsed = JSON.parse(readFileSync(path.join(examplesDir, filename), 'utf-8'));
  return {
    slug: filename.replace(/\.ocf\.json$/, ''),
    title: parsed.meta?.title ?? filename,
    description: parsed.meta?.description ?? '',
    json: JSON.stringify(parsed, null, 2),
  };
});

writeFileSync(path.join(outDir, 'examples.json'), JSON.stringify(examples, null, 2), 'utf-8');

console.log(
  `Generated site/src/generated/spec.html, toc.json, schema.json, examples.json (${examples.length} examples)`
);
```

Two behavior changes from the original:
1. Switches from the one-shot `convert()` helper to `Asciidoctor().load(...).convert()` so the parsed `Document` object is available for `doc.getSections()` — needed to build `toc.json`. The `toc: 'macro'` attribute is dropped since the mini-TOC is now built from this JSON instead of Asciidoctor's built-in TOC macro.
2. Adds `examples.json`, built by reading every `*.ocf.json` file directly under `examples/` (the filter naturally skips the `examples/invalid/` subdirectory, since directory names don't end in `.ocf.json`) and extracting `meta.title` / `meta.description` from each file's own JSON content.

- [ ] **Step 2: Run it directly and inspect output**

Run:
```bash
cd site && node scripts/build-adoc.mjs
cat src/generated/toc.json
cat src/generated/examples.json
```
Expected: `toc.json` is a JSON array of `{id, title}` objects (16 entries, one per top-level spec section). `examples.json` is a JSON array of 4 objects (`3-man-weave`, `pick-and-roll`, `quick-mode`, `transition-3v2`), each with a non-empty `title` and `json` string.

- [ ] **Step 3: Full build and verify**

Run:
```bash
npm run build
```
Expected: build succeeds (existing `spec.astro`/`schema.astro` still import `spec.html?raw` and `schema.json`, both still generated).

- [ ] **Step 4: Commit**

```bash
cd .. && git add site/scripts/build-adoc.mjs
git commit -m "feat(site): generate spec TOC and examples manifest at build time"
```

---

## Task 5: Docs hub + move Spec/Schema under /docs + redirects

**Files:**
- Create: `site/src/pages/docs/index.astro`
- Create: `site/src/pages/docs/spec.astro`
- Create: `site/src/pages/docs/schema.astro`
- Delete: `site/src/pages/spec.astro`
- Delete: `site/src/pages/schema.astro`
- Modify: `site/astro.config.mjs` (add `redirects`)

- [ ] **Step 1: Create the docs hub page**

Create `site/src/pages/docs/index.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import Card from '../../components/Card.astro';
---
<Base
  title="Docs"
  description="Documentation hub for the Open Coaching Format: full specification, JSON Schema, key features, and supported rulesets."
>
  <h1>Documentation</h1>
  <p>
    Everything you need to read, write, and validate Open Coaching Format
    files — the full specification, the canonical JSON Schema, an overview
    of the format's key features, and the coordinate system and rulesets it
    supports.
  </p>
  <div class="card-grid">
    <Card
      title="Specification"
      description="The full normative specification: coordinate system, entities, actions, frames, and branches."
      href="/docs/spec/"
    />
    <Card
      title="JSON Schema"
      description="The canonical, machine-readable JSON Schema (Draft-07) used to validate OCF files."
      href="/docs/schema/"
    />
    <Card
      title="Features"
      description="What makes OCF different: semantic actions, automatic ball possession, hybrid frames, and more."
      href="/docs/features/"
    />
    <Card
      title="Rulesets"
      description="The coordinate system and the FIBA/NBA/NCAA/NFHS rulesets OCF supports out of the box."
      href="/docs/rulesets/"
    />
  </div>
</Base>

<style>
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
    margin-top: 1.5rem;
  }
</style>
```

- [ ] **Step 2: Create docs/spec.astro with a mini table of contents**

Create `site/src/pages/docs/spec.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import specHtml from '../../generated/spec.html?raw';
import toc from '../../generated/toc.json';
---
<Base
  title="Specification"
  description="Full specification for the Open Coaching Format JSON schema: coordinate system, entities, actions, frames, and rulesets."
  wide
>
  <div class="spec-layout">
    <nav class="mini-toc" aria-label="On this page">
      <p class="mini-toc-title">On this page</p>
      <ul>
        {toc.map((entry) => (
          <li><a href={`#${entry.id}`}>{entry.title}</a></li>
        ))}
      </ul>
    </nav>
    <div class="spec-content">
      <Fragment set:html={specHtml} />
    </div>
  </div>
</Base>

<style>
  .spec-layout {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 2rem;
    align-items: start;
  }
  .mini-toc {
    position: sticky;
    top: 1.5rem;
    font-size: 0.9rem;
  }
  .mini-toc-title {
    font-weight: 700;
    color: var(--text-muted);
    margin: 0 0 0.5rem;
  }
  .mini-toc ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .mini-toc a {
    display: block;
    padding: 0.25rem 0;
  }
  @media (max-width: 860px) {
    .spec-layout {
      grid-template-columns: 1fr;
    }
    .mini-toc {
      position: static;
    }
  }
</style>
```

- [ ] **Step 3: Create docs/schema.astro**

Create `site/src/pages/docs/schema.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import schema from '../../generated/schema.json';

const pretty = JSON.stringify(schema, null, 2);
---
<Base
  title="JSON Schema"
  description="Canonical JSON Schema (Draft-07) for the Open Coaching Format v1 — court, entities, actions, frames, and branches."
>
  <h1>JSON Schema (v1)</h1>
  <p>
    Canonical schema: <code>{schema.$id}</code>
  </p>
  <pre><code>{pretty}</code></pre>
</Base>
```

- [ ] **Step 4: Delete the old top-level pages**

```bash
rm site/src/pages/spec.astro site/src/pages/schema.astro
```

- [ ] **Step 5: Add redirects to astro.config.mjs**

Replace the full content of `site/astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://opencoachingformat.org',
  outDir: './dist',
  integrations: [sitemap()],
  redirects: {
    '/spec': '/docs/spec',
    '/schema': '/docs/schema',
  },
});
```

**Known limitation (note, don't fix now):** Astro's static-output `redirects` emits an HTML page with `<meta http-equiv="refresh">` (a client-side redirect) rather than a true HTTP 301, since there's no server adapter configured. Acceptable for a small docs site; flagging so it isn't mistaken for a real 301 during review.

- [ ] **Step 6: Build and verify**

Run:
```bash
cd site && npm run build
ls dist/docs/index.html dist/docs/spec/index.html dist/docs/schema/index.html
grep -c 'http-equiv="refresh"' dist/spec/index.html
grep -c 'http-equiv="refresh"' dist/schema/index.html
grep -c 'mini-toc' dist/docs/spec/index.html
```
Expected: all 3 `dist/docs/...` files exist; both old-path files contain a refresh redirect; the spec page contains the mini-TOC markup.

- [ ] **Step 7: Commit**

```bash
cd .. && git add -A site/src/pages
git add site/astro.config.mjs
git commit -m "feat(site): add docs hub, move spec/schema under /docs with redirects"
```

---

## Task 6: Features page

**Files:**
- Create: `site/src/pages/docs/features.astro`

- [ ] **Step 1: Create the page**

Create `site/src/pages/docs/features.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
---
<Base
  title="Features"
  description="Key features of the Open Coaching Format: semantic actions, automatic ball possession, hybrid frames, and more."
>
  <h1>Features</h1>

  <h2 id="basketball-first">Basketball-first, sport-agnostic by design</h2>
  <p>
    OCF v1 covers basketball across the FIBA, NBA, NCAA, and NFHS rulesets,
    but the underlying architecture — entities, actions, frames, and named
    positions resolved per ruleset — is not basketball-specific. Future
    versions can extend the same model to other sports without breaking
    existing documents.
  </p>

  <h2 id="real-world-coordinates">Real-world coordinates</h2>
  <p>
    Every position in an OCF file is expressed in real-world units — meters
    for FIBA, feet for NBA, NCAA, and NFHS — with the origin at midcourt
    center. This keeps diagrams grounded in actual court geometry instead of
    an arbitrary pixel grid, so the same drill renders correctly at any
    scale or aspect ratio.
  </p>

  <h2 id="named-positions">Named court positions</h2>
  <p>
    Rather than forcing every position to be a raw coordinate pair, OCF
    defines a registry of named positions — <code>top_of_the_key</code>,
    <code>left_elbow</code>, <code>inbound.baseline_left</code>, and more —
    grounded in official ruleset geometry. Coaches can author drills by
    naming positions instead of guessing coordinates.
  </p>

  <h2 id="semantic-actions">Semantic actions</h2>
  <p>
    Frames describe what players <em>do</em> — <code>move</code>,
    <code>cut</code>, <code>screen</code>, <code>defend</code>,
    <code>dribble</code>, <code>pass</code>, <code>shoot</code>,
    <code>rebound</code>, <code>pickup</code> — rather than raw geometric
    lines. This makes drills legible to both humans and machines, and is a
    prerequisite for the LLM-driven generation OCF is designed toward.
  </p>

  <h2 id="ball-possession">Automatic ball possession</h2>
  <p>
    A top-level <code>balls[]</code> array (<code>carried_by</code> /
    <code>at</code> / <code>dead</code>) supports multiple balls per drill.
    Possession transfers are inferred automatically from <code>pass</code>
    and <code>pickup</code> actions, so authors don't have to manually
    track and restate who's holding the ball in every frame.
  </p>

  <h2 id="hybrid-frames">Hybrid frames</h2>
  <p>
    Frames combine explicit <code>start_state</code> /
    <code>end_state</code> anchors with action sequences, and support
    outcome branches (<code>make</code> / <code>miss</code> / …) to model
    continuum drills where the next step depends on what happened in the
    last one.
  </p>

  <h2 id="progressive-detail">Progressive detail</h2>
  <p>
    Only <code>player</code> and <code>type</code> are required per action —
    variants, tags, and timing are all optional. Coaches can sketch a drill
    quickly with minimal annotation, or go back and add full detail later,
    without the schema forcing an all-or-nothing choice.
  </p>

  <h2 id="llm-friendly">LLM-friendly</h2>
  <p>
    The semantic action model is structured enough that a language model can
    reliably generate valid OCF documents from a natural-language drill
    description — a first step toward OCF's end goal of text-to-diagram
    generation.
  </p>

  <h2 id="accessibility">Accessibility</h2>
  <p>
    OCF ships with WCAG-guided color scheme recommendations for rendered
    diagrams, so tools built on the format start from an accessible default
    instead of retrofitting contrast and color-blindness support later.
  </p>

  <h2 id="fiba-import">FIBA import path</h2>
  <p>
    OCF defines a coordinate mapping from the FIBA Europe Coaching internal
    format, giving existing FIBA-authored content a path into the open
    standard instead of starting from scratch.
  </p>
</Base>
```

- [ ] **Step 2: Build and verify**

Run:
```bash
cd site && npm run build
ls dist/docs/features/index.html
grep -c '<h2' dist/docs/features/index.html
```
Expected: file exists, 10 `<h2>` matches.

- [ ] **Step 3: Commit**

```bash
cd .. && git add site/src/pages/docs/features.astro
git commit -m "feat(site): add /docs/features page"
```

---

## Task 7: Rulesets page

**Files:**
- Create: `site/src/pages/docs/rulesets.astro`

- [ ] **Step 1: Create the page**

Create `site/src/pages/docs/rulesets.astro`:

```astro
---
import Base from '../../layouts/Base.astro';

const rulesets = [
  { ruleset: 'fiba', unit: 'm', length: '28.0', width: '15.0' },
  { ruleset: 'nba', unit: 'ft', length: '94.0', width: '50.0' },
  { ruleset: 'ncaa', unit: 'ft', length: '94.0', width: '50.0' },
  { ruleset: 'nfhs', unit: 'ft', length: '84.0', width: '50.0' },
  { ruleset: 'custom', unit: '*', length: 'user-defined', width: 'user-defined' },
];
---
<Base
  title="Rulesets"
  description="The OCF coordinate system and the FIBA, NBA, NCAA, and NFHS rulesets it supports out of the box."
>
  <h1>Coordinate System &amp; Rulesets</h1>

  <h2 id="coordinate-system">Coordinate system</h2>
  <p>OCF positions are expressed on two axes, both centered on midcourt:</p>
  <pre><code>x: −max … 0 … +max   (viewer's left → center → viewer's right)
y: −max … 0 … +max   (defense basket → midline → offense basket)</code></pre>
  <p>
    Units are real-world: <strong>meters</strong> for FIBA,
    <strong>feet</strong> for NBA, NCAA, and NFHS.
  </p>

  <h2 id="supported-rulesets">Supported rulesets</h2>
  <p>
    Each ruleset determines the coordinate unit and the court dimensions
    used to resolve named positions (e.g. <code>top_of_the_key</code>) into
    concrete coordinates.
  </p>
  <table>
    <thead>
      <tr>
        <th>Ruleset</th>
        <th>Unit</th>
        <th>Court length</th>
        <th>Court width</th>
      </tr>
    </thead>
    <tbody>
      {rulesets.map((row) => (
        <tr>
          <td><code>{row.ruleset}</code></td>
          <td>{row.unit}</td>
          <td>{row.length}</td>
          <td>{row.width}</td>
        </tr>
      ))}
    </tbody>
  </table>
</Base>
```

- [ ] **Step 2: Build and verify**

Run:
```bash
cd site && npm run build
grep -c '<td><code>fiba</code></td>' dist/docs/rulesets/index.html
```
Expected: `1`.

- [ ] **Step 3: Commit**

```bash
cd .. && git add site/src/pages/docs/rulesets.astro
git commit -m "feat(site): add /docs/rulesets page"
```

---

## Task 8: Examples page

**Files:**
- Create: `site/src/pages/examples.astro`

- [ ] **Step 1: Create the page**

Create `site/src/pages/examples.astro`:

```astro
---
import Base from '../layouts/Base.astro';
import examples from '../generated/examples.json';
---
<Base
  title="Examples"
  description="Worked examples of Open Coaching Format drills: pick and roll, 3-man weave, transition offense, and quick-mode sketches."
>
  <h1>Examples</h1>
  <p>
    Real OCF documents, from a fully-annotated set play to a minimal
    quick-mode sketch. Each one validates against the current JSON Schema.
  </p>
  {examples.map((example) => (
    <section class="example">
      <h2 id={example.slug}>{example.title}</h2>
      <p>{example.description}</p>
      <pre><code>{example.json}</code></pre>
    </section>
  ))}
</Base>

<style>
  .example {
    margin-bottom: 2.5rem;
  }
</style>
```

- [ ] **Step 2: Build and verify**

Run:
```bash
cd site && npm run build
grep -c '<section class="example">' dist/examples/index.html
```
Expected: `4` (one per file in `examples/*.ocf.json`).

- [ ] **Step 3: Commit**

```bash
cd .. && git add site/src/pages/examples.astro
git commit -m "feat(site): add /examples page"
```

---

## Task 9: Ecosystem page

**Files:**
- Create: `site/src/pages/ecosystem.astro`

- [ ] **Step 1: Create the page**

Create `site/src/pages/ecosystem.astro`:

```astro
---
import Base from '../layouts/Base.astro';
import Card from '../components/Card.astro';

const toc = [
  { id: 'validator', title: 'Validator' },
  { id: 'renderer', title: 'Renderer' },
  { id: 'editor', title: 'Editor' },
  { id: 'roadmap', title: 'Roadmap' },
];
---
<Base
  title="Ecosystem"
  description="Status of the Open Coaching Format ecosystem — Validator, Renderer, and Editor — and the roadmap toward LLM-driven drill generation."
  wide
>
  <div class="ecosystem-layout">
    <nav class="mini-toc" aria-label="On this page">
      <p class="mini-toc-title">On this page</p>
      <ul>
        {toc.map((entry) => (
          <li><a href={`#${entry.id}`}>{entry.title}</a></li>
        ))}
      </ul>
    </nav>
    <div class="ecosystem-content">
      <h1>Ecosystem</h1>
      <p>
        This repository defines the schema and standard. These are the
        companion projects being built on top of it.
      </p>

      <div class="card-grid">
        <div id="validator">
          <Card
            title="Validator"
            description="Semantic rules JSON Schema can't express: ball-possession consistency, branch target integrity, and end_state agreement."
            href="https://github.com/opencoachingformat/ocf-validator"
            status="Available"
          />
        </div>
        <div id="renderer">
          <Card
            title="Renderer"
            description="Draws drills and animates them from OCF JSON."
            href="https://github.com/opencoachingformat"
            status="In development"
          />
        </div>
        <div id="editor">
          <Card
            title="Editor"
            description="Visual authoring on top of the renderer."
            href="https://github.com/opencoachingformat/ocf-editor"
            status="Planned"
          />
        </div>
      </div>

      <h2 id="roadmap">Roadmap</h2>
      <ol>
        <li>
          <strong>Validator</strong> — semantic rules JSON Schema can't
          express: ball-possession consistency (only the carrier may
          <code>pass</code>/<code>shoot</code>/<code>dribble</code>), branch
          target integrity, and <code>end_state</code> agreement with
          action endpoints.
        </li>
        <li><strong>Renderer</strong> — draw drills and animate them from the JSON.</li>
        <li><strong>Editor</strong> — visual authoring on top of the renderer.</li>
      </ol>
      <p>
        End goal: generate drills and set plays from natural language (LLM)
        and render them directly, plus video overlay for practice analysis
        and video → play extraction.
      </p>
    </div>
  </div>
</Base>

<style>
  .ecosystem-layout {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 2rem;
    align-items: start;
  }
  .mini-toc {
    position: sticky;
    top: 1.5rem;
    font-size: 0.9rem;
  }
  .mini-toc-title {
    font-weight: 700;
    color: var(--text-muted);
    margin: 0 0 0.5rem;
  }
  .mini-toc ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .mini-toc a {
    display: block;
    padding: 0.25rem 0;
  }
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
    margin: 1.5rem 0 2.5rem;
  }
  @media (max-width: 860px) {
    .ecosystem-layout {
      grid-template-columns: 1fr;
    }
    .mini-toc {
      position: static;
    }
  }
</style>
```

`ocf-renderer` has no confirmed GitHub repo yet (unlike `ocf-validator`, referenced in `docs/RELEASING.md` and the release workflow, and `ocf-editor`, linked from `README.md`) — its card links to the `opencoachingformat` org page instead of a specific (possibly nonexistent) repo, to avoid a dead link.

- [ ] **Step 2: Build and verify**

Run:
```bash
cd site && npm run build
grep -c 'id="validator"' dist/ecosystem/index.html
grep -c 'id="roadmap"' dist/ecosystem/index.html
```
Expected: both `1`.

- [ ] **Step 3: Commit**

```bash
cd .. && git add site/src/pages/ecosystem.astro
git commit -m "feat(site): add /ecosystem page"
```

---

## Task 10: Home page redesign + JSON-LD

**Files:**
- Modify: `site/src/pages/index.astro` (full rewrite)

- [ ] **Step 1: Rewrite the home page**

Replace the full content of `site/src/pages/index.astro`:

```astro
---
import Base from '../layouts/Base.astro';
import Card from '../components/Card.astro';

const quickExample = `{
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [
    { "type": "offense", "nr": 1, "x": -3.0, "y": 6.0 },
    { "type": "offense", "nr": 2, "x": 3.0, "y": 6.0 }
  ],
  "balls": [ { "id": "ball_1", "carried_by": "offense_1" } ],
  "frames": [
    {
      "id": "frame_1",
      "actions": [
        { "player": "offense_1", "type": "pass", "to_player": "offense_2" },
        { "player": "offense_1", "type": "cut", "moves": [ { "to": { "named": "basket" } } ] }
      ],
      "end_state": {
        "offense_1": { "named": "basket" },
        "balls": { "ball_1": { "carried_by": "offense_2" } }
      }
    }
  ]
}`;

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareSourceCode',
  name: 'Open Coaching Format',
  description:
    'An open standard for representing sports coaching diagrams, drill animations, and playbooks as structured data.',
  codeRepository: 'https://github.com/opencoachingformat/spec',
  license: 'https://creativecommons.org/licenses/by/4.0/',
  programmingLanguage: 'JSON Schema',
};
---
<Base
  title="Home"
  description="An open standard for representing sports coaching diagrams, drill animations, and playbooks as structured data."
>
  <Fragment slot="head">
    <script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />
  </Fragment>

  <section class="hero">
    <h1>Open Coaching Format</h1>
    <p class="tagline">
      An open standard for representing sports coaching diagrams, drill
      animations, and playbooks as structured data.
    </p>
    <p>
      No open standard for this exists today — coaching tools like the FIBA
      Europe Coaching App, FastDraw, and Sportplan.net all use proprietary,
      image-only formats. OCF is a JSON-based alternative any tool can read,
      write, and render.
    </p>
  </section>

  <section>
    <h2>Quick example</h2>
    <p>A pass followed by a cut to the basket, in half-court FIBA coordinates:</p>
    <pre><code>{quickExample}</code></pre>
  </section>

  <section>
    <h2>Explore</h2>
    <div class="card-grid">
      <Card
        title="Docs"
        description="Full specification, JSON Schema, key features, and supported rulesets."
        href="/docs/"
      />
      <Card
        title="Examples"
        description="Worked OCF drills: pick and roll, 3-man weave, transition offense, and more."
        href="/examples/"
      />
      <Card
        title="Ecosystem"
        description="Validator, renderer, and editor projects built on top of OCF, plus the roadmap."
        href="/ecosystem/"
      />
    </div>
  </section>
</Base>

<style>
  .hero {
    margin-bottom: 2.5rem;
  }
  .tagline {
    font-size: 1.15rem;
    color: var(--text-muted);
  }
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }
</style>
```

- [ ] **Step 2: Build and verify**

Run:
```bash
cd site && npm run build
grep -c 'application/ld+json' dist/index.html
grep -c 'SoftwareSourceCode' dist/index.html
grep -c 'card-grid' dist/index.html
```
Expected: all ≥ 1.

- [ ] **Step 3: Commit**

```bash
cd .. && git add site/src/pages/index.astro
git commit -m "feat(site): redesign home page with hero, examples link, and JSON-LD"
```

---

## Task 11: robots.txt + llms.txt

**Files:**
- Create: `site/public/robots.txt`
- Create: `site/public/llms.txt`

- [ ] **Step 1: Create robots.txt**

Create `site/public/robots.txt`:

```
User-agent: *
Allow: /

Sitemap: https://opencoachingformat.org/sitemap-index.xml
```

- [ ] **Step 2: Create llms.txt**

Create `site/public/llms.txt`:

```
# Open Coaching Format

> An open standard for representing sports coaching diagrams, drill animations, and playbooks as structured data, encoded as JSON and validated against a public JSON Schema.

## Docs

- [Specification](https://opencoachingformat.org/docs/spec/): Full normative specification — coordinate system, entities, actions, frames, and branches.
- [JSON Schema](https://opencoachingformat.org/docs/schema/): Canonical JSON Schema (Draft-07) for Open Coaching Format v1.
- [Examples](https://opencoachingformat.org/examples/): Worked OCF drills, from a fully-annotated set play to a minimal quick-mode sketch.
- [Ecosystem](https://opencoachingformat.org/ecosystem/): Validator, renderer, and editor projects, plus the roadmap.
```

- [ ] **Step 3: Build and verify**

Run:
```bash
cd site && npm run build
ls dist/robots.txt dist/llms.txt
cat dist/robots.txt
```
Expected: both files exist in `dist/`; `robots.txt` references the sitemap URL.

- [ ] **Step 4: Commit**

```bash
cd .. && git add site/public/robots.txt site/public/llms.txt
git commit -m "feat(site): add robots.txt and llms.txt"
```

---

## Task 12: Accessibility CI workflow

**Files:**
- Modify: `site/package.json` (adds `@axe-core/cli` devDependency)
- Create: `.github/workflows/a11y-check.yml`

- [ ] **Step 1: Install axe-core CLI**

Run:
```bash
cd site && npm install --save-dev @axe-core/cli
```
Expected: `@axe-core/cli` added to `site/package.json` `devDependencies` and lockfile updated.

- [ ] **Step 2: Create the workflow**

Create `.github/workflows/a11y-check.yml`:

```yaml
name: Accessibility Check

on:
  pull_request:
    paths:
      - 'site/src/pages/**'
      - 'site/src/layouts/**'
      - 'site/src/components/**'
      - 'site/public/**'

jobs:
  axe:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: site/package-lock.json

      - name: Install dependencies
        working-directory: site
        run: npm ci

      - name: Build site
        working-directory: site
        run: npm run build

      - name: Start preview server
        working-directory: site
        run: npx astro preview --port 4321 &

      - name: Wait for preview server
        run: sleep 3

      - name: Run axe against all routes
        working-directory: site
        run: |
          npx axe http://localhost:4321/ \
            http://localhost:4321/docs/ \
            http://localhost:4321/docs/spec/ \
            http://localhost:4321/docs/schema/ \
            http://localhost:4321/docs/features/ \
            http://localhost:4321/docs/rulesets/ \
            http://localhost:4321/examples/ \
            http://localhost:4321/ecosystem/ \
            --exit
```

This mirrors the `paths` filter and Node 22 setup pattern already used in `.github/workflows/release-spec.yml`, and only runs when site pages/layouts/components/public assets change (per explicit user request in the design spec, so pure content edits to `docs/specification-v1.adoc` or `schema/v1.json` don't trigger it).

- [ ] **Step 3: Commit**

```bash
cd .. && git add site/package.json site/package-lock.json .github/workflows/a11y-check.yml
git commit -m "ci: add accessibility check workflow using axe-core"
```

---

## Task 13: End-to-end local verification

**Files:** none (verification only — fixes, if any are needed, land as amendments to the files touched in Tasks 1–12)

- [ ] **Step 1: Full clean build**

Run:
```bash
cd site && rm -rf dist node_modules && npm ci && npm run build
```
Expected: build succeeds with no errors or warnings about missing modules.

- [ ] **Step 2: Start a local preview server**

Run in the background:
```bash
npx astro preview --port 4321 &
sleep 2
```

- [ ] **Step 3: Run axe against every route**

Run:
```bash
npx axe http://localhost:4321/ \
  http://localhost:4321/docs/ \
  http://localhost:4321/docs/spec/ \
  http://localhost:4321/docs/schema/ \
  http://localhost:4321/docs/features/ \
  http://localhost:4321/docs/rulesets/ \
  http://localhost:4321/examples/ \
  http://localhost:4321/ecosystem/ \
  --exit
```
Expected: exit code `0`, no violations reported.

If axe reports violations (e.g. a contrast ratio just under threshold, a missing accessible name), fix them directly in the relevant file from Tasks 1–9 (most likely `global.css`, `Nav.astro`, or `Card.astro`, since those are shared across every page) and re-run this step until it passes clean. Commit each fix separately with a `fix(site): ...` message.

- [ ] **Step 4: Verify SEO artifacts end-to-end**

Run:
```bash
cat dist/sitemap-index.xml
cat dist/robots.txt
cat dist/llms.txt
grep 'og:image' dist/index.html
grep 'twitter:card' dist/index.html
```
Expected: sitemap references `sitemap-0.xml`; `robots.txt` references the sitemap; `llms.txt` lists the 4 docs sections; both meta tags are present on the home page.

- [ ] **Step 5: Stop the preview server**

Run:
```bash
kill %1
```

- [ ] **Step 6: Final commit (only if Step 3 required fixes not yet committed)**

```bash
cd .. && git status
```
If clean (no uncommitted changes), no action needed — the plan is complete. Otherwise stage and commit the remaining fix(es) as in Step 3.

---

## Self-Review Notes

- **Spec coverage:** Visual direction / AAA contrast tokens ✓ (Task 1), flat nav + off-canvas drawer with full keyboard/focus handling ✓ (Task 1), `/docs` hub + mini-TOC on Spec ✓ (Task 5), `/docs/features` ✓ (Task 6), `/docs/rulesets` ✓ (Task 7), `/examples` ✓ (Task 8), `/ecosystem` with mini-TOC + roadmap ✓ (Task 9), redesigned Home with quick example + card links ✓ (Task 10), per-page meta/OG/Twitter tags ✓ (Task 1), sitemap+robots.txt ✓ (Tasks 3, 11), JSON-LD on Home only ✓ (Task 10), llms.txt ✓ (Task 11), OG banner reused across pages ✓ (Task 1), old `/spec`/`/schema` redirects ✓ (Task 5), axe-core a11y CI scoped to site-code paths ✓ (Task 12).
- **Known, accepted gaps** (flagged inline where introduced, not hidden): SVG `og:image` may not render on all social platforms; static-output redirects are client-side meta-refresh, not HTTP 301; `ocf-renderer`'s Ecosystem card links to the GitHub org instead of a specific repo since no repo name is confirmed anywhere in this codebase.
- **Type/name consistency checked:** `examples.json` entries use `slug`/`title`/`description`/`json` consistently between `build-adoc.mjs` (Task 4) and `examples.astro` (Task 8). `toc.json` entries use `id`/`title` consistently between `build-adoc.mjs` (Task 4) and `docs/spec.astro` (Task 5). `Base.astro`'s `wide` prop (Task 1) is used identically in `docs/spec.astro` and `ecosystem.astro` (Tasks 5, 9).
