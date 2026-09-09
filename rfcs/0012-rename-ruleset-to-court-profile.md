# RFC 0012 — Rename `court.ruleset` to `court.court_profile`

| Field       | Value                                             |
|-------------|----------------------------------------------------|
| RFC Number  | 0012                                              |
| Title       | Rename `court.ruleset`/`#/definitions/ruleset` to `court.court_profile`/`#/definitions/court_profile` |
| Author(s)   | opencoachingformat maintainers                    |
| Created     | 2026-09-10                                        |
| Status      | Accepted (implemented)                            |
| Affects     | Schema + Spec + Validator (TS + Python) + registry data + every existing OCF document |
| Version     | Targets OCF v2.0.0 (program item 5 of 7 — see the [v2.0.0 program overview](../docs/superpowers/specs/2026-09-07-v2-program-overview.md)) |

---

## Summary

Today's `court.ruleset` field (`schema/v1.json`'s `#/definitions/ruleset`,
enum `fiba`/`nba`/`ncaa`/`nfhs`/`custom`) holds exactly one kind of data:
which governing body's official **court geometry** a document uses. It
carries zero actual game rules — no scoring, no timing, no fouls, nothing
a rulebook would call a "rule." The name promises more than the field
holds. This RFC renames it to `court_profile`, freeing `ruleset` as a name
for a future concept that would actually hold rule-level variation (e.g.
a temporary hot zone worth 4 points, or minibasketball's simplified
scoring — see RFC 0010's "Explicitly Out of Scope" and the
`v2-program-strategy` memory's parking of rule-driven scoring changes).

---

## Motivation

Identified during RFC 0010 (Sport-Scoped Court) design work on
2026-09-10, when discussing whether `court.ruleset` should become a
sport-scoped whitelist. Re-examining what the field actually contains —
court dimensions and named-position coordinate tables, nothing else —
made clear the name is a category error: FIBA/NBA/NCAA/NFHS are rule-
making organizations, but the *field* only ever captures their court
geometry, not their rules. A future need to model an actual rule
variant (the "Legacy Series" temporary hot-zone example raised during
design discussion, or minibasketball's simplified scoring) would have no
clean home if `ruleset` already means "court geometry variant."

Renaming now, before RFC 0010 builds its whitelist/bundle mechanism on
top of the existing name, avoids doing the rename twice (once now, once
after RFC 0010 ships and the name is even more deeply embedded).

---

## Detailed Design

**Not yet written in full.** Known scope, to be confirmed when the
Detailed Design is drafted:

- `schema/v1.json`: rename the `#/definitions/ruleset` definition to
  `#/definitions/court_profile`; rename `court.ruleset` property to
  `court.court_profile`; update every `$ref` pointing at the old
  definition name (currently: `court.ruleset` itself, and the `allOf`
  gating blocks that key off `sport`/`ruleset` together per RFC 0010's
  design — must be re-audited once RFC 0012 lands first).
- `docs/specification.adoc`: every prose/table reference to "ruleset"
  that means this field specifically (confirmed by grep: at minimum the
  `court` section, the named-position cross-ruleset difference table,
  the `court.ruleset` field-reference table, and the JSON examples) needs
  updating. Mentions of "ruleset" that are genuinely about
  FIBA/NBA/NCAA/NFHS as rule-making bodies in a general sense (not the
  field) can stay as-is — needs a careful pass, not a blind find-replace.
- `positions/resolve-position.mjs` and both validators (TS + Python):
  parameter names, error messages, and the `RULESETS` constant itself
  need renaming for consistency, even though the underlying values
  (`fiba`/`nba`/`ncaa`/`nfhs`) don't change.
- Migration: every existing example document and every consumer's own
  fixtures that write `court.ruleset` must be updated to
  `court.court_profile`. Since v2.0.0 already breaks every v1.x document
  via RFC 0006, this migration happens in the same pass as the other
  v2.0.0 breaking changes, not as a separate concern.
- Explicitly NOT in scope: inventing an actual future `ruleset` concept
  (scoring variants, hot zones). This RFC only frees the name; it does
  not fill it with new meaning.

---

## Drawbacks

- Touches every existing OCF document and every place "ruleset"
  currently appears — larger mechanical footprint than a typical single-
  field addition, even though the change itself (rename, no new
  semantics) is conceptually simple.
- `court_profile` is a longer, less immediately-obvious term than
  `ruleset` for newcomers reading a document for the first time — traded
  off deliberately for correctness (the field never held rules).

---

## Alternatives Considered

- **Keep `ruleset`, expand its scope later to hold actual rules
  alongside geometry**: rejected — would conflate two genuinely
  different concerns (court geometry vs. game rules) in one field/name,
  making a future real-rules feature (hot zones, scoring variants)
  awkward to add without further overloading the name.
- **Keep `ruleset` as-is, accept the naming imprecision**: rejected per
  explicit user judgment during design discussion — the imprecision is
  small today but would compound once RFC 0010's whitelist/bundle work
  and any future real-rules concept both build on top of it.

---

## Backwards Compatibility

- [ ] No breaking changes (additive only)
- [x] Breaking change — requires major version bump (every existing
      document using `court.ruleset` needs updating to
      `court.court_profile`)
- [ ] Deprecates existing fields (list them)

---

## Open Questions

Questions 1 and 3 were resolved during implementation (2026-09-10): the
`docs/specification.adoc` audit found every occurrence was either
field-specific (updated) or historical Changelog prose (left as-is, per
the RFC's own guidance); RFC 0012 landed first, directly followed by
RFC 0010 implemented in terms of `court_profile` from the start.

1. ~~Exact grep-and-audit checklist for every "ruleset" mention...~~ Resolved.
2. **Still open**: whether `positions/resolve-position.mjs`'s public
   function signature (`resolveNamedPosition(name, ruleset)`) should
   rename its `ruleset` parameter too, and whether that's itself a
   breaking API change for any consumer importing it directly.
   Deliberately left unresolved during implementation — the parameter
   name stayed `ruleset` (only the internal, non-exported
   implementation detail was renamed), since changing a published
   function's parameter name is a separate API-surface decision this
   RFC didn't need to make in order to ship.
3. ~~Timing relative to RFC 0010...~~ Resolved: RFC 0012 landed first.

---

## References

- RFC 0010 (Sport-Scoped Court & Ruleset) — depends on this rename;
  RFC 0010's whitelist and `sports/<sport>/` bundle design are written
  directly in terms of `court_profile`.
- `docs/superpowers/specs/2026-09-07-v2-program-overview.md` — the
  umbrella v2.0.0 program this RFC is item 5 of.
- `v2-program-strategy` memory — original parking of rule-driven scoring
  changes (hot zones, minibasketball) as future work this rename makes
  room for.
