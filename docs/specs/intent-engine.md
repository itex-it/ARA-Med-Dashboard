<!-- generated-by: gsd-doc-writer -->
# Intent Engine — ARA-Med Voice AI Platform

Stand: 2026-05-21

---

## 1. Platform-Ansatz: Universelle Voice AI mit Vertical Packs

ARA-Med ist eine branchenagnostische Voice AI Platform. Die Core Engine kennt keine Branche — sie verarbeitet Intents, füllt Slots und eskaliert. Die branchenspezifische Logik steckt vollständig in einem **Vertical Pack**.

Ein Vertical Pack besteht aus drei Datenbankkomponenten:

| Komponente | Zweck |
|---|---|
| `intent_definitions` | Welche Intents existieren in dieser Branche |
| `intent_action_mappings` | Welche Backend-Aktionen ein erkannter Intent auslöst |
| `practice_type_schema` | Konfigurationsschema für diesen Ordinationstyp |

Ein neues Vertical (z. B. Physiotherapie, Zahnarzt, Apotheke) entsteht durch neue DB-Einträge — kein neuer Applikationscode wird benötigt.

---

## 2. Das 3-Layer-Modell

Die Intent Engine arbeitet in drei klar getrennten Schichten:

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1 — Core Engine                                  │
│  Intent-Erkennung · Slot Filling · Eskalation           │
│  Unveränderlich · branchenagnostisch                    │
├─────────────────────────────────────────────────────────┤
│  Layer 2 — Practice Type Schema                         │
│  Konfiguration pro Ordinationstyp                       │
│  (Hausarzt, Zahnarzt, Physio, Gynäkologie ...)          │
│  Definiert: erlaubte Intents, Slot-Anforderungen,       │
│  Triage-Regeln, Terminarten-Mapping                     │
├─────────────────────────────────────────────────────────┤
│  Layer 3 — Tenant Config                                │
│  Praxis-spezifisch                                      │
│  Öffnungszeiten · Ärzte · Rufnummern · Kassenverträge   │
│  Synonym-Listen · Eskalationskontakte                   │
└─────────────────────────────────────────────────────────┘
```

Layer 1 wird nie modifiziert. Layer 2 wird einmalig pro Ordinationstyp konfiguriert. Layer 3 wird täglich von der Ordination selbst gepflegt.

---

## 3. DID-Routing

Jeder eingehende Anruf trifft zuerst die DID-Routing-Logik, bevor der erste Dialog-Turn stattfindet.

### Fall 1 — DID ist einer spezifischen Einheit zugeordnet

```
DID +43 1 234 5678  →  "Ordination Dr. Meier, Internist"
                    →  Practice Schema "Hausarzt Internist" sofort laden
                    →  Layer 3 Tenant Config sofort injizieren
```

Kein Discovery Flow notwendig. Der Kontext steht beim ersten Token des Gesprächs vollständig bereit.

### Fall 2 — DID ist die Praxis-Hauptnummer

```
DID +43 1 234 5000  →  Praxis-Hauptnummer (mehrere Abteilungen)
                    →  Department Discovery Flow starten
                    →  Patient nennt Anliegen
                    →  Korrekte Einheit identifizieren
                    →  Practice Schema nachladen
```

Der Discovery Flow ist ein kurzer initialer Dialog-Turn: "Guten Tag, womit kann ich Ihnen helfen?" Die KI erkennt aus der Antwort die zuständige Einheit.

### Fall 3 — Patient ruft falsche Abteilung

```
Patient ruft Chirurgie an, Anliegen betrifft Allgemeinmedizin
→  KI informiert: "Dafür ist die Allgemeinordination zuständig."
→  KI nennt korrekte Nummer oder vermittelt direkt
→  Keine Weiterbearbeitung in falscher Abteilung
```

---

## 4. Pre-Webhook: Kontextinitialisierung

Vor jedem Gesprächsbeginn lädt ein Pre-Webhook die notwendige Konfiguration aus der Datenbank und injiziert sie in den ElevenLabs `conversation_initiation_client_data` als `dynamic_variables`.

### Ziel: System Prompt unter 700 Token gesamt

Der Kontext wird in drei Budgets aufgeteilt:

| Budget | Inhalt | Token |
|---|---|---|
| Always-On | Rolle + heutige Öffnungszeiten + Intent-Liste (flach) + Eskalationsnummer | ~300 |
| On-Demand Intent | Business Rules + `required_slots` + MEDSTAR-Action-Template | ~150 |
| On-Demand Patient | Nächster Termin + Medikation + bekannt/neu Flag | ~150 |

**Always-On Context** wird bei jedem Gespräch geladen.

**On-Demand Intent-Kontext** wird nachgeladen, sobald die KI einen Intent via Tool Call gemeldet hat.

**On-Demand Patienten-Kontext** wird nachgeladen, sobald die Patienten-PID ermittelt wurde.

### Pre-Webhook Ablauf

```
1. Eingehender Call → DID extrahieren
2. Pre-Webhook: DB-Abfrage für diese DID/Tenant
   - Aktive Intents abrufen
   - Heutige Öffnungszeiten berechnen
   - Eskalationsnummer auflösen
3. Kompaktes JSON zusammenstellen
4. In conversation_initiation_client_data injizieren
5. ElevenLabs startet Gespräch mit vollständigem Kontext
```

---

## 5. Soft-to-Hard Mapping

Die KI arbeitet mit natürlicher Sprache. Backend-APIs benötigen exakte IDs. Das Soft-to-Hard Mapping ist die Brücke — vollständig in der Datenbank konfiguriert.

### Terminarten

```
Patient sagt: "Ich habe Bauchweh"
+ collected_context: { bekannter Patient, keine Notfall-Marker }

→  DB-Lookup: Symptom "Bauchweh" → appointment_type_code "ALLG_KONSULT_STANDARD"
→  Medstar API-Parameter gesetzt
```

Die Mapping-Tabelle enthält Phrasen, Synonyme und Kontext-Bedingungen. Neue Mappings entstehen durch DB-Einträge, kein Code-Deploy.

### Medikamente

```
Patient sagt: "das zweite Medikament"

→  items[].ref = 2
→  ref 2 → PZN "7654321" (aus Session large_data)
→  Medstar Rezept-Anfrage mit PZN als hartem Backend-Key
```

Referenznummern (1, 2, 3) sind die Sprach-Schnittstelle. PZN ist der interne Backend-Key. Die KI spricht niemals PZN-Nummern aus.

### Termine

```
Patient sagt: "den dritten Termin"

→  items[].ref = 3
→  ref 3 → slot_id "abc-123-def" (aus Session large_data)
→  Medstar Buchungs-Aufruf mit slot_id als hartem Backend-Key
```

---

## 6. Slot Filling

Ein Tool Call an das Backend feuert erst, wenn alle `required_slots` für den erkannten Intent vollständig gefüllt sind.

### Prinzipien

- Die KI stellt pro Turn genau eine gezielte Rückfrage.
- Nach maximal 3 erfolglosen Turns für einen einzelnen Slot eskaliert die KI.
- Die KI erkennt aktiv, wenn der Patient mid-Slot den Intent wechselt, und meldet dies via Tool Call.

### Eskalationsschwelle

```
Turn 1: "Für welches Datum möchten Sie einen Termin?"
Turn 2: "Ich habe das Datum leider nicht verstanden. Können Sie es wiederholen?"
Turn 3: "Welchen Wochentag meinen Sie — Montag, Dienstag oder einen anderen Tag?"
→ Slot noch immer ungefüllt → Eskalation
```

### Intent-Wechsel-Erkennung

```
KI fragt nach Datum für Terminbuchung.
Patient sagt: "Wissen Sie was, ich brauche eigentlich ein Rezept."

→  KI erkennt Intent-Wechsel APPT_BOOK → RX_REQUEST
→  Tool Call: { type: "INTENT_SWITCH", from: "APPT_BOOK", to: "RX_REQUEST" }
→  Backend entscheidet: aktuellen Intent pausieren, neuen Intent starten
```

---

## 7. Triage

Vor jeder Aktion (Terminbuchung, Rezept, Nachricht) durchläuft der erkannte Bedarf die Triage-Klassifizierung.

```
NOTFALL  →  sofortige Eskalation, keine KI-Aktion
HEUTE    →  Tagesbehandlung erforderlich, bevorzugte Slots heute
DRINGEND →  Behandlung innerhalb 1-3 Tage empfohlen
ROUTINE  →  reguläre Terminvermittlung
```

**NOTFALL ist immer menschliche Eskalation.** Die KI gibt niemals vor, einen Notfall eigenständig zu bearbeiten. Sie nennt die Notrufnummer und/oder die Eskalationsnummer der Ordination.

### Triage-Signale

Die Triage-Einschätzung entsteht aus:

- Expliziten Patientenaussagen ("es ist sehr schlimm", "ich kann kaum atmen")
- Symptom-Mapping in der DB (bestimmte Symptome sind fix als NOTFALL markiert)
- Kontext der Antworten auf Slot-Fragen (Schmerzstufe, Dauer, Verschlechterung)

---

## 8. Datenbankstruktur: Intent-relevante Tabellen

Die folgenden Tabellen aus dem Datenmodell v1 sind für die Intent Engine direkt relevant:

| Tabelle | Zweck |
|---|---|
| `intent_definitions` | Alle bekannten Intents je Vertical Pack |
| `intent_action_mappings` | Soft-to-Hard Mapping: Phrase → Backend-Aktion |
| `appointment_types` | Terminarten mit `is_voice_bookable` Flag |
| `appointment_type_synonyms` | Sprachvarianten für Terminarten |
| `medications` | Medikamentenliste mit `voice_label` und PZN |
| `routing_rules` | Übersteuerungsregeln für DID-Routing und Intent-Routing |
| `practice_status` | Aktueller Betriebsmodus (normal, holiday, substitution) |
| `opening_hours` | Reguläre Öffnungszeiten für Always-On Kontext |
| `special_days` | Abweichungen und Schließtage |
| `knowledge_items` | FAQ und Praxiswissen für on-demand Kontext |

---

## 9. Erweiterung: Neues Vertical hinzufügen

Ein neues Vertical (z. B. Augenarzt) erfordert ausschließlich DB-Arbeit:

```sql
-- 1. Practice Type Schema anlegen
INSERT INTO practice_type_schemas (type_key, name, config)
VALUES ('ophthalmology', 'Augenarzt', '{ ... }');

-- 2. Intent-Definitionen für dieses Vertical
INSERT INTO intent_definitions (vertical_key, intent_key, display_name, required_slots)
VALUES
  ('ophthalmology', 'APPT_BOOK_CONSULT', 'Beratungstermin buchen', '["symptom", "date_preference"]'),
  ('ophthalmology', 'APPT_BOOK_CONTROL', 'Kontrolltermin buchen', '["date_preference"]');

-- 3. Soft-to-Hard Mappings
INSERT INTO intent_action_mappings (vertical_key, phrase, appointment_type_code)
VALUES
  ('ophthalmology', 'Sehprobleme', 'AUGEN_KONSULT_STANDARD'),
  ('ophthalmology', 'Kontrolluntersuchung', 'AUGEN_KONTROLLE');
```

Kein Applikations-Deployment. Die Core Engine verarbeitet das neue Vertical ab dem nächsten Gesprächsstart.
