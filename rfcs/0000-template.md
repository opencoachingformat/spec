# RFC XXXX — [Title]

| Field       | Value                        |
|-------------|------------------------------|
| RFC Number  | XXXX                         |
| Title       | [Short descriptive title]    |
| Author(s)   | [Your name / GitHub handle]  |
| Created     | YYYY-MM-DD                   |
| Status      | Draft / Under Review / Accepted / Rejected / Postponed |
| Affects     | Schema / Spec / Both         |
| Version     | Targets OCF v[X.Y]           |

---

## Summary

*One paragraph describing what this RFC proposes.*

---

## Motivation

*Why is this change needed? What problem does it solve?
Describe the coaching or technical scenario that motivates this proposal.
Link to any related issues.*

---

## Detailed Design

*The full technical specification of the proposed change.
Include:*

- *New or modified schema fields with types and descriptions*
- *New named positions (with coordinates per ruleset)*
- *New enum values*
- *Rendering behavior*
- *Example JSON snippets*

### Schema Changes

```json
// Before (if modifying existing)
{
  "existing_field": "..."
}

// After
{
  "existing_field": "...",
  "new_field": "..."
}
```

### Example

```json
{
  "$schema": "https://opencoachingformat.org/schema/v1.json",
  ...
}
```

---

## Drawbacks

*What are the downsides or risks of this approach?
Consider: complexity, backwards compatibility, implementation burden.*

---

## Alternatives Considered

*What other approaches were considered and why were they rejected?*

---

## Backwards Compatibility

*Is this a breaking change? How should existing implementations handle this?*

- [ ] No breaking changes (additive only)
- [ ] Breaking change — requires major version bump
- [ ] Deprecates existing fields (list them)

---

## Open Questions

*List any unresolved questions that need community input.*

1. ...
2. ...

---

## References

- Issue: #[number]
- Related RFC: #[number] (if any)
- External: [link to relevant rulebook, spec, etc.]
