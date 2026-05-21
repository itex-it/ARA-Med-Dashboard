<!-- generated-by: gsd-doc-writer -->
# MEDSTAR API — Implementierungs-Referenz

**Stand:** 2026-05-21  
**Gilt für:** ARA-Med Dashboard / n8n Integration  
**Korrekturen:** Session 2026-05-21 haben absoluten Vorrang gegenüber älteren Formulierungen

---

## 1. Übersicht

### Was MEDSTAR ist

MEDSTAR ist die Arztsoftware, die als **einzige Quelle der Wahrheit** für Patienten, Termine, Terminarten, Profile und Rezeptmöglichkeiten gilt. Das Dashboard repliziert keine MEDSTAR-Daten — es speichert nur ARA-Med-Konfiguration, Logs und Freigaben.

Die MEDSTAR REST-API (Version 1.6) bietet 15 Endpoints für:

- Patientenidentifikation
- Termin-Management (suchen, buchen, stornieren)
- Rezept-Management (bestellen, stornieren)
- Nachrichten

### Was MEDSTAR liefert

- **PID** (Patienten-ID) — interne MEDSTAR-Kennung
- **SVNR** — Sozialversicherungsnummer (wird bei erfolgreicher Identifikation zurückgegeben)
- **active** — Behandlungsstatus des Patienten
- Terminarten, freie Slots, Buchungsbestätigungen
- Verfügbare Verordnungen (PZNR + Name)

### Was MEDSTAR nicht liefert

**MEDSTAR liefert keine Patientennamen.** Die API kennt nur PID und Telefonnummer. Patientennames werden weder in Requests noch in Responses übertragen. Alle patientenbezogenen Anzeigen im Dashboard basieren ausschließlich auf PID, ggf. SVNR und dem Kommunikationskanal.

### Technische Basis

| Parameter | Wert |
|-----------|------|
| Protokoll | REST/JSON |
| Transport | HTTPS (Pflicht in Produktion) |
| Auth | `X-API-KEY` im Request-Header |
| Datumsformat | ISO 8601 (`2025-08-10T10:30:00`) |
| Telefonnummern | E.164 Format (`+43664123456`) |
| Content-Type | `application/json` bei POST-Requests |

---

## 2. Authentifizierung

### Kern-Prinzip

Das Ziel jedes Anrufs ist die Ermittlung einer gültigen **PID**. Sobald die PID feststeht und `active = true`, darf für diese PID gehandelt werden.

```
POST /patient/identify → PID ermitteln
GET /patient/active?pid=... → Status prüfen (PFLICHT)
→ Erst dann: Buchungen, Rezepte, Nachrichten
```

### Variante A — Nur SVNR (höchste Sicherheit)

Anwendung: Patient kennt und nennt seine SVNR direkt.

```http
POST /patient/identify
X-API-KEY: <key>
Content-Type: application/json

{
  "svnr": "1234567890"
}
```

Eigenschaften:
- Eindeutig, keine Mehrdeutigkeit möglich
- Funktioniert von jeder Rufnummer
- Gilt für Anruf für sich selbst oder für eine andere Person
- Nachteil: Viele Patienten kennen die SVNR nicht auswendig

### Variante B — Andere Telefonnummer + Geburtsdatum

Anwendung: Anrufer ruft für eine andere Person an (z. B. Mutter ruft für Kind) oder ruft von einer fremden Nummer an.

```http
POST /patient/identify
X-API-KEY: <key>
Content-Type: application/json

{
  "phone": "+43664999888",
  "birthdate": "1955-05-12"
}
```

### Variante C — Caller-ID + Geburtsdatum (Standard)

Anwendung: Anrufer ruft von seiner beim Patienten hinterlegten Nummer an. Telefonnummer wird automatisch vom System erfasst.

```http
POST /patient/identify
X-API-KEY: <key>
Content-Type: application/json

{
  "phone": "+43664123456",
  "birthdate": "1980-03-15"
}
```

Die `phone`-Felder in Variante B und C sind technisch identisch — der Unterschied liegt darin, ob die Nummer automatisch (Caller-ID) oder manuell (vom Anrufer genannt) stammt.

### Response bei Erfolg

```json
{
  "svnr": "1234567890",
  "pid": "2310",
  "active": true
}
```

### Response bei Fehler

```json
{"error": "no match"}
```

```json
{"error": "multiple matches", "count": 2}
```

Bei `multiple matches`: SVNR abfragen und Variante A verwenden.

---

## 3. PID-Logik

### PID > 0 — bekannter Patient

Eine PID größer 0 bedeutet: Der Patient wurde in MEDSTAR gefunden, entweder via SVNR oder via Telefonnummer + Geburtsdatum.

- `active = true` → Behandlungsverhältnis aufrecht, Aktionen erlaubt
- `active = false` → Patient gesperrt, **keine Buchung erlaubt**, Verweis an Ordination

### PID = 0 — aktiv gesetzter Sonderfall

PID = 0 ist **kein Fehler**. MEDSTAR setzt PID = 0 aktiv für Sonderfälle:

- Führerscheinuntersuchung
- Vertretungsfall
- Nicht-Patienten (z. B. Behördenabfrage)

**Pflicht bei PID = 0:** Da kein Patient in MEDSTAR bekannt ist, müssen alle relevanten Patientendaten (Name, Kontaktinformationen, Anliegen) **im Kommentarfeld (`notes` / `note`) mitgeschickt** werden. Das ist die einzige Möglichkeit, den Fall in MEDSTAR nachvollziehbar zu protokollieren.

```json
{
  "patient": {
    "pid": "0"
  },
  "date": "2025-08-10T10:00:00",
  "profile": "Ordination",
  "type": "Führerschein",
  "notes": "Max Mustermann, +43664123456, Führerscheinuntersuchung Klasse B"
}
```

Die Tabelle `appointment_types` im Dashboard enthält `pid_zero_allowed` (boolean), um zu steuern, welche Terminarten für PID = 0 freigegeben sind.

### SVNR in der Session

Die SVNR wird nach erfolgreicher Identifikation **nicht persistent gespeichert**. Sie steht nur für die Dauer des Anrufs zur Verfügung und wird für Buchungen im `patient`-Objekt mitgegeben. Das Dashboard speichert SVNR nur in stark maskierter oder verschlüsselter Form, falls überhaupt erforderlich.

---

## 4. MEDSTAR-Profile

MEDSTAR ist **Profil-basiert**, nicht Arzt-basiert. Ein Profil entspricht einer Terminliste (z. B. "Ordination", "Labor"). Ein Mandant kann mehrere Profile haben, und ein Profil kann mehrere Ärzte umfassen.

Alle terminrelevanten Endpoints erwarten einen `profile`-Parameter. Er akzeptiert sowohl den Profilnamen (`profile=Ordination`) als auch die Profil-ID (`profile=0`).

Profile werden über `GET /profiles` abgefragt und im Dashboard in der Tabelle `medstar_profiles` (Spalte `medstar_profile_id`) gespiegelt.

---

## 5. Alle Endpoints

### Pflicht-Header für jeden Request

```
X-API-KEY: <medstar-api-key>
Content-Type: application/json   ← nur bei POST erforderlich
```

---

### 5.1 `GET /profiles` — Profile abfragen

Liste verfügbarer Terminlisten mit Öffnungstagen.

```http
GET /profiles
X-API-KEY: <key>
```

```json
{
  "profiles": [
    { "name": "Ordination", "id": "0", "open": ["monday", "tuesday", "thursday", "friday"] },
    { "name": "Labor",      "id": "1", "open": ["tuesday"] }
  ]
}
```

---

### 5.2 `POST /patient/identify` — Patient identifizieren

Siehe Abschnitt 2.

Fehler: `{"error": "no match"}` | `{"error": "multiple matches", "count": N}`

---

### 5.3 `GET /patient/active` — Patientenstatus prüfen

**PFLICHT vor jeder Buchung.**

```http
GET /patient/active?pid=2310
GET /patient/active?svnr=1234567890
X-API-KEY: <key>
```

```json
{ "active": true, "svnr": "1234567890", "pid": "2310" }
```

```json
{ "active": false }
```

---

### 5.4 `GET /appointments/types` — Terminarten abfragen

```http
GET /appointments/types?profile=Ordination
X-API-KEY: <key>
```

```json
{
  "appointment_types": [
    { "name": "Standard",              "duration_minutes": 15 },
    { "name": "Kontrolle",             "duration_minutes": 20 },
    { "name": "Vorsorgeuntersuchung",  "duration_minutes": 45 }
  ]
}
```

Fehler: `{"error": "invalid profile"}`

---

### 5.5 `GET /appointments/check` — Termin-Verfügbarkeit prüfen

Prüft ob ein konkreter Slot frei ist.

```http
GET /appointments/check?date=2025-08-10T10:00:00&type=Kontrolle&profile=Ordination
X-API-KEY: <key>
```

```json
{ "available": true }
```

Fehler: `{"error": "invalid profile"}` | `{"error": "invalid type"}`

---

### 5.6 `GET /appointments/free-slots` — Freie Slots eines Tages

Alle verfügbaren Zeitfenster für einen bestimmten Tag. Abfrage nur innerhalb eines Tages möglich.

```http
GET /appointments/free-slots?date=2025-08-10T09:00:00&type=Kontrolle&profile=Ordination
X-API-KEY: <key>
```

```json
{
  "slots": ["09:00", "09:30", "10:30", "11:00"],
  "duration_minutes": 20
}
```

Fehler: `{"error": "invalid profile"}` | `{"error": "invalid date"}` | `{"error": "invalid type"}`

---

### 5.7 `GET /appointments/next-free-slots` — Nächsten freien Slot ermitteln

Gibt den frühestmöglichen Termin ab einem Startdatum zurück.

```http
GET /appointments/next-free-slots?date=2025-08-10T09:00:00&type=Kontrolle&profile=Ordination
X-API-KEY: <key>
```

```json
{
  "slot": "2025-08-10T09:00:00",
  "duration_minutes": 20
}
```

Fehler: `{"error": "invalid profile"}` | `{"error": "invalid date"}` | `{"error": "invalid type"}`

---

### 5.8 `POST /appointments/book` — Termin buchen

```http
POST /appointments/book
X-API-KEY: <key>
Content-Type: application/json

{
  "patient": {
    "svnr": "1234567890",
    "pid": "2310"
  },
  "date": "2025-08-10T10:30:00",
  "profile": "Ordination",
  "type": "Kontrolle",
  "notes": "Laborwerte mitbringen"
}
```

Response bei Erfolg:

```json
{
  "id": "abcde-12345",
  "patient": { "svnr": "1234567890", "pid": "2310" },
  "date": "2025-08-10T10:30:00",
  "duration_minutes": 20,
  "profile": "Ordination",
  "type": "Kontrolle",
  "notes": "Laborwerte mitbringen"
}
```

Fehler: `Slot not available` | `patient not identified` | `pid not valid` | `pid doesnt match to svnr` | `invalid profile` | `invalid date`

---

### 5.9 `POST /appointments/query` — Termine eines Patienten abfragen

```http
POST /appointments/query
X-API-KEY: <key>
Content-Type: application/json

{
  "pid": "2310",
  "date": "2025-08-10T10:30:00",
  "profile": "Ordination"
}
```

`profile` ist optional.

```json
{
  "appointments": [
    { "date": "2025-08-10T10:30:00", "type": "Kontrolle",            "id": "abcde-12345" },
    { "date": "2025-08-10T14:00:00", "type": "Vorsorgeuntersuchung", "id": "ab45-12945"  }
  ]
}
```

Fehler: `{"error": "invalid pid"}` | `{"error": "invalid date"}`

---

### 5.10 `POST /appointments/cancel` — Termin stornieren

```http
POST /appointments/cancel
X-API-KEY: <key>
Content-Type: application/json

{
  "id": "abcde-12345",
  "reason": "Patient krank"
}
```

```json
{ "success": true }
```

Fehler: `{ "success": false, "error": "invalid id" }`

---

### 5.11 `GET /patient/prescriptions` — Verfügbare Verordnungen abfragen

Gibt die Liste der Medikamente zurück, die für diesen Patienten automatisiert bestellt werden dürfen.

```http
GET /patient/prescriptions?pid=2310&profile=Ordination
X-API-KEY: <key>
```

```json
{
  "prescriptions": [
    { "pznr": "0990646", "name": "DIANE MTE DRG 21 ST"       },
    { "pznr": "3529149", "name": "VOLTADOL SCHMERZGEL TB 60 G" }
  ]
}
```

Fehler: `invalid pid` | `patient not active` | `order not possible` | `invalid profile` | `no prescriptions found`

---

### 5.12 `POST /prescriptions/order` — Verordnung bestellen

```http
POST /prescriptions/order
X-API-KEY: <key>
Content-Type: application/json

{
  "pid": "2310",
  "pznr": "3529149",
  "name": "VOLTADOL SCHMERZGEL TB 60 G",
  "note": "Bitte 2 Packungen wegen Urlaubsreise",
  "profile": "Ordination"
}
```

```json
{
  "oid": "6576-2310",
  "pznr": "3529149",
  "name": "VOLTADOL SCHMERZGEL TB 60 G"
}
```

Fehler: `invalid pid` | `patient not active` | `order not possible` | `invalid profile`

---

### 5.13 `POST /prescriptions/query` — Stornierbare Bestellungen abfragen

```http
POST /prescriptions/query
X-API-KEY: <key>
Content-Type: application/json

{
  "pid": "2310",
  "date": "2025-08-10"
}
```

Ohne `date`: automatisch aktuelles Datum minus 14 Tage.

```json
{
  "prescriptions": [
    { "oid": "6576-2310", "pznr": "0990646", "name": "DIANE MTE DRG 21 ST"        },
    { "oid": "6576-2311", "pznr": "3529149", "name": "VOLTADOL SCHMERZGEL TB 60 G" }
  ]
}
```

Fehler: `{"error": "invalid pid"}` | `{"error": "invalid date"}`

---

### 5.14 `POST /prescriptions/cancel` — Verordnung stornieren

```http
POST /prescriptions/cancel
X-API-KEY: <key>
Content-Type: application/json

{
  "oid": "6576-2310",
  "reason": "Noch ausreichend vorhanden"
}
```

```json
{ "success": true }
```

Fehler: `{ "success": false, "error": "invalid oid" }`

---

### 5.15 `POST /message` — Nachricht hinterlassen

Für allgemeine Anliegen die nicht über Termin oder Rezept gelöst werden können.

```http
POST /message
X-API-KEY: <key>
Content-Type: application/json

{
  "pid": "2310",
  "note": "Benötige Krankmeldung, fühle mich nicht gut",
  "profile": "Ordination"
}
```

```json
{ "success": true }
```

Anwendungsfälle: Überweisungen, Krankmeldungen, allgemeine Rückfragen.

Fehler: `invalid pid` | `patient not active` | `invalid profile`

---

## 6. Integration in ARA-Med

### Key-Management via Supabase Vault

Der MEDSTAR API-Key wird **nicht** in Umgebungsvariablen oder der Datenbank im Klartext gespeichert. n8n holt den Key zur Laufzeit aus dem Supabase Vault:

```
Secret-Key-Format: medstar_key_{tenant_id}
Beispiel:          medstar_key_550e8400-e29b-41d4-a716-446655440000
```

n8n-Workflow (Pseudocode):

```javascript
// Schritt 1: Key aus Vault holen
const vaultKey = `medstar_key_${tenantId}`;
const medstarKey = await supabase.rpc('get_secret', { key: vaultKey });

// Schritt 2: API-Call mit dynamischem Key
const response = await fetch(`${medstarBaseUrl}/patient/identify`, {
  method: 'POST',
  headers: {
    'X-API-KEY': medstarKey,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ phone: callerPhone, birthdate: userBirthdate })
});
```

Die `base_url` und `secret_ref` pro Mandant sind in der Tabelle `medstar_connections` gespeichert (Spalten `base_url`, `secret_ref`).

### Pflicht-Workflow für jeden Call

```
1. GET /profiles            → Profile laden (einmalig / gecacht)
2. POST /patient/identify   → PID ermitteln
3. GET /patient/active      → Status prüfen (PFLICHT)
   → active = false → Abbruch, Verweis an Ordination
   → active = true  → weiter
4. Aktion ausführen:
   - Termin: /appointments/types → /free-slots → /book
   - Rezept: /patient/prescriptions → /prescriptions/order
   - Nachricht: /message
```

### Terminarten-Freigabe durch ARA-Med

n8n filtert Terminarten gegen die ARA-Med-Konfiguration, bevor sie dem Patienten angeboten werden:

```
Medstar liefert: GET /appointments/types → alle Terminarten
ARA-Med filtert: appointment_types.is_voice_bookable = true
                 appointment_types.visibility = 'voice_bookable'
Angeboten wird:  nur die Schnittmenge
```

### Protokollierung im Dashboard

Jeder MEDSTAR-Aufruf erzeugt einen Eintrag in `call_actions`:

| Feld | Inhalt |
|------|--------|
| `action_type` | `book_appointment`, `cancel_appointment`, `order_prescription`, `leave_message` |
| `medstar_object_id` | Termin-ID (`id`) oder Bestellungs-ID (`oid`) |
| `request_summary` | bereinigte Request-Daten (ohne SVNR im Klartext) |
| `response_summary` | bereinigte Response-Daten |
| `error_code` / `error_message` | bei Fehlern |

---

## 7. Fehlerbehandlung und Fallbacks

### Vollständige Fehler-Tabelle

| Fehlercode | Bedeutung | Aktion |
|------------|-----------|--------|
| `invalid API-key` | API-Key falsch oder fehlend | Key aus Vault prüfen, Incident loggen |
| `endpoint not found` | Falsche URL | URL im Workflow korrigieren |
| `no match` | Patient nicht gefunden | Alternative Auth-Variante anbieten |
| `multiple matches` | Mehrere Patienten (z. B. Zwillinge) | SVNR abfragen (Variante A) |
| `invalid pid` | PID ungültig | Patient neu identifizieren |
| `patient not identified` | Identifikation fehlt | `/patient/identify` aufrufen |
| `patient not active` | Behandlung inaktiv | Verweis an Ordination |
| `pid not valid` | PID existiert nicht | Patient neu identifizieren |
| `pid doesnt match to svnr` | Daten-Inkonsistenz | Fehler loggen, Abbruch |
| `Slot not available` | Termin bereits vergeben | Alternative Slots anbieten |
| `invalid profile` | Profil nicht gefunden | `GET /profiles` neu aufrufen |
| `invalid type` | Terminart ungültig | `GET /appointments/types` neu aufrufen |
| `invalid date` | Datum ungültig | ISO 8601 Format prüfen |
| `invalid id` | Termin-ID ungültig | ID aus Session prüfen |
| `invalid oid` | Bestellungs-ID ungültig | OID aus vorheriger Response prüfen |
| `order not possible` | Bestellung nicht erlaubt | `inbox_task` erstellen |
| `no prescriptions found` | Keine Verordnungen verfügbar | Verweis an Ordination |

### Fallback-Kaskade bei Identifikation

```
1. Variante C (Caller-ID + Geburtsdatum)
   → "no match"?
2. Variante B (andere Telefonnummer + Geburtsdatum nennen lassen)
   → "no match"?
3. Variante A (SVNR direkt nennen)
   → "no match"?
4. inbox_task erstellen (task_type: "patient_unknown"), Rückruf anbieten
```

### Fallback bei Slot-Konflikt

```
POST /appointments/book → "Slot not available"
→ GET /appointments/next-free-slots (neues Startdatum)
→ Alternativen anbieten
→ Falls keine Slots: Nachricht hinterlassen via POST /message
```

### Technische Fehler (5xx, Timeout, Netzwerk)

- Fehler in `call_actions` protokollieren (`status: failed`, `error_code`, `error_message`)
- `decision_traces` Eintrag mit `step_key: medstar_api_error`
- `inbox_task` erstellen mit `task_type: technical_error`
- Patienten auf Rückruf vertrösten, **keine Buchung ohne Bestätigung**

### Patient gesperrt (`active = false`)

```
GET /patient/active → { "active": false }
→ KEINE Buchung
→ KEINE Rezeptbestellung
→ Nachricht kann hinterlassen werden (je nach Praxiskonfiguration)
→ Verweis an Ordination für persönliche Klärung
→ decision_traces Eintrag: step_key "patient_active_check", decision "blocked"
```
