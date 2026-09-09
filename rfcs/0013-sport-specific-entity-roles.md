# RFC 0013 — Sport-Specific Entity Roles

| Field       | Value                                             |
|-------------|----------------------------------------------------|
| RFC Number  | 0013                                              |
| Title       | Sport-specific entity roles (e.g. goalkeeper)      |
| Author(s)   | opencoachingformat maintainers                    |
| Created     | 2026-09-10                                        |
| Status      | Draft — idea recorded, detailed design not yet written |
| Affects     | Schema + Spec + registry data (`sports/*` bundle, once RFC 0010 lands) |
| Version     | Not yet assigned to a program window              |

---

## Summary

Today every `entities[]` item is exactly one of two fixed roles:
`entity_offense` or `entity_defense` (`type` is a `const` — see
`schema/v1.json`'s `entity_offense`/`entity_defense` definitions). This is
basketball's own shape: offense vs. defense is the only distinction the
game needs. Other sports have roles that don't map onto that binary — a
soccer goalkeeper, for instance, is meaningfully different from an
outfield defender in ways a coach's diagram needs to express (different
action vocabulary, different court zone, different tactical role) but is
still "on defense" in the offense/defense sense.

This RFC proposes a sport-scoped entity-role mechanism, so a sport's own
definition (see RFC 0010's `sports/<sport>/sport.json` bundle) can declare
roles beyond the basketball offense/defense binary.

---

## Motivation

Raised during RFC 0007/0010/0012 design work (2026-09-10) when discussing
whether sport-scoping should extend to entities, not just actions and
court geometry. Not yet backed by a concrete failure case beyond the
goalkeeper example — needs research into what other invasion sports
(handball, hockey, futsal) actually require before a design is written.

---

## Detailed Design

**Not yet written.** Open questions to resolve first:

- Does this stay purely additive (a sport can declare extra roles on top
  of offense/defense), or does it replace the binary for sports where it
  doesn't fit?
- How does a sport-specific role interact with the existing
  `entity_offense`/`entity_defense` `color`/`type` const pattern?
- Does a sport-specific role change which `actions[].type` values are
  valid for that entity (e.g. only a goalkeeper can perform a sport's
  goalkeeper-specific actions)?
- Relationship to RFC 0008 (`affects` roles) — that RFC's "roles" are
  about what an action affects, not what an entity fundamentally is;
  confirm these are genuinely different concepts before designing both.

---

## Drawbacks

*Not yet assessed — pending Detailed Design.*

---

## Alternatives Considered

*Not yet assessed — pending Detailed Design.*

---

## Backwards Compatibility

- [ ] No breaking changes (additive only) — likely, but not confirmed
      until the Detailed Design is written.
- [ ] Breaking change — requires major version bump
- [ ] Deprecates existing fields (list them)

---

## Open Questions

1. What concrete roles do handball/hockey/futsal/soccer actually need,
   beyond the goalkeeper example?
2. Additive vs. replacing the offense/defense binary.
3. Interaction with RFC 0008's `affects`-roles field — same mechanism or
   genuinely separate?
4. Whether this depends on RFC 0010's `sports/<sport>/sport.json` bundle
   existing first (a natural place to declare a sport's own entity roles).

---

## References

- RFC 0010 (Sport-Scoped Court & Ruleset) — the `sports/<sport>/` bundle
  this RFC's roles would likely be declared in.
- RFC 0008 (`affects` roles) — a different "roles" concept; needs explicit
  disambiguation once both are designed in detail.
- `schema/v1.json` — `entity_offense`/`entity_defense` definitions, the
  current fixed binary this RFC would extend.
