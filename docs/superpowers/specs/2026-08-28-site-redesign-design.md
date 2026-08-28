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

### Diagram rendering pipeline (Kroki)

A build-time module renders `[plantuml]` and `[mermaid]` sources to **SVG**,
embedded statically into the page (no client JS). Same path serves both the spec
`.adoc`'s 4 PlantUML blocks and the arc42 (Mermaid + PlantUML). The Kroki
endpoint is a **config constant** (default `https://kroki.io`, self-hostable
later). If Kroki is unreachable at build time the build **fails loudly** rather
than silently dropping diagrams.

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

- `site/src/lib/kroki.mjs` — pure-ish helper: given diagram source + type,
  return SVG (fetches Kroki). Endpoint is a constant; errors throw.
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

- **Kroki availability at build time.** Public `kroki.io` is the default and the
  build needs network to reach it; a CI without egress would fail the diagram
  step. Mitigation path (not built now): self-host Kroki and point the config
  constant at it.
- **arc42 diagram dialect coverage.** Confirm Kroki handles every Mermaid/PlantUML
  variant the arc42 uses during Plan D; fix any unsupported block then.
