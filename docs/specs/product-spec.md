<!-- generated-by: gsd-doc-writer -->
# ARA-Med — Autoritative Produktspezifikation

Stand: 2026-05-21

---

## 1. Produktidentität

ARA-Med ist eine Voice-AI-Plattform mit austauschbaren Vertical Packs. Der erste Vertical Pack adressiert Arztordinationen in Verbindung mit dem Praxissystem MEDSTAR. Die Plattform ist von Grund auf mandantenfähig und für den Betrieb mehrerer Kunden auf einer gemeinsamen Infrastruktur ausgelegt.

Die eingesetzte Technologie bleibt für Ordination und Patient vollständig unsichtbar. Sämtliche Produkt- und Kommunikationsfunktionen treten unter dem Namen ARA-Med auf:

- **ARA-Med Voice** — Sprachverarbeitung und Gesprächsführung
- **ARA-Med Nachricht** — ausgehende Benachrichtigungen
- **ARA-Med Erinnerung** — automatisierte Terminerinnerungen
- **ARA-Med Routing** — Weiterleitungs- und Bypass-Logik

Technische Provider (Voice-Engine, Orchestrierung, Datenbank, Messaging-Dienste) sind jederzeit austauschbar und dürfen im Frontend nicht als Marke erscheinen.

---

## 2. Systemarchitektur

### Schichten

| Schicht | Funktion |
|---|---|
| Voice-Ebene | Spracherkennung, Intent-Extraktion, Gesprächsführung |
| Orchestrierung | Tool-Dispatching, Medstar-API-Aufrufe, Fehlerhandling |
| Dashboard | Operative Steuerzentrale, Konfiguration, Auswertung |
| Medstar | Quelle der Wahrheit für Patienten, Termine, Rezepte |

### MEDSTAR als Quelle der Wahrheit

MEDSTAR liefert alle patientenbezogenen Daten und führt fachliche Aktionen aus. Das Dashboard steuert ausschließlich, welche Funktionen der Voice-KI zur Verfügung stehen — es repliziert keine Medstar-Daten.

MEDSTAR-Profile ermöglichen die Abbildung von Abteilungen und Gemeinschaftspraxen. Jedes Profil hat eigene Öffnungstage, Terminarten und Slots. Das Datenmodell sieht `medstar_profile_id` als optionalen Scope auf allen relevanten Entitäten vor; im MVP ist ein Profil aktiv.

### Datenmodell-Grundsatz

Jede mandantenbezogene Tabelle enthält `tenant_id`. Secrets und API-Keys werden ausschließlich serverseitig verwaltet und sind im Frontend nicht sichtbar.

### Realtime-Verhalten

Das Dashboard erhält Daten über zwei Push-Ereignisse:

- **Pre-Call Push** — unmittelbar beim Eintreffen des Webhooks, bevor das Gespräch beginnt
- **End-Call Push** — nach Abschluss des Gesprächs mit vollständigen Ergebnisdaten

Zwischen diesen zwei Ereignissen entsteht kein wahrnehmbarer Lag im Dashboard.

---

## 3. Kernprozesse der Voice-KI

### Patientenidentifikation

Nur aktive Patienten (PID > 0) erhalten den vollen Leistungsumfang. Ausnahmen:

- **Vertretungsmodus**: Wenn ein Patient angibt, wegen der Vertretung zu kommen und kein bestehender Patient ist — PID = 0 buchbar.
- **Führerscheinuntersuchung**: Der Anrufer darf kein Patient der Ordination sein. Buchung immer mit PID = 0. Erfordert E-Card, amtlichen Lichtbildausweis, ggf. Brillenpass.

Identifikationspfade:
- Mit SVNR: `GET /patient/active?svnr=...`
- Ohne SVNR: `POST /patient/identify` mit `phone` (optional `birthdate`)

### Gesprächsabschluss

Jedes Gespräch erzeugt `summary_short` und `summary_structured` (mit `intent_main`, `actions_done`, `open_items`, `callback_needed`). Bei nicht lösbaren Anliegen wird `leave_message` mit Rückrufgrund, Kontaktdaten, Zeitwunsch und Zusammenfassung aufgerufen.

### Triage

| Kategorie | Behandlung |
|---|---|
| Akute Symptome (Thoraxschmerzen, Atemnot, starke Schmerzen u.a.) | Sofortige telefonische Vermittlung |
| Standarderkrankungen (Fieber, Husten, Rückenschmerzen u.a.) | Terminbuchung oder Rückruf |
| Außerhalb Öffnungszeiten ohne aktive PID | Hinweis auf Gesundheitsberatung 1450 |

---

## 4. Dashboard — Module

Das Dashboard ist die operative Steuerzentrale. Es besteht aus 10 Modulen.

### Modul 1 — Status-Bar

Kernanzeigen auf jeder Seite sichtbar:

- ARA-Med Status: aktiv / pausiert / gestört
- Praxisstatus: geöffnet / geschlossen / Sondermodus
- Aktiver Modus: Normal / Urlaub / Vertretung / Überlastung
- Offene Aufgaben (Zähler)
- Live-Toggle zum sofortigen Aktivieren/Deaktivieren

### Modul 2 — Call-Log und Inbox

**Call-Log** — chronologische Liste aller Gespräche. Pro Eintrag:

- Zeitstempel, Telefonnummer (rechteabhängig maskiert), Dauer
- Patient erkannt (ja/nein), PID-Status
- SVNR nur wenn fachlich erforderlich, standardmäßig maskiert
- Intent und Subintent, erkannte Sprache
- Status: gelöst / offen / weitergeleitet / fehlgeschlagen / abgebrochen
- Ausgeführte Aktionen: Termin gebucht/storniert/verschoben, Rezept bestellt, Nachricht erstellt, Weiterleitung, Notfallhinweis
- Audio-Link, Transkript, KI-Zusammenfassung (je nach Recht)
- Technische Fehler, Verbrauch
- Telefonnummern-Historie: Anruffrequenz, wiederkehrende Intents, Fehlermuster

**Call-Detail** — Detailansicht je Gespräch:

- Audio-Player, Volltext-Transkript, strukturierte Zusammenfassung
- Erkannte Patientendaten, Entscheidungsweg der KI
- Ausgeführte Medstar-Aktionen, Fehler und API-Antwortstatus
- Interne Notizen, manuelle Korrektur von Kategorie/Intent
- Feedback-Markierung (korrekt / falsch erkannt / Training nötig)

**Inbox** — Alle Fälle mit Handlungsbedarf:

- Patient nicht identifizierbar, ungültige/inaktive PID, mehrere Treffer
- Rückruf notwendig, Rezept nicht möglich, unklarer Intent
- Notfall-/Akutfall-Hinweis, technische Fehler

Status: offen / in Bearbeitung / erledigt / archiviert

### Modul 3 — Kalender

Mehrschichtiger Kalender:

| Layer | Inhalt |
|---|---|
| 1 | Reguläre Öffnungszeiten (aus MEDSTAR) |
| 2 | Sondertage, Feiertage, Terminart-Overrides |
| 3 | Vertretungszeiträume |
| 4 | Bypass-/Privatleistungsslots (eigene Routing-Regel, kein MEDSTAR-API-Call) |

Jeder Layer-4-Eintrag enthält: Zeitraum, Routing-Ziel (Weiterleitung / eigener Prompt / Ticket), optionale Caller-Filterregel. Im MVP ist eine einfache Wochen- und Sondertagsverwaltung ausreichend; der Vollkalender mit allen Layern ist Ausbaustufe 2.

### Modul 4 — Statistiken

- Anrufe pro Tag/Woche/Monat, durchschnittliche Dauer
- Automatisch gelöste Quote, Weiterleitungsquote
- Offene Aufgaben, gebuchte Termine, Rezeptanfragen
- Häufigste Intents, kritische/eskalierte Fälle
- Gesparte Telefonzeit, Kosten/Verbrauch

### Modul 5 — Routing und VIP

Allgemeiner Routing-Layer. Regeltypen:

- Telefonnummern-basiert (WIP: Nummern, die immer durchgestellt werden)
- Prompt-/Intent-basiert (z.B. Apotheke, Labor, Krankenhaus)
- Terminart-basiert, Zeitraum-basiert, Modus-basiert

Mögliche Aktionen je Regel:

- Direkt verbinden
- Eigenen Prompt verwenden
- Ticket erstellen
- Bypass-Slot anbieten
- An bestimmte Nummer weiterleiten
- Nachricht aufnehmen

Bypass ist je Regel konfigurierbar.

### Modul 6 — Intent-Mapping

- MEDSTAR-Terminarten synchron anzeigen
- Pro Terminart: sichtbar / KI-buchbar / nur intern
- Synonyme und typische Formulierungen zuordnen
- Standard-Terminart für unklare Beschwerden
- Sonderfall Führerscheinuntersuchung mit PID = 0-Regel
- Schulung und ähnliche Terminarten als Override für normale Öffnungszeiten

### Modul 7 — Vertretungsmanagement

- Vertretungsarzt anlegen, Zeitraum kalendergestützt zuordnen
- Eigener Begrüßungstext, eigene Weiterleitungsnummer
- Verhalten für Nicht-Patienten (PID = 0)
- Modus "Eigener Vertretungsdienst" mit separatem Prompt und PID = 0-Speziallogik

### Modul 8 — Medikamentenliste

Globale Liste für die gesamte Ordination (Operator-only Schreibzugriff):

- PZNR, Medikamentenname
- Aussprache-Feld für die Voice-KI (Freitext, z.B. "Voltadol" statt technischer Handelsname)
- Aktiv/inaktiv, Notiz für Operator

Die Liste ergänzt die Medstar-Rezeptlogik; sie ersetzt sie nicht.

### Modul 9 — Begrüßungstexte und FAQ

Pflegbare Inhalte:

- Begrüßungstexte je Modus (Normal / Urlaub / Vertretung / Eigener Vertretungsdienst)
- Texte pro Sprache (Sprachcode-gesteuert; Deutsch als Standard)
- FAQ: Parkmöglichkeiten, Adresse, Kasseninformation, Vorbereitung auf Untersuchungen, Standardantworten
- Ansagetexte je Betriebsmodus

### Modul 10 — System-Settings

Operator-only. Enthält:

- Mandantenverwaltung (Hostname, Medstar-Server/API-Konfiguration, Fallback-Adressen, Weiterleitungsnummern)
- Aktive Features pro Mandant
- Aktive Sprachen und Stimme pro Sprache
- Volumen/Verbrauch, Guthaben, Warnschwellen
- Info/News-Block (Markdown, sichtbar für Arzt und Assistenz)
- Changelog/Live-Ticker

---

## 5. Kommunikationsmodul

Das Kommunikationsmodul steuert, wie ARA-Med mit der Ordination kommuniziert und wie Patienten benachrichtigt werden. Es ist kanalunabhängig aufgebaut:

1. Ereignis tritt ein
2. Regel prüft Kontext (Mandant, Richtung, Priorität)
3. Empfänger wird bestimmt
4. Kanal wird bestimmt (mit Fallback-Kanal)
5. Template wird gerendert
6. Versand wird protokolliert

### Richtung Ordination

Ereignisse: Patient nicht identifizierbar, Rückruf notwendig, kritischer Fall, Rezeptanfrage offen, Medstar-Aktion fehlgeschlagen, Termin gebucht/storniert/verschoben, VIP/WIP/Bypass-Anruf, technische Störung, ARA-Med deaktiviert.

Kanäle: Interne ARA-Med Inbox, E-Mail, Telegram, WhatsApp, SMS, Voicecall, Webhook, Medstar-Direktnachricht.

### Richtung Patient

Ereignisse: Terminbestätigung, Terminerinnerung, Terminverschiebung, Terminabsage, Rückrufbestätigung, Rezeptbestellung eingegangen, Rezept nicht möglich, Vorbereitung auf Termin.

Kanäle: SMS, E-Mail, WhatsApp, Voicecall.

### Kommunikationsregel (Felder)

`tenant_id`, Richtung, Ereignistyp, Priorität, Empfängergruppe, Kanal, Fallback-Kanal, Template, Aktivitätsstatus, Zeitfenster, Wiederholungslogik, maximale Versuche, Datenschutzklasse.

### Template-System

Templates enthalten Variablen: `patient_name`, `appointment_date`, `appointment_type`, `practice_name`, `callback_phone`. Sprachversionen werden über `language_code` gesteuert. Im MVP: sichere Vorlagenverwaltung mit Vorschau und Testversand.

### Kommunikationslog

Jeder Versandversuch wird protokolliert: Ereignis, Kanal, Empfänger, Template-Version, Status (geplant / gesendet / zugestellt / fehlgeschlagen / abgebrochen), Fehlergrund, Zeitpunkt, auslösender Call oder Task.

---

## 6. Rechte- und Berechtigungssystem

### Rollen

| Rolle | Beschreibung |
|---|---|
| **Operator** | Plattformbetreiber. Mandantenverwaltung, System-Settings, API-Konfiguration, globale Features, technische Logs. |
| **Arzt / Ordinationsadmin** | Medizinisch/organisatorisch verantwortliche Person. Praxisregeln, Öffnungszeiten, Vertretung, Terminarten, Routing, Mitarbeiterverwaltung. |
| **Ordinationsassistenz** | Operativ. Call-Log, Inbox, Notizen, Aufgaben, Rückrufe, einfache Tageseinstellungen. |
| **Viewer** | Lesend. Freigegebene Dashboards, Statistiken; keine personenbezogenen Details, keine Bearbeitung. |

### Modulrechte

Neben Rollen existieren feingranulare Rechte je Kategorie:

`none` / `view` / `edit` / `manage` / `admin`

Kategorien: Dashboard-Übersicht, Telefonate, Audio, Transkripte, Patientendaten, Inbox/Aufgaben, Termine, Rezepte, Routing, Kommunikation, Kommunikations-Templates, Öffnungszeiten, Vertretung, Prompts/Texte, Training/FAQ, Statistiken, Kosten, Benutzerverwaltung, System-Settings, Audit-Log.

### Delegationsregel

Ein Benutzer darf maximal die Rechte vergeben, die er selbst besitzt. Die Prüfung erfolgt serverseitig — nicht nur im Frontend.

### Datenschutz und Maskierung

| Feld | Regel |
|---|---|
| Telefonnummer | Vollständig nur mit Call-Detail-Recht, sonst maskiert |
| SVNR | Standardmäßig nicht angezeigt oder stark maskiert |
| PID | Sichtbar im Mandantenkontext für technische Nachvollziehbarkeit |
| Audio/Transkript | Eigenes Recht, unabhängig von Call-Log |
| Rezeptdetails | Eigenes Recht |

### Audit-Log

Pflicht für alle kritischen Änderungen: Benutzerverwaltung, Rechteänderungen, ARA aktiviert/deaktiviert, Öffnungszeiten, Routing- und Kommunikationsregeln, Templates, Terminart-Konfiguration, Vertretungsmodus, Prompts, API-/System-Settings.

Felder: Mandant, Benutzer, Aktion, Objekt, alter Wert, neuer Wert, Zeitpunkt, IP/User-Agent.

---

## 7. Authentifizierung und Sicherheit

- E-Mail/Passwort oder Magic Link
- Passwort-vergessen-Funktion
- Zwei-Faktor-Authentifizierung verpflichtend für Operator und Ordinationsadmins; je Mandant konfigurierbar
- Session-Management, sichere Passwortregeln, Login-Audit
- Account-Lockout und Rate-Limits bei Angriffsversuchen
- Rollen- und Rechtprüfung ausschließlich serverseitig
- OAuth/OIDC-Vorbereitung für spätere SSO-Integrationen

### Datenverschlüsselung

Transport- und Storage-Verschlüsselung ist Mindestanforderung. Für sensitive Felder (Audio-Referenzen, Transkript, Telefonnummern, Patientendaten, API-Konfigurationen) gilt eine explizite Klassifizierung: Klartext mit strenger Zugriffskontrolle / maskiert+indexiert / verschlüsselt / nicht gespeichert. Secrets werden nicht als Klartext in Tabellen abgelegt.

---

## 8. Navigation

### Hauptnavigation (alle Rollen, rechtegesteuert)

- Übersicht
- Telefonate
- Inbox
- Statistiken
- Einstellungen
- Kommunikation
- Benutzer & Rechte
- Logs

### Einstellungen (Unternavigation)

- Allgemein
- Öffnungszeiten
- Vertretung
- Terminarten
- Routing
- Kommunikationsrouting
- Nachrichtenvorlagen
- Texte & FAQ

### Operator-Zusatznavigation

- Mandanten
- System-Settings
- Integrationen
- Billing
- News/Changelog

---

## 9. MVP-Scope

Ein produktionsfähiger erster Release ist erreicht, wenn eine Ordination:

- ARA-Med aktivieren und pausieren kann
- Öffnungszeiten und Vertretung pflegen kann
- Erlaubte Terminarten steuern kann
- Alle Telefonate mit Audio, Transkript, Zusammenfassung und Aktionen nachvollziehen kann
- Offene Aufgaben bearbeiten kann
- Interne Nachrichten und Patientenbenachrichtigungen über konfigurierte Kommunikationsregeln auslösen kann
- Einfache KPIs einsehen kann
- Benutzer mit passenden Rechten verwalten kann
- Alle kritischen Änderungen im Audit-Log nachvollziehen kann

### Nicht im MVP (vorbereitet, nicht gebaut)

- Vollständiger Layer-Kalender
- Komplexe Rule Engine
- Multi-Profil-UI für Ärztezentren
- Mehrsprachige Prompt-Verwaltung im UI
- Automatisiertes Billing
- Outbound Recall
- Komplexe Omnichannel-Kampagnen
- Automatische Feiertagslogik mit Sonderfällen
- KI-Optimierungsempfehlungen

---

## 10. Mehrsprachigkeit

Das Datenmodell enthält `language_code` auf allen textbezogenen Entitäten (Prompts, Begrüßungen, FAQ, Stimmen). Deutsch ist der Standard. Weitere Sprachen sind als Feature-Flag aktivierbar. Für jede aktive Sprache sind Stimme, Begrüßungstext je Modus und Prompt-Variante pflegbar. Im MVP wird die UI ausschließlich auf Deutsch ausgeliefert.

---

## 11. Skalierung und SaaS

- Multi-Tenant von Anfang an: `tenant_id` auf jeder mandantenbezogenen Tabelle
- Kommunikationsprovider sind über einen Provider-Adapter-Layer austauschbar; die Fachlogik erzeugt nur Kommunikationsereignisse
- Jeder Provider-Adapter enthält: Mandantenkonfiguration, Aktivitätsstatus, Rate-Limits, Fehlerhandling, Audit/Delivery Log, Fallback-Kanal
- Medstar-Profile erlauben spätere Abbildung von Gemeinschaftspraxen ohne Datenbankmigrationen
- Decision Trace: Für jede kritische KI-Entscheidung werden gespeichert: aktive Öffnungszeiten, aktiver Modus, erkannter Intent, gegrifene Regel, ausgeführte Medstar-Aktion
