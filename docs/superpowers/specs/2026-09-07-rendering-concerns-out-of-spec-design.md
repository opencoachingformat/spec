# Rendering Concerns Do Not Belong in the Spec — Design

## Status

Draft — brainstormed 2026-09-07. Records a decided direction
(`color_scheme`/`color` removal) plus one genuinely open question
(`area`/`label` semantics) explicitly deferred to a public GitHub
Discussion rather than decided here.

## Context

The user's stated position, verified against the codebase during this
session: OCF (the spec + validator) should describe **only** the semantic
content of a play or drill — who does what, when, where, with what ball.
How that gets drawn (circles vs. X's for offense/defense, 3D figures,
stroke styles for dribble paths, whether a move differs from a shot by
color) is a rendering decision, and should stay one, so competing/
differentiating renderer products remain possible on top of one shared
spec. This matches the project's own existing north star (see
`v2-program-strategy` memory): *"the spec contains everything a renderer
needs; the renderer does ZERO validation"* — the corollary, made explicit
now, is that the spec also carries **nothing** the renderer doesn't need to
determine the play's meaning.

An accessibility (WCAG) check on the *specification* — divorced from any
actual rendering — was independently identified as not making sense at this
layer either: contrast only exists once something is actually drawn with
concrete pixels, not in an abstract semantic document.

## Evidence: where color/visual concepts currently live in the schema

Full inventory (searched every `"color"` property key in
`schema/v1.json`, not assumed):

1. **`color_scheme`** (root-level, optional) — 11 hex-value fields
   (`offense_fill`, `offense_stroke`, `defense_fill`, `defense_stroke`,
   `black`, `grey`, `yellow`, `green`, `red`, `blue`, `white`). Pure
   rendering configuration.
2. **`color_role`** (enum: `offense`/`defense`/`black`/`grey`/`yellow`/
   `green`/`red`/`blue`/`white`) — the semantic-name vocabulary
   `color_scheme` resolves.
3. **`entity_offense.color`** / **`entity_defense.color`** (optional,
   default = the entity's own role name) — confirmed, after an initial
   misreading corrected during this session, to be a **separate, optional
   override field**, not the entity's role itself. The role is already
   fully carried by `type: "offense"`/`"defense"` (required,
   `additionalProperties: false`). `color` here is pure decoration with no
   independent meaning — an author could set `type: "offense"` +
   `color: "red"` today with no semantic effect.
4. **`area.color`** (default `"yellow"`) and **`label.color`** (default
   `"black"`) — different from (3): `area` and `label` have **no other
   field carrying meaning**. `area` is `{form, color, opacity, x, y,
   width, height, rotation, coords}` — a free-floating drawn shape with a
   color and nothing else distinguishing what it's *for*. Confirmed via
   the one real usage in the codebase
   (`examples/pick-and-roll.ocf.json`): a yellow, 20%-opacity rectangle
   over the paint with no field indicating why it's there or what a
   consumer should do with it beyond drawing it.
5. **`CONTRAST_LOW` validator rule** (both languages, `v1/rules/quality.ts`
   + Python equivalent, recently ported to `v2/rules/quality.ts` in Plan
   3/Task 16) — reads `color_scheme`, computes WCAG relative luminance/
   contrast ratio between `offense_fill`/`offense_stroke` and
   `defense_fill`/`defense_stroke`, warns below 4.5:1. Entirely dependent
   on (1) existing.

## Decision

### Remove `color_scheme`, `color_role`, and the `color` field wherever it
### appears (entities, `area`, `label`)

- `color_scheme` (root field) — removed entirely.
- `color_role` (definition) — removed entirely (nothing else references
  it once every `color` field is gone).
- `entity_offense.color` / `entity_defense.color` — removed. `type`
  already fully carries the role; a renderer decides on its own how to
  draw "offense" vs. "defense" (color, shape, icon, 3D model — the spec's
  business ends at "this is an offensive player at this position").
- `CONTRAST_LOW` validator rule — removed (both languages, both v1 and
  v2 rule modules), since its only input (`color_scheme`) no longer
  exists. This also retires the recently-added v2 port from Plan 3/Task
  16 — noted here so a future reader of that task's history understands
  why a just-shipped check is being removed shortly after, rather than
  reading it as an oversight.
- `area.color` / `label.color` — removed **without a semantic replacement
  field for now** (see Open Question below). This is a deliberate,
  disclosed gap: today's only real use of `area` (marking the paint area
  in a pick-and-roll example) loses its color entirely and becomes "draw
  a rectangle here" with zero indication of intent. The user chose to
  accept this gap rather than design a replacement now, and instead take
  the underlying question — does OCF need `area`/`label` to carry real
  semantic meaning at all, and if so what — to a public GitHub Discussion,
  since it's a genuinely open design question the maintainers want
  community input on, not a decision to make unilaterally in this session.

### What stays sport-general and unaffected

`entity.type` (offense/defense/ball/coach), `action.type`/`variant`, all
coordinate/position concepts, `trigger`, `branch`, `continuum`,
`side_effects` — none of this is touched. This change is scoped
exclusively to the four items in the Evidence list above.

## Open Question (explicitly deferred to a public GitHub Discussion, not
## decided in this session)

Removing `area.color`/`label.color` without a replacement raises a real
question the user surfaced directly: if `area`/`label` are going to carry
real meaning rather than pure decoration, what should that meaning be, and
does it change what these objects *are* — from static drawn shapes into
something an `action` could actually reference?

Concretely raised by the user: could an action instruction eventually read
something like *"pass the ball to a player within the target zone"* —
i.e., does `area` need to become a genuinely referenceable, named game
concept (a "zone" an action can point at via something like a
`zone_ref`, analogous to `entity_ref`/`ball_ref`/`action_id`), rather than
a shape a renderer just happens to draw?

This is explicitly **not resolved here**. It has real validation
implications if pursued (a "pass into a zone" action would need
possession/reference-integrity rules the current model has no equivalent
for — the target isn't an actor, it's a region) and is exactly the kind of
question that benefits from public/community input before committing to a
schema shape, per the project's own RFC process. Candidate framing for the
Discussion (not a decision, a starting point):

- Should `area`/`label` gain a `role`/`kind` field carrying semantic
  meaning (e.g. `"target_zone"`, `"restricted_zone"`, `"emphasis"`),
  letting a renderer choose its own visual treatment per role — mirroring
  how `entity.type` already separates role from appearance?
- If so, does that require its own validation concept (e.g. a
  `REF_ZONE_UNKNOWN`-style check, or possession/targeting rules for
  actions that reference a zone) — a materially bigger addition than
  "add an enum field," since it would make `area` a first-class,
  referenceable participant in the action model, not a decoration.
- Or does this stay entirely out of scope for OCF, with "pass to a player
  in this region" expressed instead via existing means (e.g. a `tags`
  value, or left to renderer/tooling convention, never becoming spec/
  validator-checked)?

## Backwards Compatibility

Breaking change — removes fields, not additive. Belongs in the v2.0.0
program window (see `docs/superpowers/specs/2026-09-07-v2-program-overview.md`)
alongside the program's other breaking changes, though it was not one of
the five originally-scoped items and needs its own RFC (see Next Steps).

## What this explicitly does NOT decide

- No decision on whether OCF's reference renderer (this project's own SVG
  renderer, `ocf-renderer`) keeps a `color_scheme`-equivalent concept
  internally — the user was explicit that "for our reference
  implementation, today's definitions still apply, but only there." This
  design only removes the concept from the **spec/validator**; the
  renderer repo may still need its own (renderer-internal, non-spec)
  color configuration, out of scope for this document.
- No decision on the `area`/`label` semantic-meaning question (see Open
  Question above) — deferred to public discussion.
- The user's closing question — "does an action need a tag/property
  signaling a renderer should give it special treatment?" — was
  considered and the user's own current answer was **no, not needed right
  now**, and if it becomes needed later, it would be an additive optional
  field (no breaking change). Recorded here so the question isn't lost,
  not because it's resolved differently than "not now."

## Next Steps (not yet done)

1. This design needs its own RFC (unscheduled program-item number, since
   it wasn't one of the original five v2.0.0 program items) once approved.
2. A GitHub Discussion should be opened for the `area`/`label` semantic
   question — drafted, not yet posted (a public action, left for explicit
   user approval before posting).
3. No schema/validator/renderer code has been changed by this document.
