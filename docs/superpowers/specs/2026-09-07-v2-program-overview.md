# OCF v2.0.0 Program — Overview

## Status

Living document, not an RFC. Tracks the six bundled breaking changes that
together make up the v2.0.0 release. Update as items progress.

## Why a "program," not a single RFC

OCF v2.0.0 bundles six independent breaking changes into one release
rather than shipping each as its own major bump. Per SemVer discipline each
would technically warrant its own major version; batching them avoids a
rapid sequence of major-version churn for consumers migrating once anyway.
Each item still gets its own RFC (per this project's existing one-RFC-per-
feature convention, e.g. RFC 0001-0005 for v1.x) — this document is only the
index tying them together, not a substitute for any of them.

**Release discipline**: each item is designed and, where ready, implemented
independently and testably — but **no final v2.0.0 release ships until all
five are in**. Until then, schema/package versions carry a pre-release
suffix (currently `2.0.0-alpha.1`).

**North star / acceptance criterion for v2**: the spec contains everything a
renderer needs; the renderer does zero validation. Clean separation: spec =
truth + validatability; validator = correctness; renderer = display only.

## The six items

| # | RFC | Title | Status |
|---|-----|-------|--------|
| 1 | [RFC 0007](../../../rfcs/0007-sport-required.md) | `sport` becomes required | Draft — decision recorded, design not written |
| 2 | [RFC 0008](../../../rfcs/0008-affects-roles.md) | `affects` roles field | Draft — decision recorded, design not written |
| 3 | [RFC 0009](../../../rfcs/0009-multi-ball.md) | Multi-ball | Partially Accepted — two-ball dribbling implemented; broader generalization open |
| 4 | [RFC 0006](../../../rfcs/0006-frameless-action-model.md) | Frame-less action model | Accepted, implemented |
| 5 | [RFC 0010](../../../rfcs/0010-sport-scoped-court.md) | Sport-scoped court & ruleset | Draft — brainstormed, not yet approved for implementation |
| 6 | [RFC 0011](../../../rfcs/0011-remove-rendering-concerns.md) | Remove rendering concerns (`color_scheme`, `color`, `CONTRAST_LOW`) | Draft — decision recorded, not yet implemented |

## Ordering rationale

Item 4 (frame-less action model) was scheduled and delivered **first**,
ahead of its numeric position in the original list, because it changes the
`end_state`/frame basis that items 1, 2, and 5 (in different ways) build on
or interact with — designing `affects`-roles or sport-scoped court/ruleset
against a frame model about to be abolished would have wasted the work.
Item 5 depends on item 1 (`sport` reliably present) to make its whitelist
gating meaningful, so item 5 is sequenced last regardless of its RFC number.

## Cross-item dependencies (confirmed during design work)

- RFC 0006's `trigger` field and its Open Question 2 (variant-dependency
  constraints, e.g. `cut.curl` requiring a coupled `screen`) likely share a
  mechanism with RFC 0008's `affects`-roles work — coordinate, don't design
  independently.
- RFC 0009's two-ball dribbling (`ball_ids[]`) was actually designed and
  shipped as part of RFC 0006, not separately — RFC 0009 exists to record
  that and keep the broader multi-ball generalization question open.
- RFC 0010 (sport-scoped court/ruleset) requires RFC 0007 (`sport` required)
  to be meaningful — a `sport`-less document silently defaulting to
  basketball would undermine a whitelist keyed on `sport`.
- RFC 0011 (remove rendering concerns) has no dependency on any other
  program item and none depend on it — it can be implemented in any order
  relative to the other five. Its one open follow-on question (a possible
  future `area`/`label` semantic field, tracked in
  opencoachingformat/spec#53) is explicitly independent and non-breaking,
  so it does not need to resolve before v2.0.0 ships.

## Related deferred/companion topics

Not part of the v2.0.0 program scope:

- Dynamic positions (entity-relative coordinates) — later, not in v2 unless
  proven needed.
- Possession invariant spec follow-up (prose + validator rules for
  possession/sequencing) — companion documentation work, not a schema
  change.
- Funino/multi-goal topology and rule-driven scoring changes (e.g.
  minibasketball scoring) — explicitly out of scope for RFC 0010; would
  need their own design pass if ever pursued.
- The renderer's pre-existing ruleset-blindness bug (ignores `court.ruleset`
  for dimensions, always draws FIBA defaults) — a real, separate bug,
  independent of this program.
- Whether `area`/`label` should gain a semantic `role`/`kind` field (e.g. a
  referenceable "target zone" an action could point at) — open public
  discussion, opencoachingformat/spec#53; confirmed additive/non-breaking
  whenever it's resolved, so it does not gate RFC 0011 or the v2.0.0
  release.

## References

- `v2-program-strategy` memory — the original decision record for this
  program's existence and scope.
- Individual RFCs linked above for full detail per item.
