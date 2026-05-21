<!-- generated-by: gsd-doc-writer -->
# Session Management — ARA-Med Voice AI Platform

Stand: 2026-05-21

---

## 1. Session Store Struktur

Jedes Gespräch erhält eine dedizierte Session. Die Session ist der zentrale Arbeitsspeicher für den n8n-Orchestrierungsworkflow während eines Anrufs.

```javascript
{
  // Identifikation
  session_id:       "uuid",
  tenant_id:        "uuid",
  call_id:          "uuid",
  conversation_id:  "elevenlabs_conversation_id",
  phone_hash:       "sha256_des_anrufers",
  pid:              "medstar_pid",           // null bis Patient identifiziert

  // Intent-Zustand
  active_intent:    "APPT_BOOK",
  collected_slots:  {
    patient_name:   "Anna Müller",
    date_of_birth:  "1978-03-15",
    symptom:        "Rückenschmerzen"
  },
  intent_queue:     ["RX_REQUEST"],           // weitere Anliegen des Patienten
  completed_actions: [
    { intent: "APPT_BOOK", result: "success", at: "2026-05-21T10:14:32Z" }
  ],
  pending_tasks: [
    { type: "prescription_check", reason: "Arzt muss Rezept freigeben", priority: "normal" }
  ],

  // Große Datensätze — separat, nicht im Hot-Path
  large_data: {
    available_slots:  [ /* Medstar Slot-Objekte */ ],
    medication_list:  [ /* Medikament-Objekte mit PZN */ ]
  },

  expires_at: "2026-05-21T11:00:00Z"
}
```

### Felder im Detail

| Feld | Zweck |
|---|---|
| `session_id` | Eindeutige Kennung dieser Session, wird in jedem Tool Response zurückgegeben |
| `tenant_id` | Mandantenzuordnung — alle DB-Abfragen gefiltert nach diesem Wert |
| `call_id` | Referenz zum `calls`-Datensatz im Dashboard |
| `conversation_id` | ElevenLabs Conversation ID für Audio/Transkript-Matching |
| `phone_hash` | SHA-256 der Anrufernummer — für Wiedererkennungslogik ohne Klartextspeicherung |
| `pid` | Medstar-PID des identifizierten Patienten, `null` für unbekannte Anrufer |
| `active_intent` | Der Intent, der gerade bearbeitet wird |
| `collected_slots` | Bereits gesammelte Slot-Werte für den aktiven Intent |
| `intent_queue` | Weitere Anliegen, die der Patient erwähnt hat und die nach `active_intent` bearbeitet werden |
| `completed_actions` | Protokoll abgeschlossener Aktionen in diesem Gespräch |
| `pending_tasks` | Aufgaben, die nach dem Gespräch im Dashboard erscheinen müssen |
| `large_data` | Verfügbare Slots und Medikamentenlisten — nur bei Bedarf geladen, nicht im System Prompt |
| `expires_at` | Session-TTL, typisch 60 Minuten nach Gesprächsstart |

---

## 2. Multi-Intent Flow

Ein Patient hat in einem Gespräch häufig mehrere Anliegen. Das Session Management verwaltet diese sauber sequenziell.

### Ablauf

```
Patient: "Ich brauche einen Termin... ach, und ein Rezept bräuchte ich auch."

→  active_intent:  "APPT_BOOK"
→  intent_queue:   ["RX_REQUEST"]

[Terminbuchung wird abgeschlossen]

→  completed_actions: [{ intent: "APPT_BOOK", result: "success" }]
→  active_intent:  "RX_REQUEST"   ← nächster aus intent_queue
→  intent_queue:   []
```

### Unterbrechungs-Entscheidung

Wenn ein neuer Intent erkannt wird, meldet die KI ihn via Tool Call. Das Backend entscheidet:

| Szenario | Entscheidung |
|---|---|
| Neuer Intent ist NOTFALL | Sofortige Unterbrechung, Eskalation |
| Neuer Intent ist DRINGEND | Unterbrechung, aktueller Intent wird in Queue zurückgelegt |
| Neuer Intent ist ROUTINE | In `intent_queue` einreihen, nach aktuellem Intent bearbeiten |
| Aktueller Intent ist fast abgeschlossen | In `intent_queue` einreihen |

```javascript
// Tool Call der KI bei erkanntem Intent-Wechsel
{
  type:        "INTENT_SWITCH",
  from:        "APPT_BOOK",
  to:          "RX_REQUEST",
  urgency:     "ROUTINE"
}

// Backend-Antwort: in Queue einreihen
{
  ok:          true,
  nextAction:  "CONTINUE",
  speak_hint:  "Ich notiere das Rezeptanliegen und kümmere mich darum, sobald wir den Termin gebucht haben."
}
```

---

## 3. Pending Tasks

Nicht alle Anliegen können im Gespräch vollständig automatisiert abgeschlossen werden. Für Fälle, die menschliche Nacharbeit erfordern, entstehen `pending_tasks` in der Session. Nach Gesprächsende werden diese als `inbox_tasks` im Dashboard angelegt.

### Typische Pending Task Szenarien

| Szenario | Task-Typ | Priorität |
|---|---|---|
| Arzt muss Rezept prüfen und freigeben | `prescription_check` | normal |
| Patient nicht identifizierbar | `patient_unknown` | high |
| Rückruf erbeten | `callback` | normal |
| Technischer Fehler bei Medstar-Aktion | `technical_error` | high |
| Unklares Anliegen, KI konnte nicht helfen | `unclear_intent` | normal |
| Dringender Hinweis für Arzt | `urgent_hint` | critical |

```javascript
// Pending Task in der Session
{
  type:     "prescription_check",
  reason:   "Patient hat Metformin 500mg angefordert. Medstar meldet: Freigabe durch Arzt erforderlich.",
  priority: "normal"
}

// → Nach Gesprächsende erzeugt n8n einen inbox_task im Dashboard:
// POST /api/inbox  { task_type: "prescription_check", priority: "normal", ... }
```

---

## 4. Tool Response Format

Alle n8n-Tools verwenden ein einheitliches Response-Format. Die KI versteht und verarbeitet nur dieses Format — kein Tool gibt rohe Medstar-Daten zurück.

```javascript
{
  ok:          true,                    // false bei Fehler
  nextAction:  "CONTINUE",             // Steuerbefehl für die KI

  session_id:  "uuid",                  // immer mitgeführt

  // Genau eines der folgenden Felder:
  speak_hint:     "Frage den Patienten, welches Medikament er benötigt.",
  // ODER:
  speak_verbatim: "Ihre Daten werden gemäß DSGVO verarbeitet.",

  // Optional: referenzierbare Listenelemente
  items: [
    { ref: 1, label: "Metformin 500mg",  phonetic: "Met-for-min",  pzn: "1234567" },
    { ref: 2, label: "Ramipril 5mg",     phonetic: "Ra-mi-pril",   pzn: "7654321" },
    { ref: 3, label: "Atorvastatin 10mg", phonetic: "A-tor-va-sta-tin", pzn: "9876543" }
  ]
}
```

### nextAction Werte

| Wert | Bedeutung |
|---|---|
| `CONTINUE` | Normal weiterführen, speak_hint oder speak_verbatim vorlesen |
| `ASK_*` | Spezifische Rückfrage anfordern (z. B. `ASK_DATE`, `ASK_SYMPTOM`) |
| `ESCALATE` | Gespräch an Mensch übergeben, Eskalationsnummer nennen |
| `OFFER_CALLBACK` | Rückrufangebot aussprechen, pending_task anlegen |

### Fehlerfall

```javascript
{
  ok:          false,
  nextAction:  "ESCALATE",
  speak_hint:  "Entschuldigung, ich kann gerade nicht auf den Kalender zugreifen. Ich verbinde Sie mit der Ordination.",
  error_code:  "MEDSTAR_TIMEOUT"
}
```

---

## 5. Speech Pattern Regeln

Die Speech Pattern Regeln stellen sicher, dass die Sprachausgabe der KI natürlich, verständlich und rechtssicher klingt.

### speak_hint vs. speak_verbatim

| Feld | Verwendung | Formulierung |
|---|---|---|
| `speak_hint` | Normale Gesprächsführung | KI formuliert in eigenen Worten — natürlicher, menschlicher Ton |
| `speak_verbatim` | Pflichtformulierungen | Exakter Text, eingeschlossen in `<>` — KI liest wortgenau vor |

```javascript
// Natürliche Antwort — KI darf Formulierung anpassen
speak_hint: "Frage den Patienten, ob er morgen oder übermorgen Zeit hätte."

// Rechtlich bindende Formulierung — KI liest exakt vor
speak_verbatim: "<Ihre Daten werden gemäß DSGVO für die Terminverwaltung verarbeitet.>"
```

`speak_verbatim` wird eingesetzt für: DSGVO-Hinweise, Datenschutzerklärungen, gesetzliche Pflichtinformationen.

### Referenznummern (items[].ref)

```javascript
// Tool Response mit nummerierten Elementen
items: [
  { ref: 1, label: "Montag, 23. Mai, 9:00 Uhr",  phonetic: null,       slot_id: "slot_abc" },
  { ref: 2, label: "Dienstag, 24. Mai, 14:00 Uhr", phonetic: null,      slot_id: "slot_def" },
  { ref: 3, label: "Donnerstag, 26. Mai, 10:30 Uhr", phonetic: null,    slot_id: "slot_ghi" }
]

// KI präsentiert:
// "Ich habe drei freie Termine: Montag, 23. Mai um neun Uhr,
//  Dienstag, 24. Mai um 14 Uhr, oder Donnerstag, 26. Mai um halb elf.
//  Welcher passt Ihnen?"

// Patient: "Der zweite."
// → ref 2 → slot_id "slot_def" → Medstar Buchungs-API
```

Der Patient spricht Ordinalzahlen ("der erste", "das zweite", "nummer drei"). Das Backend löst ref → internen Backend-Key auf. Die KI kennt niemals slot_id oder PZN-Nummern direkt.

### Phonetic-Schreibung

```javascript
{ ref: 1, label: "Metformin 500mg", phonetic: "Met-for-min", pzn: "1234567" }
```

Die KI spricht `phonetic`, nicht `label`. Phonetic-Einträge werden für Medikamente, Fachbegriffe und schwer aussprechbare Eigennamen gepflegt. Fehlt `phonetic`, spricht die KI `label`.

### Zeitdarstellung

Timestamps sind niemals in `speak_hint` oder `speak_verbatim` erlaubt. Zeitangaben werden immer ausgeschrieben:

```javascript
// Falsch — niemals so:
speak_hint: "Der Termin ist am 2026-05-23T09:00:00Z."

// Richtig — immer so:
speak_hint: "Der Termin ist am Samstag, 23. Mai, um neun Uhr."
```

### Abkürzungsverbot in Sprachtexten

Abkürzungen erscheinen niemals in `speak_hint` oder `speak_verbatim`:

| Verboten | Richtig |
|---|---|
| `z.B.` | "zum Beispiel" |
| `Dr.` | "Doktor" (oder vollständiger Name) |
| `bzgl.` | "bezüglich" |
| `Tel.` | "Telefonnummer" |

---

## 6. Session Lifecycle

```
1. Anruf eingehend
   → Pre-Webhook lädt Kontext
   → Session wird angelegt (session_id, tenant_id, call_id, expires_at)

2. Gesprächsführung
   → Jeder Tool Call liest und schreibt Session
   → collected_slots werden inkrementell befüllt
   → intent_queue wächst bei neuen Anliegen

3. Intent abgeschlossen
   → completed_actions Eintrag hinzufügen
   → Nächsten Intent aus intent_queue aktivieren
   → Oder: Gespräch freundlich beenden

4. Gespräch beendet
   → Session.pending_tasks → Dashboard inbox_tasks (POST /api/inbox)
   → Session.completed_actions → call_actions (via n8n Dashboard Event)
   → Session wird auf expires_at belassen (kein sofortiges Löschen)
   → Dashboard-Event: call.completed

5. Session-Ablauf (expires_at erreicht)
   → Session wird aus dem Store gelöscht
   → Alle relevanten Daten sind bereits im Dashboard persistiert
```

---

## 7. Datenschutz in der Session

Die Session enthält patientenbezogene Daten und folgt den gleichen Grundsätzen wie das Dashboard-Datenmodell:

| Datum | Speicherung in Session |
|---|---|
| Telefonnummer | Nur als `phone_hash` (SHA-256) |
| Patientenname | Im `collected_slots` für den Gesprächsverlauf |
| PID | Als `pid` für Medstar-Aufrufe |
| Medikamentenliste | In `large_data` — niemals in System Prompt injiziert |
| Slot-Daten | In `large_data` — nur als ref-Nummer zur KI |

Patientennamen und PID verlassen die Session nur in maskierter Form Richtung Dashboard (`patient_reference` im `inbox_task`).

---

## 8. Verknüpfung mit dem Dashboard-Datenmodell

Die Session ist ein flüchtiger Arbeitsspeicher. Das Dashboard-Datenmodell ist die persistente Quelle.

| Session-Feld | Dashboard-Tabelle | Übernahme-Zeitpunkt |
|---|---|---|
| `call_id` | `calls` | Session-Start |
| `completed_actions` | `call_actions` | Jede abgeschlossene Aktion |
| `pending_tasks` | `inbox_tasks` | Gesprächsende |
| `active_intent` / `intent_queue` | `calls.main_intent`, `calls.sub_intent` | Gesprächsende |
| Decision-Informationen | `decision_traces` | Pro Entscheidungsschritt via n8n |
