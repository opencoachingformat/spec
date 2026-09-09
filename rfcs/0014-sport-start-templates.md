# RFC 0014 — Sport Start Templates (Formations)

| Field       | Value                                             |
|-------------|----------------------------------------------------|
| RFC Number  | 0014                                              |
| Title       | Sport-bound start templates / formations           |
| Author(s)   | opencoachingformat maintainers                    |
| Created     | 2026-09-10                                        |
| Status      | Draft — idea recorded, detailed design not yet written |
| Affects     | Schema + Spec + registry data (`sports/*` bundle, once RFC 0010 lands) |
| Version     | Not yet assigned to a program window              |

---

## Summary

An OCF document's `entities[]` array is authored from scratch every time —
there's no reusable, named starting formation a document can reference
(e.g. a soccer 4-4-2, a basketball 5-out set). This RFC proposes
sport-bound start templates: predefined `entities[]` layouts a document
could reference or start from, reducing repetitive manual authoring for
common formations.

---

## Motivation

Raised during RFC 0007/0010/0012 design work (2026-09-10): start
templates are inherently sport-bound (a 4-4-2 makes sense only for
soccer), so if they're built, they belong in the same
`sports/<sport>/sport.json` bundle RFC 0010 introduces. Not yet backed by
concrete user demand or a worked example beyond the general idea — needs
scoping before a design is written.

---

## Detailed Design

**Not yet written.** Open questions to resolve first:

- Is a template a full `entities[]` array a document can copy/reference,
  or a lighter-weight named shape (e.g. "4-4-2" implies relative
  positions, scaled to whichever court/ruleset the document uses)?
- How does a template interact with `court_profile` (RFC 0012) — is a
  formation defined once per sport and repositioned per court profile, or
  does each court profile need its own template coordinates?
- Referenced by id (`"formation": "4-4-2"`) vs. fully inlined and then
  edited — affects whether this is a validator concern (does the id
  exist?) or purely an authoring convenience with no schema footprint.
- Whether this is schema-level at all, or better served as a
  tooling/editor feature (e.g. an authoring UI's "start from a template"
  button) with zero OCF document format impact — needs deciding before
  committing to any schema change.

---

## Drawbacks

*Not yet assessed — pending Detailed Design.*

---

## Alternatives Considered

- **Pure tooling feature, no schema change**: an editor could offer
  "start from a formation" without OCF itself needing to represent
  templates — not yet decided against, genuinely open per the Detailed
  Design questions above.

---

## Backwards Compatibility

- [ ] No breaking changes (additive only) — likely, if this ends up
      schema-relevant at all; not confirmed.
- [ ] Breaking change — requires major version bump
- [ ] Deprecates existing fields (list them)

---

## Open Questions

1. Schema-level construct vs. pure tooling/editor feature with no OCF
   format footprint.
2. Relationship to `court_profile` (RFC 0012) — per-sport or per-profile
   coordinates.
3. Reference-by-id vs. copy-and-edit authoring model.
4. Whether this depends on RFC 0010's `sports/<sport>/sport.json` bundle
   existing first.

---

## References

- RFC 0010 (Sport-Scoped Court & Ruleset) — the `sports/<sport>/` bundle
  this RFC's templates would likely live in, if schema-level at all.
- RFC 0012 (rename `court.ruleset` to `court.court_profile`) — templates
  would need to interact with whichever court-variant concept exists.
