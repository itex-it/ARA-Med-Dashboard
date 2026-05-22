# Requirements: ARA-Med Dashboard

**Defined:** 2026-05-22
**Core Value:** Eine Ordination kann ARA-Med Voice AI aktivieren, alle Telefonate mit Ergebnissen in Echtzeit verfolgen und offene Aufgaben bearbeiten — ohne technisches Know-how.

## v1 Requirements

### Authentication (AUTH)

- [ ] **AUTH-01**: User kann sich mit E-Mail und Passwort einloggen
- [ ] **AUTH-02**: User kann sich von jeder Seite ausloggen
- [ ] **AUTH-03**: User kann das Passwort via E-Mail-Link zurücksetzen
- [ ] **AUTH-04**: Operator und Arzt/Admin müssen vor Dashboard-Zugriff TOTP-2FA abschließen (AAL2 via Supabase MFA)
- [ ] **AUTH-05**: User-Session bleibt über Browser-Refresh hinweg aktiv (Supabase Auth Cookie)
- [ ] **AUTH-06**: Beim Entziehen von Rollen/Rechten wird die aktive Session des betroffenen Users serverseitig sofort invalidiert

### Multi-Tenant Foundation (TENANT)

- [ ] **TENANT-01**: Alle Datenbankabfragen sind auf den Mandanten des eingeloggten Users begrenzt — tenant_id kommt ausschließlich aus dem JWT (nie aus dem Request Body)
- [ ] **TENANT-02**: Row-Level Security (RLS) ist auf jeder Tabelle aktiv und erzwingt Mandantenisolation
- [ ] **TENANT-03**: Operator kann einen Mandanten konfigurieren: Hostname, MEDSTAR-Server/API-Konfiguration, Fallback-Adressen, Weiterleitungsnummern
- [ ] **TENANT-04**: API-Keys (MEDSTAR, ElevenLabs) werden ausschließlich im Supabase Vault gespeichert und sind im Frontend nicht sichtbar
- [ ] **TENANT-05**: Aktive Features pro Mandant sind durch den Operator konfigurierbar

### Status Bar (STATUS)

- [ ] **STATUS-01**: ARA-Med-Status ist auf jeder Seite sichtbar (aktiv / pausiert / gestört)
- [ ] **STATUS-02**: Praxisstatus ist auf jeder Seite sichtbar (geöffnet / geschlossen / Sondermodus)
- [ ] **STATUS-03**: Aktiver Modus ist sichtbar (Normal / Urlaub / Vertretung / Überlastung)
- [ ] **STATUS-04**: Anzahl offener Aufgaben ist auf jeder Seite als Zähler sichtbar
- [ ] **STATUS-05**: Berechtigter User kann ARA-Med via Live-Toggle sofort aktivieren oder pausieren

### Call Log (CALL)

- [ ] **CALL-01**: User kann eine chronologische Liste aller Gespräche des Mandanten einsehen
- [ ] **CALL-02**: Jeder Call-Eintrag zeigt: Zeitstempel, maskierte Telefonnummer, Dauer, Patient erkannt (ja/nein), PID-Status, Intent/Subintent, erkannte Sprache, Status (gelöst/offen/weitergeleitet/fehlgeschlagen/abgebrochen)
- [ ] **CALL-03**: User mit Call-Detail-Recht kann die vollständige (unmaskierte) Telefonnummer einsehen
- [ ] **CALL-04**: Ausgeführte Aktionen pro Gespräch sind sichtbar (Termin gebucht/storniert/verschoben, Rezept bestellt, Nachricht erstellt, Weiterleitung, Notfallhinweis)
- [ ] **CALL-05**: User mit Audio-Recht kann die Gesprächsaufzeichnung direkt im Browser abspielen (Audio-Player, signierte URL, kein permanenter Link)
- [ ] **CALL-06**: User mit Transkript-Recht kann das vollständige Text-Transkript einsehen
- [ ] **CALL-07**: User kann die KI-generierte Zusammenfassung einsehen (summary_short und summary_structured mit intent_main, actions_done, open_items, callback_needed)
- [ ] **CALL-08**: User kann interne Notizen zu einem Gespräch hinzufügen und Intent-Kategorie manuell korrigieren
- [ ] **CALL-09**: User kann ein Gespräch mit Feedback markieren (korrekt / falsch erkannt / Training nötig)
- [ ] **CALL-10**: Call-Detail zeigt den KI-Entscheidungsweg und ausgeführte MEDSTAR-Aktionen mit API-Antwortstatus

### Inbox und Aufgabenverwaltung (INBOX)

- [ ] **INBOX-01**: Alle Gespräche mit Handlungsbedarf erscheinen in der Inbox
- [ ] **INBOX-02**: Inbox-Fälle umfassen: Patient nicht identifizierbar, ungültige/inaktive PID, mehrere Treffer, Rückruf notwendig, Rezept nicht möglich, unklarer Intent, Notfall-/Akutfall-Hinweis, technische Fehler
- [ ] **INBOX-03**: Jeder Inbox-Fall hat einen Lifecycle-Status: offen / in Bearbeitung / erledigt / archiviert
- [ ] **INBOX-04**: User kann einen Fall durch die Lifecycle-Zustände führen
- [ ] **INBOX-05**: User kann interne Notizen zu Inbox-Fällen hinzufügen

### Öffnungszeiten und Kalender (HOURS)

- [ ] **HOURS-01**: User kann wöchentliche Öffnungszeiten (Tage und Uhrzeiten) für den Mandanten konfigurieren
- [ ] **HOURS-02**: User kann Sondertage und Ausnahmen anlegen (Schließungen, Feiertage, Sonderzeiten)
- [ ] **HOURS-03**: User kann Vertretungszeiträume mit Start- und Enddatum konfigurieren

### Terminarten (APPT)

- [ ] **APPT-01**: MEDSTAR-Terminarten werden synchron angezeigt
- [ ] **APPT-02**: User kann je Terminart festlegen: sichtbar / KI-buchbar / nur intern
- [ ] **APPT-03**: User kann Synonyme und typische Formulierungen einer Terminart zuordnen
- [ ] **APPT-04**: User kann eine Standard-Terminart für unklare Beschwerden konfigurieren
- [ ] **APPT-05**: Führerscheinuntersuchung ist mit PID=0-Regel konfigurierbar

### Routing (ROUTE)

- [ ] **ROUTE-01**: User kann Routing-Regeln konfigurieren (Telefonnummern-basiert, Prompt/Intent-basiert, Zeitraum-basiert, Modus-basiert)
- [ ] **ROUTE-02**: Je Routing-Regel ist eine Aktion konfigurierbar: direkt verbinden / eigenen Prompt / Ticket erstellen / Bypass-Slot anbieten / an Nummer weiterleiten / Nachricht aufnehmen
- [ ] **ROUTE-03**: VIP/WIP-Nummern können konfiguriert werden, sodass Anrufe immer durchgestellt werden

### Kommunikationsregeln (COMM)

- [ ] **COMM-01**: User kann interne Benachrichtigungsregeln konfigurieren (Ereignisse an Inbox, E-Mail, Telegram, SMS etc.)
- [ ] **COMM-02**: User kann Patientenbenachrichtigungsregeln konfigurieren (Terminbestätigung, -erinnerung, -absage, Rezepteingang)
- [ ] **COMM-03**: Kommunikationsregel enthält: Ereignistyp, Richtung, Kanal, Fallback-Kanal, Template, Priorität, Zeitfenster, Wiederholungslogik, max. Versuche, Datenschutzklasse
- [ ] **COMM-04**: Jeder Versandversuch wird protokolliert: Ereignis, Kanal, Empfänger (maskiert), Template-Version, Status, Fehlergrund, Zeitpunkt
- [ ] **COMM-05**: User kann Nachrichtenvorlagen verwalten (Variablen: patient_name, appointment_date, appointment_type, practice_name, callback_phone; Sprachversionen über language_code)

### Begrüßungstexte und FAQ (TEXT)

- [ ] **TEXT-01**: User kann Begrüßungstexte je Modus konfigurieren (Normal / Urlaub / Vertretung / Eigener Vertretungsdienst)
- [ ] **TEXT-02**: EU-KI-Gesetz Art. 50 Offenlegungshinweis ist in Begrüßungstexten erzwungen und kann nicht entfernt werden
- [ ] **TEXT-03**: User kann FAQ-Antworten pflegen (Parkmöglichkeiten, Adresse, Kasseninformation, Untersuchungsvorbereitung, Standardantworten)
- [ ] **TEXT-04**: Begrüßungstexte unterstützen mehrere Sprachen (language_code); Deutsch als Standard

### Vertretungsmanagement (DEPUTY)

- [ ] **DEPUTY-01**: User kann einen Vertretungsarzt anlegen (Name, Begrüßungstext, Weiterleitungsnummer)
- [ ] **DEPUTY-02**: User kann einem Vertretungsarzt einen Kalender-Zeitraum zuordnen
- [ ] **DEPUTY-03**: Vertretungsmodus hat konfigurierbares Verhalten für Nicht-Patienten (PID=0)
- [ ] **DEPUTY-04**: Modus "Eigener Vertretungsdienst" mit separatem Prompt und PID=0-Speziallogik ist konfigurierbar

### Medikamentenliste (MED)

- [ ] **MED-01**: Operator kann eine globale Medikamentenliste für die Ordination verwalten (PZNR, Name, Aussprache-Feld für Voice-KI, aktiv/inaktiv, Notiz)

### Statistiken und KPIs (STAT)

- [ ] **STAT-01**: User kann Anrufvolumen nach Tag/Woche/Monat und durchschnittliche Gesprächsdauer einsehen
- [ ] **STAT-02**: User kann Quote automatisch gelöster Anrufe und Weiterleitungsquote einsehen
- [ ] **STAT-03**: User kann Anzahl offener Aufgaben, gebuchte Termine und Rezeptanfragen einsehen
- [ ] **STAT-04**: User kann häufigste Intents und kritische/eskalierte Fälle einsehen
- [ ] **STAT-05**: User kann geschätzte eingesparte Telefonzeit einsehen

### Benutzerverwaltung und RBAC (RBAC)

- [ ] **RBAC-01**: Operator kann Mandanten verwalten und Arzt/Admin-User zuweisen
- [ ] **RBAC-02**: Arzt/Admin kann Assistenz- und Viewer-User für seinen Mandanten verwalten
- [ ] **RBAC-03**: Jeder User hat eine Rolle (Operator / Arzt+Ordinationsadmin / Ordinationsassistenz / Viewer)
- [ ] **RBAC-04**: Feingranulare Modulrechte sind je User konfigurierbar (none/view/edit/manage/admin je Kategorie: Dashboard-Übersicht, Telefonate, Audio, Transkripte, Patientendaten, Inbox/Aufgaben, Termine, Rezepte, Routing, Kommunikation, Kommunikations-Templates, Öffnungszeiten, Vertretung, Prompts/Texte, Training/FAQ, Statistiken, Kosten, Benutzerverwaltung, System-Settings, Audit-Log)
- [ ] **RBAC-05**: Ein User kann maximal die Rechte vergeben, die er selbst besitzt (Delegationsregel, serverseitig erzwungen)
- [ ] **RBAC-06**: Rollen- und Rechtprüfung erfolgt ausschließlich serverseitig auf jeder API Route / Server Action

### Audit-Log (AUDIT)

- [ ] **AUDIT-01**: Alle kritischen Änderungen werden protokolliert: Benutzerverwaltung, Rechteänderungen, ARA aktiviert/deaktiviert, Öffnungszeiten, Routing-Regeln, Kommunikationsregeln, Templates, Terminart-Konfiguration, Vertretungsmodus, Prompts, API-/System-Settings
- [ ] **AUDIT-02**: Jeder Audit-Eintrag enthält: Mandant, User, Aktion, Objekt, alter Wert, neuer Wert, Zeitpunkt, IP/User-Agent
- [ ] **AUDIT-03**: Operator und Arzt/Admin können den Audit-Log einsehen

### Realtime-Updates (REALTIME)

- [ ] **REALTIME-01**: Call-Log aktualisiert sich in Echtzeit, sobald ein neues Gespräch eintrifft (Pre-Call Push via Supabase Realtime)
- [ ] **REALTIME-02**: Call-Log-Eintrag wird in Echtzeit mit vollständigen Ergebnisdaten aktualisiert, wenn ein Gespräch endet (End-Call Push)
- [ ] **REALTIME-03**: Offener-Aufgaben-Zähler in der Status-Bar aktualisiert sich in Echtzeit bei neuen Inbox-Einträgen

---

## v2 Requirements

### Kalender (Layer 2-4)

- **KAL-01**: Vollständiger Layer-Kalender mit Sondertagen, Feiertagen, Terminart-Overrides (Layer 2)
- **KAL-02**: Vertretungszeitraum-Layer mit UI-Kalenderansicht (Layer 3)
- **KAL-03**: Bypass-/Privatleistungsslots mit eigenem Routing, Caller-Filter, kein MEDSTAR-API-Call (Layer 4)

### Erweiterte Konfiguration

- **CFG-01**: Komplexe Rule Engine mit bedingten Regelketten
- **CFG-02**: Multi-Profil-UI für Ärztezentren (mehrere MEDSTAR-Profile pro Mandant)
- **CFG-03**: Mehrsprachige Prompt-Verwaltung im UI (über Deutsch hinaus)
- **CFG-04**: Automatische Feiertagslogik mit österreichischen Bundesländer-Sonderfällen

### Kommunikation und Kampagnen

- **OUT-01**: Outbound Recall (KI ruft Patient zurück)
- **OUT-02**: Omnichannel-Kampagnen (Erinnerungs-Serien, Nachfolge-Nachrichten)
- **OUT-03**: WhatsApp Business API (Meta-approved Templates, Consent-Workflow)

### Monetarisierung

- **BILL-01**: Automatisiertes Billing (Verbrauch, Guthaben, Abrechnung)
- **BILL-02**: KI-Optimierungsempfehlungen basierend auf Call-Daten

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Direkte MEDSTAR-Kommunikation aus dem Dashboard | Immer über n8n — kein direkter API-Call im Frontend |
| Mobile App | Web-first; mobiles Responsive-Design ausreichend für MVP |
| Real-time Chat zwischen Praxis und Patienten | Nicht im Produkt-Scope; komplexe Consent-Anforderungen |
| SVNR im Dashboard speichern | Nur in MEDSTAR — nicht in der Dashboard-DB |
| Video-Integration | Nicht im Produkt-Scope |
| SSO/OAuth für Ordinationsmitarbeiter (OIDC) | Vorbereitet, nicht gebaut — Magic Link reicht für MVP |
| Öffentliche Patienten-Selfservice-Seite | Nicht im Scope — KI-Telefonie ist der Kanal |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 bis AUTH-06 | Phase 1 | Pending |
| TENANT-01 bis TENANT-05 | Phase 1 | Pending |
| REALTIME-01 bis REALTIME-03 | Phase 2 | Pending |
| STATUS-01 bis STATUS-05 | Phase 3 | Pending |
| CALL-01 bis CALL-10 | Phase 3 | Pending |
| INBOX-01 bis INBOX-05 | Phase 4 | Pending |
| HOURS-01 bis HOURS-03 | Phase 5 | Pending |
| APPT-01 bis APPT-05 | Phase 5 | Pending |
| TEXT-01 bis TEXT-04 | Phase 5 | Pending |
| DEPUTY-01 bis DEPUTY-04 | Phase 5 | Pending |
| MED-01 | Phase 5 | Pending |
| ROUTE-01 bis ROUTE-03 | Phase 6 | Pending |
| COMM-01 bis COMM-05 | Phase 6 | Pending |
| STAT-01 bis STAT-05 | Phase 7 | Pending |
| RBAC-01 bis RBAC-06 | Phase 7 | Pending |
| AUDIT-01 bis AUDIT-03 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 73 total
- Mapped to phases: 73
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-22*
*Last updated: 2026-05-22 after initial definition from product-spec.md*
