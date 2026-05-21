# ARA-MED Dashboard v1 - Technische Architektur und Datenmodell

Stand: 2026-05-11

Status: Entwurf zur fachlichen und technischen Freigabe

## 1. GSD-Zusammenfassung

### 1.1 Ziel

Das ARA-MED Dashboard v1 soll die Voice-KI fuer eine Arztordination steuerbar, nachvollziehbar und sicher betreibbar machen.

Der MVP fokussiert auf:

- Mandantenfaehige SaaS-Grundstruktur.
- Rollen, Rechte, Maskierung und Audit von Anfang an.
- Nachvollziehbares Call-Log mit Detailansicht.
- Inbox fuer offene oder eskalierte Faelle.
- Konfiguration von ARA-MED Status, Oeffnungszeiten, Vertretung, Terminarten und Routing.
- Kommunikationsrouting mit Templates und Versandlog.
- Vorbereitung fuer Medstar, n8n, Voice-Provider und weitere Kommunikationsprovider ohne Providerbindung im Produkt.

### 1.2 Ist-Zustand im Repo

Relevante Quellen:

- `2026-05-11_ARA-MED_Dashboard_Funktionsumfang.md`: Produkt- und MVP-Konzept.
- `2026-05-11_ARA-MED_Chat_Handover.md`: Uebergabe und naechster Schritt.
- `PROJECT_DOCUMENTATION.md`: aktueller ARA-Med/n8n/Medstar Projektstatus.
- `ARA-Med-prompt01.md`: aktueller Voice- und MCP-Vertrag.
- `omerovic.md`: fachliche Praxisregeln.
- `MEDSTAR-API.pdf`: verbindliche Medstar API-Referenz.
- `MEDSTAR Complete V2 - medstar-2512 All 14 Tools + Session Management.json`: Referenzworkflow.

Aktueller technischer Stand:

- Voice-KI sendet flache Nutzdaten an n8n MCP.
- n8n orchestriert Medstar-Aufrufe.
- Medstar bleibt Quelle der Wahrheit fuer Patienten, PID, Profile, Terminarten, Slots, Termine und Rezeptmoeglichkeiten.
- Dashboard existiert noch nicht als implementierte Anwendung.

### 1.3 Offene Entscheidungen

Vor Implementierung freizugeben:

- Webframework: Empfehlung `Next.js` mit serverseitiger Zugriffskontrolle und Postgres-Anbindung.
- Auth: Empfehlung `Supabase Auth` oder vergleichbarer OIDC-faehiger Auth-Dienst mit 2FA-Faehigkeit.
- Datenbank: Empfehlung `PostgreSQL`, optional ueber Supabase, mit konsequenter `tenant_id`.
- Storage fuer Audio/Transkripte: Empfehlung objektbasierter Storage, DB speichert nur Referenzen und Metadaten.
- Feldverschluesselung: pro Datenklasse entscheiden, nicht pauschal alles verschluesseln.
- Providerstrategie: Fachlogik erzeugt Events, Adapter versenden ueber konkrete Provider.

### 1.4 Empfehlung

Fuer v1 sollte die Architektur bewusst konservativ bleiben:

- `Next.js` als Dashboard und Backend-for-Frontend.
- `PostgreSQL` als zentrale Datenbank.
- `Supabase Auth/Postgres` pruefen, wenn Auth, RLS, Storage und schnelle MVP-Entwicklung priorisiert sind.
- `n8n` bleibt Orchestrierungs- und Integrationsschicht fuer Medstar-nahe Workflows.
- Dashboard schreibt keine Medstar-Wahrheit nach, sondern speichert ARA-MED-Konfiguration, Protokolle, Entscheidungen und Kommunikationsereignisse.
- Alle fachlichen Tabellen erhalten `tenant_id`.
- Rechte werden serverseitig geprueft; UI-Maskierung ist nur zusaetzlich.

## 2. Zielarchitektur

### 2.1 Komponenten

```text
Patient
  -> Telefon / Voice-KI
  -> ARA-MED Voice Layer
  -> n8n MCP / Orchestrierung
  -> Medstar API

ARA-MED Dashboard
  -> Backend/API-Routen
  -> PostgreSQL
  -> Object Storage fuer Audio/Transkripte
  -> n8n Webhooks fuer Aktionen und Synchronisation
  -> Kommunikationsprovider-Adapter
```

### 2.2 Verantwortlichkeiten

| Komponente | Verantwortung |
| --- | --- |
| Voice Layer | Gespraech, Intent-Erkennung, strukturierte Tool-Calls, keine Systemoffenlegung |
| n8n | Medstar-API-Orchestrierung, Normalisierung, technische Integrationen |
| Medstar | Quelle der Wahrheit fuer Patienten, Termine, Terminarten, Rezepte |
| Dashboard Backend | Auth, RBAC, Mandantengrenzen, API fuer UI, Audit, Maskierung |
| Dashboard Frontend | Operative Bedienung, Konfiguration, Call- und Inbox-Ansichten |
| PostgreSQL | ARA-MED-Konfiguration, Logs, Rechte, Aufgaben, Kommunikation |
| Object Storage | Audio, grosse Transkriptdateien, ggf. exportierte Artefakte |
| Kommunikationsadapter | Versand ueber E-Mail, SMS, WhatsApp, Telegram, Voicecall, Webhook, Medstar-Nachricht |

### 2.3 Provider-Abstraktion

Im Produkt sichtbar:

- ARA-MED Voice.
- ARA-MED Nachricht.
- ARA-MED Erinnerung.
- ARA-MED Routing.

Nicht sichtbar:

- ElevenLabs.
- konkreter WhatsApp-Provider.
- konkreter E-Mail-Service.
- n8n.
- technische Container- oder Hostingplattform.

Provider werden nur in technischen Admin-Bereichen fuer Operatoren sichtbar.

## 3. Mandantenmodell

### 3.1 Grundsatz

Jede fachliche Tabelle erhaelt `tenant_id`.

Ausnahmen sind nur globale Systemtabellen, z. B. globale Feature-Definitionen, globale Rollen-Vorlagen oder technische Migrationsdaten.

### 3.2 Tabellen

#### tenants

Mandanten bzw. Ordinationen.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Mandant |
| name | text | Anzeigename |
| slug | text unique | technische Kennung |
| status | text | `active`, `paused`, `disabled` |
| default_language_code | text | Standard `de` |
| timezone | text | z. B. `Europe/Vienna` |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

#### tenant_features

Aktive Features je Mandant.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Feature-Zuordnung |
| tenant_id | uuid fk | Mandant |
| feature_key | text | z. B. `prescriptions`, `communication_routing` |
| enabled | boolean | aktiv |
| config | jsonb | optionale Feature-Konfiguration |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

#### medstar_connections

Mandantenbezogene Medstar-Konfiguration. Secrets werden nicht im Klartext gespeichert.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Verbindung |
| tenant_id | uuid fk | Mandant |
| base_url | text | Medstar Server/API URL |
| default_profile_id | text | aktuell genutztes Profil |
| secret_ref | text | Referenz auf Secret Store |
| status | text | `active`, `inactive`, `error` |
| last_sync_at | timestamptz | letzte Synchronisation |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

## 4. Auth, Rollen und Rechte

### 4.1 Rollen

Grundrollen:

- `operator`
- `ordination_admin`
- `assistant`
- `viewer`

Rollen sind Vorlagen. Entscheidend sind konkrete Modulrechte.

### 4.2 Rechtstufen

| Wert | Bedeutung |
| --- | --- |
| `none` | kein Zugriff |
| `view` | lesen |
| `edit` | bearbeiten |
| `manage` | bearbeiten plus Unterobjekte verwalten |
| `admin` | volle Kontrolle inklusive Rechtevergabe |

### 4.3 Rechtekategorien

MVP-Kategorien:

- `dashboard`
- `calls`
- `call_audio`
- `call_transcripts`
- `patient_data`
- `inbox`
- `appointments`
- `prescriptions`
- `routing`
- `communication`
- `communication_templates`
- `opening_hours`
- `substitution`
- `prompts`
- `training_faq`
- `statistics`
- `costs`
- `user_management`
- `system_settings`
- `audit_log`

### 4.4 Tabellen

#### users

Wenn Supabase Auth genutzt wird, verweist diese Tabelle auf `auth.users`.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Benutzer-ID, identisch mit Auth-ID |
| email | citext | Login-Mail |
| display_name | text | Anzeigename |
| status | text | `active`, `invited`, `disabled` |
| mfa_required | boolean | 2FA Pflicht |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

#### tenant_users

Benutzerzuordnung zu Mandanten.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Zuordnung |
| tenant_id | uuid fk | Mandant |
| user_id | uuid fk | Benutzer |
| base_role | text | Grundrolle |
| status | text | `active`, `invited`, `disabled` |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

Unique:

- `(tenant_id, user_id)`

#### permission_profiles

Rechtevorlagen je Mandant.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Profil |
| tenant_id | uuid fk nullable | null fuer globale Vorlage |
| name | text | z. B. `Assistenz Standard` |
| description | text | Beschreibung |
| is_system | boolean | Systemvorlage |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

#### permission_profile_items

Rechte je Vorlage.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Eintrag |
| profile_id | uuid fk | Rechteprofil |
| category_key | text | Rechtekategorie |
| level | text | `none`, `view`, `edit`, `manage`, `admin` |

Unique:

- `(profile_id, category_key)`

#### user_permissions

Konkrete Rechte je Mandantenbenutzer.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Recht |
| tenant_user_id | uuid fk | Mandantenbenutzer |
| category_key | text | Rechtekategorie |
| level | text | Rechtstufe |
| granted_by | uuid fk | vergebender Benutzer |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

Unique:

- `(tenant_user_id, category_key)`

### 4.5 Delegationsregel

Serverseitige Pflichtregel:

Ein Benutzer darf nur Rechte vergeben, die kleiner oder gleich seinen eigenen Rechten im gleichen Mandanten sind.

Operatoren duerfen mandantenuebergreifend Rechte setzen, sofern sie im Operator-Kontext handeln.

## 5. Praxis- und Betriebsstatus

#### practice_status

Aktueller ARA-MED und Praxisstatus.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Status |
| tenant_id | uuid fk | Mandant |
| ara_status | text | `active`, `paused`, `degraded`, `disabled` |
| practice_mode | text | `normal`, `holiday`, `substitution`, `overload` |
| status_note | text | interne Notiz |
| active_from | timestamptz | optional |
| active_until | timestamptz | optional |
| updated_by | uuid fk | Benutzer |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

#### opening_hours

Regulaere Oeffnungszeiten.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Eintrag |
| tenant_id | uuid fk | Mandant |
| weekday | int | 1-7 |
| opens_at | time | Beginn |
| closes_at | time | Ende |
| department_key | text | z. B. `practice`, `phone`, `lab` |
| is_active | boolean | aktiv |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

#### special_days

Sondertage und Abweichungen.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Sondertag |
| tenant_id | uuid fk | Mandant |
| date | date | Datum |
| status | text | `closed`, `special_hours`, `substitution` |
| opens_at | time nullable | Beginn |
| closes_at | time nullable | Ende |
| message | text | Ansage/Hinweis |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

#### substitution_periods

Vertretungszeiträume.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Zeitraum |
| tenant_id | uuid fk | Mandant |
| name | text | Vertretungsbezeichnung |
| starts_at | timestamptz | Beginn |
| ends_at | timestamptz | Ende |
| greeting_text | text | Begruessung |
| forwarding_phone | text | Weiterleitung |
| allow_pid_zero | boolean | Nichtpatienten erlaubt |
| is_active | boolean | aktiv |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

## 6. Medstar-nahe Konfiguration

#### medstar_profiles

Synchronisierte oder manuell referenzierte Medstar-Profile.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | lokaler Datensatz |
| tenant_id | uuid fk | Mandant |
| medstar_profile_id | text | externe ID |
| name | text | Anzeigename |
| is_default | boolean | Standardprofil |
| is_active | boolean | aktiv |
| synced_at | timestamptz | letzte Synchronisation |

Unique:

- `(tenant_id, medstar_profile_id)`

#### appointment_types

Terminarten aus Medstar plus ARA-MED-Freigabe.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Terminart |
| tenant_id | uuid fk | Mandant |
| medstar_type_id | text | externe ID oder Name |
| medstar_profile_id | text nullable | Profilbezug |
| name | text | Anzeigename |
| voice_label | text | Aussprache |
| visibility | text | `hidden`, `internal`, `voice_visible`, `voice_bookable` |
| is_voice_bookable | boolean | KI darf buchen |
| default_duration_minutes | int nullable | Dauer falls bekannt |
| pid_zero_allowed | boolean | z. B. Fuehrerschein |
| requires_active_patient | boolean | Standard true |
| is_active | boolean | aktiv |
| synced_at | timestamptz | letzte Synchronisation |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

Unique:

- `(tenant_id, medstar_type_id, medstar_profile_id)`

#### appointment_type_synonyms

Synonyme und Formulierungen fuer Terminarten.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Synonym |
| tenant_id | uuid fk | Mandant |
| appointment_type_id | uuid fk | Terminart |
| phrase | text | Formulierung |
| language_code | text | Sprache |
| is_active | boolean | aktiv |

## 7. Telefonate und Decision Trace

### 7.1 Grundsatz

Call-Log ist das zentrale Vertrauensmodul.

Es speichert nicht nur Ergebnisstatus, sondern auch:

- was erkannt wurde,
- welche Regeln galten,
- welche Aktion ausgefuehrt wurde,
- warum eskaliert wurde,
- welcher technische Fehler auftrat.

### 7.2 Tabellen

#### calls

Telefonat-Kopfdatensatz.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Call |
| tenant_id | uuid fk | Mandant |
| external_conversation_id | text | Voice/n8n Conversation-ID |
| started_at | timestamptz | Beginn |
| ended_at | timestamptz nullable | Ende |
| duration_seconds | int nullable | Dauer |
| caller_phone_hash | text | Such-/Wiedererkennungswert |
| caller_phone_masked | text | maskierte Anzeige |
| caller_phone_encrypted | bytea nullable | optional verschluesselt |
| language_code | text | Sprache |
| patient_identified | boolean | erkannt |
| medstar_pid | text nullable | PID, mandantenbezogen |
| pid_status | text | `active`, `inactive`, `pid_zero`, `unknown` |
| main_intent | text | Hauptintent |
| sub_intent | text nullable | Subintent |
| status | text | `resolved`, `open`, `transferred`, `failed`, `abandoned` |
| summary_short | text | Kurzfassung |
| summary_structured | jsonb | strukturierte Zusammenfassung |
| cost_units | numeric nullable | Minuten/Kosten-Platzhalter |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

Indexes:

- `(tenant_id, started_at desc)`
- `(tenant_id, status, started_at desc)`
- `(tenant_id, main_intent, started_at desc)`
- `(tenant_id, caller_phone_hash)`

#### call_media

Audio und Transkript-Referenzen.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Medium |
| tenant_id | uuid fk | Mandant |
| call_id | uuid fk | Call |
| media_type | text | `audio`, `transcript`, `raw_payload` |
| storage_ref | text | Object-Storage-Referenz |
| mime_type | text | Dateityp |
| size_bytes | bigint nullable | Groesse |
| checksum | text nullable | Integritaet |
| retention_until | date nullable | Aufbewahrung |
| created_at | timestamptz | Erstellung |

#### call_transcript_segments

Optional fuer durchsuchbare Transkriptsegmente.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Segment |
| tenant_id | uuid fk | Mandant |
| call_id | uuid fk | Call |
| speaker | text | `patient`, `ara`, `staff`, `unknown` |
| starts_at_ms | int nullable | Start |
| ends_at_ms | int nullable | Ende |
| text | text | Segmenttext |
| created_at | timestamptz | Erstellung |

#### call_actions

Ausgefuehrte oder versuchte Aktionen.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Aktion |
| tenant_id | uuid fk | Mandant |
| call_id | uuid fk | Call |
| action_type | text | `book_appointment`, `cancel_appointment`, `order_prescription`, `leave_message`, `transfer`, `create_task` |
| status | text | `planned`, `success`, `failed`, `skipped` |
| medstar_object_id | text nullable | Termin-/Order-ID |
| request_summary | jsonb | bereinigte Request-Daten |
| response_summary | jsonb | bereinigte Response-Daten |
| error_code | text nullable | Fehlercode |
| error_message | text nullable | Fehlertext |
| created_at | timestamptz | Erstellung |

Indexes:

- `(tenant_id, call_id)`
- `(tenant_id, action_type, created_at desc)`

#### decision_traces

Nachvollziehbare Entscheidungsgruende.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Trace |
| tenant_id | uuid fk | Mandant |
| call_id | uuid fk | Call |
| step_key | text | z. B. `opening_hours_check`, `intent_route`, `appointment_type_filter` |
| input_snapshot | jsonb | bereinigter Input |
| rule_snapshot | jsonb | angewandte Regel |
| decision | text | Entscheidung |
| reason | text | Kurzbegruendung |
| created_at | timestamptz | Erstellung |

## 8. Inbox und Aufgaben

#### inbox_tasks

Offene Faelle fuer menschliche Bearbeitung.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Aufgabe |
| tenant_id | uuid fk | Mandant |
| call_id | uuid fk nullable | Bezug zum Call |
| task_type | text | `patient_unknown`, `callback`, `prescription_blocked`, `unclear_intent`, `urgent_hint`, `technical_error` |
| priority | text | `low`, `normal`, `high`, `critical` |
| status | text | `open`, `in_progress`, `done`, `archived` |
| title | text | Kurztitle |
| description | text | Beschreibung |
| assigned_to | uuid fk nullable | Benutzer |
| due_at | timestamptz nullable | Faelligkeit |
| patient_reference | jsonb | maskierte/erlaubte Patientendaten |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |
| closed_at | timestamptz nullable | Abschluss |

Indexes:

- `(tenant_id, status, priority, created_at desc)`
- `(tenant_id, assigned_to, status)`

#### inbox_task_comments

Interne Notizen.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Kommentar |
| tenant_id | uuid fk | Mandant |
| task_id | uuid fk | Aufgabe |
| author_id | uuid fk | Benutzer |
| body | text | Notiz |
| created_at | timestamptz | Erstellung |

## 9. Routing-Regeln

#### routing_rules

Allgemeiner Routing-Layer fuer Stufe 1/2.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Regel |
| tenant_id | uuid fk | Mandant |
| name | text | Anzeigename |
| priority | int | niedrigere Zahl zuerst |
| rule_type | text | `phone`, `intent`, `appointment_type`, `time`, `mode` |
| conditions | jsonb | Bedingung |
| action_type | text | `transfer`, `prompt`, `create_task`, `bypass_slot`, `message` |
| action_config | jsonb | Aktionsdetails |
| is_active | boolean | aktiv |
| starts_at | timestamptz nullable | optional |
| ends_at | timestamptz nullable | optional |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

Indexes:

- `(tenant_id, is_active, priority)`

#### phone_lists

WIP/VIP/Bypass-Listen.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Liste |
| tenant_id | uuid fk | Mandant |
| list_type | text | `wip`, `vip`, `bypass`, `blocked` |
| name | text | Anzeigename |
| description | text | Beschreibung |
| is_active | boolean | aktiv |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

#### phone_list_entries

Eintraege in Telefonlisten.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Eintrag |
| tenant_id | uuid fk | Mandant |
| phone_list_id | uuid fk | Liste |
| phone_hash | text | Hash |
| phone_masked | text | maskierte Nummer |
| phone_encrypted | bytea nullable | optional verschluesselt |
| label | text | z. B. Apotheke |
| notes | text | interne Notiz |
| is_active | boolean | aktiv |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

## 10. Kommunikation

### 10.1 Grundsatz

Fachlogik erzeugt Kommunikationsereignisse.

Ein Routing-Layer entscheidet:

- Empfaenger,
- Kanal,
- Template,
- Fallback,
- Versandzeitpunkt,
- Wiederholung.

### 10.2 Tabellen

#### communication_events

Ausgeloeste Kommunikationsereignisse.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Event |
| tenant_id | uuid fk | Mandant |
| direction | text | `ordination`, `patient` |
| event_type | text | z. B. `callback_needed`, `appointment_confirmed` |
| source_type | text | `call`, `task`, `system`, `manual` |
| source_id | uuid nullable | Quellobjekt |
| payload | jsonb | bereinigte Variablen |
| status | text | `new`, `routed`, `sent`, `failed`, `cancelled` |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

#### communication_rules

Routingregeln fuer Kommunikation.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Regel |
| tenant_id | uuid fk | Mandant |
| direction | text | `ordination`, `patient` |
| event_type | text | Ereignis |
| priority | int | Reihenfolge |
| recipient_target | jsonb | Gruppe/Ziel |
| channel | text | `internal`, `email`, `sms`, `whatsapp`, `telegram`, `voicecall`, `webhook`, `medstar_message` |
| fallback_channel | text nullable | Fallback |
| template_id | uuid fk nullable | Vorlage |
| active_window | jsonb | Zeitfenster |
| retry_policy | jsonb | Wiederholung |
| privacy_class | text | `normal`, `sensitive`, `medical` |
| is_active | boolean | aktiv |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

Indexes:

- `(tenant_id, direction, event_type, is_active, priority)`

#### communication_templates

Nachrichtenvorlagen.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Template |
| tenant_id | uuid fk | Mandant |
| name | text | Anzeigename |
| channel | text | Kanal |
| language_code | text | Sprache |
| subject_template | text nullable | Betreff |
| body_template | text | Inhalt |
| variables_schema | jsonb | erlaubte Variablen |
| version | int | Version |
| status | text | `draft`, `active`, `archived` |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

#### communication_deliveries

Jeder Versandversuch.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Versand |
| tenant_id | uuid fk | Mandant |
| event_id | uuid fk | Event |
| channel | text | Kanal |
| provider_key | text | nur technisch, nicht UI-fachlich |
| recipient_masked | text | maskierter Empfaenger |
| recipient_hash | text | Hash |
| template_id | uuid fk nullable | Template |
| template_version | int nullable | Version |
| status | text | `planned`, `sent`, `delivered`, `failed`, `cancelled` |
| error_code | text nullable | Fehler |
| error_message | text nullable | Fehlertext |
| scheduled_at | timestamptz nullable | geplant |
| sent_at | timestamptz nullable | gesendet |
| delivered_at | timestamptz nullable | zugestellt |
| created_at | timestamptz | Erstellung |

Indexes:

- `(tenant_id, status, created_at desc)`
- `(tenant_id, event_id)`

## 11. Prompts, Texte, FAQ und Medikamente

#### prompt_texts

Pflegbare ARA-MED Texte.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Text |
| tenant_id | uuid fk | Mandant |
| text_key | text | z. B. `greeting_normal` |
| language_code | text | Sprache |
| body | text | Text |
| mode | text nullable | Modusbezug |
| status | text | `draft`, `active`, `archived` |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

#### knowledge_items

Praxiswissen und FAQ.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Eintrag |
| tenant_id | uuid fk | Mandant |
| category | text | Kategorie |
| question | text nullable | Frage |
| answer | text | Antwort |
| language_code | text | Sprache |
| is_active | boolean | aktiv |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

#### medications

Ordinationsweite Medikamentenliste fuer Aussprache und Bedienbarkeit, nicht als Rezeptwahrheit.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Medikament |
| tenant_id | uuid fk | Mandant |
| pznr | text nullable | PZNR |
| name | text | Name |
| voice_label | text | Aussprache |
| note | text nullable | Operator-Notiz |
| is_active | boolean | aktiv |
| created_at | timestamptz | Erstellung |
| updated_at | timestamptz | letzte Aenderung |

## 12. Statistik und Kosten

MVP-Statistiken sollten aus bestehenden Tabellen berechnet werden.

Materialisierte Views koennen spaeter ergaenzt werden:

- `daily_call_metrics`
- `daily_intent_metrics`
- `daily_automation_metrics`
- `daily_cost_metrics`

Start ohne doppelte KPI-Tabellen, ausser Performance macht Aggregation noetig.

## 13. Audit-Log

#### audit_log

Pflicht fuer kritische Aenderungen.

| Spalte | Typ | Zweck |
| --- | --- | --- |
| id | uuid pk | Audit |
| tenant_id | uuid fk nullable | Mandant, null fuer global |
| actor_user_id | uuid fk nullable | Benutzer |
| actor_type | text | `user`, `system`, `n8n` |
| action | text | z. B. `opening_hours.updated` |
| object_type | text | Tabelle/Objekttyp |
| object_id | uuid nullable | Objekt |
| old_value | jsonb nullable | alter Wert, bereinigt |
| new_value | jsonb nullable | neuer Wert, bereinigt |
| ip_address | inet nullable | IP |
| user_agent | text nullable | User-Agent |
| created_at | timestamptz | Zeitpunkt |

Indexes:

- `(tenant_id, created_at desc)`
- `(tenant_id, object_type, object_id, created_at desc)`
- `(actor_user_id, created_at desc)`

## 14. Datenschutz, Maskierung und Verschluesselung

### 14.1 Datenklassen

| Datenklasse | Speicherung | Anzeige |
| --- | --- | --- |
| Telefonnummer | Hash + maskiert, optional verschluesselt | voll nur mit Recht |
| SVNR | standardmaessig nicht speichern; falls noetig stark maskiert/verschluesselt | nur Sonderrecht |
| PID | speichern, mandantenbezogen | sichtbar mit Patientendaten-Recht |
| Audio | Object Storage Referenz | eigenes Audio-Recht |
| Transkript | Storage oder Segmente | eigenes Transkript-Recht |
| Rezeptdetails | minimiert speichern | eigenes Rezept-Recht |
| API-Keys/Tokens | Secret Store oder verschluesselt | nie im Frontend |

### 14.2 Maskierungsregeln

Serverantworten muessen bereits berechtigt und maskiert sein.

Frontend-Maskierung ist zusaetzlich, aber nicht ausreichend.

Beispiele:

- Telefonnummer ohne Recht: `+43 *** *** 123`
- SVNR: standardmaessig nicht anzeigen.
- Audio-URL: nur zeitlich begrenzte signierte URL.
- Transkript: ohne Recht nicht ausliefern.

## 15. API- und Backend-Schnittstellen

### 15.1 Dashboard API

Empfohlene Ressourcen:

- `GET /api/dashboard/summary`
- `GET /api/calls`
- `GET /api/calls/:id`
- `PATCH /api/calls/:id/classification`
- `GET /api/inbox`
- `PATCH /api/inbox/:id`
- `POST /api/inbox/:id/comments`
- `GET /api/settings/opening-hours`
- `PUT /api/settings/opening-hours`
- `GET /api/settings/appointment-types`
- `PATCH /api/settings/appointment-types/:id`
- `GET /api/communication/rules`
- `POST /api/communication/rules`
- `PATCH /api/communication/rules/:id`
- `GET /api/communication/templates`
- `POST /api/communication/templates`
- `PATCH /api/communication/templates/:id`
- `GET /api/users`
- `POST /api/users/invite`
- `PATCH /api/users/:id/permissions`
- `GET /api/audit-log`

Alle Endpunkte pruefen:

- Authentifizierung.
- Mandantenzugriff.
- Modulrecht.
- Datenmaskierung.
- Auditpflicht bei Aenderungen.

### 15.2 n8n/Dashboard Events

Empfohlene Richtung n8n -> Dashboard:

- `call.started`
- `call.updated`
- `call.completed`
- `call.action.executed`
- `call.decision.trace`
- `inbox.task.created`
- `communication.event.created`
- `medstar.sync.completed`
- `system.error`

Empfohlene Richtung Dashboard -> n8n:

- Terminarten synchronisieren.
- Medstar-Profile synchronisieren.
- Test-Kommunikation ausloesen.
- Manuelle Retry-Aktion ausloesen.
- Status-/Healthcheck abfragen.

## 16. n8n, Voice und Medstar Datenfluss

### 16.1 Eingehender Call

1. Patient ruft an.
2. Voice-KI fuehrt Dialog und ruft n8n MCP-Tools auf.
3. n8n prueft Kontext, Identifikation, Oeffnungszeiten und Medstar-Aktionen.
4. n8n sendet Call-Events, Actions und Decision Trace an Dashboard API.
5. Dashboard speichert Call, Actions, Trace, ggf. Inbox-Task und Kommunikationsereignis.

### 16.2 Terminbuchung

1. Voice-KI erkennt Terminwunsch.
2. n8n holt erlaubte Medstar-Daten und filtert gegen ARA-MED Terminartenfreigabe.
3. Nur `voice_bookable` Terminarten werden angeboten.
4. Medstar fuehrt Buchung aus.
5. Dashboard protokolliert `call_action`.
6. Kommunikationsereignis `appointment_confirmed` kann erzeugt werden.

### 16.3 Rezeptanfrage

1. Voice-KI erkennt Rezeptanliegen.
2. n8n prueft aktive PID und verfuegbare Verordnungen.
3. Medstar bleibt Quelle der Rezeptmoeglichkeit.
4. Dashboard protokolliert Ergebnis und ggf. offene Aufgabe.

### 16.4 Nicht loesbarer Fall

1. n8n/Voice erkennt unklaren Intent, Identifikationsproblem oder technischen Fehler.
2. Dashboard erstellt `inbox_task`.
3. Kommunikationsrouting informiert Ordination ueber gewaehlten Kanal.
4. Aufgabe wird im Dashboard bearbeitet und auditiert.

## 17. MVP-Akzeptanzkriterien

### 17.1 Betrieb

- Ein Mandant kann ARA-MED aktivieren, pausieren und in Sondermodi setzen.
- Oeffnungszeiten und Sondertage koennen gepflegt werden.
- Vertretungsmodus kann konfiguriert werden.

### 17.2 Nachvollziehbarkeit

- Jeder Call ist im Call-Log sichtbar.
- Call-Detail zeigt Audio, Transkript, Zusammenfassung, Aktionen und Fehler nur bei passenden Rechten.
- Decision Trace zeigt die wichtigsten Entscheidungen.
- Telefonnummern-Historie ist ueber Hash nachvollziehbar, ohne Nummern unnoetig offenzulegen.

### 17.3 Inbox

- Offene Faelle werden automatisch als Aufgaben angelegt.
- Aufgaben koennen bearbeitet, kommentiert, abgeschlossen und archiviert werden.
- Kritische Faelle sind sichtbar priorisiert.

### 17.4 Konfiguration

- Medstar-Terminarten koennen synchron angezeigt werden.
- Pro Terminart ist steuerbar, ob sie sichtbar, intern oder KI-buchbar ist.
- Synonyme koennen gepflegt werden.
- Fuehrerscheinuntersuchung/PID-0-Sonderlogik ist modelliert.

### 17.5 Kommunikation

- Kommunikationsereignisse koennen aus Calls und Aufgaben entstehen.
- Regeln bestimmen Kanal, Empfaenger und Template.
- Jeder Versandversuch wird protokolliert.
- Provider bleiben im Praxis-Frontend unsichtbar.

### 17.6 Rechte und Audit

- Benutzer koennen Rollen und Modulrechte erhalten.
- Delegationsregel wird serverseitig geprueft.
- Sensible Felder werden serverseitig maskiert.
- Kritische Aenderungen erzeugen Audit-Log-Eintraege.

## 18. Nicht-Ziele fuer v1

Nicht im ersten technischen MVP:

- vollstaendige Rule Engine mit beliebigen Bedingungen.
- komplexer Layer-Kalender.
- Multi-Profil UI fuer Aerztezentren.
- automatisiertes Billing.
- KI-Optimierungsempfehlungen.
- vollstaendige BI-Schicht.
- Omnichannel-Kampagnenlogik.
- Provider-spezifische Konfiguration fuer Ordinationsbenutzer.

## 19. Risiken und Gegenmassnahmen

| Risiko | Gegenmassnahme |
| --- | --- |
| Datenschutz wird spaeter nachgeruestet | RBAC, Maskierung, Audit und `tenant_id` sofort einbauen |
| Dashboard dupliziert Medstar-Logik | Medstar bleibt Quelle der Wahrheit, Dashboard speichert nur Freigaben und Logs |
| Providerbindung entsteht | Event- und Adaptermodell verwenden |
| Rechte nur im Frontend | alle API-Endpunkte serverseitig pruefen |
| Call-Details werden zu gross | Audio/Transkript in Storage, DB nur Metadaten und Segmente |
| SaaS wird spaeter teuer | Mandantenmodell und tenant_id sofort |
| Kommunikationslog wird unvollstaendig | jedes Event und jeder Delivery-Versuch separat speichern |

## 20. Freigabepunkte vor Implementierung

Bitte vor Entwicklung entscheiden:

1. Wird `Next.js` als v1-Webframework freigegeben?
2. Wird `Supabase Auth/Postgres` verwendet oder ein eigenes Auth/Postgres-Setup?
3. Welche sensiblen Felder muessen wirklich verschluesselt werden?
4. Wird Audio im MVP gespeichert oder nur verlinkt?
5. Welche Kommunikationskanaele sind im MVP wirklich aktiv?
6. Welche Rollen/Rechtevorlagen sollen initial ausgeliefert werden?
7. Soll n8n Dashboard-Events aktiv an die Dashboard API senden, oder soll das Dashboard Events abholen?
8. Fuehrerschein-Sonderfall verbindlich klaeren: Prompt und Konzept verwenden `PID = 0`, `omerovic.md` enthaelt zusaetzlich die widerspruechliche Formulierung "PID muss negativ sein".
