# Frame-less Action Model — Open Questions

Companion list to the (in-progress) frame-less action model design. These are
points we deliberately deferred during brainstorming because resolving them
later would **not** be a major/breaking change (see the scope-decision
heuristic) — but they need an answer before or shortly after the design ships,
from someone with more field/domain experience than this session had.

Format: **Question** — why it's open — who's likely best positioned to answer.

---

## 1. Joint Action syntax (DHO and similar merged actions) — mostly resolved

**Decision:** Added a generic `side_effects` array to the action model:
`side_effects: [{ type, on: entity_ref, ...type-specific fields }]`. DHO
becomes `{ type: "pass", variant: "hand_off", to_player, side_effects: [{
type: "screen", on: <defender_of_receiver>, physicality? }] }` — no second,
awkward standalone `screen` action needed (today's `screen` action requires
`for_player`, which doesn't fit a screen that's a byproduct of a pass
motion). Chosen over a basketball-specific field like `pass.screens:
entity_ref` so the mechanism generalizes to other sports/future combos
without a new schema field per case.

**Still open — does `side_effect` need its own `id`?** Leaning yes (tentative
decision, not fully confirmed): needed so a later action can `during`/`after`
target the side effect specifically (e.g. a cutter curling around exactly the
DHO screen's duration, not the whole pass action's duration). Confirmed
non-breaking to add later if we skip it now (an optional `id` field is
purely additive), so this isn't a hard blocker — but real DHO+curl play
fixtures would help confirm the timing precision is actually needed in
practice, not just theoretically nice.

**Best positioned to answer:** Someone who has tried to encode DHO-into-curl
sequences in a real play file, or the DBTV coach contact (confirmed
branching/timing matters to them) — check whether `side_effect`-level timing
precision is ever actually needed, or whether coupling to the whole pass
action is always close enough in practice.

---

## 2. Variant-dependency constraints on sport definitions (incl. trigger vocabulary)

**Question:** Some action variants structurally require a coupled action of
another type (e.g. `cut.curl` requires an active `screen` the cutter runs
around). Today `sports/*.json` is a pure vocabulary list (action_types,
variants, outcomes, rulesets) with no dependency/constraint mechanism between
variants. Do we add a constraint mechanism at the sport-definition level, and
if so, what does it look like (a declarative "requires" field referencing
another action type/variant, a query language, something else)?

This also covers the new unified `trigger` field's `type` vocabulary (see
decision below — `trigger` replaces `after`/`with`/`on_catch` with
`{type: action_end|action_start|action_overlap|reception|<sport-extensible>,
ref?: action_id}`): which `trigger.type` values are valid/meaningful for a
given sport (e.g. `reception` makes sense for basketball/handball, is
near-meaningless for outfield soccer actions) is the same open
declaration-mechanism question, not a separate one.

**Why open:** Confirmed the *gap* is real (basketball action matrix surfaced
it) and confirmed our trigger/during reference primitives are probably
sufficient as a building block — but the actual constraint-declaration syntax
and where the validator would enforce it is undesigned. This is its own
follow-up topic, structurally similar to the `affects`-roles field already
in the v2 program.

**Best positioned to answer:** Whoever ends up designing the `affects`-roles
RFC (see v2-program-strategy memory) — this is likely the same mechanism, or
at least should be designed in the same pass to avoid two competing
constraint systems.

---

## 3. `around_player` implied timing — does implicit-only hold up?

**Question:** We decided a `move_step` with `around_player: X` implicitly
requires X to be at its final position by the time the step is processed —
no explicit `after`/`during` needed from the author. Does this implicit rule
hold for ALL real-world cases, or are there cases where `around_player` is
purely geometric (running around a teammate who is doing something
unrelated, no timing dependency at all) where the implicit rule would
produce a false validator constraint?

**Why open:** Confirmed additive/non-breaking either way (an explicit
override field could be added later without invalidating existing plays), so
we proceeded with implicit-only rather than blocking on it.

**Best positioned to answer:** An experienced coach or someone with a large
corpus of real diagrammed plays (DBTV contact, or whoever ends up building
out more `examples/*.json` fixtures) — check whether any real play needs
"run around player X, but X's position/timing doesn't matter."

---

## 4. Continuum loop-anchor and merge-point details

**Question:** We agreed a Play-level `continuum: true` (+ loop anchor)
metadata should exist, with branch `then` able to target the loop anchor, and
the validator checking end-state ≈ start-state. We did NOT work out: what
"approximately equal" tolerance means (exact match? within some distance?),
whether a continuum can loop to a point other than the true start, or how
this interacts with multi-ball / affects-roles once those land.

**Why open:** Explicitly scoped down per the user's request — worth
specifying alongside branching/merge (which we did, at the concept level),
but full detail was deferred as its own topic.

**Best positioned to answer:** Whoever picks up the Continuum follow-up
(see brainstorming note); likely needs input from renderer maintainers on
what "loop back cleanly" needs to look like visually/for animation.

---

## Notes on things we explicitly ruled OUT (not open questions, decided)

- **No `within_ms` / explicit latency-window field.** Timing is derived from
  `intensity` + distance; a hard millisecond field would be the only
  non-semantic timing primitive in the schema and was deliberately rejected.
- **No Chapter/Label concept in the spec.** Confirmed via research
  (video chapters, Labanotation, sport play-by-play formats) that
  chapter/section grouping is universally a consumer/tooling-layer concern,
  never part of the underlying movement data. Stays out of the spec;
  `action.id` is the only anchor a third party needs.
- **`after`/`with`/`on_catch` unified into one `trigger` field.** Full schema
  read of schema/v1.json + specification-v1.adoc showed `action_ref` today
  resolves via `<entity_ref>.<action_type>` (not a unique action id) — the
  real root cause of the "max ~2 actions per actor per frame" limitation that
  started this whole redesign. New shape:
  `trigger: {type: action_end|action_start|action_overlap|reception|<sport-extensible>, ref?: action_id}`
  — `action_end`/`action_start` replace `after` (and disambiguate it: the old
  prose said "starts after the referenced action **begins**", which
  contradicted every actual usage pattern we could find), `action_overlap`
  replaces `during`-style needs (e.g. a curl cut running while a screen is
  held), `reception` replaces the boolean `on_catch` (git history: introduced
  in the original v1.0.0 semantic-action-model PR (#3) as a parallel field,
  no documented reasoning against unifying it with `after` — so this wasn't
  overriding a deliberate prior decision). Rationale for unifying: `on_catch`
  as a plain boolean is not sport-general — it's schema-present on every
  action type including hockey `faceoff`/soccer `tackle` where "catching"
  isn't meaningful, and git history confirms it was only ever mechanically
  copied to new sport action types (RFC 0003), never re-evaluated per sport.
  An open, sport-extensible `trigger.type` vocabulary fixes this the same way
  `tags` already avoids schema changes for open coaching vocabulary.
  `around_player` (a `move_step` geometry reference) deliberately stays
  SEPARATE from `trigger` — it's a geometric reference with an implied timing
  side-effect (see open question 3), not an explicit author-set trigger, and
  folding it in would make the single most common case (curl around a
  screener) more verbose for no expressiveness gain.
- **DHO / merged actions get a generic `side_effects` array** (see open
  question 1) instead of a basketball-specific field or a second standalone
  action — generalizes to other sports/future combos.
- **Two-ball dribbling uses one `dribble` action with `ball_ids: [entity_ref]`
  (max 2, one per hand)**, not two parallel `dribble` actions for the same
  player. Considered and rejected two-simultaneous-actions-per-actor: nothing
  in the schema would stop two independent actions from describing
  contradictory movement for the same physical body at the same time — a
  real error-potential the frame-less model must not introduce. `moves[]`
  stays a single shared sequence (the player's one physical path); whether
  the two balls dribble in sync or alternating is renderer/tag nuance, not a
  position/timing fact the spec needs to encode (consistent with how
  `physicality` is already kept separate from `intensity`). General
  principle for the rest of this redesign: **an actor may have at most one
  active action at a time** — anything that looks like "two things happening
  at once for one actor" should be modeled as one action with richer fields
  (`ball_ids`, `side_effects`), never as two concurrent actions on the same
  `player`.
