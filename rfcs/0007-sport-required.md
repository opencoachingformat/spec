# RFC 0007 — `sport` Becomes Required

| Field       | Value                                             |
|-------------|----------------------------------------------------|
| RFC Number  | 0007                                              |
| Title       | `sport` becomes a required top-level field         |
| Author(s)   | opencoachingformat maintainers                    |
| Created     | 2026-09-07                                        |
| Status      | Draft — detailed design complete, not yet implemented |
| Affects     | Schema + Spec                                     |
| Version     | Targets OCF v2.0.0 (program item 1 of 7 — see the [v2.0.0 program overview](../docs/superpowers/specs/2026-09-07-v2-program-overview.md)) |

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

The mechanical schema change: move `sport` from `schema/v1.json`'s
`properties` into its root `required` array (`["meta", "court", "entities",
"actions", "sport"]`).

**Enum stays closed** (decision, 2026-09-10): `sport`'s enum remains
exactly `basketball`/`soccer`/`handball`/`hockey`/`futsal` — no `custom`/
`other` escape hatch. A sport not yet in the registry must be added as a
proper `sports/<sport>/` bundle (RFC 0010) before it can be declared;
there is no silent/implicit path around the registry. The enum is
maintained by hand (a plain array in the schema), not generated from the
`sports/` directory at build time — a dynamic, registry-driven enum was
considered and explicitly rejected for this RFC's scope: JSON Schema has
no native mechanism to read an enum from external files at validation
time, so "dynamic" would mean introducing a build step that generates
`schema/v1.json`'s enum from `sports/<sport>/sport.json`'s presence. That
is a real capability the project could add later (e.g. backed by a
convention test asserting the two stay in sync, similar to existing
convention tests), but it is a separate, larger change to the build
pipeline that this RFC does not need in order to make `sport` required.

**Cleanup of existing `allOf` back-compat branches**: every one of the
six existing `allOf` blocks in `schema/v1.json` that gate on `sport`
today has an explicit `anyOf: [{ not: { required: ["sport"] } }, { sport
const X }]` shape, added specifically to treat "sport absent" and "sport
is basketball" as the same case for v1.x back-compat. Once `sport` is
required, "absent" can no longer occur, so every one of these six blocks
simplifies to a plain `{ properties: { sport: { const: X } } }` check.
This is mechanical but touches every existing sport-gated `allOf` block,
not just one.

**Migration**: exactly one example document in this repo currently omits
`sport` — `examples/quick-mode.ocf.json` (confirmed basketball content:
`court.ruleset: "fiba"`, actions `cut`/`pass`/`shoot`). It needs
`"sport": "basketball"` added. No other valid example or conformance
fixture omits `sport`; several `examples/invalid/*.json` fixtures also
omit it, but they're intentionally invalid for other reasons and don't
need updating unless their expected error code would change (it
wouldn't — `SCHEMA_INVALID` still applies once other required fields
mismatch, and the fixtures aren't testing sport-presence specifically).

External consumers (outside this repo) that omit `sport` and relied on
the basketball default will need to add it explicitly — this is the same
migration burden every other v2.0.0 breaking change already imposes
(RFC 0006 alone requires every v1.x document to be restructured), so no
separate migration tooling is planned beyond the existing v2.0.0
migration guidance.

**Sequencing** (decision, 2026-09-10): RFC 0007 lands first as its own
commit — required-field change plus the six-block `allOf` cleanup above
— directly followed by RFC 0012 (rename `ruleset` to `court_profile`)
and then RFC 0010 (sport-scoped court) in the same implementation
session. See the v2.0.0 program overview's Ordering rationale.

---

## Drawbacks

- Breaks any external document that omits `sport` and relied on the
  basketball default — but every v1.x document already breaks against
  v2.0.0 via RFC 0006, so this adds no new migration burden beyond what
  the release already requires.
- Touches all six existing `sport`-gated `allOf` blocks in
  `schema/v1.json` for the back-compat-branch cleanup — mechanical, but
  not a single-line change.

---

## Alternatives Considered

- **`custom`/`other` escape hatch in the enum**: considered, rejected —
  see Detailed Design. Would let a document declare a sport with no
  corresponding `sports/<sport>/` bundle, undermining the registry as
  the single source of truth RFC 0010 builds on.
- **Dynamically generate the enum from the `sports/` directory at build
  time**: considered, rejected for this RFC's scope — real capability,
  but a separate, larger build-pipeline change (see Detailed Design).
  Left as a possible future improvement, not blocking this RFC.

---

## Backwards Compatibility

- [ ] No breaking changes (additive only)
- [x] Breaking change — requires major version bump
- [ ] Deprecates existing fields (list them)

---

## Open Questions

All three of this RFC's original open questions were resolved during the
2026-09-10 design session (see Detailed Design): enum stays closed,
migration checklist is the single `quick-mode.ocf.json` fixture plus
standard v2.0.0 external-consumer migration guidance, and sequencing is
RFC 0007 → RFC 0012 → RFC 0010 within the same implementation session.
No open questions remain.

---

## References

- RFC 0003 (Sport Scoping) — introduced the optional `sport` field this RFC
  makes required.
- `docs/superpowers/specs/2026-09-07-v2-program-overview.md` — the umbrella
  v2.0.0 program this RFC is item 1 of.
- RFC 0012 (Rename `ruleset` to `court_profile`) — lands directly after
  this RFC in the same implementation session.
- RFC 0010 (Sport-Scoped Court & `court_profile`) — depends on `sport`
  being reliably present for its whitelist to be meaningful.
- `v2-program-strategy` memory — original decision record.
