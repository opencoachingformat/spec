# RFC 0004 — Explicit arc for `around_player` (`side` + `arc`)

| Field       | Value                                             |
|-------------|---------------------------------------------------|
| RFC Number  | 0004                                              |
| Title       | Explicit arc for `around_player` (`side` + `arc`) |
| Author(s)   | opencoachingformat maintainers                    |
| Created     | 2026-08-28                                        |
| Status      | Draft                                             |
| Affects     | Schema + Spec                                     |
| Version     | Targets OCF v1.3.0                                |

---

## Summary

`around_player` today is only an `entity_ref` — it says *"go around player X"*
but not **which side** or **how tight the arc**. Renderers must invent both,
which makes the same document render differently across tools and prevents an
author from expressing e.g. a tight curl vs. a wide flare. This RFC adds two
optional, sport-neutral fields to `move_step` (and, mirroring `around_player`,
to the `cut` action level as a default): `side` (`left`/`right`, relative to
movement direction) and `arc` (`tight`/`normal`/`wide`). Both are optional; when
absent the renderer keeps its own defaults, so existing documents are unchanged.
Additive → **minor (v1.3.0)**.

---

## Motivation

`move_step.around_player` and `action_cut.around_player` currently carry no shape
information. The `ocf-renderer` resolves the path by:

- deriving the **side** from geometry (a cross-product heuristic) rather than the
  author's intent, and
- placing the detour waypoint at a **hardcoded 0.6 court units** from the
  obstacle, with a single waypoint that a spline smooths over.

So two coaching intents that should look different — a tight curl around a
screen vs. a wide flare brushing past — carry identical data and render
identically, and a different renderer could legitimately pick the opposite side.
This is exactly the renderer-dependent ambiguity the semantic action model
otherwise eliminates (cf. `intensity`/`physicality`, which made tempo/contact
explicit instead of renderer-guessed).

Note `cut.variant` already enumerates `curl`, `flare`, `fade` — coaching terms
that *imply* an arc shape — but nothing (schema field or renderer) connects a
variant to an actual arc. This RFC provides the missing vocabulary; the
variant→default mapping stays renderer/doc-level (see Non-Goals).

---

## Detailed Design

### Where the fields live: `move_step` (sport-neutral)

`around_player` lives on **`move_step`** (shared by the `move`, `cut`, and
`dribble` actions, which all use `moves: [move_step]`) and additionally on the
`cut` action level as a per-action default. The new `side`/`arc` fields follow
the **same placement and the same override rule** already documented on
`move_step` ("Reference fields override the action-level ones").

Because the fields live on `move_step`, they are available to `move`, `cut`, and
`dribble` alike, and they are **sport-neutral**: moving around an opponent with a
chosen side and arc tightness is generic to invasion sports. No per-sport gating
is added for these fields — the sport scoping from RFC 0003 already restricts
*which actions* a sport allows (e.g. `cut` is not in soccer's whitelist), so the
sport-specificity is carried by the action, not by these movement modifiers.

### `side`

```json
"side": { "type": "string", "enum": ["left", "right"] }
```

- Which side to pass the obstacle on, **relative to the moving player's
  direction of travel** at that step (left/right of the heading vector). This is
  renderer-independent and directly computable from the path the renderer
  already has — it replaces the geometry heuristic that currently guesses a side.
- Optional. When absent, the renderer chooses a side (see Renderer behavior).

### `arc`

```json
"arc": { "type": "string", "enum": ["tight", "normal", "wide"] }
```

- How closely the path wraps the obstacle: `tight` (curl-like), `normal`,
  `wide` (flare-like). A semantic enum in the style of `intensity`/`physicality`
  — deliberately **not** a numeric radius in the document.
- Optional. When absent, the renderer uses its default arc.

**Why no numeric radius in the schema.** The concrete radius each `arc` value
maps to is a rendering concern that should be tunable by the tool/coach, not
baked into every document. Keeping `arc` a small enum keeps documents portable
and readable; the renderer owns the enum→radius mapping and MAY expose it as
configuration. (This mirrors why coordinates stay real court units but timing
stays a relative `intensity` enum.)

### Override semantics (unchanged pattern)

Per the existing `move_step` rule, `side`/`arc` set on a `move_step` override the
`cut`-action-level values, which in turn are the defaults for that cut's steps.
This matches how `around_player`/`intensity` already behave.

### Renderer behavior (normative for renderers, not the schema)

- **`side` absent:** the renderer picks a side (it MAY keep today's geometry
  heuristic). Providing `side` makes it deterministic and author-controlled.
- **`arc` absent:** the renderer applies a default arc. If the action is a `cut`
  with a `variant` that implies a shape (`curl`→tight, `flare`/`fade`→wide), the
  renderer SHOULD derive the default from the variant; otherwise it uses a
  neutral default (replacing the current hardcoded 0.6). The renderer defines
  these defaults and MAY let a coach configure them.
- Existing documents (no `side`/`arc`, no change to `around_player`) render
  exactly as before — the renderer's defaults reproduce current behavior.

### Schema Changes

Add two optional properties to `move_step`, and mirror them on `action_cut`
(where `around_player` already exists at action level):

```json
// move_step — before
{ "properties": { "variant": ..., "to": ..., "around_player": ..., "off_screen_by": ..., "intensity": ... } }

// move_step — after (additive)
{ "properties": {
    "variant": ..., "to": ..., "around_player": ..., "off_screen_by": ..., "intensity": ...,
    "side": { "type": "string", "enum": ["left", "right"] },
    "arc":  { "type": "string", "enum": ["tight", "normal", "wide"] }
} }
```

```json
// action_cut — add the same two optional properties alongside its existing
// action-level around_player, as per-action defaults:
    "side": { "type": "string", "enum": ["left", "right"] },
    "arc":  { "type": "string", "enum": ["tight", "normal", "wide"] }
```

`additionalProperties: false` is preserved on both definitions (the new keys are
listed). No field is removed or made required.

---

## Drawbacks

- Two more optional fields to understand. Mitigated: they're small enums, only
  meaningful alongside `around_player`, and default to current behavior.
- The `variant`→default mapping is renderer-level, so two renderers could choose
  different defaults for a bare `curl` (no explicit `side`/`arc`). Accepted:
  authors who care set the fields explicitly; the spec documents the recommended
  mapping so renderers converge.
- `side` is defined relative to movement direction; for a step with no
  meaningful heading (e.g. a stationary move) `side` is undefined — the renderer
  falls back to its default there.

---

## Alternatives Considered

- **Numeric `arc_radius` in court units** (replacing the hardcoded 0.6 directly).
  Rejected as the primary form: bakes a rendering constant into every document
  and is un-OCF-like (OCF prefers semantic enums for renderer-derived quantities,
  as with `intensity`). The enum can still be extended or a renderer config added
  later without a document change.
- **`side` as `strong`/`weak`** (ball-relative) instead of `left`/`right`.
  Rejected: `strong`/`weak` is ambiguous for off-ball movement (where is "strong"
  when the ball is elsewhere?), whereas `left`/`right` relative to heading is
  always well-defined and directly computable.
- **Encode the `variant`→`side`/`arc` defaults in the schema** (per-variant
  `if/then`). Rejected: adds conditional complexity, and JSON Schema `default` is
  a non-validating annotation so it wouldn't actually apply during validation.
  The mapping is behavior, documented in the spec and implemented in the
  renderer.
- **Gate `side`/`arc` to `sport: basketball`.** Rejected: the fields are
  sport-neutral movement modifiers; RFC 0003 already gates them implicitly by
  gating the actions that use them.

---

## Backwards Compatibility

- [x] No breaking changes (additive only)
- [ ] Breaking change — requires major version bump
- [ ] Deprecates existing fields (list them)

Both fields are optional additions to `move_step` and `action_cut`; no existing
document changes meaning, and renderers reproduce current behavior when the
fields are absent. **Version impact: MINOR → v1.3.0.**

---

## Testing / Regression

- **valid:** a `cut` with `moves: [{ to, around_player, side, arc }]` — validates.
- **valid:** action-level `side`/`arc` on a `cut`, overridden by a `move_step` —
  validates.
- **valid:** a `dribble`/`move` step with `around_player` + `side`/`arc` —
  validates (fields are on `move_step`, shared by all three).
- **invalid:** `side` not in `["left","right"]` — rejected.
- **invalid:** `arc` not in `["tight","normal","wide"]` — rejected.
- **back-compat:** an existing example using `around_player` without `side`/`arc`
  still validates unchanged.

Renderer work (separate from this schema RFC): honor `side` (drop the geometry
guess when provided), map `arc`→radius (replacing the hardcoded 0.6), derive
defaults from `cut.variant`, and expose the mapping as configuration. Tracked in
the renderer task list.

---

## Non-Goals

- Defining the exact enum→radius numbers (renderer config, not schema).
- The `curl`/`flare`/`fade`→default mapping as normative schema (it's renderer
  behavior + a spec recommendation).
- Any change to `off_screen_by` (a related but separate modifier).

---

## References

- Related RFC: #0003 (Sport Scoping — why `side`/`arc` are neutral while the
  actions that use them may be sport-gated).
- Renderer analysis (internal): the `around_player` hardcoded-0.6 / geometry-side
  finding that motivated this.
