# MEDSTAR REST-API Kompendium
**Version:** 1.6 (30. Oktober 2025)  
**Erstellt:** 2026-01-16  
**Zweck:** Vollständige Referenz für KI-Telefonsystem-Integration

---

## 📋 Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [Authentifizierung](#authentifizierung)
3. [API-Endpoints](#api-endpoints)
4. [Workflow-Regeln](#workflow-regeln)
5. [Variablen-Referenz](#variablen-referenz)
6. [Error-Handling](#error-handling)
7. [Dialog-Beispiele](#dialog-beispiele)
8. [Implementierungs-Guide](#implementierungs-guide)

---

## Übersicht

### Einsatzzweck
Integration von KI-basierten Telefonsystemen mit der Arztsoftware MEDSTAR für:
- Automatisierte Terminbuchung
- Rezeptbestellungen
- Patientenidentifikation während Anruf
- 24/7 Self-Service
- Entlastung Ordinationspersonal

### Technische Basis
- **Protokoll:** REST/JSON
- **Transport:** HTTP/HTTPS (HTTPS im Produktivbetrieb Pflicht)
- **Authentifizierung:** API-Key im Header
- **Datumsformat:** ISO 8601
- **Telefonnummern:** E.164 Format
- **Content-Type:** application/json

### Verfügbare Funktionen
- ✅ 15 REST-Endpoints
- ✅ Patienten-Identifikation
- ✅ Termin-Management (suchen, buchen, stornieren)
- ✅ Rezept-Management (bestellen, stornieren)
- ✅ Nachrichten-System

---

## Authentifizierung

### Kern-Prinzip
```
ZIEL: PID (Patienten-ID) ermitteln
DANN: Anrufer darf für diese PID agieren
```

### Drei Authentifizierungs-Varianten

#### Variante A: Nur SVNR (höchste Sicherheit)
```json
POST /patient/identify
{
  "svnr": "1234567890"
}
```
- ✅ Eindeutig
- ✅ Keine weitere Abfrage nötig
- ✅ Funktioniert von jeder Telefonnummer
- ✅ Gilt für sich selbst oder andere Person
- ⚠️ User kennen SVNR oft nicht auswendig

#### Variante B: Andere Telefonnummer + Geburtsdatum
```json
POST /patient/identify
{
  "phone": "+43664123456",
  "birthdate": "1980-03-15"
}
```
**Anwendungsfälle:**
- Anruf für andere Person (z.B. Mutter ruft für Kind)
- Anruf von fremder Nummer (z.B. von Arbeit)

#### Variante C: Caller-ID + Geburtsdatum (Standard)
```json
POST /patient/identify
{
  "phone": "+43664123456",  // Automatisch vom System
  "birthdate": "1980-03-15"
}
```
- ✅ Standard-Variante
- ✅ Telefonnummer automatisch erfasst
- ✅ Zusätzliche Sicherheit durch Geburtsdatum

### Wichtige Regeln
```
✓ Nach erfolgreicher Auth darf Anrufer für PID agieren
✓ Keine Einschränkung wer für wen anruft
✓ Eine Telefonnummer kann mehreren Patienten zugeordnet sein
✓ SVNR + PID sind eindeutig
✓ phone + birthdate kann bei Zwillingen mehrdeutig sein
✓ PID kann existieren, aber active=false (gesperrt)
```

---

## API-Endpoints

### Allgemeine Anforderungen
```
Header (PFLICHT):
  X-API-KEY: <medstar-api-key>
  Content-Type: application/json (bei POST)

Fehler bei fehlendem/falschem Key:
  {"error": "invalid API-key"}
```

---

### 1. Profile abfragen

**Zweck:** Liste verfügbarer Terminlisten mit Öffnungszeiten

```http
GET /profiles
Header: X-API-KEY: <api-key>
```

**Response:**
```json
{
  "profiles": [
    {
      "name": "Ordination",
      "id": "0",
      "open": ["monday", "tuesday", "thursday", "friday"]
    },
    {
      "name": "Labor",
      "id": "1",
      "open": ["tuesday"]
    }
  ]
}
```

**Hinweis:** Bei allen Aufrufen kann `profile=name` oder `profile=id` verwendet werden

---

### 2. Patient identifizieren

**Zweck:** Patient über SVNR oder Telefon+Geburtsdatum eindeutig identifizieren

```http
POST /patient/identify
Header: Content-Type: application/json
        X-API-KEY: <api-key>
```

**Request (Variante A - nur SVNR):**
```json
{
  "svnr": "1234567890"
}
```

**Request (Variante B/C - Telefon + Geburtsdatum):**
```json
{
  "phone": "+436644037230",
  "birthdate": "1970-12-10"
}
```

**Response (Erfolg):**
```json
{
  "svnr": "1234567890",
  "pid": "2310",
  "active": true
}
```

**Response (Fehler):**
```json
{"error": "no match"}
```

**Response (Mehrdeutigkeit):**
```json
{"error": "multiple matches", "count": 2}
```

**Hinweis:** `birthdate` ist optional, empfohlen bei Mehrdeutigkeit

---

### 3. Patientenstatus abfragen

**Zweck:** Prüfen ob Patient aktiv ist (aufrechtes Behandlungsverhältnis)

```http
GET /patient/active?pid=2310
GET /patient/active?svnr=1234567890
Header: X-API-KEY: <api-key>
```

**Response:**
```json
{
  "active": true,
  "svnr": "1234567890",
  "pid": "2310"
}
```

**oder:**
```json
{"active": false}
```

**WICHTIG:** Dieser Check ist PFLICHT vor jeder Buchung!

---

### 4. Mögliche Terminarten abfragen

**Zweck:** Verfügbare Terminarten für ein Profil auflisten

```http
GET /appointments/types?profile=Ordination
Header: X-API-KEY: <api-key>
```

**Response:**
```json
{
  "appointment_types": [
    {"name": "Standard", "duration_minutes": 15},
    {"name": "Kontrolle", "duration_minutes": 20},
    {"name": "Vorsorgeuntersuchung", "duration_minutes": 45}
  ]
}
```

**Fehler:**
```json
{"error": "invalid profile"}
```

---

### 5. Termin-Verfügbarkeit prüfen

**Zweck:** Prüfen ob ein konkreter Termin frei ist

```http
GET /appointments/check?date=2025-08-10T10:00:00&type=Kontrolle&profile=Ordination
Header: X-API-KEY: <api-key>
```

**Response:**
```json
{"available": true}
```

**oder:**
```json
{"available": false}
```

**Fehler:**
```json
{"error": "invalid profile"}
{"error": "invalid type"}
```

---

### 6. Freie Terminslots eines Tages abfragen

**Zweck:** Alle verfügbaren Zeitfenster für einen bestimmten Tag

```http
GET /appointments/free-slots?date=2025-08-10T09:00:00&type=Kontrolle&profile=Ordination
Header: X-API-KEY: <api-key>
```

**Response:**
```json
{
  "slots": ["09:00", "09:30", "10:30", "11:00"],
  "duration_minutes": 20
}
```

**Fehler:**
```json
{"error": "invalid profile"}
{"error": "invalid date"}
{"error": "invalid type"}
```

**Hinweis:** Abfrage nur innerhalb eines Tages möglich

---

### 7. Nächsten freien Terminslot ermitteln

**Zweck:** Automatisch den frühestmöglichen Termin finden

```http
GET /appointments/next-free-slots?date=2025-08-10T09:00:00&type=Kontrolle&profile=Ordination
Header: X-API-KEY: <api-key>
```

**Response:**
```json
{
  "slot": "2025-08-10T09:00:00",
  "duration_minutes": 20
}
```

**Fehler:**
```json
{"error": "invalid profile"}
{"error": "invalid date"}
{"error": "invalid type"}
```

---

### 8. Termin buchen

**Zweck:** Termin für einen Patienten in MEDSTAR buchen

```http
POST /appointments/book
Header: Content-Type: application/json
        X-API-KEY: <api-key>
```

**Request:**
```json
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

**Response (Erfolg):**
```json
{
  "id": "abcde-12345",
  "patient": {
    "svnr": "1234567890",
    "pid": "2310"
  },
  "date": "2025-08-10T10:30:00",
  "duration_minutes": 20,
  "profile": "Ordination",
  "type": "Kontrolle",
  "notes": "Laborwerte mitbringen"
}
```

**Fehler:**
```json
{"error": "Slot not available"}
{"error": "patient not identified"}
{"error": "pid not valid"}
{"error": "pid doesnt match to svnr"}
{"error": "invalid profile"}
{"error": "invalid date"}
```

---

### 9. Termine abfragen

**Zweck:** Übersicht über bestehende Termine eines Patienten

```http
POST /appointments/query
Header: Content-Type: application/json
        X-API-KEY: <api-key>
```

**Request:**
```json
{
  "pid": "2310",
  "date": "2025-08-10T10:30:00",
  "profile": "Ordination"
}
```

**Hinweis:** `profile` ist optional

**Response:**
```json
{
  "appointments": [
    {
      "date": "2025-08-10T10:30:00",
      "type": "Kontrolle",
      "id": "abcde-12345"
    },
    {
      "date": "2025-08-10T14:00:00",
      "type": "Vorsorgeuntersuchung",
      "id": "ab45-12945"
    }
  ]
}
```

**Fehler:**
```json
{"error": "invalid pid"}
{"error": "invalid date"}
```

---

### 10. Termin stornieren

**Zweck:** Gebuchten Termin wieder stornieren

```http
POST /appointments/cancel
Header: Content-Type: application/json
        X-API-KEY: <api-key>
```

**Request:**
```json
{
  "id": "abcde-12345",
  "reason": "Patient krank"
}
```

**Response:**
```json
{"success": true}
```

**oder:**
```json
{
  "success": false,
  "error": "invalid id"
}
```

---

### 11. Mögliche Verordnungen abfragen

**Zweck:** Liste der Medikamente, die automatisiert bestellt werden dürfen

```http
GET /patient/prescriptions?pid=2310&profile=Ordination
Header: X-API-KEY: <api-key>
```

**Response:**
```json
{
  "prescriptions": [
    {"pznr": "0990646", "name": "DIANE MTE DRG 21 ST"},
    {"pznr": "3529149", "name": "VOLTADOL SCHMERZGEL TB 60 G"}
  ]
}
```

**Fehler:**
```json
{"error": "invalid pid"}
{"error": "patient not active"}
{"error": "order not possible"}
{"error": "invalid profile"}
{"error": "no prescriptions found"}
```

---

### 12. Verordnung bestellen

**Zweck:** Verordnung für den Patienten in MEDSTAR anlegen

```http
POST /prescriptions/order
Header: Content-Type: application/json
        X-API-KEY: <api-key>
```

**Request:**
```json
{
  "pid": "2310",
  "pznr": "0990646",
  "name": "DIANE MTE DRG 21 ST",
  "note": "Bitte 2 Packungen wegen Urlaubsreise",
  "profile": "Ordination"
}
```

**Response:**
```json
{
  "oid": "6576-2310",
  "pznr": "0990646",
  "name": "DIANE MTE DRG 21 ST"
}
```

**Fehler:**
```json
{"error": "invalid pid"}
{"error": "patient not active"}
{"error": "order not possible"}
{"error": "invalid profile"}
```

---

### 13. Stornierbare Bestellungen abfragen

**Zweck:** Alle offenen Bestellungen die noch storniert werden dürfen

```http
POST /prescriptions/query
Header: Content-Type: application/json
        X-API-KEY: <api-key>
```

**Request:**
```json
{
  "pid": "2310",
  "date": "2025-08-10"
}
```

**Hinweis:** Falls `date` nicht angegeben, wird aktuelles Datum minus 14 Tage genommen

**Response:**
```json
{
  "prescriptions": [
    {
      "oid": "6576-2310",
      "pznr": "0990646",
      "name": "DIANE MTE DRG 21 ST"
    },
    {
      "oid": "6576-2311",
      "pznr": "3529149",
      "name": "VOLTADOL SCHMERZGEL TB 60 G"
    }
  ]
}
```

**Fehler:**
```json
{"error": "invalid pid"}
{"error": "invalid date"}
```

---

### 14. Bestellung einer Verordnung stornieren

**Zweck:** Zuvor aufgegebene Verordnung stornieren

```http
POST /prescriptions/cancel
Header: Content-Type: application/json
        X-API-KEY: <api-key>
```

**Request:**
```json
{
  "oid": "6576-2310",
  "reason": "Noch ausreichend vorhanden"
}
```

**Response:**
```json
{"success": true}
```

**oder:**
```json
{
  "success": false,
  "error": "invalid oid"
}
```

---

### 15. Nachricht hinterlassen

**Zweck:** Allgemeine Kommunikation und weiterführende Lösungen

```http
POST /message
Header: Content-Type: application/json
        X-API-KEY: <api-key>
```

**Request:**
```json
{
  "pid": "2310",
  "note": "Benötige Krankmeldung, fühle mich nicht gut",
  "profile": "Ordination"
}
```

**Response:**
```json
{"success": true}
```

**Fehler:**
```json
{"error": "invalid pid"}
{"error": "patient not active"}
{"error": "invalid profile"}
```

**Anwendungsfälle:**
- Überweisung anfordern
- Krankmeldung anfordern
- Allgemeine Rückfragen
- Kommunikation unterstützen

---

## Workflow-Regeln

### Pflicht-Reihenfolge

```
┌────────────────────────────────────┐
│ SCHRITT 1: Patient identifizieren │
│ POST /patient/identify             │
│ → pid erhalten                     │
└──────────────┬─────────────────────┘
               ↓
┌────────────────────────────────────┐
│ SCHRITT 2: Status prüfen (PFLICHT!)│
│ GET /patient/active?pid=XXX        │
│ → active=true?                     │
└──────────────┬─────────────────────┘
               ↓
         ┌─────┴─────┐
         │  JA       │  NEIN → ABBRUCH
         └─────┬─────┘
               ↓
┌────────────────────────────────────┐
│ SCHRITT 3: Aktion ausführen        │
│ - Termin buchen/abfragen/stornieren│
│ - Rezept bestellen/stornieren      │
│ - Nachricht hinterlassen           │
└────────────────────────────────────┘
```

### Termin-Workflow

```
A) GET /profiles → Profil wählen
B) GET /appointments/types?profile=X → Terminart wählen
C) GET /appointments/free-slots → Verfügbare Slots
   ODER
   GET /appointments/next-free-slots → Nächster Slot
D) POST /appointments/book → Termin buchen
```

### Rezept-Workflow

```
A) GET /patient/prescriptions?pid=X → Verfügbare Verordnungen
B) POST /prescriptions/order → Verordnung bestellen
C) Optional: POST /prescriptions/cancel → Stornieren
```

### Sicherheits-Checks

| Check | Zeitpunkt | Aktion bei Fehler |
|-------|-----------|-------------------|
| API-Key | Jeder Call | 401 Unauthorized |
| Telefon Format (E.164) | Vor identify | "Ungültige Nummer" |
| PID existiert | Vor Buchung | "Patient unbekannt" |
| active=true | Nach identify | "Behandlung gesperrt" |
| Profile valide | Vor Termin | "Profil nicht verfügbar" |
| Slot frei | Vor Buchung | Alternativen anbieten |

---

## Variablen-Referenz

### Authentifizierung
| Variable | Typ | Format | Pflicht | Beschreibung |
|----------|-----|--------|---------|--------------|
| `X-API-KEY` | Header | String | ✓ | API-Schlüssel für Authentifizierung |

### Patient
| Variable | Typ | Format | Pflicht | Beschreibung |
|----------|-----|--------|---------|--------------|
| `pid` | String | - | ✓ | Patienten-ID (eindeutig) |
| `svnr` | String | 10 Zeichen | - | Sozialversicherungsnummer (eindeutig) |
| `phone` | String | E.164 | - | Telefonnummer (z.B. +436644037230) |
| `birthdate` | String | ISO 8601 | - | Geburtsdatum (z.B. 1970-12-10) |
| `active` | Boolean | true/false | - | Behandlungsstatus |

### Termin
| Variable | Typ | Format | Pflicht | Beschreibung |
|----------|-----|--------|---------|--------------|
| `profile` | String | Name/ID | ✓ | Terminliste/Profil |
| `type` | String | - | ✓ | Terminart |
| `date` | String | ISO 8601 | ✓ | Datum/Zeit (z.B. 2025-08-10T10:30:00) |
| `duration_minutes` | Integer | - | - | Dauer in Minuten |
| `id` | String | UUID | - | Termin-ID (nach Buchung) |
| `notes` | String | - | - | Notizen/Bemerkungen |
| `reason` | String | - | - | Stornierungsgrund |

### Verordnung
| Variable | Typ | Format | Pflicht | Beschreibung |
|----------|-----|--------|---------|--------------|
| `pznr` | String | 7 Zeichen | ✓ | Pharmazentralnummer |
| `name` | String | - | ✓ | Medikamentenname |
| `oid` | String | - | - | Bestellungs-ID |
| `note` | String | - | - | Bemerkung zur Bestellung |

### Nachricht
| Variable | Typ | Format | Pflicht | Beschreibung |
|----------|-----|--------|---------|--------------|
| `note` | String | - | ✓ | Nachrichtentext |

---

## Error-Handling

### Standard-Errors

| Error | Bedeutung | Aktion |
|-------|-----------|--------|
| `invalid API-key` | Authentifizierung fehlgeschlagen | API-Key prüfen |
| `endpoint not found` | Falsche URL | URL korrigieren |
| `invalid profile` | Profil nicht gefunden | Profile abfragen |
| `invalid type` | Terminart nicht gefunden | Types abfragen |
| `invalid pid` | PID ungültig | Patient neu identifizieren |
| `invalid date` | Datum ungültig | ISO 8601 Format prüfen |
| `invalid id` | Termin-ID ungültig | ID prüfen |
| `invalid oid` | Bestellungs-ID ungültig | OID prüfen |
| `no match` | Patient nicht gefunden | Alternative Identifikation |
| `multiple matches` | Mehrere Patienten gefunden | SVNR abfragen |
| `patient not identified` | Identifikation fehlt | /patient/identify aufrufen |
| `patient not active` | Behandlung inaktiv | Verweis an Ordination |
| `pid not valid` | PID existiert nicht | Patient neu identifizieren |
| `pid doesnt match to svnr` | Daten-Inkonsistenz | Fehler loggen, abbrechen |
| `Slot not available` | Termin bereits vergeben | Alternative Slots anbieten |
| `order not possible` | Bestellung nicht erlaubt | Grund klären |
| `no prescriptions found` | Keine Verordnungen verfügbar | Verweis an Ordination |

### Authentifizierungs-Fehler

#### Szenario: Patient nicht gefunden
```json
Response: {"error": "no match"}
```
**Reaktion:**
1. Alternative Identifikationsmethode anbieten
2. Bei SVNR: Telefon + Geburtsdatum probieren
3. Bei Telefon + Geburtsdatum: SVNR probieren
4. Letzter Ausweg: Rückruf anbieten

#### Szenario: Mehrere Patienten gefunden
```json
Response: {"error": "multiple matches", "count": 2}
```
**Reaktion:**
1. "Mehrere Einträge gefunden"
2. SVNR zur eindeutigen Identifikation abfragen
3. Falls SVNR unbekannt: Manueller Callback

#### Szenario: Patient gesperrt
```json
Response: {
  "pid": "2310",
  "svnr": "1234567890",
  "active": false
}
```
**Reaktion:**
1. "Ihre Behandlung ist derzeit nicht aktiv"
2. KEINE Buchung erlauben
3. Verweis an Ordination für persönliche Klärung

---

## Dialog-Beispiele

### Beispiel 1: Standard-Authentifizierung (Caller ID + Geburtsdatum)

```
[System erfasst automatisch: +43 664 123456]

Bot:  "Guten Tag! Ihr Geburtsdatum bitte zur Bestätigung."
User: "15. März 1980"

[API: POST /patient/identify]
{
  "phone": "+43664123456",
  "birthdate": "1980-03-15"
}

[Response]
{
  "pid": "2310",
  "svnr": "1234567890",
  "active": true
}

Bot: "Danke. Wie kann ich Ihnen helfen?"
```

### Beispiel 2: SVNR-Authentifizierung (schnellster Weg)

```
Bot:  "Guten Tag! Wie möchten Sie sich authentifizieren?"
User: "1234 150380" [nennt SVNR direkt]

[API: POST /patient/identify]
{
  "svnr": "1234150380"
}

[Response]
{
  "pid": "2310",
  "svnr": "1234150380",
  "active": true
}

Bot: "Danke. Möchten Sie einen Termin buchen?"
```

### Beispiel 3: Anruf für Dritte (andere Telefonnummer)

```
Bot:  "Guten Tag! Sind Sie Patient bei uns?"
User: "Nein, ich rufe für meine Mutter an."

Bot:  "Die Telefonnummer Ihrer Mutter bitte."
User: "+43 664 999888"

Bot:  "Geburtsdatum Ihrer Mutter?"
User: "12. Mai 1955"

[API: POST /patient/identify]
{
  "phone": "+43664999888",
  "birthdate": "1955-05-12"
}

[Response]
{
  "pid": "4521",
  "svnr": "9876543210",
  "active": true
}

Bot: "Danke. Was möchten Sie für Ihre Mutter buchen?"
```

### Beispiel 4: Anruf von fremder Nummer

```
[System erfasst: +43 1 234567 (Büro)]

Bot:  "Guten Tag! Geburtsdatum bitte."
User: "15. März 1980"

[API: POST /patient/identify]
{
  "phone": "+431234567",
  "birthdate": "1980-03-15"
}

[Response]
{"error": "no match"}

Bot:  "Diese Nummer ist nicht registriert. 
       Ihre private Telefonnummer bitte."
User: "+43 664 123456"

Bot:  "Nochmal Ihr Geburtsdatum zur Sicherheit?"
User: "15. März 1980"

[API: POST /patient/identify]
{
  "phone": "+43664123456",
  "birthdate": "1980-03-15"
}

[Response]
{
  "pid": "2310",
  "svnr": "1234567890",
  "active": true
}

Bot: "Danke, gefunden! Wie kann ich helfen?"
```

### Beispiel 5: Mehrdeutigkeit (Zwillinge)

```
Bot:  "Guten Tag! Geburtsdatum bitte."
User: "20. April 2010"

[API: POST /patient/identify]
{
  "phone": "+43664123456",
  "birthdate": "2010-04-20"
}

[Response]
{"error": "multiple matches", "count": 2}

Bot:  "Ich finde mehrere Einträge mit diesem Geburtsdatum.
       Sozialversicherungsnummer zur eindeutigen Zuordnung?"
User: "1234 200410"

[API: POST /patient/identify]
{
  "svnr": "1234200410"
}

[Response]
{
  "pid": "5678",
  "svnr": "1234200410",
  "active": true
}

Bot: "Danke. Wie kann ich helfen?"
```

### Beispiel 6: Vollständiger Termin-Buchungs-Dialog

```
[Auth erfolgreich, pid=2310 gespeichert]

Bot:  "Möchten Sie einen Termin buchen?"
User: "Ja"

[API: GET /appointments/types?profile=Ordination]

Bot:  "Welche Art von Termin? 
       Standard, Kontrolle oder Vorsorgeuntersuchung?"
User: "Kontrolle"

Bot:  "Welcher Tag wäre Ihnen recht?"
User: "Nächste Woche Mittwoch"

[API: GET /appointments/free-slots?date=2025-08-13T07:00:00&type=Kontrolle&profile=Ordination]

[Response]
{
  "slots": ["09:00", "09:30", "11:00", "14:30"],
  "duration_minutes": 20
}

Bot:  "Am 13. August sind folgende Zeiten frei:
       9 Uhr, 9 Uhr 30, 11 Uhr oder 14 Uhr 30."
User: "9 Uhr 30 passt"

[API: POST /appointments/book]
{
  "patient": {"pid": "2310", "svnr": "1234567890"},
  "date": "2025-08-13T09:30:00",
  "profile": "Ordination",
  "type": "Kontrolle",
  "notes": ""
}

[Response]
{
  "id": "xyz-789",
  "patient": {"pid": "2310", "svnr": "1234567890"},
  "date": "2025-08-13T09:30:00",
  "duration_minutes": 20,
  "profile": "Ordination",
  "type": "Kontrolle"
}

Bot: "Ihr Termin ist gebucht für Mittwoch, 13. August um 9 Uhr 30.
      Die Dauer beträgt 20 Minuten. Noch etwas?"
```

### Beispiel 7: Rezept bestellen

```
[Auth erfolgreich, pid=2310 gespeichert]

Bot:  "Möchten Sie ein Rezept bestellen?"
User: "Ja"

[API: GET /patient/prescriptions?pid=2310&profile=Ordination]

[Response]
{
  "prescriptions": [
    {"pznr": "0990646", "name": "DIANE MTE DRG 21 ST"},
    {"pznr": "3529149", "name": "VOLTADOL SCHMERZGEL TB 60 G"}
  ]
}

Bot:  "Folgende Medikamente können bestellt werden:
       Diane oder Voltadol Schmerzgel. Welches benötigen Sie?"
User: "Voltadol Schmerzgel"

Bot:  "Gibt es noch eine Anmerkung?"
User: "Bitte 2 Packungen wegen Urlaub"

[API: POST /prescriptions/order]
{
  "pid": "2310",
  "pznr": "3529149",
  "name": "VOLTADOL SCHMERZGEL TB 60 G",
  "note": "Bitte 2 Packungen wegen Urlaub",
  "profile": "Ordination"
}

[Response]
{
  "oid": "6576-2310",
  "pznr": "3529149",
  "name": "VOLTADOL SCHMERZGEL TB 60 G"
}

Bot: "Ihre Bestellung wurde aufgenommen. 
      Sie können das Rezept in der Ordination abholen."
```

---

## Implementierungs-Guide

### Setup-Checklist

```
□ API-Key von Dr. Wienzl erhalten
□ Testsystem-Zugang einrichten
□ HTTPS-Zertifikat für Produktivbetrieb
□ E.164 Telefonnummer-Parser implementieren
□ ISO 8601 Datum-Parser implementieren
□ Error-Handling für alle Endpoints
□ Session-Management für PID-Speicherung
□ Logging für Fehleranalyse
```

### Minimal-Implementierung (Pseudo-Code)

```python
class MEDSTARAITelefonsystem:
    def __init__(self, api_key, base_url):
        self.api_key = api_key
        self.base_url = base_url
        self.session = {}
    
    def authenticate(self, caller_id):
        """Haupt-Authentifizierungs-Logik"""
        
        # Schritt 1: Frage nach Authentifizierung
        bot_say("Geburtsdatum oder Sozialversicherungsnummer?")
        user_input = listen()
        
        # Schritt 2: Identifiziere Eingabe-Typ
        if is_svnr(user_input):
            # Variante A: Nur SVNR
            response = self.api_call(
                'POST', 
                '/patient/identify',
                {'svnr': parse_svnr(user_input)}
            )
        
        elif is_date(user_input):
            birthdate = parse_date(user_input)
            
            # Frage ob Caller ID verwendbar
            bot_say("Rufen Sie von Ihrer registrierten Nummer an?")
            answer = listen()
            
            if answer == "ja":
                # Variante C: Caller ID + Geburtsdatum
                response = self.api_call(
                    'POST',
                    '/patient/identify',
                    {'phone': caller_id, 'birthdate': birthdate}
                )
            else:
                # Variante B: Andere Nummer
                bot_say("Ihre registrierte Telefonnummer?")
                phone = listen()
                response = self.api_call(
                    'POST',
                    '/patient/identify',
                    {'phone': phone, 'birthdate': birthdate}
                )
        
        # Schritt 3: Response auswerten
        if 'error' in response:
            return self.handle_auth_error(response)
        
        # Schritt 4: Status prüfen
        if not response.get('active'):
            bot_say("Ihre Behandlung ist derzeit nicht aktiv. Bitte melden Sie sich persönlich.")
            return False
        
        # Schritt 5: Session speichern
        self.session['pid'] = response['pid']
        self.session['authenticated'] = True
        
        bot_say("Authentifizierung erfolgreich. Wie kann ich helfen?")
        return True
    
    def handle_auth_error(self, response):
        """Error-Handling für Authentifizierung"""
        if response['error'] == 'no match':
            bot_say("Patient nicht gefunden. Möchten Sie einen Rückruf?")
            return False
        
        elif response['error'] == 'multiple matches':
            bot_say("Mehrere Einträge gefunden. Sozialversicherungsnummer?")
            svnr = listen()
            return self.authenticate_with_svnr(svnr)
        
        else:
            bot_say("Technischer Fehler. Bitte versuchen Sie es später.")
            return False
    
    def book_appointment(self, profile="Ordination"):
        """Termin buchen"""
        if not self.session.get('authenticated'):
            return "Bitte zuerst authentifizieren"
        
        pid = self.session['pid']
        
        # Schritt 1: Terminarten abrufen
        types = self.api_call('GET', f'/appointments/types?profile={profile}')
        bot_say(f"Verfügbare Terminarten: {types}")
        
        # Schritt 2: Typ wählen
        appointment_type = listen()
        
        # Schritt 3: Datum/Slots abfragen
        bot_say("Welcher Tag?")
        date = parse_date(listen())
        
        slots = self.api_call(
            'GET',
            f'/appointments/free-slots?date={date}&type={appointment_type}&profile={profile}'
        )
        
        bot_say(f"Freie Zeiten: {slots['slots']}")
        
        # Schritt 4: Zeit wählen
        time = listen()
        
        # Schritt 5: Buchen
        result = self.api_call(
            'POST',
            '/appointments/book',
            {
                'patient': {'pid': pid},
                'date': f"{date}T{time}:00",
                'profile': profile,
                'type': appointment_type,
                'notes': ""
            }
        )
        
        if 'error' in result:
            bot_say(f"Fehler: {result['error']}")
            return False
        
        bot_say(f"Termin gebucht für {result['date']}")
        return True
    
    def order_prescription(self, profile="Ordination"):
        """Rezept bestellen"""
        if not self.session.get('authenticated'):
            return "Bitte zuerst authentifizieren"
        
        pid = self.session['pid']
        
        # Schritt 1: Verfügbare Verordnungen
        prescriptions = self.api_call(
            'GET',
            f'/patient/prescriptions?pid={pid}&profile={profile}'
        )
        
        if 'error' in prescriptions:
            bot_say("Keine Rezepte verfügbar")
            return False
        
        bot_say(f"Verfügbare Medikamente: {prescriptions}")
        
        # Schritt 2: Auswahl
        choice = listen()
        selected = find_prescription(prescriptions, choice)
        
        # Schritt 3: Bestellen
        result = self.api_call(
            'POST',
            '/prescriptions/order',
            {
                'pid': pid,
                'pznr': selected['pznr'],
                'name': selected['name'],
                'note': "",
                'profile': profile
            }
        )
        
        bot_say(f"Rezept bestellt: {result['name']}")
        return True
    
    def api_call(self, method, endpoint, data=None):
        """Generischer API-Call"""
        headers = {
            'X-API-KEY': self.api_key,
            'Content-Type': 'application/json'
        }
        
        url = f"{self.base_url}{endpoint}"
        
        if method == 'GET':
            response = requests.get(url, headers=headers)
        elif method == 'POST':
            response = requests.post(url, headers=headers, json=data)
        
        return response.json()


# Verwendung
system = MEDSTARAITelefonsystem(
    api_key="YOUR_API_KEY",
    base_url="https://medstar-api.example.com"
)

# Bei eingehendem Anruf
caller_id = get_caller_id()
if system.authenticate(caller_id):
    # Hauptmenü
    action = listen()
    if action == "termin":
        system.book_appointment()
    elif action == "rezept":
        system.order_prescription()
```

### Best Practices

1. **Session-Management**
   - PID nach erfolgreicher Auth speichern
   - PID für gesamten Call verwenden
   - SVNR NICHT persistent speichern

2. **Error-Recovery**
   - Bei "no match" → Alternative Methode anbieten
   - Bei "multiple matches" → SVNR abfragen
   - Bei technischen Fehlern → Callback anbieten

3. **Datenschutz**
   - Minimale Datenspeicherung
   - Keine Namen erfassen (API liefert keine)
   - HTTPS im Produktivbetrieb
   - API-Key sicher speichern

4. **User Experience**
   - Klare Ansagen
   - Bestätigungen nach Aktionen
   - Fehler verständlich erklären
   - Alternativen anbieten

5. **Testing**
   - Testsystem nutzen
   - Alle 3 Auth-Varianten testen
   - Edge Cases prüfen (Zwillinge, gesperrte Patienten)
   - Error-Handling validieren

---

## Anhang

### Testsystem
Kontakt: Dr. Wienzl Informationssysteme GmbH  
Adresse: 1230 Wien, Parttartgasse 34/16a  
Zweck: Vollständige Simulationsumgebung ohne Echtdaten

### Produktiv-Freischaltung
Nach erfolgreichen Integrationstests kann Zugriff auf Produktivsystem freigeschaltet werden (nur HTTPS, nur nach Abstimmung mit Support-Team)

### Kooperationspartner
Diese Schnittstelle richtet sich an Anbieter von KI-basierten Telefonsystemen zur Integration mit MEDSTAR.

### Datenschutz & Sicherheit
- HTTPS verpflichtend im Produktivbetrieb
- API-Key individuell pro Partner
- Einhaltung DSGVO
- Minimale Datenspeicherung

---

**Version:** 1.0  
**Stand:** 16. Januar 2026  
**Erstellt für:** Voice-AI Integration mit MEDSTAR
