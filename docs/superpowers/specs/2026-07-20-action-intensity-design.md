# Open Coaching Format — Aktions-Tempo (`intensity`) & Körperlichkeit (`physicality`) (Design)

**Datum:** 2026-07-20
**Status:** Entwurf zur Review
**Betrifft:** Additive Erweiterung des semantischen Aktionsmodells
(`docs/superpowers/specs/2026-06-02-semantic-action-model-design.md`) um zwei
optionale, unabhängige Felder je Aktion: `intensity` (Tempo über Distanz) und
`physicality` (Körperkontakt/Kollisionsstil für die Animationsauswahl).

---

## 1. Motivation

Das semantische Aktionsmodell beschreibt *was* passiert (wer bewegt sich
wohin, wer passt an wen), aber nicht *wie schnell*. Für einen Renderer, der
Animationsdauer aus der Distanz einer Aktion ableiten will, fehlt die
Information, ob ein Cut ein langsamer Ausschwenker oder ein explosiver
Antritt ist — ob ein Pass ein weicher Bogenpass oder ein harter Flachpass
ist.

Das bestehende Design hat das bewusst offengelassen:

> „Konkrete Sekunden-Timestamps pro Aktion sind eine mögliche spätere,
> additive Erweiterung ... und nicht Teil dieses Designs."

Dieses Dokument spezifiziert genau diese Erweiterung — bewusst **relativ und
qualitativ** (`slow`/`fast`/…), nicht als konkrete Millisekundenangabe.

---

## 2. Leitprinzip: relativ statt absolut

`intensity` beschreibt **wie** eine Aktion ausgeführt wird, nicht **wie
lange** sie dauert. Eine konkrete Dauer hängt von den tatsächlichen
Fähigkeiten der Spieler ab (U10 vs. NBA), die außerhalb eines einzelnen,
wiederverwendbaren Play-Files liegen — in einer team-/roster-spezifischen
Anwendung, die Spieler-Speed-Profile pflegt und daraus je Play konkrete
Zeiten berechnet und persistiert. Das OCF-Play bleibt dabei roster-agnostisch
und wiederverwendbar.

Das Schema liefert also nur das **relative Vokabular**; die Umrechnung in
Millisekunden ist bewusst nicht Teil dieses Formats.

---

## 3. Neues Feld `intensity`

Optionales String-Enum-Feld. Das Enum ist je Aktionstyp unterschiedlich, der
Feldname bleibt einheitlich `intensity` (kein zusätzliches Vokabular für
Trainer/LLMs zu lernen).

### 3.1 Bewegungsaktionen — `movement_intensity`

Gilt für `move`, `cut`, `dribble`.

| Wert | Bedeutung |
|---|---|
| `slow` | Gehtempo / bewusst verzögert |
| `normal` | Standard-Lauftempo (Default) |
| `fast` | Zügiger Lauf |
| `explosive` | Maximaler Antritt / Sprint |

### 3.2 Ballaktionen — `ball_intensity`

Gilt für `pass`, `shoot`.

| Wert | Bedeutung |
|---|---|
| `soft` | Weicher, langsamer Ball (z. B. Touch-Pass, Floater) |
| `normal` | Standardtempo (Default) |
| `hard` | Druckvoller, schneller Ball |
| `bullet` | Maximale Ballgeschwindigkeit |

Bewusst **kein** `lob`-Wert hier, da `lob` bereits ein `variant`-Wert bei
`pass` ist (Flugkurve/Technik) — `variant: "lob"` + `intensity: "soft"` sind
unabhängige, kombinierbare Achsen (Technik vs. Tempo).

### 3.3 Kein `intensity` bei `screen`, `defend`, `rebound`, `pickup`

Diese Aktionstypen haben kein `moves[]`/keine Distanz-über-Zeit-Semantik,
für die `intensity` gedacht ist. Ein „harter Screen" oder „intensives
Defending" ist im Kern kein *Geschwindigkeits*-Konzept, sondern eher
physische Härte/Kollisionsverhalten (Animationsstil im Renderer) — eine
andere Dimension als das hier definierte, distanz-basierte Zeit-Tempo. Dafür
gibt es das eigenständige Feld `physicality` (Abschnitt 3.4).

### 3.4 Körperkontakt-Aktionen — `physicality`

Optionales String-Enum-Feld, unabhängig von `intensity`. Beschreibt den
Kollisions-/Kontaktstil einer Aktion und hilft einem 3D-Renderer, die
passende Animation zu wählen (z. B. sauberer Screen vs. Moving-Screen-artige
Rammung, sanftes Contesting vs. hartes Boxing-out). Hat **keinen** Einfluss
auf Distanz- oder Zeitberechnung — das bleibt exklusiv `intensity`
vorbehalten, damit beide Konzepte nicht vermischt werden.

Gilt für `screen`, `defend`, `rebound`, `pickup` — die Aktionstypen mit
tatsächlichem oder potenziellem Körperkontakt. Keiner dieser Typen hat
`moves[]`, daher gilt `physicality` immer direkt und ungeteilt für die
gesamte Aktion (keine Vererbungsregel wie bei `intensity`/`moves[]`
nötig).

| Wert | Bedeutung |
|---|---|
| `passive` | Kontaktvermeidend, gibt nach |
| `normal` | Standard, regelkonform (Default) |
| `aggressive` | Aktiv, druckvoll, sucht Kontakt |
| `hard` | Kompromisslos, maximaler Kontakt |

```json
{ "player": "offense_4", "type": "screen", "for_player": "offense_1",
  "on_player": "defense_1", "variant": "ball_screen", "physicality": "hard" }
```

```json
{ "player": "defense_3", "type": "defend", "guards_player": "offense_2",
  "variant": "box_out", "physicality": "aggressive" }
```

`variant` (Technik, z. B. `box_out`, `ball_screen`) und `physicality`
(Kontaktstil) sind unabhängige, kombinierbare Achsen — kein Wert-Konflikt
mit bestehenden `variant`-Enums von `screen`/`defend`/`rebound`/`pickup`.

---

## 4. Vererbung bei `move`/`cut`/`dribble`

Analog zum bestehenden Muster bei `variant`/`around_player` auf
`move_step`-Ebene: `intensity` kann auf der Aktion gesetzt werden (gilt für
die gesamte Move-Kette) und pro `move_step` überschrieben werden.

**Auflösung:** `move_step.intensity` → sonst Aktions-`intensity` → sonst
`normal`.

```json
{
  "player": "offense_1",
  "type": "cut",
  "intensity": "slow",
  "moves": [
    { "to": { "x": -2.0, "y": 4.5 } },
    { "to": { "named": "basket" }, "intensity": "explosive" }
  ]
}
```

```json
{
  "type": "pass",
  "player": "offense_1",
  "to_player": "offense_2",
  "variant": "lob",
  "intensity": "soft"
}
```

`pass`/`shoot` haben kein `moves[]`, daher gilt `intensity` dort direkt und
ungeteilt für die gesamte Aktion.

---

## 5. Verhältnis zum bestehenden `duration_ms`

`duration_ms` (Frame-Ebene, `docs/specification-v1.adoc:619`) ist laut Doku
bereits nur eine „**suggested** animation duration" — unverbindlich, grob,
pro Frame statt pro Aktion. Mit `intensity` steht ein feineres, portables,
pro-Aktion verfügbares Vokabular zur Verfügung, das dieselbe Rolle
präziser abdeckt.

**Entscheidung:** `duration_ms` wird in der Spec als **deprecated**
markiert, bleibt aber im JSON-Schema als gültiges optionales Feld erhalten
(Rückwärtskompatibilität zu bestehenden Beispielen/Playbooks). Neue
Play-Files sollen `intensity` statt `duration_ms` verwenden.

---

## 6. Out of scope (bewusst nicht Teil dieser Erweiterung)

- **Konkrete Zeiten (ms) im Schema.** Weder pro Aktion noch als
  Gesamt-Play-Dauer (`estimated_duration_ms` o. ä.). Das ist Aufgabe einer
  downstream Playbook-/Roster-Anwendung, die Play × Team-Speed-Profile
  verrechnet und persistiert — nicht Teil eines portablen, wiederverwendbaren
  Play-Files.
- **Renderer-seitige Tempo-Profile** (z. B. „nba_pro", „u14_youth" mit
  konkreten m/s-Werten). Reine Renderer-/Anwendungskonfiguration, kein
  Schema-Bestandteil.
- **`intensity` bei `screen`/`defend`/`rebound`/`pickup`.** Siehe Abschnitt
  3.3 — dafür gibt es stattdessen `physicality` (Abschnitt 3.4).
- **Playbook-Abfrage/Recommender** (z. B. „welches Play passt in 1.5s und
  endet mit einem Distanzwurf"). Spannende künftige Anwendung auf Basis von
  `intensity` + `meta.tags`, aber eine eigene Anwendungsebene, kein
  Schema-Thema.

---

## 7. Schema-Änderungen (Zusammenfassung)

- `schema/v1.json`: neues Enum `movement_intensity`
  (`slow|normal|fast|explosive`), referenziert von `action_move`,
  `action_cut`, `action_dribble` sowie deren `move_step`-Definition.
- `schema/v1.json`: neues Enum `ball_intensity`
  (`soft|normal|hard|bullet`), referenziert von `action_pass`,
  `action_shoot`.
- `schema/v1.json`: neues Enum `physicality`
  (`passive|normal|aggressive|hard`), referenziert von `action_screen`,
  `action_defend`, `action_rebound`, `action_pickup`.
- `docs/specification-v1.adoc`: `duration_ms` als deprecated dokumentieren;
  `intensity` je Aktionstyp dokumentieren (Enum, Default `normal`,
  Vererbungsregel für `moves[]`); `physicality` je Aktionstyp dokumentieren
  (Enum, Default `normal`, keine Vererbungsregel nötig).
- Keine Breaking Changes — alle drei Enums sind rein additiv und optional.
