# Frame-less Action Model (v2) — Design

## Context

OCF v1's `frames[]` array forces every play into discrete "coaching phase"
containers, each with an `end_state` anchor. Studying two competitors
(HoopsGeek, CoachCanvas — confirmed independently by a DBTV coach contact)
showed this frame model hard-limits how many actions a single actor can have
per phase, because timing references resolve via `<entity_ref>.<action_type>`
(schema `action_ref`), not a unique action id — two actions of the same type
for the same actor in one frame can't be unambiguously referenced. On a
physical whiteboard a coach just keeps drawing and narrating one continuous
flow; the artificial phase boundary breaks that.

This is v2 program item 4 (see `[[v2-program-strategy]]` memory), scheduled
first because it changes the `end_state`/frame basis the other three v2
items (`sport` required, `affects`-roles, multi-ball) build on. North star
unchanged: the spec carries everything a renderer needs; the renderer does
zero validation; framing (grouping actions into a still-frame or PDF step)
becomes **entirely a renderer/consumer concern** — the term "auto-framing"
is retired because it wrongly implied the spec does framing work.

## Goals

- Remove the artificial cap on concurrent/sequential actions per actor per
  phase.
- Attach coaching prose to the action it describes, not to an artificial
  phase container.
- Make branching (outcome-dependent continuations) and looping (continuum
  drills) expressible without a frame array to branch between.
- Fix, as a byproduct, the real root cause found during design: action
  references resolve via `<entity_ref>.<action_type>`, which cannot address
  more than one action of a given type per actor — this is what actually
  caused the "2 actions per actor" ceiling, not the frame boundary itself.
- Stay sport-general: nothing in the new model may be basketball-specific
  where a shared concept works for soccer/handball/hockey/futsal too.

## Non-goals

- Redesigning how a renderer groups actions into visual frames/pages — that
  is downstream, out of scope, and deliberately unconstrained by the spec.
- Full multi-ball generalization (own v2 program item) — but see "Multi-ball
  compatibility" below; this design was checked against it.
- Full `affects`-roles design — variant-dependency constraints and this
  design's `trigger` vocabulary extension point are confirmed compatible but
  not fully specified (open question, see companion doc).
- Chapter/section/label concepts — researched and explicitly rejected from
  the spec (see companion doc); stays tooling/playbook-layer.

## Architecture

### Top-level shape change

`frames[]` (required, `minItems: 1`) is replaced by a flat, ordered
`actions[]` array at the drill root, alongside the existing `entities[]` and
`balls[]` (which now serve purely as **initial setup** — position/possession
at time zero; no mid-play entity introduction, confirmed no exception needed
for e.g. substitutions, which are just part of setup for the documents this
format targets). There is no other position/state anchor anywhere in the
document besides this one initial setup — no per-action or per-branch
`start_state`/`end_state` of any kind; every later position is derived
purely from setup + the action sequence.

This is a breaking change to the document root contract
(`required: ["meta","court","entities","frames"]` → `frames` replaced by
`actions`), which is why it belongs in the v2 major bump, not a minor
addition.

### Action identity and ordering

Every action gets a unique `id` (string, unique within the document),
replacing the current `action_ref` pattern of `<entity_ref>.<action_type>`.
This directly fixes the reference ambiguity that caused the per-actor action
ceiling — any number of actions of the same type for the same actor can now
coexist and be referenced unambiguously.

**An actor has at most one active action at a time.** Anything that looks
like "two things at once for one actor" is modeled as one action with richer
fields, never as two concurrent actions on the same `player`:
- Two balls handled simultaneously → one `dribble` action with
  `ball_ids: [entity_ref, entity_ref]` (max 2, one per hand), one shared
  `moves[]` path. Sync vs. alternating dribble rhythm is renderer/tag nuance,
  not a position/timing fact.
- A composite action (pass that also screens, etc.) → `side_effects[]` on
  the primary action (see below), not a second parallel action.

**Default ordering:** an actor's actions run in the order they appear for
that actor across the flat sequence — implicit chaining, no field needed.
The first action of a given actor starts from that actor's `entities[]`
(or `balls[]`) setup position; every subsequent action for that actor starts
where its previous action ended. No per-action `start_state` — this was
confirmed as sufficient (setup covers the one exception case, entity
introduction, since this format doesn't support mid-play substitutions).

**Cross-actor coupling** uses the new unified `trigger` field (replaces
`after`/`with`/`on_catch`):

```
"trigger": {
  "type": "action_end" | "action_start" | "action_overlap" | "reception" | <sport-extensible string>,
  "ref": "<action_id>"   // required for action_end/action_start/action_overlap; omitted for reception
}
```

- `action_end` / `action_start`: starts after the referenced action ends /
  begins. Replaces `after`, and resolves a real ambiguity found in the old
  spec prose ("starts after the referenced action begins" — contradicted by
  every actual timing need surfaced during design, e.g. a pin-down screen
  triggering a curl only once the screen is *set*, not when it *starts*).
- `action_overlap`: this action runs *while* the referenced action is
  active — e.g. a curl cut running during an active screen. Replaces the
  gap where `with` only expressed simultaneous *start*, not sustained
  overlap.
- `reception`: this action starts the instant its actor receives the ball
  (own catch) — replaces the boolean `on_catch`. No `ref` needed (implicit:
  own most recent ball reception).
- The `type` vocabulary is **open/sport-extensible**, the same way `tags`
  already avoids schema changes for coaching vocabulary. This fixes a
  concrete flaw found in the current schema: `on_catch` is present on every
  action type of every sport (including hockey `faceoff`, soccer `tackle`,
  where "catching" is meaningless) purely because it was mechanically copied
  across sport RFCs (confirmed via git history — no sport-by-sport
  re-evaluation ever happened). An open trigger vocabulary means only sports
  whose action set has a real reception concept use `reception`.

**Geometric coupling stays separate from `trigger`:** `around_player` (on a
`move_step`) is a geometry reference — "curve around this actor's position"
— that implies a timing constraint (the referenced actor must be at that
position by the time the step is processed) as a side effect, without a
separate explicit field. This was deliberately NOT folded into `trigger`,
because unlike `trigger` it isn't an author-stated timing intent — it's a
derived consequence of an existing geometric reference, and forcing it into
`trigger` syntax would make the single most common case (curl around a
screener) more verbose for no expressiveness gain. Open question: does the
implicit rule hold for every real case, or are there geometry-only
`around_player` uses with no timing meaning? (see companion doc)

### Composite actions: `side_effects`

Some actions are semantically one unit that happens to touch a second actor
in a second way — e.g. a dribble hand-off (DHO): the ball-handler passes
*and* simultaneously screens the receiver's defender with their own body.
Rather than a basketball-specific field or an awkward second `screen` action
(which requires `for_player` and doesn't fit a screen that's a byproduct of
a pass), actions carry an optional generic array:

```
"side_effects": [
  { "type": "screen", "on": "<entity_ref>", "physicality": "normal" }
]
```

Generalizes to other sports/future combinations without a new top-level
field per case. Open question: does a `side_effect` need its own `id` for
other actions to `trigger` off it specifically (e.g. a cutter curling around
exactly the DHO screen, not the whole pass action)? Leaning yes, confirmed
non-breaking to add later if skipped now (see companion doc).

### Branching

Branching moves from `frame.branches` (outcome → target frame id) to a
dedicated action-sequence element:

```
{
  "type": "branch",
  "id": "branch_1",
  "on": "<action_id>",
  "cases": {
    "make":  { "actions": [ ... ], "then": "<anchor_action_id>" },
    "miss":  { "actions": [ ... ], "then": null }
  }
}
```

- `on` references the action whose outcome selects the case (outcome enum
  unchanged: `make`, `miss`, `turnover`, `steal`, `foul`).
- Each case holds its own self-contained sub-sequence of actions — avoids
  needing to tag every downstream action with which branch it belongs to,
  and avoids the combinatorial-explosion problem of tagging by named
  "case IDs" across many actions (considered and rejected: the branch
  container itself IS the scope, no separate case-id bookkeeping needed).
- `then` is optional: a **terminal marker is required when a case does not
  continue** (explicit "this branch ends here", not an implicit missing
  field — so a validator can distinguish "author decided this ends" from
  "author forgot to continue it"). `then` may point at any action id,
  including one that precedes the branch (continuum loop, see below).
- Scope of a branch is per-branch, not global: only actions inside the
  triggering case's `actions[]` are affected. Any other actor's action that
  needs to react to the same outcome must itself live inside the relevant
  case's sub-sequence, or use `trigger` against an action inside it. This
  was chosen over "branching affects the whole play state" (today's
  behavior) because it maps more directly to how a single actor's fate
  actually forks, and avoids forcing every uninvolved actor through a
  branch structure they have nothing to do with.

### Continuum (loop) plays

A drill-level flag, orthogonal to branching but sharing its anchor/terminal
vocabulary:

```
"continuum": true
```

When true, a validator checks that the play's terminal state (position of
every entity/ball at every unresolved end-point) matches the setup state (or
an explicitly designated loop anchor — exact tolerance/anchor-flexibility
left to the follow-up, see companion doc). A branch case's `then` may target
the loop anchor to express "this path re-enters the loop." This piece is
intentionally NOT fully specified here — only enough to confirm branching's
`then`/terminal vocabulary composes with it cleanly; full continuum
semantics (tolerance, non-start loop points, multi-ball interaction) are a
deferred follow-up.

### What does NOT change

- `variant`, `side`, `arc`, `intensity`, `physicality`, `tags` stay exactly
  as they are today — all already action-scoped properties, unaffected by
  the frame container's removal.
- `description` moves from `frame.description` to each `action` (optional) —
  coaching prose attaches to the action it explains, matching how a coach
  narrates while drawing. No information is lost; a frame's single
  description historically covered several actions at once, an action-level
  description covers exactly one — a renderer wanting a paragraph per
  visual "step" concatenates the descriptions of the actions it groups.
- Ball possession lifecycle (`carried_by`/`at`/`dead`, automatic transfer on
  pass/shoot/pickup/rebound) is unchanged; balls follow the same
  one-active-action-at-a-time, implicit-chaining rule as any other actor.
- The possession invariant (a ball holder may only `dribble`, never
  `move`/`cut`) needed no change for two-ball drills — confirmed the rule
  stays binary per actor ("holding ANY ball forbids move/cut"), not
  per-(actor,ball).
- No chapter/label concept enters the spec (confirmed via research across
  video chapters, Labanotation, and sports play-by-play formats — this is
  universally a tooling/consumer-layer concern). `action.id` is the only
  anchor a third party needs.
- No explicit millisecond/latency-window field. Relative timing between
  actions is still derived from `intensity` + distance, never a literal
  duration — consistent with the existing `movement_intensity`/
  `ball_intensity` philosophy ("does not imply a concrete duration").

## Data flow (renderer's job, not the spec's)

The spec's flat `actions[]` plus each action's `trigger` gives any consumer
enough information to reconstruct a full timeline: walk the sequence,
resolve each actor's implicit chaining, resolve `trigger`/`around_player`
dependencies into a directed graph, and follow `branch`/`continuum`
structure for outcome-dependent paths. How a renderer then groups that
timeline into still frames (for PDF, for an editor's page view, for step
count) is entirely its own decision/configuration — the spec deliberately
does not constrain "how many actions per visual frame."

## Error handling / validation implications

- A validator can reject: two actions for the same `player` with no `trigger`
  ordering relationship where the schema requires one (i.e. it MUST NOT be
  possible to have two directly-conflicting simultaneous actions for one
  actor — enforced by the "one active action per actor" rule structurally,
  not by a runtime check, since the schema simply has no way to express two
  parallel actions for one actor anymore).
- A validator can reject a `branch` case lacking both `then` and an explicit
  terminal marker.
- A validator can reject a `continuum: true` document whose terminal state
  doesn't match its loop anchor (exact rule deferred, see companion doc).
- Possession invariant, sequential-chaining, and pass-reception-at-end-state
  rules (already documented separately, see `[[possession-invariant-spec-followup]]`)
  carry over unchanged, now checked against the flat action sequence instead
  of frame-scoped `actions[]`.

## Multi-ball compatibility (checked, not designed here)

This design was explicitly checked against the planned multi-ball v2 item
and found to help rather than hinder it:
- Unique `action.id`s (vs. today's `<entity_ref>.<action_type>` action_ref)
  resolve the exact reference-ambiguity problem multi-ball would otherwise
  hit first (two simultaneous `dribble` actions for one actor could not be
  referenced unambiguously today).
- Two-ball dribbling (a common real basketball drill) is handled by
  `ball_ids: [entity_ref]` on one `dribble` action rather than two actions,
  keeping the one-action-per-actor invariant intact.

## Follow-up / out of scope for this design

See the companion open-questions document
(`2026-09-05-frameless-action-model-open-questions.md`) for:
1. Whether a `side_effect` needs its own `id`.
2. Variant-dependency constraints at the sport-definition level (e.g.
   `cut.curl` requiring a coupled `screen`), including the `trigger.type`
   sport vocabulary — likely the same mechanism as the planned
   `affects`-roles RFC.
3. Whether `around_player`'s implicit timing rule holds for every real case.
4. Continuum loop-anchor tolerance and non-start loop points.
