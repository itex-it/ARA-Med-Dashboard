# ARA-MED Chat Handover

Stand: 2026-05-11

## Zweck

Dieses Dokument ist die kompakte Uebergabe fuer einen neuen Chat oder eine neue Codex-Session. Es fasst die bisherigen Entscheidungen, Projektziele, relevanten Dateien und naechsten Schritte fuer das ARA-MED Dashboard zusammen.

## Projektziel

ARA-MED ist eine Voice-KI-Loesung fuer Arztordinationen mit Medstar-Anbindung. Das Dashboard soll nicht nur Statistiken anzeigen, sondern als Steuer- und Kontrollzentrale dienen.

Kernziele:

- ARA-MED aktivieren, pausieren und konfigurieren.
- Jedes Telefonat nachvollziehbar machen.
- Offene Aufgaben aus KI-Gespraechen bearbeiten.
- Medstar-nahe Prozesse wie Termine und Rezepte kontrolliert abbilden.
- Kommunikationswege zur Ordination und zu Patienten steuern.
- Mandantenfaehigkeit fuer spaetere SaaS-Plattform vorbereiten.
- Hohe Sicherheit, Rollen/Rechte, Audit und Datenschutz von Anfang an einplanen.

## Bisherige Hauptentscheidung

Das Dashboard wird als SaaS-faehige Plattform gedacht, aktuell aber fuer eine Ordination bzw. ein Medstar-Profil geplant.

Medstar bleibt Quelle der Wahrheit fuer:

- Patientenstatus.
- PID.
- Profile.
- Terminarten.
- Slots.
- Terminbuchung/Storno.
- Rezeptmoeglichkeiten.

ARA-MED bzw. das Dashboard steuert:

- welche Terminarten KI-buchbar sind.
- welche Regeln und Modi aktiv sind.
- welche Prompts/Informationen gelten.
- wie Eskalation und Kommunikation laufen.
- welche Benutzer was sehen oder bearbeiten duerfen.

## Zentrale Konzeptdatei

Ausfuehrliches Produktkonzept:

- `2026-05-11_ARA-MED_Dashboard_Funktionsumfang.md`

Diese Datei enthaelt:

- MVP-Funktionsumfang.
- Ausbaustufen.
- Call-Log und Call-Detail.
- Inbox/Aufgaben.
- Rechte- und Berechtigungssystem.
- Kommunikationsrouting.
- SaaS-/Mandantenfaehigkeit.
- technische Sicherheitsanforderungen.

## Relevante bestehende Projektdateien

- `README.md`: Projektueberblick.
- `PROJECT_DOCUMENTATION.md`: technischer und fachlicher Projektstatus.
- `ARA-Med-prompt01.md`: aktueller Voice-/JSON-Vertrag.
- `omerovic.md`: fachliche Praxisregeln.
- `2026-02-23_MEDSTAR_API_Kompendium.md`: Medstar API Zusammenfassung.
- `MEDSTAR-API.pdf`: verbindliche API-Referenz.
- `MEDSTAR Complete V2 - medstar-2512 All 14 Tools + Session Management.json`: n8n Workflow Export.
- `doc/diskussion*.md`: ChatGPT/Claude Diskussionen und Vorarbeiten.

## MVP-Scope

Empfohlener erster Ausbau:

- Uebersicht mit ARA-MED Status, Praxisstatus, Modus und offenen Aufgaben.
- Telefonate/Call-Log.
- Call-Detail mit Audio, Transkript, Zusammenfassung, Intent, Aktionen und Fehlern.
- Inbox fuer unklare oder offene Faelle.
- Basis-Statistiken.
- Einstellungen fuer ARA aktiv/inaktiv, Oeffnungszeiten, Vertretung, Terminarten.
- Benutzer- und Rechteverwaltung.
- Kommunikationsrouting.
- Audit-Log.

Bewusst nicht im MVP:

- komplexe Rule Engine.
- vollstaendiger Layer-Kalender.
- Multi-Profil UI fuer Aerztezentren.
- mehrsprachige Prompt-Verwaltung.
- automatisiertes Billing.
- komplexe Omnichannel-Kampagnen.
- KI-Optimierungsempfehlungen.
- umfangreiche BI-Dashboards.

## Rollen und Rechte

Rechte sind Kernanforderung, nicht optional.

Grundrollen:

- `operator`: Plattformbetreiber/ITEX/ARA-MED Admin.
- `ordination_admin` bzw. Arzt/Admin: verwaltet Praxisregeln, Benutzer, Rechte im eigenen Mandanten.
- `assistant`: Ordinationsassistenz fuer Call-Log, Inbox und operative Bearbeitung.
- `viewer`: reine Leseberechtigung.

Feingranulare Modulrechte:

- `none`
- `view`
- `edit`
- `manage`
- `admin`

Wichtige Regel:

Ein Benutzer darf niemals mehr Rechte vergeben, als er selbst besitzt. Ein Ordinationsadmin kann also Mitarbeiter anlegen, aber nur Rechte innerhalb des eigenen Rechteumfangs vergeben.

Sensible Rechte muessen getrennt sein:

- Patientendaten.
- Telefonnummern.
- Audio.
- Transkripte.
- Rezeptdetails.
- Kosten.
- Benutzerverwaltung.
- Systemsettings.

## Kommunikationsmodul

ARA-MED braucht ein Kommunikationsrouting-Modul.

Richtung Ordination:

- Medstar-Direktnachricht.
- interne Inbox.
- E-Mail.
- Telegram.
- WhatsApp.
- SMS.
- Voicecall.
- Webhook.

Richtung Patient:

- Terminbestaetigung.
- Terminerinnerung.
- Terminverschiebung.
- Terminabsage.
- Rueckrufbestaetigung.
- Rezeptstatus.
- Vorbereitungshinweise.

Designprinzip:

Die Fachlogik erzeugt ein Kommunikationsereignis. Ein Provider-Adapter versendet ueber den passenden Kanal. Provider wie ElevenLabs, WhatsApp-Anbieter oder Mailservice duerfen im Produkt nicht sichtbar sein.

Templates:

- E-Mail.
- SMS/WhatsApp.
- interne Nachrichten.
- Voicecall-Skripte.
- Variablen wie `patient_name`, `appointment_date`, `practice_name`.
- `language_code` spaeter vorbereiten.

## Technischer Ziel-Stack

Aktuell angedacht:

- ElevenLabs fuer Voice Agents.
- n8n fuer Orchestrierung/Webhooks.
- PostgreSQL als Datenbank.
- Docker fuer Deployment.
- Portainer fuer Betrieb/Containerverwaltung.
- Webframework noch offen.

Pragmatische Kandidaten:

- Next.js mit Backend/API-Routen.
- NestJS plus React/Next.js Frontend.
- Django, falls Admin/RBAC/Sicherheit wichtiger als maximale Frontend-Flexibilitaet ist.

Noch zu entscheiden:

- Supabase Auth/Postgres oder eigenes Postgres/Auth.
- Webframework.
- Deployment-Struktur.

Empfehlung bisher:

- Next.js oder NestJS/Next.js.
- PostgreSQL/Supabase mit sauberem RBAC.
- Docker-first.
- Provider-Abstraktion fuer ElevenLabs und Kommunikationskanaele.

## Auth und Sicherheit

Anforderungen:

- moderne Authentifizierung.
- Passwort-vergessen-Funktion.
- Zwei-Faktor-Authentifizierung fuer Operator und Ordinationsadmins.
- optional verpflichtende 2FA pro Mandant.
- serverseitige Rechtepruefung.
- Audit fuer kritische Aktionen.
- keine Secrets im Frontend.
- optional Feldverschluesselung fuer sensible Daten.
- personenbezogene Daten nach Berechtigung maskieren.
- Provider/Plattformen wie ElevenLabs nicht sichtbar machen.

Audit muss mindestens erfassen:

- Benutzer- und Rechteaenderungen.
- ARA aktiv/inaktiv.
- Oeffnungszeiten.
- Routingregeln.
- Kommunikationsregeln.
- Templates.
- Terminarten KI-buchbar.
- Vertretungsmodus.
- API-/Systemsettings.

## Installierte bzw. relevante Skills

ElevenLabs:

- `agents`
- `elevenlabs-agents`
- `setup-api-key`
- `text-to-speech`
- `speech-to-text`
- `voice-changer`
- `voice-isolator`

Entfernt, weil nicht relevant:

- `music`
- `sound-effects`

n8n:

- `n8n-mcp-tools-expert`
- `n8n-workflow-patterns`
- `n8n-node-configuration`
- `n8n-expression-syntax`
- `n8n-validation-expert`
- `n8n-code-javascript`
- `n8n-code-python`

Postgres/Supabase:

- `supabase`
- `supabase-postgres-best-practices`

Docker/Portainer:

- `portainer-skill`

## Wichtige Leitlinie

Arbeitsweise nach GSD-Prinzip:

1. Ziel klaeren.
2. Ist-Zustand im Repo pruefen.
3. offene Entscheidungen benennen.
4. Empfehlung geben.
5. konkretes Artefakt erstellen.
6. Ergebnis und offene Punkte knapp zusammenfassen.

## Naechster sinnvoller Schritt

Als naechstes sollte ein technisches Architektur- und Datenmodell-Dokument fuer ARA-MED Dashboard v1 erstellt werden.

Inhalt:

- Zielarchitektur.
- Mandantenmodell.
- Rollen- und Rechte-Datenmodell.
- Tabellen fuer Calls, Call-Aktionen, Inbox, Routing, Kommunikation, Templates, Audit.
- Auth- und Security-Konzept.
- API-/Backend-Schnittstellen.
- n8n/ElevenLabs/Medstar Datenfluss.
- MVP-Akzeptanzkriterien.

Empfohlener Dateiname:

- `2026-05-11_ARA-MED_Technische_Architektur_Datenmodell_v1.md`

## Startprompt fuer neuen Chat

Bitte lies zuerst:

- `AGENTS.md`
- `2026-05-11_ARA-MED_Chat_Handover.md`
- `2026-05-11_ARA-MED_Dashboard_Funktionsumfang.md`
- `PROJECT_DOCUMENTATION.md`
- `ARA-Med-prompt01.md`

Ziel: Erstelle als naechsten Schritt ein technisches Architektur- und Datenmodell-Dokument fuer das ARA-MED Dashboard v1. Arbeite nach GSD: erst Repo-Kontext pruefen, dann konkrete Architektur und Tabellenstruktur vorschlagen. Keine Implementierung, bevor Architektur und Datenmodell freigegeben sind.
