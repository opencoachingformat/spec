# RFC 0009 — Multi-Ball

| Field       | Value                                             |
|-------------|----------------------------------------------------|
| RFC Number  | 0009                                              |
| Title       | Multi-ball: two-ball dribbling + open question on further generalization |
| Author(s)   | opencoachingformat maintainers                    |
| Created     | 2026-09-07 (two-ball dribbling implemented 2026-09-05 as part of RFC 0006) |
| Status      | Partially Accepted (two-ball dribbling implemented; broader ball-model generalization still open) |
| Affects     | Schema + Spec + Validator (TS + Python)           |
| Version     | Targets OCF v2.0.0 (program item 3 of 5 — see the [v2.0.0 program overview](../docs/superpowers/specs/2026-09-07-v2-program-overview.md)) |

---

## Summary

RFC 0003 (Sport Scoping) left open whether the ball model — today's single
`ball` entity with `carried_by`/`at`/`dead` state — needs generalizing for
other invasion sports (multi-ball drills, hockey pucks, handball). During
RFC 0006's design, the narrower **two-ball dribbling** case (one player
handling two balls at once, a real, common basketball drill) was
implemented as `ball_ids[]` on `action_dribble`. This RFC records that as
done and keeps the broader generalization question open as unresolved.

---

## Motivation

RFC 0003 Open Question 4 asked: *"Does any target invasion sport need the
ball model generalized (multi-ball)? Current `carried_by/at/dead` covers
single ball and puck."* This was deferred into the v2.0.0 program (item 3)
rather than answered in RFC 0003 itself.

While designing RFC 0006 (Frame-less Action Model), a concrete, narrower
version of this question came up directly: with the old frame-based model's
per-actor action ceiling gone, could an actor now hold and move two balls
*simultaneously* in one action (two-ball dribbling)? This was checked
against RFC 0006's core invariant — "an actor has at most one active action
at a time" — and resolved as `ball_ids: [entity_ref, entity_ref]` (max 2, one
per hand) on a single `dribble` action with one shared `moves[]` path,
rather than two parallel actions. This kept RFC 0006's invariant intact and
shipped with it.

This is a real but narrow slice of the original, broader RFC 0003 question.
It does **not** address: multiple independent balls in simultaneous separate
play (e.g. a multi-station drill with several balls live at once — already
structurally possible via multiple `balls[]` entries, but never
stress-tested against validator possession logic for genuinely independent,
unrelated balls), a hockey puck's distinct physical behavior vs. a
basketball, or handball's ball model. Those remain open.

---

## Detailed Design

### Implemented: two-ball dribbling (`ball_ids[]`)

```json
{
  "type": "action_dribble",
  "properties": {
    "ball_id": { "$ref": "#/definitions/ball_ref" },
    "ball_ids": {
      "type": "array",
      "description": "Two-ball dribbling: one ball per hand. Use ball_id for the single-ball case; use ball_ids (not both) when this action controls two balls simultaneously.",
      "minItems": 1, "maxItems": 2,
      "items": { "$ref": "#/definitions/ball_ref" }
    }
  },
  "not": { "required": ["ball_id", "ball_ids"] }
}
```

Mutual exclusivity (`not: required: [ball_id, ball_ids]`) mirrors the
existing `ball.carried_by`/`at`/`dead` pattern. The possession invariant (a
ball holder may only `dribble`, never `move`/`cut`) stays binary per actor,
not per-(actor,ball) — confirmed sufficient for two-ball drills during RFC
0006's design; both validator implementations (TS and Python) check
"holding ANY ball forbids move/cut," not per-ball.

### Not yet designed: broader ball-model generalization

RFC 0003's original question is still open:

- Does `carried_by`/`at`/`dead` genuinely cover a hockey puck's behavior, or
  does puck physics (e.g. can be "loose" in a materially different sense
  than a dropped basketball) need its own state machine?
- Handball's ball model — is it identical to basketball's for this format's
  purposes (single ball, one carrier at a time, pass/shoot/pickup
  lifecycle), or does it need anything RFC 0009 hasn't considered?
- Multi-station drills with several *unrelated* live balls (not one actor's
  two-ball dribble, but genuinely independent balls each with their own
  actor/possession chain) — structurally already possible via multiple
  `balls[]` entries, but never explicitly validated/tested for this case;
  confirm the validator's possession rules (which iterate all balls
  independently already, per the TS/Python `possession_rules_v2`
  implementation) actually handle N independent balls correctly, not just
  the two-ball-same-actor case.

---

## Drawbacks

- Two-ball dribbling: none identified beyond the general RFC 0006 drawback
  of a more expressive-but-more-complex `trigger`/possession model.
- Leaving the broader generalization open means a future hockey/handball
  sport registry entry could surface a real gap late, rather than being
  designed for now. Accepted as a deliberate scope decision (see this
  project's own scope-decision heuristic: don't design for a sport that
  isn't being promoted past "provisional" status yet).

---

## Alternatives Considered

- **Two parallel `dribble` actions for two-ball dribbling** instead of one
  action with `ball_ids[]`: rejected — violates RFC 0006's "one active
  action per actor" invariant and would have required a special-case
  exception to it for exactly one scenario.
- **Generalize the full ball model now** (puck-specific state, N-ball
  drills, etc.) as part of this RFC: rejected as premature — no sport
  beyond basketball is past "provisional" registry status yet (see RFC
  0010), so there's no concrete requirement to design against.

---

## Backwards Compatibility

- [x] No breaking changes (additive only) — for the implemented two-ball
      dribbling piece (`ball_ids` is a new optional field).
- [ ] Breaking change — requires major version bump (unresolved for any
      future broader generalization; depends on what shape it takes)
- [ ] Deprecates existing fields (list them)

Filed under the v2.0.0 program (see the program overview) because it was
designed and shipped alongside RFC 0006's breaking root-shape change, not
because `ball_ids[]` itself required a major bump on its own.

---

## Open Questions

1. Hockey puck behavior vs. basketball's `carried_by`/`at`/`dead` — same
   model or needs its own?
2. Handball's ball model — any gap vs. basketball's?
3. Multi-station/N-independent-balls scenario — confirm validator
   possession rules handle it correctly; write conformance fixtures if not
   already covered.
4. Should this RFC be closed as "two-ball dribbling done, broader question
   moved to its own tracked follow-up," or does it stay open until the
   broader question is answered?

---

## References

- RFC 0003 (Sport Scoping) — Open Question 4, the origin of this RFC.
- RFC 0006 (Frame-less Action Model) — "Multi-ball compatibility" section;
  where `ball_ids[]` was actually designed and implemented.
- `docs/superpowers/specs/2026-09-07-v2-program-overview.md` — the umbrella
  v2.0.0 program this RFC is item 3 of.
- Implementation: `packages/ts/src/v2/rules/possession.ts` and
  `packages/py/ocf_validator/v2/possession_rules.py` in the `ocf-validator`
  repo (`resolveBallIds`/`_resolve_ball_ids` handle both `ball_id` and
  `ball_ids`).
