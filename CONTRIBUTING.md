# Contributing to Open Coaching Format

Thank you for your interest in contributing to OCF.
This document explains how to participate — whether you are a coach, developer, or sports scientist.

---

## Types of Contributions

### Bug Reports & Clarification Requests

If something in the schema or specification is unclear, incorrect, or inconsistent,
please open a [GitHub Issue](https://github.com/opencoachingformat/spec/issues)
with the label `bug` or `clarification`.

Include:
- Which version of the schema you are using
- The specific section or field in question
- What you expected vs. what you found

### Feature Requests

For new features (e.g. new entity types, additional rulesets, new line types),
open an issue with the label `enhancement` and describe:
- The use case (what coaching scenario requires this?)
- Which sport(s) are affected
- Whether it requires a schema version bump

### RFC Process (Significant Changes)

Changes that affect the schema in a **breaking or substantially additive** way
require a Request for Comments (RFC) before implementation.

**What requires an RFC:**
- New top-level fields
- New entity types or line types
- Changes to the coordinate system
- New ruleset definitions
- Removing or renaming existing fields

**What does NOT require an RFC:**
- Documentation improvements
- New example files
- Clarifications that don't change schema behavior
- New named positions within an existing ruleset

#### RFC Workflow

1. **Open an issue** describing the problem you want to solve
2. **Fork the repo** and create a branch: `rfc/your-feature-name`
3. **Copy the RFC template:**
   ```
   cp rfcs/0000-template.md rfcs/XXXX-your-feature-name.md
   ```
   Use the next available RFC number.
4. **Fill in the RFC** — motivation, detailed design, drawbacks, alternatives
5. **Open a Pull Request** with the label `rfc`
6. **Discussion period:** at least 14 days for community feedback
7. **Decision:** maintainers mark the RFC as `accepted`, `postponed`, or `rejected`
8. **Implementation PR** references the accepted RFC number

### Pull Requests

For accepted RFCs and non-breaking changes:

1. Fork and create a branch: `feat/your-change` or `fix/your-fix`
2. Make your changes
3. Validate example files against the schema:
   ```bash
   npx ajv-cli validate -s schema/v1.json -d "examples/*.ocf.json"
   ```
4. Open a Pull Request referencing the relevant issue or RFC

---

## Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) v2.1.
Be respectful, constructive, and inclusive.

---

## Versioning Policy

OCF follows [Semantic Versioning](https://semver.org/):

- **Patch** (v1.0.x): Documentation fixes, clarifications, new examples
- **Minor** (v1.x.0): Additive changes (new optional fields, new named positions, new rulesets)
- **Major** (vX.0.0): Breaking changes to the schema

All schema versions are maintained in `schema/`:
```
schema/
├── v1.json       ← current stable
└── v1.1.json     ← when released
```

Old schema versions are never deleted — implementations can pin to a specific version.

---

## Adding a New Ruleset

To add a new sport or league ruleset (e.g. EuroLeague, WNBA, 3x3, Wheelchair):

1. Open an RFC describing the ruleset's court dimensions and geometry
2. Define named positions in the spec (following the FIBA table format)
3. Add the ruleset to the schema enum
4. Add at least two example files using the new ruleset
5. Document WCAG contrast for any new default colors

---

## Questions?

Open an issue with the label `question` or start a discussion in
[GitHub Discussions](https://github.com/opencoachingformat/spec/discussions).
