# Docs Site Redesign + SEO Design

**Status:** Approved for planning
**Author:** Brainstorming session, 2026-07-20

## Goal

Make the Astro docs site (`site/`) visually polished and expand it with more
indexable content pages, giving the Open Coaching Format standard better SEO
and AI-crawler discoverability, without regressing accessibility.

## Current State

The site has 3 pages (Home, Spec, Schema), inline `<style>` in `Base.astro`,
no per-page meta tags, no sitemap, no favicon/OG image, and a flat `<nav>`
with only 3 links. Content that already exists in `README.md` (features,
rulesets, coordinate system, roadmap) is not represented on the site at all.

## Visual Direction

"Technical Docs" style: dark navy nav/header (`#0b1220` / `#0f172a`), a single
blue accent color, monospace touches for code/schema content. Chosen over a
"Basketball Branded" (warm orange, playful) and "Minimal Editorial" (serif,
RFC-style) alternative because it reads as a serious technical standard site
(comparable to Stripe/Vercel docs) while staying simple to implement without a
CSS framework.

**Accessibility target:** WCAG 2.2 **AAA** for all practically-applicable
criteria (contrast, focus appearance, focus-not-obscured, target size,
section headings, link purpose). AAA criteria that don't apply to a static
technical-docs site (authentication, sign language, reading-level
simplification) are explicitly out of scope.

Concrete implications:
- Text colors must meet 7:1 contrast (normal text) / 4.5:1 (large text)
  against their background — e.g. muted grays like `#94a3b8` on `#0b1220`
  must be lightened (e.g. `#cbd5e1`) until they pass.
- Custom `:focus-visible` styles: ≥2px ring, 3:1 contrast against adjacent
  colors, applied to nav links, hamburger button, and card links (no
  reliance on browser default outline).
- All interactive targets (hamburger button, nav links, card links) get
  ≥44×44px hit areas via padding, not just font size.
- The mobile off-canvas drawer must never obscure a focused element; it
  closes on `Escape`, moves focus into itself on open, and returns focus to
  the hamburger button on close.

## Navigation & Layout

No persistent sidebar. A flat top nav with 4 items plus an external GitHub
link:

```
Home | Docs | Examples | Ecosystem            (+ GitHub, external)
```

`Docs` is a hub/landing page rather than a hover/click dropdown — this
sidesteps the accessibility complexity of building a fully keyboard- and
screen-reader-correct dropdown menu, and doubles as another real, indexable
SEO page (pillar-content pattern: `/docs` links out to more specific
sub-pages).

On narrow viewports, the top nav collapses into a hamburger button that
opens an off-canvas drawer (see accessibility requirements above). On wide
viewports, the 4 nav items are simply always visible — no hamburger needed
at that breakpoint since the list is short.

Long-form pages (Spec, Ecosystem) additionally render an "on this page"
mini table-of-contents from their headings, reusing the existing AsciiDoc
`toc: macro` output for the Spec page.

## Information Architecture

```
/                    Home — hero, quick JSON example, links to Docs/Examples/Ecosystem
/docs                Docs hub — intro + 4 cards linking to the pages below
/docs/spec           Full specification (existing specification-v1.adoc content)
/docs/schema         JSON Schema v1 (existing schema.json content)
/docs/features       Key features, expanded from the README feature list into prose
/docs/rulesets       Coordinate system + supported ruleset table (FIBA/NBA/NCAA/NFHS)
/examples            The 4 example drills (examples/*.ocf.json), each with context + code
/ecosystem           Validator / Renderer / Editor status cards + roadmap section
```

`/spec/` and `/schema/` (current URLs) redirect to `/docs/spec/` and
`/docs/schema/` via Astro's `redirects` config in `astro.config.mjs`.

### Content sourcing per new page

- **`/docs/features`**: expands each README feature bullet (semantic actions,
  automatic ball possession, hybrid frames, progressive detail, LLM
  friendliness, accessibility, FIBA import) into a short paragraph of prose
  rather than bare bullets — plain bullet lists carry less SEO weight than
  real sentences.
- **`/docs/rulesets`**: the coordinate system explanation and the ruleset
  table (unit + court dimensions per FIBA/NBA/NCAA/NFHS/custom) from the
  README, lightly rewritten as page prose.
- **`/examples`**: one section per file in `examples/*.ocf.json`
  (`pick-and-roll`, `3-man-weave`, `transition-3v2`, `quick-mode`), each with
  a title, 1-2 sentences of context, and the JSON rendered as a code block.
- **`/ecosystem`**: three status cards — Validator (✓ available, has a
  working TS/Python CLI), Renderer (🚧 in development, v1 goal not yet
  shipped), Editor (📋 planned only) — each linking to its GitHub repo, plus
  a roadmap section (Validator → Renderer → Editor → LLM-driven drill
  generation) drawn from the README roadmap section.
- **`/docs`** (hub): short intro + 4 cards linking to Spec/Schema/Features/Rulesets,
  same card component/pattern as Ecosystem for visual consistency.

## SEO

- **Per-page meta tags**: `Base.astro` gains a required `description` prop
  used for `<meta name="description">`, in addition to the existing `title`
  prop.
- **Open Graph / Twitter Cards**: `og:title`, `og:description`, `og:image`,
  `twitter:card=summary_large_image`. Same static banner image reused across
  all pages (see below).
- **sitemap.xml + robots.txt**: `@astrojs/sitemap` integration added to
  `astro.config.mjs`, generating a sitemap from the site's routes
  automatically at build time. A static `robots.txt` in `site/public/`
  references the sitemap.
- **JSON-LD**: a `SoftwareSourceCode` Schema.org block on the Home page only
  (name, license CC BY 4.0, repository URL, programming language "JSON
  Schema") — deliberately minimal, not applied per-page.
- **llms.txt**: a static `/llms.txt` (Markdown: H1 site name, one-sentence
  description blockquote, linked sections for Spec/Schema/Examples/
  Ecosystem) placed in `site/public/`, so it ships with every build. This is
  an informal community convention (not backed by W3C/IETF, and Google has
  said it doesn't use it for ranking), but it's become a de-facto standard
  for developer/API-focused sites (Stripe, Vercel, Cloudflare, Anthropic all
  ship one) and Chrome Lighthouse 13.3's "Agentic Browsing" audit checks for
  its presence. Low maintenance cost, fits a project that already markets
  itself as LLM-friendly.
- **OG banner image**: one simple generated static banner (PNG/SVG) with the
  site title in the Technical Docs visual style, created once and reused as
  `og:image` for every page. Not a per-page screenshot pipeline (out of
  scope — YAGNI for a site this size).
- **Redirects**: old `/spec/` and `/schema/` URLs redirect to their new
  `/docs/...` locations.

## Technical Architecture

- **New pages**: `site/src/pages/docs/index.astro`, `docs/features.astro`,
  `docs/rulesets.astro`, `docs/spec.astro` (moved from `pages/spec.astro`),
  `docs/schema.astro` (moved from `pages/schema.astro`), `examples.astro`,
  `ecosystem.astro`.
- **`Base.astro`**: adds a required `description` prop; renders per-page
  `<meta name="description">`, Open Graph tags, Twitter Card tags, and links
  the shared OG banner image. Replaces its inline `<nav>` with the new
  `Nav.astro` component.
- **`Nav.astro`** (new component): renders the flat top nav plus the
  hamburger/off-canvas drawer behavior for narrow viewports. Owns all nav
  markup and JS (vanilla, no framework).
- **`Card.astro`** (new component): a reusable card (title, description,
  status badge, link) used by both `/docs` (hub) and `/ecosystem` (status
  cards), replacing what would otherwise be copy-pasted markup.
- **Examples content pipeline**: `site/scripts/build-adoc.mjs` is extended to
  also copy `examples/*.ocf.json` into `site/src/generated/examples/` (same
  pattern already used for `schema/v1.json` → `schema.json`), so the new
  `/examples` page can import them directly.
- **Static assets**: `llms.txt` and the OG banner image live in
  `site/public/`, which Astro copies to `dist/` unchanged.
- **Sitemap dependency**: `@astrojs/sitemap` added to
  `site/package.json` and wired into `astro.config.mjs`'s `integrations`.

## Accessibility Testing

- **Tool**: `@axe-core/cli` (new dev dependency in `site/`), which drives a
  headless browser against built pages and checks WCAG rules including
  contrast, focus order, and ARIA usage.
- **Process**: `npm run build` → `astro preview` (local static server) →
  `axe` run against every route (`/`, `/docs/`, `/docs/spec/`,
  `/docs/schema/`, `/docs/features/`, `/docs/rulesets/`, `/examples/`,
  `/ecosystem/`).
- **CI scope**: a new, separate workflow
  (`.github/workflows/a11y-check.yml`), triggered on `pull_request`, scoped
  with a `paths` filter so it only runs when pages/layouts/components/public
  assets actually change:
  ```yaml
  paths:
    - 'site/src/pages/**'
    - 'site/src/layouts/**'
    - 'site/src/components/**'
    - 'site/public/**'
  ```
  This deliberately excludes pure content edits to
  `docs/specification-v1.adoc` or `schema/v1.json` that don't touch site
  code, per explicit user request that a11y checks shouldn't run on every
  unrelated change.

## Out of Scope

- Automated OG-image screenshot generation (static banner only).
- Per-page JSON-LD (Home page only).
- Sidebar navigation (superseded by the flat top nav + `/docs` hub decision).
- General a11y test tooling beyond axe-core (no visual regression testing,
  no Lighthouse CI integration).
