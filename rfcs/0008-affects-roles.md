# RFC 0008 — `affects` Roles

| Field       | Value                                             |
|-------------|----------------------------------------------------|
| RFC Number  | 0008                                              |
| Title       | `affects` roles field on actions (self/ball/target) |
| Author(s)   | opencoachingformat maintainers                    |
| Created     | 2026-09-07                                        |
| Status      | Draft — decision recorded, detailed design not yet written |
| Affects     | Schema + Spec + Validator                         |
| Version     | Targets OCF v2.0.0 (program item 2 of 7 — see the [v2.0.0 program overview](../docs/superpowers/specs/2026-09-07-v2-program-overview.md)) |

---

## Summary

Adds an `affects` field to actions declaring which roles (self / ball /
target) an action's semantics involve, coupled with `if`/`then` schema logic
so a declared role makes its corresponding position property required.
Intended to also produce a multi-sport action-modelling guideline so the
validator can validate a newly-registered sport's action vocabulary
out-of-the-box, without a validator code change per sport.

---

## Motivation

Recorded in `v2-program-strategy` memory as v2 program item 2, deliberately
sequenced **after** RFC 0006 (Frame-less Action Model): RFC 0006's design
surfaced that its `trigger` field and variant-dependency needs (e.g.
`cut.curl` requiring a coupled `screen` — see RFC 0006's Open Question 2)
likely share a mechanism with this RFC's `affects`-roles work. Designing
`affects` against the `frames[]`/`end_state` model RFC 0006 replaced would
have required redoing the work; this RFC's design is meant to start from
RFC 0006's already-shipped shape.

The underlying problem this RFC targets: today, whether an action needs
e.g. a `for_player`, `on_player`, or `ball_id` field is fixed per action
*type* in the schema (hardcoded per `action_*` definition), not derived from
a general "what roles does this action touch" concept. Every new sport's
action vocabulary currently requires bespoke schema + validator changes
rather than being checkable against a general role-declaration mechanism.

---

## Detailed Design

**Not yet written.** No `affects` field exists in the schema today (confirmed
via `grep` — zero occurrences), and no design document has been produced (this
RFC's filing is itself the first artifact for this item beyond the one-line
memory note). Open design surface, not yet worked through:

- Exact shape of `affects` (a fixed enum `["self","ball","target"]`? An
  open, sport-extensible list, matching `trigger.type`'s pattern from RFC
  0006?).
- The `if`/`then` coupling mechanism: presumably `allOf` conditionals
  analogous to the existing `sport` → `actions[].type` whitelist and RFC
  0010's proposed `sport` → `court.ruleset` whitelist — but not yet drafted
  for this specific field.
- The "multi-sport action-modelling guideline" mentioned in the originating
  memory note is described as enabling validation of a new sport's action
  vocabulary "out-of-the-box, no code change" — this is a significant claim
  that needs its own worked example (e.g. draft a hypothetical new sport's
  action set and confirm it validates correctly against `affects` alone)
  before this RFC can move past Draft.
- Relationship to RFC 0006's variant-dependency open question (`cut.curl`
  requiring a coupled `screen`) — confirm whether `affects` actually
  resolves that case or whether it needs its own separate mechanism.

---

## Drawbacks

*Not yet assessed — pending Detailed Design.*

---

## Alternatives Considered

*Not yet assessed — pending Detailed Design.*

---

## Backwards Compatibility

- [ ] No breaking changes (additive only)
- [x] Breaking change — requires major version bump (assumed, pending design
      confirming whether the `if`/`then` coupling could instead be additive)
- [ ] Deprecates existing fields (list them)

---

## Open Questions

1. Fixed vs. open-vocabulary `affects` roles.
2. Exact `if`/`then` schema mechanism and how it composes with the existing
   `sport` → `actions[].type` whitelist and RFC 0010's proposed `sport` →
   `court.ruleset` whitelist.
3. Whether this genuinely enables no-code-change validation of a new sport's
   action vocabulary, or whether that claim needs scoping down.
4. Whether this resolves RFC 0006's variant-dependency open question
   (`cut.curl` requiring `screen`) or needs a separate mechanism for it.

---

## References

- RFC 0006 (Frame-less Action Model) — sequenced before this RFC; its
  `trigger` field and Open Question 2 (variant-dependency constraints) are
  the confirmed overlap point.
- `docs/superpowers/specs/2026-09-07-v2-program-overview.md` — the umbrella
  v2.0.0 program this RFC is item 2 of.
- RFC 0010 (Sport-Scoped Court & Ruleset) — its proposed `sport` →
  `court.ruleset` whitelist is the composition point noted in Open
  Question 2 above.
- `v2-program-strategy` memory — original decision record.
