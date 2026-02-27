# RFC 0001 — Initial Open Coaching Format Standard (v1.0)

| Field       | Value                                  |
|-------------|----------------------------------------|
| RFC Number  | 0001                                   |
| Title       | Initial Open Coaching Format Standard  |
| Author(s)   | opencoachingformat maintainers         |
| Created     | 2025-02-27                             |
| Status      | Accepted                               |
| Affects     | Schema + Spec                          |
| Version     | OCF v1.0.0                             |

---

## Summary

Defines the initial Open Coaching Format (OCF) v1.0 standard — a JSON schema for
representing basketball drill diagrams, plays, and multi-step coaching animations
as structured, interoperable data.

---

## Motivation

No open standard exists for sports coaching diagrams. All major tools
(FIBA Europe Coaching App, FastDraw, Sportplan.net, Playdrill.com) use proprietary
formats with image-only export. This prevents:

- Programmatic drill creation and modification
- LLM-assisted coaching tools (text → diagram)
- Cross-platform interoperability
- Community-driven coaching content libraries
- Accessibility tooling

OCF addresses this by defining a minimal, extensible JSON format grounded in
real-world court geometry.

---

## Detailed Design

### Core Principles

1. **Real-world units** — meters (FIBA) or feet (NBA/NCAA/NFHS), not pixel grids
2. **Origin at midcourt center** — positive y = frontcourt (offense), negative = backcourt
3. **Named positions** — standard court landmarks as first-class citizens
4. **Entity keys = team + number** — `"offense_1"`, `"defense_3"` — no synthetic IDs
5. **Frames are additive** — only delta entity positions per frame
6. **Colors are semantic roles** — `"offense"`, `"defense"` — resolved via color_scheme
7. **Registry over fixed enum** — extensible named positions via `custom.*`

### Coordinate System

```
x: −max … 0 … +max   (viewer's left → court center → viewer's right)
y: −max … 0 … +max   (defense basket → midline → offense basket)
```

Half court uses y = 0 → +max. Full court uses y = −max → +max.

### Supported Rulesets (v1.0)

- `fiba` (meters, 28×15m)
- `nba` (feet, 94×50ft, straight corner geometry)
- `ncaa` (feet, 94×50ft)
- `nfhs` (feet, 84×50ft)
- `custom` (user-defined dimensions)

### Coordinate Types

Three forms for coordinates in `coords[]` arrays:

```json
{ "x": 2.45, "y": 8.20 }                              // absolute
{ "named": "left_elbow" }                              // named (ruleset-resolved)
{ "relative_to": "left_elbow", "dx": 1.0, "dy": -0.5 }  // relative offset
```

### Entity Types

`offense`, `defense`, `ball`, `coach`, `cone`, `station`

### Line Types

`movement`, `passing`, `dribbling`, `screen`, `line`, `free`

### Frame Model

- `entities[]` = initial positions (frame 0 baseline)
- Each `frame.entity_states` = delta positions only
- Each `frame.lines[]` = lines active in that frame
- Entities not in `entity_states` inherit previous frame position

---

## Backwards Compatibility

This is the initial version. No backwards compatibility concerns.

---

## References

- FIBA Official Basketball Rules 2022
- NBA Official Rules 2023-24
- NCAA Men's Basketball Rules 2023-24
- FIBA Europe Coaching Website (coaching.fibaeurope.com) — internal format analysis
