# Open Coaching Format — Semantisches Aktionsmodell (Design)

**Datum:** 2026-06-02
**Status:** Entwurf zur Review
**Betrifft:** Ablösung des geometrischen v1-Formats durch ein semantisches Aktionsmodell

---

## 1. Motivation

Das aktuelle v1-Format ist **rein geometrisch**: Entities sind Punkte mit
`x/y`, Bewegungen sind `line`-Objekte mit einem Typ (`movement`, `passing`,
`dribbling`, `screen`), und der Ball ist eine eigene Entity, deren Koordinaten
in **jedem** Frame manuell mitgeführt werden müssen.

Daraus ergeben sich drei Probleme:

1. **Fehleranfällig.** Der Ballbesitz ist nirgends modelliert — er ergibt sich
   nur daraus, dass jemand zufällig dieselben Koordinaten wie der Ball hat. In
   jedem Frame muss `ball: {x, y}` von Hand synchron gehalten werden.
2. **Nicht semantisch.** Ein Pass ist nur eine gestrichelte Linie. Es gibt
   keine Information über Werfer/Fänger, Passart, Wurfart, oder worauf sich ein
   Cut/Screen bezieht.
3. **Schwer aus Text generierbar.** Genau weil die Bedeutung fehlt, lässt sich
   ein Drill nicht zuverlässig aus einer natürlichsprachigen Beschreibung
   erzeugen — und umgekehrt kein Text aus einem Drill ableiten.

Ziel dieses Designs: ein **semantisches** Modell, in dem Aktionen das
ausdrücken, was ein Trainer meint („A spielt einen Bodenpass zum rollenden B,
der per Eurostep auflegt"), und aus dem ein Renderer Geometrie/Animation
ableitet.

---

## 2. Leitprinzipien

| Prinzip | Entscheidung |
|---|---|
| **Semantik vor Geometrie** | Aktionen drücken Absicht aus; Linien/Pfade leitet der Renderer ab. |
| **Progressive Detail — alles optional** | Pflicht ist nur das Minimum, das eine Aktion definiert (wer/was/Ziel). Jede Variante, jedes Tag, jeder Bezug, jedes Timing ist optional. Schnell-Modus und Detail-Modus im selben Format. |
| **Ballbesitz wandert automatisch** | `pass`/`shoot`/`pickup`/`rebound` verschieben den Ball; er wird nicht von Hand mitgeführt. |
| **Hybrid-Frames** | Frames sind Coaching-Phasen mit expliziten Positions-/Ball-Ankern (`start_state`/`end_state`) **und** semantischen `actions` dazwischen. |
| **Kuratiertes Vokabular + freie Tags** | Bekannte Varianten als Enum (renderbar), alles Weitere als freie Tags (keine Schema-Änderung nötig). |
| **Mächtig, aber keine Programmiersprache** | Verzweigung nur auf Frame-Ebene über Outcomes; kein beliebiger Kontrollfluss. |

### Das „alles optional"-Prinzip im Detail

Ein Trainer, der schnell skizzieren will, schreibt minimale Aktionen:

```json
{ "player": "offense_1", "type": "pass", "to_player": "offense_2" }
{ "player": "offense_2", "type": "shoot" }
```

Ein Trainer (oder ein LLM), der für Analyse/Textgenerierung annotieren will,
füllt die optionalen Felder:

```json
{ "player": "offense_1", "type": "pass", "to_player": "offense_2",
  "variant": "bounce", "tags": ["left_handed"], "after": "offense_2.cut" }
{ "player": "offense_2", "type": "shoot", "variant": "layup",
  "tags": ["eurostep"], "result": "make", "on_catch": true }
```

Beides ist gültig. Eine vage Beschreibung erzeugt minimale Aktionen, eine
detaillierte füllt die optionalen Felder — das macht das Format LLM- und
textfreundlich.

---

## 3. Dokumentstruktur (Top-Level)

Unverändert aus v1 übernommen: `meta`, `court`, `color_scheme`,
`named_positions`, `areas`, `labels`, das Koordinatensystem (Ursprung
Mittelkreis, +y = Angriffskorb) und die named-position-Registry.

Geändert/neu:

```
{
  "meta": { ... },              // wie v1
  "court": { ... },             // wie v1
  "color_scheme": { ... },      // wie v1 (optional)
  "named_positions": { ... },   // wie v1 (optional)
  "entities": [ ... ],          // GEÄNDERT: kein Ball mehr
  "balls": [ ... ],             // NEU: Liste benannter Bälle
  "frames": [ ... ],            // GEÄNDERT: Hybrid-Modell
  "areas": [ ... ],             // wie v1 (optional)
  "labels": [ ... ]             // wie v1 (optional)
}
```

---

## 4. Entities

Spieler (`offense`/`defense`), `coach`, `cone`, `station` bleiben wie in v1 und
definieren ihre **Initialposition** (Frame-0-Anker). **Die Ball-Entity entfällt
ersatzlos** — der Ball wird über `balls[]` modelliert.

Entity-Referenzen behalten das v1-Schema: `offense_1`, `defense_3`, `coach`,
`cone_1`, `station_1`.

---

## 5. Bälle (`balls[]`)

Eine Liste benannter Ball-Objekte. Drills haben oft mehrere Bälle (zwei
Schützen; Coach füttert ein), daher ist der Ball **referenzierbar**, nicht
implizit.

Jeder Ball hat **genau eine** von drei Zustandsformen (Lebenszyklus):

```json
"balls": [
  { "id": "ball_1", "carried_by": "offense_1" },          // jemand trägt ihn
  { "id": "ball_2", "carried_by": "coach" },              // auch der Coach kann tragen
  { "id": "ball_3", "at": { "named": "right_corner" } },  // liegt/ruht an einem Ort
  { "id": "ball_4", "dead": true }                        // aus dem Spiel
]
```

- **`carried_by: "<entity>"`** — ein Spieler oder Coach trägt den Ball.
- **`at: <coordinate>`** — der Ball ruht an einer Position (Boden, am Ring nach
  Fehlwurf, im Korb-Bereich). **Noch im Spiel**: aufnehmbar (`pickup`) oder
  reboundbar (`rebound`).
- **`dead: true`** — aus dem Spiel (Korb gefallen *und* Spielzug vorbei, oder
  ins Aus). Niemand kann ihn mehr aufnehmen, bis ein neuer Zustand gesetzt wird.

Dies im `balls[]`-Array ist der **Initialzustand**. Aktionen und
`start_state`/`end_state` verändern ihn über die Frames hinweg.

### Ball-Lebenszyklus nach einem Wurf

Der `shoot`-Aktion selbst diktiert **nicht** den Folgezustand. Es gilt:

- Folgt nach einem `shoot` (egal ob `make` oder `miss`) **keine** `rebound`-
  oder `pickup`-Aktion auf denselben Ball, wird der Ball **`dead`** (Spielzug
  endet, oder Treffer fällt).
- Folgt eine `rebound`/`pickup`-Aktion, bleibt der Ball im Spiel und geht in
  `carried_by` des aufnehmenden Spielers über.

Das deckt das **Continuum**-Muster ab (Treffer → eigenen Rebound holen → zu Y
passen → von vorn) ebenso wie den **Spielzug** (Wurf → niemand reboundet →
`dead`).

---

## 6. Frames (Hybrid-Modell)

Ein Frame ist eine **Coaching-Phase** und kombiniert harte Anker mit
semantischen Aktionen:

```json
{
  "id": "frame_3",
  "label": "Finish",
  "description": "Coaching-Text, LLM-generierbar.",
  "duration_ms": 1800,              // optional: Gesamtdauer der Phase

  "start_state": { ... },           // optional: erbt sonst end_state des Vorgängers
  "actions": [ ... ],               // semantische Bewegung (Kern)
  "end_state": { ... },             // expliziter Anker am Phasenende

  "branches": { ... }               // optional: Outcome-Verzweigung
}
```

### `start_state` / `end_state` — die Anker

Beide führen **Koordinaten und Ballzustände** als explizite Keyframes. Dadurch
ist jeder Frame **als Standbild renderbar**, ohne die gesamte Historie zu
simulieren — wichtig für PDF/Einzelbild-Export, Editor-Scrubbing und
Video-Overlay-Analyse.

```json
"end_state": {
  "offense_1": { "x": -1.0, "y": 9.0 },
  "offense_4": { "named": "right_block" },
  "defense_1": { "x": -1.5, "y": 8.5 },
  "balls": {
    "ball_1": { "carried_by": "offense_4" }
  }
}
```

**Vererbungsregel:** `start_state` ist optional. Fehlt es, erbt der Frame den
`end_state` des Vorgänger-Frames. Explizit setzen nur bei Sprüngen, Steals,
Rebounds oder Continuum-Resets. Das eliminiert die Redundanz zwischen
benachbarten Frames und ist zugleich der Notausgang für Edge Cases.

### `entity_states` (v1) entfällt

Ersetzt durch `start_state`/`end_state` (Anker) + `actions` (Bewegung
dazwischen). Damit gibt es keine doppelte Wahrheit innerhalb einer Ebene mehr:
Anker sind diskrete Keyframes, Aktionen beschreiben den Übergang.

### `branches` — Outcome-Verzweigung

Ohne `branches` folgt linear der nächste Frame im Array. Mit `branches` wählt
das Outcome den Folge-Frame:

```json
"branches": {
  "make": "frame_continuum_reset",
  "miss": "frame_offensive_rebound"
}
```

Outcomes sind ein kuratiertes Enum: `make`, `miss`, `turnover`, `steal`,
`foul`. Ein Branch darf auf einen **früheren** Frame zeigen (Continuum-Schleife).
Für einen Spielzug lässt man `branches` weg; der letzte Frame setzt den Ball
`dead`.

---

## 7. Aktionen

Jede Aktion hat:

- **`player`** (Pflicht) — Entity-Ref des Handelnden.
- **`type`** (Pflicht) — Aktionsart (siehe unten).
- **Typ-spezifische Pflichtfelder** — nur das unverzichtbare Ziel/Gegenüber.
- **Alles andere optional** — `variant`, `tags[]`, Bezugsfelder, Timing.

### Semantisches Timing (optional)

Statt roher Sekunden drücken Aktionen ihre Relation zueinander semantisch aus.
Aktionen ohne Timing-Relation gelten als (gleichzeitig) zu Frame-Beginn.

- **`after: "<player>.<type>"`** — startet nach Beginn der referenzierten Aktion.
- **`with: "<player>.<type>"`** — gleichzeitig mit der referenzierten Aktion.
- **`on_catch: true`** — direkt aus dem Fang heraus (z. B. Catch-and-Shoot).

> Konkrete Sekunden-Timestamps pro Aktion sind eine **mögliche spätere,
> additive Erweiterung** (Power-User/Editor-Feinjustierung) und nicht Teil
> dieses Designs.

### Bewegungs-`moves[]` (für `move`, `cut`, `dribble`)

Bewegungsaktionen tragen eine **Sequenz** von Moves statt eines einzelnen
Ziels. Das bildet zusammenhängende Move-Ketten ab (Crossover → between-legs →
Antritt; oder V-Cut → backdoor).

- Ein Move **ohne `to`** = Move „am Ort" (Ballhandling/Finte).
- Ein Move **mit `to`** = trägt den Spieler/Ball zu einem Zwischen-/Endziel.
- Endziel der Aktion = `to` des letzten Moves, der eines hat; muss mit der
  Position des Spielers im `end_state` übereinstimmen.
- **Bezugsfelder pro Move**, mit Fallback auf Aktionsebene (der Move gewinnt).

```json
{
  "player": "offense_2",
  "type": "cut",
  "moves": [
    { "variant": "v_cut" },
    { "variant": "backdoor", "to": { "named": "basket" },
      "around_player": "defense_2", "off_screen_by": "offense_5" }
  ]
}
```

### Aktionskatalog

Alle `variant`-Werte und alle Bezugsfelder mit `?` sind **optional**. Zu jeder
Aktion ist zusätzlich ein freies `tags[]`-Array erlaubt (z. B. `left_handed`,
`right_handed`, `eurostep`, `reverse`, `duck`).

| Typ | Ball nötig | Pflichtfelder | Optionale Bezüge | Varianten (enum) |
|---|---|---|---|---|
| `move` | nein | `moves[]` | — | (neutral) |
| `cut` | nein | `moves[]` | je Move: `around_player?`, `off_screen_by?` | `backdoor`, `give_and_go`, `flash`, `v_cut`, `l_cut`, `curl`, `flare`, `fade`, `basket` |
| `screen` | nein | `for_player` | `on_player?`, `at?` | `ball_screen`, `back_screen`, `down_screen`, `flare_screen`, `cross_screen`, `pin_down` |
| `defend` | nein | `guards_player` | — | `on_ball`, `deny`, `help`, `hedge`, `switch`, `box_out` |
| `dribble` | ja | `moves[]` | `ball_id?` | `speed`, `hesitation`, `crossover`, `behind_back`, `between_legs`, `spin`, `retreat` |
| `pass` | ja | `to_player` | `ball_id?` | `chest`, `bounce`, `overhead`, `lob`, `baseball`, `hand_off`, `outlet` |
| `shoot` | ja | — | `ball_id?`, `result?` (`make`/`miss`) | `jumper`, `three`, `layup`, `floater`, `dunk`, `hook`, `free_throw` |
| `rebound` | wird Ball | — | `ball_id?` | `offensive`, `defensive` (+ Tags `tip_in`, `put_back`) |
| `pickup` | wird Ball | `ball_id` | — | — |

Anmerkungen:

- **Eurostep, Reverse, Duck** sind Tags auf `shoot variant: layup`, nicht eigene
  Varianten (sie sind Finish-Formen des Korblegers).
- **Händigkeit** (`left_handed`/`right_handed`) ist ein freies Tag, gilt für
  `pass`/`shoot`/`dribble` gleichermaßen.
- **`hand_off`** (Handoff/DHO) ist eine Pass-Variante (Pass aus nächster Nähe).
- **`ball_id`** ist optional, wenn nur ein Ball im Spiel ist (Auto-Auswahl);
  bei mehreren Bällen anzugeben.
- **`pass`/`shoot` brauchen kein `to`-Koordinate** — das Ziel ergibt sich aus
  `to_player` bzw. dem Korb.

### Aktion vs. Ballbesitz — Validierung

Ballabhängige Aktionen (`pass`, `shoot`, `dribble`) setzen voraus, dass der
Spieler den referenzierten Ball trägt; `pickup`/`rebound` setzen einen Ball
`at: <coord>` in Reichweite voraus. Diese Konsistenz ist **semantisch
wünschenswert**, lässt sich in JSON-Schema aber nur begrenzt ausdrücken — sie
wird daher von einem **zusätzlichen Validator** (nicht vom Schema allein)
geprüft. Welche Aktion welcher Spieler ausführen *darf*, ist Konvention, keine
harte Schema-Regel (es gibt legitime Ausnahmen).

---

## 8. Vollständiges Beispiel — Pick & Roll (Detail-Modus)

Endsequenz: A attackiert per Crossover zum Korb, B rollt zum rechten Block, A
spielt einen Bodenpass, B legt per Eurostep auf und **trifft** — der Ball ist
danach `dead` (Spielzug-Ende).

```json
{
  "id": "frame_3",
  "label": "Finish",
  "description": "offense_1 attackiert per Crossover zum Korb, offense_4 rollt zum rechten Block, offense_1 spielt einen Bodenpass, offense_4 legt per Eurostep auf und trifft.",
  "duration_ms": 1800,
  "start_state": {
    "offense_1": { "named": "left_elbow" },
    "offense_4": { "x": -0.5, "y": 6.2 },
    "defense_1": { "x": -2.0, "y": 7.5 },
    "balls": { "ball_1": { "carried_by": "offense_1" } }
  },
  "actions": [
    {
      "player": "offense_4",
      "type": "cut",
      "moves": [ { "variant": "basket", "to": { "named": "right_block" } } ],
      "tags": ["roll"]
    },
    {
      "player": "offense_1",
      "type": "dribble",
      "ball_id": "ball_1",
      "moves": [
        { "variant": "crossover" },
        { "variant": "speed", "to": { "x": -1.0, "y": 9.0 }, "around_player": "defense_1" }
      ]
    },
    {
      "player": "offense_1",
      "type": "pass",
      "to_player": "offense_4",
      "ball_id": "ball_1",
      "variant": "bounce",
      "after": "offense_4.cut"
    },
    {
      "player": "offense_4",
      "type": "shoot",
      "ball_id": "ball_1",
      "variant": "layup",
      "result": "make",
      "tags": ["eurostep"],
      "on_catch": true
    }
  ],
  "end_state": {
    "offense_1": { "x": -1.0, "y": 9.0 },
    "offense_4": { "named": "right_block" },
    "defense_1": { "x": -1.5, "y": 8.5 },
    "balls": { "ball_1": { "dead": true } }
  }
}
```

> Korrektur gegenüber frühem Entwurf: Nach `shoot result: make` ohne folgende
> `rebound`-Aktion ist der Ball **`dead`**, nicht `carried_by: offense_4`.

---

## 9. Vollständiges Beispiel — Schnell-Modus

Derselbe Abschluss, wie ihn ein Trainer skizziert, der keine Details will:

```json
{
  "id": "frame_3",
  "label": "Finish",
  "actions": [
    { "player": "offense_4", "type": "cut",  "moves": [ { "to": { "named": "right_block" } } ] },
    { "player": "offense_1", "type": "pass", "to_player": "offense_4" },
    { "player": "offense_4", "type": "shoot" }
  ],
  "end_state": {
    "offense_4": { "named": "right_block" },
    "balls": { "ball_1": { "dead": true } }
  }
}
```

Gültig, renderbar, ohne eine einzige Variante. Genau dieselbe Struktur trägt
beide Detailgrade.

---

## 10. Continuum-Beispiel (Verzweigung + Rebound)

Skizze, wie eine Schussphase mit Outcome-Verzweigung und Offensiv-Rebound
aussieht (Continuum: Treffer → Reset, Fehlwurf → eigener Rebound → weiter):

```json
{
  "id": "frame_shot",
  "label": "Abschluss",
  "actions": [ { "player": "offense_1", "type": "shoot", "ball_id": "ball_1", "variant": "jumper" } ],
  "end_state": { "balls": { "ball_1": { "at": { "named": "basket" } } } },
  "branches": {
    "make": "frame_reset",
    "miss": "frame_oreb"
  }
}
```

> Der `end_state` führt den Ball als `at: {named: "basket"}` (noch im Spiel, am
> Ring/Korb) — das ist der Zustand **vor** der Outcome-Entscheidung. Welcher
> Folge-Frame greift, entscheidet `branches`: Bei `make` setzt `frame_reset` den
> Ball anschließend `dead` bzw. startet das Continuum neu; bei `miss` greift der
> Offensiv-Rebound unten.

```json
{
  "id": "frame_oreb",
  "label": "Offensiv-Rebound",
  "start_state": { "balls": { "ball_1": { "at": { "named": "basket" } } } },
  "actions": [
    { "player": "offense_1", "type": "rebound", "ball_id": "ball_1", "variant": "offensive" },
    { "player": "offense_1", "type": "pass", "to_player": "offense_2" }
  ],
  "end_state": { "balls": { "ball_1": { "carried_by": "offense_2" } } }
}
```

---

## 11. Versionierung

Das neue Modell **ersetzt v1 direkt** (`schema/v1.json` wird umgeschrieben). Das
Projekt ist frisch (ein Commit, keine externen Nutzer), daher kein
Parallel-Schema und kein Migrationspfad nötig. Schema, Beispiele
(`examples/*.ocf.json`) und Spezifikation (`docs/specification-v1.adoc`) werden
entsprechend neu erstellt/angepasst.

---

## 12. Auswirkungen auf die Projektziele

| Ziel | Wie das Modell es bedient |
|---|---|
| **Echte Animationen** | `actions` mit semantischem Timing liefern den kontinuierlichen Übergang; `start_state`→`end_state` sind die garantierten Keyframes, gegen die interpoliert wird. |
| **Video-Overlay zur Analyse** | Jeder Frame hat explizite, koordinatenbasierte Anker → Sollpositionen lassen sich exakt auf einen Videoframe legen und mit der Ist-Position vergleichen. |
| **Video → Spielzug ableiten** | Tracking-Positionen mappen direkt auf `start_state`/`end_state`-Anker; erkannte Pässe/Würfe füllen die `actions`. Das Hybrid-Modell ist die Brücke zwischen rohen Trajektorien und semantischem Spielzug. |
| **Taktische Analyse** | Semantische Aktionen (`pass bounce`, `shoot layup eurostep`) sind durchsuchbar/aggregierbar; explizite Koordinaten erlauben quantitative Auswertung (Distanzen, Spacing). |
| **Text ↔ Drill** | Minimal-Aktionen aus vager Beschreibung, optionale Felder aus detaillierter — bidirektional. |

---

## 13. Offene Punkte für die Implementierung

- Konkrete JSON-Schema-Formulierung der `oneOf`-Struktur für die Ball-Zustände
  (`carried_by` XOR `at` XOR `dead`).
- Exakte Auflösungsregeln, wie ein `variant`-Move (z. B. `speed`) ohne `to`
  geometrisch interpoliert wird (Renderer-Determinismus).
- Vollständige Enum-Liste der Outcomes und Abgleich mit `result`-Werten.
- Validator-Regeln (außerhalb JSON-Schema) für Ballbesitz-Konsistenz.
