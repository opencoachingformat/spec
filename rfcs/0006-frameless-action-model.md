# RFC 0006 — Frame-less Action Model

| Field       | Value                                             |
|-------------|----------------------------------------------------|
| RFC Number  | 0006                                              |
| Title       | Frame-less Action Model: flat `actions[]`, unique action `id`, `trigger`, `branch`, `continuum` |
| Author(s)   | opencoachingformat maintainers                    |
| Created     | 2026-09-05                                        |
| Status      | Accepted (implemented)                            |
| Affects     | Schema + Spec + Validator (TS + Python)           |
| Version     | Targets OCF v2.0.0 (program item 4 of 7 — see the [v2.0.0 program overview](../docs/superpowers/specs/2026-09-07-v2-program-overview.md)) |

---

## Summary

Replaces the `frames[]` array (each a discrete coaching-phase container with
its own `end_state` anchor) with a single flat, ordered `actions[]` array at
the document root. Every action gets a unique required `id`, replacing the
`<entity_ref>.<action_type>` `action_ref` pattern. Cross-actor timing moves
from `after`/`with`/`on_catch` to a unified, sport-extensible `trigger`
field. Outcome branching becomes a dedicated `branch` action-sequence
element with self-contained per-case sub-sequences and an explicit terminal
marker. A document-level `continuum` flag supports looping drills. Breaking
→ **major (v2.0.0 program item)**.

---

## Motivation

OCF v1's `frames[]` model hard-limits how many actions a single actor can
have per coaching phase, because timing references resolve via
`<entity_ref>.<action_type>` (the `action_ref` pattern) — not a unique
action id. Two actions of the same type for the same actor within one frame
cannot be unambiguously referenced. This was confirmed against two
competitor formats (HoopsGeek, CoachCanvas) and an independent coach
contact: on a physical whiteboard, a coach just keeps drawing and narrating
one continuous flow. The frame boundary is an artificial phase container the
spec never needed to impose — it belongs entirely to how a renderer or PDF
exporter chooses to group actions into visual steps, not to the semantic
description of a play.

This is v2 program item 4 (see the v2.0.0 program overview for the full program), scheduled
**first** among the five items because it changes the `end_state`/frame
basis the other four build on — designing `affects`-roles (RFC 0008) or
sport-required (RFC 0007) against a frame model about to be abolished would
have wasted the work.

---

## Detailed Design

### Root shape change

`frames[]` (required, `minItems: 1`) is replaced by a flat, ordered
`actions[]` array at the drill root. `entities[]`/`balls[]` now serve purely
as **initial setup** (position/possession at time zero) — no mid-play entity
introduction is supported (confirmed no exception needed for substitutions,
which are simply part of setup for the documents this format targets). There
is no other position/state anchor anywhere in the document besides this one
initial setup: no per-action or per-branch `start_state`/`end_state`. Every
later position derives purely from setup plus the action sequence.

```json
// Before (v1)
{ "$schema": ".../v1.json", "frames": [ { "id": "f1", "actions": [...], "end_state": {...} } ] }

// After (v2)
{ "$schema": ".../v2.json", "actions": [ { "id": "a1", "player": "offense_1", "type": "shoot" } ] }
```

### Action identity and ordering

Every action gets a unique `id` (string, unique within the document). This
directly fixes the reference-ambiguity root cause of the old per-actor
action ceiling.

**An actor has at most one active action at a time.** Anything that looks
like "two things at once for one actor" is modeled as one action with richer
fields, never as two concurrent actions on the same `player`:

- Two balls handled simultaneously → one `dribble` action with `ball_ids`
  (max 2), one shared `moves[]` path (see RFC 0009, Multi-Ball).
- A composite action (e.g. a pass that also screens) → `side_effects[]` on
  the primary action, not a second parallel action.

**Default ordering**: an actor's actions run in the order they appear for
that actor across the flat sequence — implicit chaining, no field needed.
The first action of a given actor starts from that actor's setup position;
every subsequent action starts where the previous one ended.

**Cross-actor coupling** uses a new unified `trigger` field, replacing
`after`/`with`/`on_catch`:

```jsonc
"trigger": {
  "type": "action_end" | "action_start" | "action_overlap" | "reception" | "<sport-extensible string>",
  "ref": "<action_id>"   // required for action_end/action_start/action_overlap; omitted for reception
}
```

- `action_end` / `action_start`: starts after the referenced action ends /
  begins.
- `action_overlap`: runs *while* the referenced action is active (e.g. a
  curl cut during an active screen).
- `reception`: starts the instant its actor receives the ball (own catch);
  no `ref` needed.
- `type` is an **open, sport-extensible vocabulary** (same pattern as
  `tags`) — fixes a concrete v1 flaw where `on_catch` was present on every
  action type of every sport (including hockey `faceoff`, soccer `tackle`,
  where "catching" is meaningless) purely from being mechanically copied
  across sport RFCs, confirmed via git history.

### Composite actions: `side_effects`

```json
"side_effects": [ { "type": "screen", "on": "<entity_ref>", "physicality": "normal" } ]
```

Handles actions that are semantically one unit but touch a second actor in a
second way (e.g. a dribble hand-off: the ball-handler passes *and*
simultaneously screens the receiver's defender). Generalizes beyond
basketball without a new top-level field per case.

### Branching

```jsonc
{
  "type": "branch", "id": "branch_1", "on": "<action_id>",
  "cases": {
    "make":  { "actions": [ /* ... */ ], "then": "<anchor_action_id>" },
    "miss":  { "actions": [ /* ... */ ], "then": null }
  }
}
```

- `on` references the action whose outcome (`make`/`miss`/`turnover`/
  `steal`/`foul`, unchanged enum) selects the case.
- Each case holds a self-contained sub-sequence — avoids tagging every
  downstream action with a branch/case id and the combinatorial-explosion
  problem that would create.
- `then` is required to be present (though may be `null`) on every case: an
  explicit terminal marker distinguishes "author decided this ends here"
  from "author forgot to continue it." `then` may target any action id,
  including one preceding the branch (continuum loop).
- A branch's scope is per-branch, not global: only actions inside the
  triggering case's own `actions[]` are affected.

### Continuum (loop) plays

```json
"continuum": true
```

A drill-level flag; when true, a validator checks the play's terminal state
against its setup state (or an explicit loop anchor via a case's `then`).
Full tolerance/anchor-flexibility semantics are an explicit, tracked
follow-up (not fully specified in this RFC — see Open Questions).

### What does not change

`variant`/`side`/`arc`/`intensity`/`physicality`/`tags` are unaffected.
`description` moves from `frame.description` to each `action`. Ball
possession lifecycle (`carried_by`/`at`/`dead`, automatic transfer on
pass/shoot/pickup/rebound) is unchanged; the possession invariant (a ball
holder may only `dribble`, never `move`/`cut`) stays binary per actor. No
chapter/label concept enters the spec (researched and explicitly rejected —
stays a tooling/consumer-layer concern).

---

## Drawbacks

- Removes the `frames[]` grouping a renderer previously got "for free" from
  the document itself — a renderer that wants discrete visual steps must now
  compute its own grouping from the flat sequence. This was judged
  acceptable and correct: framing is a presentation decision, not a fact
  about the play, and conflating the two was the root problem.
- The `trigger`/`around_player` timing model is more expressive but requires
  every consumer (validator, renderer) to reconstruct a full dependency
  graph rather than reading an already-grouped structure — real
  implementation cost, paid once, in the validator (Plan 3, both languages)
  and pending in the renderer.

---

## Alternatives Considered

- **Keep `frames[]`, fix only the `action_ref` ambiguity** (e.g. add a
  same-frame action index): rejected — it treats the symptom, not the root
  cause, and does nothing for the deeper problem that a frame boundary is an
  artificial phase container a coach's continuous narration doesn't have.
- **Fold `around_player`'s implicit timing into `trigger` syntax**:
  considered and rejected — `around_player` is a derived consequence of an
  existing geometric reference, not an author-stated timing intent; forcing
  it into `trigger` would make the single most common case (curl around a
  screener) more verbose for no expressiveness gain.
- **Tag every downstream action with a branch/case id** instead of nesting
  branch cases as self-contained sub-sequences: rejected for the
  combinatorial-explosion/bookkeeping burden it would place on authors.

---

## Backwards Compatibility

- [ ] No breaking changes (additive only)
- [x] Breaking change — requires major version bump
- [x] Deprecates existing fields: `frames[]`, `frame.end_state`/
      `start_state`/`label`/`description`/`duration_ms`/`branches`,
      `action_ref` (`<entity_ref>.<action_type>`), `after`/`with`/`on_catch`

---

## Open Questions

1. Does a `side_effect` need its own `id` so other actions can `trigger` off
   it specifically (e.g. a cutter curling around exactly a dribble
   hand-off's screen, not the whole pass action)? Leaning yes; confirmed
   non-breaking to add later if skipped now.
2. Variant-dependency constraints at the sport-definition level (e.g.
   `cut.curl` requiring a coupled `screen`) — likely shares a mechanism with
   RFC 0008 (`affects`-roles). Tracked there, not resolved here.
3. Does `around_player`'s implicit timing rule (the referenced actor must be
   at that position by the time the step is processed) hold for every real
   case, or are there geometry-only `around_player` uses with no timing
   meaning?
4. Continuum loop-anchor tolerance and non-start loop points — full
   semantics deferred to a dedicated follow-up.

---

## References

- Design doc: `docs/superpowers/specs/2026-09-05-frameless-action-model-design.md`
- Companion open-questions doc: `docs/superpowers/specs/2026-09-05-frameless-action-model-open-questions.md`
- RFC 0009 (Multi-Ball) — `ball_ids[]` was implemented as part of this
  design; see that RFC for the standalone rationale.
- `docs/superpowers/specs/2026-09-07-v2-program-overview.md` — the umbrella
  v2.0.0 program this RFC is item 4 of.
- Implementation: `ocf-validator` repo, `docs/plans/2026-09-05-frameless-action-model-plan3-validator-dual-version.md`
  (v2 rule modules, both languages, dual-version dispatch).
