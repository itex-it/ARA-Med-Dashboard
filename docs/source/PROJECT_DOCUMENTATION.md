# ARA-Med Projektdokumentation

## Ziel und Scope
ARA-Med ist eine Voice-KI fuer eine Arztpraxis. Die KI erkennt Intents und sendet nur flache, strukturierte Nutzdaten an n8n (MCP-Server). n8n fuehrt die Medstar-API-Aufrufe aus, liefert Ergebnisstatus zurueck und entlastet das Backoffice durch klare Automationsregeln.

## Quellen der Wahrheit
1. `MEDSTAR-API.pdf` (einzige verbindliche API-Spezifikation)
2. `omerovic.md` (fachliche Praxisregeln und Triagevorgaben)
3. `ARA-Med-prompt01.md` (aktueller Voice-/JSON-Vertrag)
4. `MEDSTAR Complete V2 - medstar-2512 All 14 Tools + Session Management.json` (Referenz-Workflow)

## Systemarchitektur
- Voice-Ebene: ARA-Med (Intent-Erkennung, natuerliche Sprache)
- Orchestrierung: n8n MCP-Server `ARA-Med-MCP`
- Tools:
  - `ARA-01_Triage-Context`
  - `ARA-02_Appointments`
  - `ARA-03_Prescriptions-Communication`
- Backend: Medstar API (zentral ueber konfigurierbare Server-URL)

## Datenvertrag (flach)
Pflichtfelder bei jedem Tool-Call:
- `conversation_id`
- `intent`

Wichtige optionale Felder:
- Identifikation: `phone`, `birthdate`, `svnr`, `pid`, `caller_id`
- Termine: `date`, `from_date`, `type`, `profile`, `appointment_id`, `booking_intent`
- Rezepte/Nachrichten: `pznr`, `order_id`, `note`, `email`

Formatregeln:
- Datum Geburt: `YYYY-MM-DD`
- Terminzeit: ISO-8601 mit `T`
- Telefon: moeglichst E.164 (`+43...`), sonst lokale Nummer akzeptieren und normalisieren

## Kernprozesse
1. Identifikation zuerst (aktive Patienten `PID > 0`), Ausnahme Fuehrerschein mit `pid=0`.
2. Terminlogik:
   - `next-free-slots` fuer fruehestmoeglichen Termin
   - `free-slots` fuer Wunschdatum/Wunschfenster
3. Buchung immer mit `booking_intent`.
4. Medikamente:
   - Status `NO_PRESCRIPTIONS` direkt ausgeben
   - bei >4 Medikamenten Backend-Batches nutzen; ARA fragt pro Batch nach Auswahl/weiteren Wuenschen
5. Nichtkunde (`pid=0`): bei Nachricht zwingend E-Mail erfassen.
6. Waehrend Oeffnungszeiten immer Vermittlung anbieten; bei Fehlschlag priorisierte Rueckrufnachricht.

## Abschluss- und Backoffice-Regeln
Jedes Gespraech erzeugt:
- `summary_short`
- `summary_structured` (`intent_main`, `actions_done`, `open_items`, `callback_needed`, etc.)

Wenn nicht loesbar, Identifikation fehlschlaegt oder Rueckruf noetig:
- Intent `leave_message` aufrufen und Rueckrufgrund + Kontaktdaten + Zeitwunsch + Zusammenfassung speichern.

## Test- und Betriebsleitfaden
- Keine produktiven Terminbuchungen ohne Freigabe.
- Bei Tests erstellte Termin-ID dokumentieren, damit Storno nachvollziehbar moeglich ist.
- Endpoint-Unterschiede mit realen Payloads gegen Medstar pruefen und Ergebnisse im Repo dokumentieren.
- Keine Secrets oder API-Keys in Markdown/JSON commits.

## Projektstatus (Stand 2026-03-05)
### Umgesetzt
- ARA-MCP-Server aktiv: `ARA-01_MCP-Server-Med` mit Tool-Workflows `ARA-02_Triage-Context`, `ARA-03_Appointments`, `ARA-04_Prescriptions-Communication`.
- `conversation_id` wird nicht mehr von ARA abgefragt; systemseitige Vergabe im Workflow.
- Termin-Workflow fixiert auf:
  - `profile = 0`
  - `type = Standard`
- Triage auf Doku-Logik angepasst:
  - mit `svnr`: `GET /patient/active?svnr=...`
  - ohne `svnr`: `POST /patient/identify` mit `phone` (+ optional `birthdate`)
- Legacy-Workflow wird fuer ARA nicht mehr verwendet.

### Wichtige Testerkenntnisse
- Historischer Fehler (behoben): `no_match` wurde in der Auswertung teils als `SUCCESS` behandelt (siehe Lauf `24908`).
- Aktuelle Triage-Auswertung liefert bei SVNR-Pfad konsistente Codes (`SVNR_ACTIVE`/`SVNR_NOT_ACTIVE` bzw. klarer Fehlerpfad).
- Mehrere direkte Medstar-Tests mit bereitgestellten Testdaten lieferten `no_match` (Backend-Antwort), obwohl SVNR korrekt uebermittelt wurde.
- Legacy-Analyse bestaetigte zusaetzlich: alter `identify`-Pfad war telefonzentriert und fuer SVNR-only ungeeignet.

### Offene Punkte
- Verifikation mit echtem ARA-Produktivcall nach letzter Umstellung (`/patient/active?svnr`) inklusive neuer Execution-ID.
- Falls weiterhin `no_match`/`active:false` fuer als gueltig gemeldete SVNR:
  - Medstar-Datenbestand/Umgebung (Server, Mandant, Profilkontext) fachlich pruefen.
  - Ruecksprache mit Medstar-Support zu konkreten Beispiel-SVNRs und erwarteter Antwort.
- Optional: zusaetzlicher Health-/Debug-Intent im ARA-Flow fuer transparenten Backend-Status je Anfrage.
