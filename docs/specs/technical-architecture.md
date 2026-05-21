<!-- generated-by: gsd-doc-writer -->

# ARA-Med Dashboard — Technische Architekturspezifikation

Stand: 2026-05-21 | Status: Autoritativ — gilt für die gesamte Implementierung

---

## 1. System-Überblick

ARA-Med ist eine mandantenfähige SaaS-Plattform für Arztordinationen. Sie macht eine Voice-KI steuerbar, nachvollziehbar und sicher betreibbar.

Das Dashboard ist die operative Steuerzentrale: Es steuert, welche Medstar-Funktionen der Voice-KI zugänglich sind, protokolliert jeden Anruf lückenlos und bietet Inbox, Konfiguration und Audit für das Ordinationspersonal.

**Medstar bleibt Quelle der Wahrheit** für Patienten, PIDs, Terminarten, Termine und Rezeptmöglichkeiten. Das Dashboard repliziert keine Medstar-Logik — es speichert ARA-Med-Konfiguration, Freigaben, Protokolle und Kommunikationsereignisse.

---

## 2. Tech Stack

| Schicht | Technologie |
| --- | --- |
| Frontend & Backend-for-Frontend | Next.js 16 + React 19 + TypeScript strict |
| Styling & Komponenten | Tailwind CSS 4 + shadcn/ui |
| Datenbank, Auth, Storage, Realtime | Supabase (Postgres + Realtime + Auth + Vault) |
| Deployment | Vercel |
| Workflow-Orchestrierung | n8n Community Edition (Webhook-basiert) |

Alle Entscheidungen sind fixiert. Alternativen werden nicht mehr evaluiert.

---

## 3. Systemkomponenten und Datenfluss

```
Patient
  └─> Telefon / ElevenLabs Voice Layer
        └─> n8n (MCP-Orchestrierung)
              ├─> Medstar API (Wahrheitsquelle)
              └─> ARA-Med Dashboard API
                    ├─> Supabase Postgres (Konfiguration, Logs, Audit)
                    ├─> Supabase Storage (Audio, Transkripte)
                    └─> Supabase Realtime (Live-Updates an Frontend)
```

### 3.1 Komponentenverantwortung

| Komponente | Verantwortung |
| --- | --- |
| Voice Layer (ElevenLabs) | Gesprächsführung, Intent-Erkennung, strukturierte Tool-Calls |
| n8n | Medstar-API-Orchestrierung, Key-Verwaltung via Vault, Dashboard-Event-Versand |
| Medstar | PID, Patienten, Terminarten, Slots, Termine, Rezepte |
| Dashboard Backend (Next.js API Routes) | Auth, RBAC, Mandantengrenzen, Datenmaskierung, Audit |
| Dashboard Frontend | Operative Bedienung, Konfiguration, Call-Log, Inbox |
| Supabase Postgres | ARA-Med-Konfiguration, Logs, Rechte, Kommunikationsereignisse |
| Supabase Storage | Audiodateien, Transkripte — DB speichert nur Referenz + Metadaten |
| Supabase Realtime | Live-Updates (Calls, Inbox, Status) — kein Polling |
| Supabase Vault | Externe API-Keys (Medstar, ElevenLabs) je Mandant |

### 3.2 Provider-Abstraktion

Im Produkt sichtbar (Ordination und Patient sehen nur):

- ARA-Med Voice
- ARA-Med Nachricht
- ARA-Med Erinnerung
- ARA-Med Routing

Nie sichtbar im Praxis-Frontend: ElevenLabs, n8n, konkrete Messaging-Provider, Vercel, Supabase. Technische Provider erscheinen ausschließlich in Operator-Bereichen.

---

## 4. Multi-Tenant-Architektur

### 4.1 Grundsatz

`tenant_id` ist auf jeder fachlichen Tabelle Pflicht — ohne Ausnahme. Row Level Security (RLS) ist auf jeder Tabelle aktiv. Mandantengrenzen werden serverseitig durchgesetzt; Frontend-Filterung ist additiv, nicht ausreichend.

Ausnahmen sind nur globale Systemtabellen (Feature-Definitionen, Rollen-Vorlagen, Migrationsdaten).

### 4.2 n8n Multi-Tenant Key Management

Alle externen API-Keys (Medstar, ElevenLabs) liegen in Supabase Vault.

Key-Namensschema: `medstar_key_{tenant_id}`

n8n besitzt einen Supabase Service-Role-Key. Der erste Node jedes Workflows holt den mandantenspezifischen Key aus Vault und gibt ihn als Variable an nachfolgende Nodes weiter. Kein Key verlässt n8n in Richtung Frontend.

---

## 5. Authentication und Autorisierung

### 5.1 Auth

- **Supabase Auth** mit 2FA-Pflicht für `operator` und `ordination_admin`.
- 2FA kann pro Mandant als Pflicht für alle Benutzer konfiguriert werden.
- Session-Management, Login-Audit und Account-Lockout über Supabase Auth.
- OAuth/OIDC ist vorbereitet (SSO-Integration in späteren Stufen).

### 5.2 Rollen

| Rolle | Reichweite |
| --- | --- |
| `operator` | Plattformübergreifend (ITEX/ARA-Med Admin) |
| `ordination_admin` | Ein Mandant — Konfiguration, Benutzerverwaltung |
| `assistant` | Ein Mandant — operative Bearbeitung |
| `viewer` | Ein Mandant — Lesezugriff auf freigegebene Bereiche |

Rollen sind Vorlagen. Die rechtsverbindliche Steuerung erfolgt über granulare Modulrechte.

### 5.3 Rechtstufen

`none` | `view` | `edit` | `manage` | `admin`

### 5.4 Rechtekategorien (MVP)

`dashboard`, `calls`, `call_audio`, `call_transcripts`, `patient_data`, `inbox`, `appointments`, `prescriptions`, `routing`, `communication`, `communication_templates`, `opening_hours`, `substitution`, `prompts`, `training_faq`, `statistics`, `costs`, `user_management`, `system_settings`, `audit_log`

### 5.5 Delegationsregel

Ein Benutzer darf nur Rechte vergeben, die kleiner oder gleich seinen eigenen Rechten im gleichen Mandanten sind. Serverseitige Pflichtprüfung — UI ist additiv.

---

## 6. Datenmodell

### 6.1 Mandant und Basis

#### tenants
| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Mandant |
| name | text | Anzeigename |
| slug | text unique | technische Kennung |
| status | text | `active`, `paused`, `disabled` |
| default_language_code | text | Standard `de` |
| timezone | text | z. B. `Europe/Vienna` |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |

#### profiles
Supabase Auth-Extension: Erweitert `auth.users` um ARA-Med-spezifische Felder.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | = auth.users.id |
| email | citext | Login |
| display_name | text | Anzeigename |
| status | text | `active`, `invited`, `disabled` |
| mfa_required | boolean | 2FA-Pflicht |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |

#### practice_settings
Betriebsparameter je Mandant (ara_status, practice_mode, Öffnungszeiten-Konfiguration, Spracheinstellungen).

### 6.2 Intent-Engine

#### intent_definitions
Canonical-Intents je Mandant (`termin_buchen`, `rezept_bestellen`, `rueckruf`, etc.).

#### intent_aliases
Natürlichsprachliche Ausdrücke ("Ich brauche einen Termin", "kann ich kommen") → Canonical-Intent.

#### intent_routing_rules
Regeln: Intent + Kontext → Aktion (`transfer`, `prompt`, `create_task`, `book_appointment`).

#### intent_action_mappings
Intent → erlaubte Medstar-Aktionen je Mandant.

#### appointment_type_aliases
Soft→Hard-Mapping: Patientenformulierung ("Bauchweh", "Schwindel") → `medstar_appointment_type_code`. Ermöglicht fuzzy Terminart-Erkennung ohne Prompt-Logik.

### 6.3 Conversation Memory

#### conversation_memory

Kurzzeit-Kontext je anrufender Nummer für n8n-Workflows.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | — |
| tenant_id | uuid fk | Mandant |
| phone_hash | text | Hash der Rufnummer |
| cached_pid | text nullable | PID-Cache (15 min TTL) |
| pid_cached_at | timestamptz nullable | Cache-Zeitstempel |
| last_language | text | zuletzt erkannte Sprache |
| last_intent | text nullable | letzter Intent |
| updated_at | timestamptz | — |

Unique: `(tenant_id, phone_hash)`

**TTL-Regel:** `cached_pid` gilt 15 Minuten ab `pid_cached_at`. n8n prüft das Delta vor jeder Nutzung und holt bei Ablauf eine frische PID aus Medstar.

### 6.4 Audit-Trail (Call-Protokoll)

#### call_log
Telefonat-Kopfdatensatz.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Call |
| tenant_id | uuid fk | Mandant |
| external_conversation_id | text | n8n/Voice Conversation-ID |
| started_at | timestamptz | Beginn |
| ended_at | timestamptz nullable | Ende |
| duration_seconds | int nullable | Dauer |
| caller_phone_hash | text | Such- und Wiedererkennungswert |
| caller_phone_masked | text | maskierte Anzeige |
| caller_phone_encrypted | bytea nullable | optional verschlüsselt |
| language_code | text | erkannte Sprache |
| patient_identified | boolean | Identifikation erfolgreich |
| medstar_pid | text nullable | PID (mandantenbezogen) |
| pid_status | text | `active`, `inactive`, `pid_zero`, `unknown` |
| main_intent | text | Hauptintent |
| sub_intent | text nullable | Subintent |
| status | text | `resolved`, `open`, `transferred`, `failed`, `abandoned` |
| summary_short | text | Kurzfassung |
| summary_structured | jsonb | strukturierte Zusammenfassung |
| cost_units | numeric nullable | Minuten/Kosten-Platzhalter |
| created_at | timestamptz | — |
| updated_at | timestamptz | — |

Indexes: `(tenant_id, started_at desc)`, `(tenant_id, status, started_at desc)`, `(tenant_id, main_intent, started_at desc)`, `(tenant_id, caller_phone_hash)`

#### call_actions
Jede ausgeführte oder versuchte Aktion eines Calls (`book_appointment`, `cancel_appointment`, `order_prescription`, `leave_message`, `transfer`, `create_task`). Status: `planned`, `success`, `failed`, `skipped`. Enthält `request_summary` und `response_summary` als bereinigtes JSONB — keine Rohdaten mit PII.

#### conversation_events
Granulares Turn-by-Turn-Protokoll: jeder Dialog-Turn, jeder Tool-Call-Aufruf, jede Zwischenentscheidung. Dient Debugging und Decision-Trace.

#### decision_traces
Nachvollziehbare Entscheidungsgründe je Call-Step (`opening_hours_check`, `intent_route`, `appointment_type_filter`). Enthält `input_snapshot`, `rule_snapshot`, `decision`, `reason`.

### 6.5 Session Store

#### session_store
Große Laufzeit-Daten, die nie im Prompt landen.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | — |
| tenant_id | uuid fk | Mandant |
| session_key | text | z. B. `slots_{call_id}`, `medications_{tenant_id}` |
| payload | jsonb | available_slots, medication_list o. ä. |
| expires_at | timestamptz | TTL |
| created_at | timestamptz | — |

Unique: `(tenant_id, session_key)`

n8n schreibt vor dem Prompt-Aufruf in `session_store` und übergibt nur den `session_key`. Die Voice-KI ruft bei Bedarf gezielt einzelne Werte ab.

### 6.6 Medstar-nahe Konfiguration

#### medstar_connections
Mandantenbezogene Medstar-Verbindungsdaten. Secrets ausschließlich als `secret_ref` → Supabase Vault. Kein Klartext-Key in der Datenbank.

#### appointment_types
Terminarten aus Medstar + ARA-Med-Freigabe. `visibility`: `hidden`, `internal`, `voice_visible`, `voice_bookable`. `is_voice_bookable` steuert, ob die KI buchen darf. `pid_zero_allowed` für Führerscheinuntersuchungen.

#### appointment_type_synonyms
Synonyme und Patientenformulierungen je Terminart + Sprache.

### 6.7 Inbox und Aufgaben

#### inbox_tasks
Offene Fälle für menschliche Bearbeitung. `task_type`: `patient_unknown`, `callback`, `prescription_blocked`, `unclear_intent`, `urgent_hint`, `technical_error`. `priority`: `low`, `normal`, `high`, `critical`.

#### inbox_task_comments
Interne Notizen zur Aufgabe.

### 6.8 Kommunikation

#### communication_events
Fachlogik erzeugt Events (`callback_needed`, `appointment_confirmed` usw.). Ein Routing-Layer entscheidet Empfänger, Kanal, Template, Fallback, Zeitpunkt, Wiederholung.

#### communication_rules
Routing-Regeln: Richtung (`ordination`, `patient`), Ereignistyp, Priorität, Kanal, Fallback-Kanal, Datenschutzklasse (`normal`, `sensitive`, `medical`).

#### communication_templates
Nachrichtenvorlagen je Kanal und Sprache. Kanalspektrum: `internal`, `email`, `sms`, `whatsapp`, `telegram`, `voicecall`, `webhook`, `medstar_message`.

#### communication_deliveries
Jeder Versandversuch mit Status (`planned`, `sent`, `delivered`, `failed`, `cancelled`), `provider_key` (nur technisch, nie im UI), `recipient_masked`, `recipient_hash`.

### 6.9 Praxis- und Betriebsstatus

- **practice_status**: `ara_status` (`active`, `paused`, `degraded`, `disabled`), `practice_mode` (`normal`, `holiday`, `substitution`, `overload`)
- **opening_hours**: Reguläre Wochenzeiten je Department (`practice`, `phone`, `lab`)
- **special_days**: Sondertage mit abweichenden Zeiten oder Schließung
- **substitution_periods**: Vertretungszeiträume mit eigenem Begrüßungstext und Weiterleitungsnummer

### 6.10 Wissen, Prompts, Medikamente

- **prompt_texts**: Pflegbare Sprach-Texte je `text_key` und `language_code` (`greeting_normal`, etc.)
- **knowledge_items**: FAQ und Praxiswissen je Kategorie und Sprache
- **medications**: Ordinationsweite Medikamentenliste für Aussprache und Erkennung — keine Rezeptwahrheit, ersetzt Medstar nicht

### 6.11 Rechte und Audit

- **permission_profiles**: Rechtevorlagen je Mandant (global und mandantenspezifisch)
- **permission_profile_items**: Rechte je Vorlage und Kategorie
- **user_permissions**: Konkrete Modulrechte je Mandantenbenutzer, mit `granted_by`-Referenz
- **audit_log**: Pflicht für kritische Änderungen. Actor-Type: `user`, `system`, `n8n`. Enthält `old_value` und `new_value` als bereinigtes JSONB.

---

## 7. Audio und Transkripte

- Audio wird in **Supabase Storage** gespeichert.
- Die Datenbank speichert ausschließlich Referenz (`storage_ref`), Metadaten (`mime_type`, `size_bytes`, `checksum`) und Aufbewahrungsfrist (`retention_until`).
- Audio-URLs werden als zeitlich begrenzte signierte URLs ausgeliefert — nie als dauerhafte Links.
- **Auto-Löschung in ElevenLabs nach 30 Tagen** (Wert konfigurierbar pro Mandant via `tenant_features.config`).
- Transkript-Segmente (`call_transcript_segments`) sind optional durchsuchbar nach Speaker, Zeitstempel und Text.

---

## 8. Supabase Realtime

Alle Live-Updates an das Frontend laufen über **Supabase Realtime Channels**. Es gibt kein Polling.

Kanäle (Beispiele):
- `calls:{tenant_id}` — neue und aktualisierte Call-Log-Einträge
- `inbox:{tenant_id}` — Inbox-Aufgaben
- `practice_status:{tenant_id}` — ARA-Med und Praxis-Status

Das Frontend abonniert Channels nach Login und räumt sie bei Logout auf.

---

## 9. Datenschutz und Maskierung

### 9.1 Datenklassen

| Datenklasse | Speicherung | Anzeige |
| --- | --- | --- |
| Telefonnummer | Hash + maskiert, optional verschlüsselt | voll nur mit `calls`-Recht |
| SVNR | standardmäßig nicht speichern; bei Bedarf stark maskiert/verschlüsselt | nur Sonderrecht |
| PID | gespeichert, mandantenbezogen | sichtbar mit `patient_data`-Recht |
| Audio | Supabase Storage — DB nur Referenz | eigenes `call_audio`-Recht + signierte URL |
| Transkript | Storage oder Segmente | eigenes `call_transcripts`-Recht |
| Rezeptdetails | minimiert | eigenes `prescriptions`-Recht |
| API-Keys/Tokens | Supabase Vault | nie im Frontend, nie in DB-Klartext |

### 9.2 Maskierungsregeln

Serverantworten sind bereits maskiert und berechtigt. Frontend-Maskierung ist additiv.

- Telefonnummer ohne Recht: `+43 *** *** 123`
- SVNR: standardmäßig nicht anzeigen
- Audio-URL: nur zeitlich begrenzte signierte URL
- Transkript: ohne Recht nicht ausliefern

---

## 10. n8n → Dashboard Event-Schnittstelle

### n8n sendet an Dashboard API

| Event | Auslöser |
| --- | --- |
| `call.started` | Gesprächsbeginn |
| `call.updated` | Statuswechsel mid-call |
| `call.completed` | Gesprächsende + Summary |
| `call.action.executed` | Medstar-Aktion abgeschlossen |
| `call.decision.trace` | Entscheidungsschritt |
| `inbox.task.created` | Eskalation oder Fehler |
| `communication.event.created` | Kommunikationsereignis |
| `medstar.sync.completed` | Terminarten-Synchronisation |
| `system.error` | Technischer Fehler |

n8n sendet aktiv (Push). Das Dashboard holt keine Events (kein Pull).

### Dashboard sendet an n8n

- Terminarten synchronisieren
- Medstar-Profile synchronisieren
- Test-Kommunikation auslösen
- Manuelle Retry-Aktion auslösen
- Status-/Healthcheck

---

## 11. Dashboard API — Endpunkte (MVP)

Alle Endpunkte prüfen: Authentifizierung, Mandantenzugriff, Modulrecht, Datenmaskierung, Audit-Pflicht bei Änderungen.

```
GET    /api/dashboard/summary
GET    /api/calls
GET    /api/calls/:id
PATCH  /api/calls/:id/classification
GET    /api/inbox
PATCH  /api/inbox/:id
POST   /api/inbox/:id/comments
GET    /api/settings/opening-hours
PUT    /api/settings/opening-hours
GET    /api/settings/appointment-types
PATCH  /api/settings/appointment-types/:id
GET    /api/communication/rules
POST   /api/communication/rules
PATCH  /api/communication/rules/:id
GET    /api/communication/templates
POST   /api/communication/templates
PATCH  /api/communication/templates/:id
GET    /api/users
POST   /api/users/invite
PATCH  /api/users/:id/permissions
GET    /api/audit-log
```

---

## 12. Typische Datenflüsse

### 12.1 Eingehender Call

1. Patient ruft an → ElevenLabs Voice Layer führt Dialog.
2. Voice-KI ruft n8n-MCP-Tools auf.
3. n8n holt Key aus Vault → prüft `conversation_memory` (PID-Cache TTL 15 min).
4. n8n orchestriert Medstar-Aufrufe.
5. n8n sendet `call.*`-Events an Dashboard API.
6. Dashboard speichert `call_log`, `call_actions`, `conversation_events`, `decision_traces`.
7. Frontend erhält Live-Update via Supabase Realtime.

### 12.2 Terminbuchung

1. Voice-KI erkennt Terminwunsch.
2. n8n holt erlaubte Terminarten aus Medstar, filtert gegen `appointment_types.is_voice_bookable`.
3. Nur `voice_bookable`-Terminarten werden angeboten.
4. Medstar führt Buchung aus.
5. Dashboard protokolliert `call_action` (status: `success`).
6. Kommunikationsereignis `appointment_confirmed` kann erzeugt werden.

### 12.3 Nicht lösbarer Fall

1. n8n erkennt unklaren Intent, Identifikationsproblem oder technischen Fehler.
2. Dashboard erstellt `inbox_task` mit passendem `task_type` und `priority`.
3. Kommunikationsrouting informiert Ordination über definierten Kanal.
4. Aufgabe wird im Dashboard bearbeitet und auditiert.

---

## 13. Statistiken

MVP-KPIs werden aus bestehenden Tabellen berechnet (keine separaten KPI-Tabellen).

Vorbereitete materialisierte Views (ab Stufe 2 bei Performance-Bedarf):
- `daily_call_metrics`
- `daily_intent_metrics`
- `daily_automation_metrics`
- `daily_cost_metrics`

---

## 14. Nicht im MVP

- Komplexe Rule Engine mit beliebigen Bedingungen
- Layer-Kalender
- Multi-Profil-UI für Ärztezentren
- Automatisiertes Billing
- KI-Optimierungsempfehlungen
- Vollständige BI-Schicht
- Omnichannel-Kampagnenlogik
- Provider-spezifische Konfiguration für Ordinationsbenutzer
- Mehrsprachige Prompt-Verwaltung (Datenmodell vorbereitet, UI Stufe 3)

---

## 15. MVP-Akzeptanzkriterien

**Betrieb:** Mandant kann ARA-Med aktivieren, pausieren, in Sondermodi versetzen, Öffnungszeiten und Vertretung pflegen.

**Nachvollziehbarkeit:** Jeder Call ist sichtbar. Detail-Ansicht zeigt Audio, Transkript, Zusammenfassung, Aktionen, Decision Trace — rechteabhängig. Telefonnummer-Historie über Hash nachvollziehbar.

**Inbox:** Offene Fälle werden automatisch angelegt, können bearbeitet, kommentiert, abgeschlossen und archiviert werden.

**Konfiguration:** Medstar-Terminarten synchron anzeigbar. Pro Terminart steuerbar: sichtbar, intern, KI-buchbar. Synonyme pflegbar. PID-0-Sonderlogik (Führerscheinuntersuchung) modelliert.

**Kommunikation:** Events entstehen aus Calls und Aufgaben. Regeln bestimmen Kanal, Empfänger, Template. Jeder Versandversuch protokolliert. Provider im Praxis-Frontend unsichtbar.

**Rechte & Audit:** Modulrechte granular konfigurierbar. Delegationsregel serverseitig durchgesetzt. Sensible Felder servermasked. Kritische Änderungen erzeugen Audit-Log-Einträge.
