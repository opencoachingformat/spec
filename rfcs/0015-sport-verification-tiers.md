# RFC 0015 — Sport/Court-Profile Verification Tiers

| Field       | Value                                             |
|-------------|----------------------------------------------------|
| RFC Number  | 0015                                              |
| Title       | Verification tier for sport/court-profile data (bronze/silver/gold/platinum) |
| Author(s)   | opencoachingformat maintainers                    |
| Created     | 2026-09-10                                        |
| Status      | Draft — idea recorded, detailed design not yet written |
| Affects     | Schema + Spec + registry data (`sports/*` bundle, once RFC 0010 lands) |
| Version     | Not yet assigned to a program window              |

---

## Summary

Proposes a tiered verification/trust concept for sport and court-profile
registry data — a way to distinguish "a licensed coach or club confirmed
this is accurate and complete" from "the sport's national or world
governing body confirmed it." Working tier names from the originating
discussion: **bronze** (confirmed by a licensed coach, club, or similar
individual/local authority), **silver** (confirmed by a regional
federation), **gold** (confirmed by a national federation), **platinum**
(confirmed by the sport's world governing body).

---

## Motivation

Raised during RFC 0007/0010/0012 design work (2026-09-10), while
discussing what metadata `sports/<sport>/sport.json` should carry beyond
today's bare `sport`/`version`/`status` fields (`source`, `maintainers`/
`contributors`, and `reviewed_by`/`review_date` were folded directly into
RFC 0010's Detailed Design as simpler additions — see RFC 0010). The tier
concept is substantially larger than a metadata field: it's a trust
hierarchy with real-world verification implications, likely needs to be
tracked **per court profile**, not just per sport (e.g. FIBA's official
dimensions could reasonably be "platinum," while a newly-contributed
court profile for a not-yet-promoted sport might start at "bronze" until
reviewed further up the hierarchy).

---

## Detailed Design

**Not yet written.** Open questions to resolve first:

- Exact tier definitions and which real-world entities qualify at each
  level — the bronze/silver/gold/platinum framing above is a first pass
  from the originating discussion, not a finalized taxonomy.
- Per-sport or per-court-profile — the originating discussion leans
  toward per-court-profile (see Motivation), but this needs confirming
  once the mechanism is designed.
- How a tier is claimed/verified in practice — is this self-declared by
  whoever contributes the data (with the honor system doing the work), or
  does it require some review/attestation process this project would
  need to run?
- Whether this is purely descriptive metadata (informational, no
  validation behavior) or whether a validator should ever treat tier as
  load-bearing (e.g. warn on an unverified court profile) — leaning
  descriptive-only unless a concrete need for validator behavior emerges.

---

## Drawbacks

*Not yet assessed — pending Detailed Design.*

---

## Alternatives Considered

*Not yet assessed — pending Detailed Design.*

---

## Backwards Compatibility

- [x] No breaking changes (additive only) — likely, as a new optional
      metadata field, but not confirmed until the Detailed Design is
      written.
- [ ] Breaking change — requires major version bump
- [ ] Deprecates existing fields (list them)

---

## Open Questions

1. Final tier taxonomy and qualifying entities per tier.
2. Per-sport vs. per-court-profile tracking.
3. Self-declared vs. reviewed/attested verification process.
4. Purely descriptive vs. validator-relevant.
5. Whether this depends on RFC 0010's `sports/<sport>/sport.json` bundle
   existing first.

---

## References

- RFC 0010 (Sport-Scoped Court & Court Profile) — the `sports/<sport>/`
  bundle this RFC's tiers would likely be declared in; RFC 0010 itself
  adds the simpler `source`/`maintainers`/`reviewed_by` metadata fields
  this RFC's tier concept builds on top of.
