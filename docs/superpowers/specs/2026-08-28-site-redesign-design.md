# Design: Site Redesign — Audience-First IA, Merged "Try it", Diagram Rendering, arc42

| Field    | Value                                                   |
|----------|---------------------------------------------------------|
| Date     | 2026-08-28                                              |
| Status   | Draft (design)                                          |
| Repo     | `opencoachingformat/spec` (the `site/` Astro app)       |
| Pulls from | `opencoachingformat/ocf-validator` (arc42, at build time) |
| Supersedes | the parked "Strang C" multi-sport redesign (folded in here) |

## Problem

The current Astro site is technical-first and undersells OCF:

- The **homepage** reads like reference docs, not an introduction. A newcomer
  ("what is this, what does it do, how is it built?") gets no narrative.
- **No page mentions multi-sport** or the `sport` field, though RFC 0003 shipped
  in v1.2.0 — the format looks basketball-only.
- **Playground and validator/renderer are two separate pages**
  (`playground.astro`, `playground/renderer.astro`) when they operate on the same
  document.
- **Diagrams don't render.** The spec `.adoc` has 4 `[plantuml]` blocks that
  produce nothing; the validator's **arc42** (Markdown, using Mermaid + PlantUML)
  isn't on the site at all.
- **Rendered diagrams are too small** even where they exist.

## Goals

- A **non-technical, informative homepage** for anyone learning about OCF:
  what it is, what it does, roughly how it's built — details one level deeper.
- **Audience-first navigation**: Home · Learn · Use · Build.
- **Multi-sport story** front and center, with a dedicated page per sport
  (basketball full; others a reserved template + a call to contribute).
- **One "Try it" page** merging validation and rendering, with **large,
  full-width diagrams**.
- **Mermaid + PlantUML render** at build time (spec `.adoc` blocks + arc42).
- **arc42 architecture docs** browsable on the site under "Build".

## Non-Goals

- Making the renderer itself presentation-quality (tracked separately). The
  homepage therefore ships **without** a diagram; a live preview can be added
  later once the renderer is good enough — no page rebuild required.
- Self-hosting a Kroki instance now (public `kroki.io` first; the endpoint is a
  config constant so it can move later).
- Any schema/validator code change — this is a site-only redesign that *consumes*
  the version-aware validator (0.2.0) already shipped.

---

## Architecture

### Information architecture (audience-first)

Top-level nav: **Home · Learn · Use · Build** (+ GitHub).

- **Home** — story scroll, non-technical, **no diagram**. Order:
  1. The problem (diagrams locked in proprietary apps, image-only export)
  2. What OCF is (a readable JSON format for diagrams & animations)
  3. **Multi-sport** (sport cards → sport pages) — *deliberately before* structure
  4. Rough structure (court coordinates · entities & actions · frames/animation)
  5. Where next → Learn / Use / Build
- **Learn** — concepts + **sport pages** (overview + one page per sport).
- **Use** — **"Try it"** (merged playground+validator+renderer) · rulesets ·
  how to embed.
- **Build** — Spec · Schema · **Architecture (arc42)** · Error Codes ·
  Ecosystem/repos.

Existing pages are re-grouped, not discarded: `docs/spec`, `docs/schema`,
`docs/rulesets`, `docs/features`, `examples`, `errors`, `ecosystem` move under
Learn/Use/Build; `playground.astro` + `playground/renderer.astro` are replaced by
one "Try it" page.

### "Try it" (merged)

One document, one editor, switchable outputs:

- Left: JSON editor with an examples dropdown.
- Right: tabs **[Validation] [Diagram]**.
- On the **Diagram** tab the editor collapses to a thin strip so the diagram
  takes the **full width**; plus a fullscreen button. Diagrams scale responsively
  (replacing today's fixed small size).
- **Validation** integrates the version-aware validator (0.2.0+): a schema-version
  badge ("validated against 1.4.0"), a "newer version available" hint driven by
  `/schema/versions.json`, the validator loaded at `@latest`, and the
  error/warning list with error codes.

### Diagram rendering pipeline (PlantUML build-time, Mermaid client-side)

**Verified facts (2026-08-28):** the two doc sets use disjoint diagram
languages (spec `.adoc` → PlantUML only; arc42 → Mermaid only). Public
`kroki.io` renders PlantUML fine but returns HTTP 500 for Mermaid. And
`@mermaid-js/mermaid-cli` (`mmdc`) is a **fragile, heavyweight build dependency**:
its install downloads a headless Chromium and failed outright in this
environment (`node install.mjs` errored), and the deploy workflow has no browser
set up. So the two languages render by different, each-verified means:

- **PlantUML → Kroki, build-time SVG** (`https://kroki.io`, POST). Serves the
  spec `.adoc` blocks. Embedded statically, no client JS. Endpoint is a config
  constant (self-hostable later). *(Already shipped in Plan A.)*
- **Mermaid → client-side** via `mermaid@11` ESM from jsDelivr (verified: 200,
  CORS `*`). The arc42 pages emit `<pre class="mermaid">…</pre>` blocks and a
  small module script calls `mermaid.run()` in the browser. No build-time
  Chromium, no fragile post-install. This is a deliberate, fact-driven revision
  of the original "no client JS" goal: mmdc's unreliability makes client-side the
  robust choice for Mermaid specifically. PlantUML stays build-time SVG.

The PlantUML path stays behind the Plan A façade (`renderDiagram`); the Mermaid
path is a thin arc42-only concern. If the PlantUML renderer fails, the build
**fails loudly** rather than silently dropping diagrams. (A single self-hosted
Kroki instance with a working Mermaid companion could later move Mermaid
build-time too and collapse this back to one build-time path — noted in Open Points.)

### arc42 integration

A build step pulls the arc42 Markdown from `opencoachingformat/ocf-validator` at
a **pinned commit** (same pattern as `error-codes.json`, pin lives beside the
others in `validator-version.mjs`), renders Markdown→HTML with diagrams via
Kroki, and publishes it under **Build → Architecture**.

### Sport pages (under Learn)

- **Overview**: a card per sport with a status badge (full / reserved).
- **Basketball (full)**: vocabulary (actions), rulesets, named positions,
  examples — data-driven from `sports/basketball-v1.json`, `positions/*`,
  `examples/*`.
- **Reserved sports (soccer/handball/hockey/futsal)**: one shared **template**
  component, data-fed from `sports/<sport>-v0.0.1.json` — status "reserved",
  provisional vocabulary, and a prominent **"Contribute"** block (how to help:
  the RFC path, repo link, "sport experts wanted"). No copy-paste; the four share
  the template.

---

## Components (site build)

- `site/src/lib/diagram.mjs` — façade `renderDiagram(type, source) -> svg` for
  the **build-time** path: `plantuml` → Kroki (fetch); errors throw
  (build-fails-loud). Mermaid is **not** in this façade — it renders client-side
  (see the pipeline section), so arc42 pages emit `<pre class="mermaid">` + a
  `mermaid@11` module script instead.
- `site/scripts/build-adoc.mjs` — extended to route `[plantuml]`/`[mermaid]`
  blocks through `kroki.mjs`.
- `site/scripts/build-arc42.mjs` — new: fetch arc42 markdown at the pinned
  commit, render to HTML, run diagrams through Kroki.
- `site/src/lib/validator-version.mjs` — gains a dedicated `OCF_ARC42_COMMIT`
  pin (separate from `OCF_VALIDATOR_COMMIT`, since arc42 docs and the validator
  bundle can be updated independently).
- `site/src/pages/` — restructured to Home/Learn/Use/Build; new `use/try-it`,
  `learn/sports/*`, `build/architecture/*`; nav component updated.
- Sport page template: one component, fed per-sport JSON.

## Testing

- **Kroki helper**: unit test with an injected fetch — success returns SVG;
  a non-OK response throws (build-fails-loud contract).
- **build-adoc / build-arc42**: run in CI; assert the generated HTML contains
  `<svg` where diagram blocks were (no leftover raw `@startuml`/```mermaid).
- **"Try it"**: existing playground tests carry over/extend — validation result
  rendering, schema badge, examples dropdown; a Playwright check that the diagram
  tab goes full-width.
- **Nav/pages**: build succeeds; every top-level route resolves; the axe
  accessibility check (already in CI) stays green.
- **Sport template**: renders all five sports from their JSON; reserved ones show
  the contribute block, basketball shows the full vocabulary.

## Rollout — four sequential, independently deployable plans

1. **Plan A — Diagram pipeline (Kroki).** Foundation. Renders the spec page's 4
   PlantUML blocks. Immediately visible, blocks nothing else.
2. **Plan B — Navigation + homepage.** Audience-first nav (Home/Learn/Use/Build),
   the story homepage, re-slot existing pages.
3. **Plan C — "Try it" + sport pages.** Merge playground/validator/renderer
   (version transparency + full-width diagram) and build the sport pages.
4. **Plan D — arc42 integration.** Pull the validator's arc42 at build time and
   render it under Build, diagrams included.

Each plan is its own implementation plan produced by writing-plans; the design
here is shared across all four.

## Open Points

- **PlantUML needs network (Kroki) at build time.** Public `kroki.io` is the
  default; a CI without egress would fail the PlantUML step. Mitigation (not built
  now): self-host Kroki.
- **Mermaid renders client-side.** The arc42 pages load `mermaid@11` from
  jsDelivr in the visitor's browser (verified: 200, CORS `*`), so there is no
  build-time Chromium dependency. Trade-off: the diagrams need JS to appear, and
  the axe a11y check runs only the mermaid-free overview page (section pages are
  excluded to avoid flaky client-render timing).
- **Future consolidation.** A self-hosted Kroki with a working Mermaid companion
  could render Mermaid build-time too, moving arc42 diagrams to static SVG and
  removing the client-side dependency.
