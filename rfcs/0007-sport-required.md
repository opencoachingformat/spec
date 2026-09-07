# RFC 0007 — `sport` Becomes Required

| Field       | Value                                             |
|-------------|----------------------------------------------------|
| RFC Number  | 0007                                              |
| Title       | `sport` becomes a required top-level field         |
| Author(s)   | opencoachingformat maintainers                    |
| Created     | 2026-09-07                                        |
| Status      | Draft — decision recorded, detailed design not yet written |
| Affects     | Schema + Spec                                     |
| Version     | Targets OCF v2.0.0 (program item 1 of 5 — see the [v2.0.0 program overview](../docs/superpowers/specs/2026-09-07-v2-program-overview.md)) |

---

## Summary

RFC 0003 introduced `sport` as optional (default `"basketball"`) for
backwards compatibility with every v1.x document that predates the field.
This RFC removes that default: `sport` becomes a required top-level field in
v2.0.0. No v1.x document validates unmodified against v2 anyway (the
`frames[]` → `actions[]` root-shape change in RFC 0006 alone breaks every
v1 document), so the backwards-compatibility reason for `sport`'s optionality
no longer holds once v2.0.0 ships.

---

## Motivation

RFC 0003's own "Detailed Design" made the default explicit specifically to
avoid breaking existing v1.x content:

> `sport` absent OR basketball → basketball action whitelist (default is a
> non-validating annotation, so absence must be handled explicitly for
> back-compat)

That constraint is a v1.x-only concern. v2.0.0 is already a major,
breaking-everything-at-once release (RFC 0006 alone requires every existing
document to be migrated). Once documents must be migrated anyway, there is
no remaining reason to keep `sport` silently defaulting — an author who
forgets to declare it should get a clear, explicit validation error rather
than the document quietly validating as basketball. This also removes a
latent trap RFC 0010 (this RFC's sibling, sport-scoped court/ruleset) relies
on not existing: a `sport`-less document could otherwise silently mean
"basketball" in a codebase that increasingly treats `sport` as load-bearing
(action-type whitelisting today; ruleset-scoping and `affects`-roles once
RFC 0008/0010 land).

This was already decided informally (`v2-program-strategy` memory, program
item 1) before this RFC was written; this document formalizes that decision
and gives it a number, per the project's own convention that every v2.0.0
breaking change gets its own RFC (see the v2.0.0 program overview).

---

## Detailed Design

**Not yet written.** The mechanical schema change itself is small — moving
`sport` from `schema/v1.json`'s `properties` into its root `required` array
— but this RFC intentionally does not yet specify:

- Whether `sport`'s enum stays closed (`basketball`/`soccer`/`handball`/
  `hockey`/`futsal`) or needs a `custom`/`other` escape hatch for a sport not
  yet in the registry (relevant now that RFC 0010 makes the `sports/*.json`
  registry load-bearing, not just descriptive).
- Migration guidance for existing v1.x documents/tooling (every consumer
  that currently omits `sport` and relies on the basketball default must be
  updated — this needs an explicit checklist, not just a schema diff).
- Whether this lands in the same schema-version bump as RFC 0006, or as its
  own commit within the v2.0.0 program window (the program's release
  discipline allows either, per RFC 0010).

This RFC is filed now, ahead of its detailed design, specifically so its
number and scope are visible alongside the rest of the v2.0.0 program (see
the v2.0.0 program overview) rather than living only in an internal memory
note.

---

## Drawbacks

*Not yet assessed — pending Detailed Design.*

---

## Alternatives Considered

*Not yet assessed — pending Detailed Design.*

---

## Backwards Compatibility

- [ ] No breaking changes (additive only)
- [x] Breaking change — requires major version bump
- [ ] Deprecates existing fields (list them)

---

## Open Questions

1. Closed enum vs. escape hatch for sports outside the current registry.
2. Exact migration checklist for existing tooling/documents.
3. Timing relative to RFC 0006/0008/0009/0010 within the v2.0.0 program
   window.

---

## References

- RFC 0003 (Sport Scoping) — introduced the optional `sport` field this RFC
  makes required.
- `docs/superpowers/specs/2026-09-07-v2-program-overview.md` — the umbrella
  v2.0.0 program this RFC is item 1 of.
- RFC 0010 (Sport-Scoped Court & Ruleset) — depends on `sport` being
  reliably present for its sport→ruleset whitelist to be meaningful.
- `v2-program-strategy` memory — original decision record.
