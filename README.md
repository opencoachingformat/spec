# Open Coaching Format (OCF)

**An open standard for representing sports coaching diagrams, drill animations, and playbooks as structured data.**

[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)
[![Schema Version](https://img.shields.io/badge/schema-v1.0.0-blue)](schema/v1.json)
[![Status: Draft](https://img.shields.io/badge/status-draft-yellow)]()

---

## What is OCF?

The Open Coaching Format is a JSON-based standard for encoding sports coaching content — drills, plays, playbooks, and animated diagrams — in a structured, interoperable format.

**No open standard for this currently exists.** All major coaching tools (FIBA Europe Coaching App, FastDraw, Sportplan.net) use proprietary formats with image-only export. OCF changes that.

### Key Features

- 🏀 **Basketball-first, sport-agnostic by design** — v1 covers basketball (FIBA, NBA, NCAA, NFHS); the architecture supports extension to other sports
- 📐 **Real-world coordinates** — meters (FIBA) or feet (NBA/NCAA), origin at midcourt center
- 🗺️ **Named court positions** — `top_of_the_key`, `left_elbow`, `inbound.baseline_left` — grounded in official ruleset geometry
- 🎬 **Semantic actions** — frames describe what players *do* (`move`, `cut`, `screen`, `defend`, `dribble`, `pass`, `shoot`, `rebound`, `pickup`) rather than raw geometric lines
- 🏐 **Automatic ball possession** — a top-level `balls[]` array (`carried_by` / `at` / `dead`) supports multiple balls; possession transfers are inferred from `pass` and `pickup` actions
- 🔀 **Hybrid frames** — explicit `start_state` / `end_state` anchors combined with action sequences; outcome branches (`make` / `miss` / …) model continuum drills
- ✏️ **Progressive detail** — only `player` + `type` are required per action; variants, tags, and timing are all optional, so coaches can sketch quickly or annotate fully
- 🤖 **LLM-friendly** — structured enough for text-to-diagram generation
- ♿ **Accessibility** — color scheme with WCAG guidance
- 🔄 **FIBA import path** — coordinate mapping from the FIBA Europe internal format

---

## Quick Example

```json
{
  "court": { "ruleset": "fiba", "type": "half_court" },
  "entities": [
    { "type": "offense", "nr": 1, "x": -3.0, "y": 6.0 },
    { "type": "offense", "nr": 2, "x": 3.0, "y": 6.0 }
  ],
  "balls": [ { "id": "ball_1", "carried_by": "offense_1" } ],
  "frames": [
    {
      "id": "frame_1",
      "actions": [
        { "player": "offense_1", "type": "pass", "to_player": "offense_2" },
        { "player": "offense_1", "type": "cut", "moves": [ { "to": { "named": "basket" } } ] }
      ],
      "end_state": {
        "offense_1": { "named": "basket" },
        "balls": { "ball_1": { "carried_by": "offense_2" } }
      }
    }
  ]
}
```

---

## Repository Structure

```
opencoachingformat/
├── schema/
│   └── v1.json                  # JSON Schema Draft-7 (canonical)
├── docs/
│   └── specification-v1.adoc   # Full specification (AsciiDoc)
├── examples/
│   ├── pick-and-roll.ocf.json
│   ├── 3-man-weave.ocf.json
│   └── transition-3v2.ocf.json
├── rfcs/
│   └── 0001-initial-standard.md
└── .github/
    ├── ISSUE_TEMPLATE/
    └── workflows/
```

---

## Specification

→ [Full Specification (AsciiDoc)](docs/specification-v1.adoc)
→ [JSON Schema v1](schema/v1.json)

### Coordinate System

```
x: −max … 0 … +max   (viewer's left → center → viewer's right)
y: −max … 0 … +max   (defense basket → midline → offense basket)
```

Units are real-world: **meters** for FIBA, **feet** for NBA/NCAA/NFHS.

### Supported Rulesets

| Ruleset | Unit | Court (L × W)   |
|---------|------|-----------------|
| `fiba`  | m    | 28.0 × 15.0 m   |
| `nba`   | ft   | 94.0 × 50.0 ft  |
| `ncaa`  | ft   | 94.0 × 50.0 ft  |
| `nfhs`  | ft   | 84.0 × 50.0 ft  |
| `custom`| *    | user-defined    |

---

## Implementations

| Project | Type | Status |
|---------|------|--------|
| [ocf-editor](https://github.com/opencoachingformat/ocf-editor) *(planned)* | Web editor + viewer | 🚧 In development |

*Built something with OCF? Open a PR to add it here.*

---

## Roadmap

This repository defines the **schema and standard**. Planned companion projects
(separate repos):

1. **Validator** — semantic rules JSON Schema can't express: ball-possession
   consistency (only the carrier may `pass`/`shoot`/`dribble`), branch target
   integrity, and `end_state` agreement with action endpoints.
2. **Renderer** — draw drills and animate them from the JSON.
3. **Editor** — visual authoring on top of the renderer.

End goal: generate drills and set plays from natural language (LLM) and render
them directly, plus video overlay for practice analysis and video → play
extraction.

---

## Contributing

We welcome contributions from coaches, developers, and sports scientists.

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to:
- Report issues or request features
- Propose changes via the RFC process
- Submit pull requests

---

## License

The Open Coaching Format specification and schema are licensed under
[Creative Commons Attribution 4.0 International (CC BY 4.0)](LICENSE).

You are free to use, share, and adapt the standard — including in commercial products —
as long as you give appropriate credit.

---

## Acknowledgements

OCF v1 is informed by reverse-engineering analysis of the
[FIBA Europe Coaching Website](https://coaching.fibaeurope.com) drawing tool,
and draws on publicly available ruleset documentation from FIBA, NBA, NCAA, and NFHS.
