# ARA-Med Dashboard

## What This Is

ARA-Med ist eine Multi-Tenant SaaS Voice-AI-Plattform für österreichische Arztordinationen. Das Dashboard ist die operative Steuerzentrale: Ordinationen steuern die Voice-KI (ARA-Med Voice), sehen alle eingehenden Telefonate mit Audio, Transkript und KI-Zusammenfassung ein, bearbeiten offene Aufgaben (Rückrufe, unidentifizierte Patienten, Rezeptanfragen) und konfigurieren Routing, Terminarten, Kommunikationsregeln und Benutzerverwaltung. Der erste Vertical Pack verbindet ElevenLabs Voice AI mit dem Praxissystem MEDSTAR. Die Plattform ist für den Betrieb mehrerer Mandanten auf gemeinsamer Infrastruktur ausgelegt.

## Core Value

Eine Ordination kann ARA-Med Voice AI aktivieren, alle Telefonate mit Ergebnissen in Echtzeit verfolgen und offene Aufgaben bearbeiten — ohne technisches Know-how und ohne direkte Systemzugriffe.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Ordination kann ARA-Med aktivieren und pausieren (Status-Bar, Live-Toggle)
- [ ] Ordination kann Öffnungszeiten und Vertretungszeiten pflegen
- [ ] Ordination kann erlaubte Terminarten und deren KI-Buchbarkeit steuern
- [ ] Alle Telefonate sind mit Audio, Transkript, KI-Zusammenfassung und Aktionen einsehbar
- [ ] Inbox für alle Fälle mit Handlungsbedarf (Rückruf, unidentifizierter Patient, Rezept offen)
- [ ] Interne Nachrichten und Patientenbenachrichtigungen über konfigurierbare Kommunikationsregeln
- [ ] Einfache KPIs: Anrufvolumen, Lösungsquote, häufige Intents
- [ ] Benutzerverwaltung mit rollenbasiertem Berechtigungssystem (Operator / Arzt / Assistenz / Viewer)
- [ ] Audit-Log für alle kritischen Änderungen
- [ ] Realtime-Updates im Dashboard (Pre-Call- und End-Call-Push via Supabase Realtime)
- [ ] Routing-Regeln konfigurierbar (Nummern-basiert, Intent-basiert, Zeitraum-basiert)
- [ ] Begrüßungstexte und FAQ pflegbar je Modus (Normal / Urlaub / Vertretung)
- [ ] Medikamentenliste für Rezeptlogik (globale Ordinations-Liste)
- [ ] Multi-Tenant: vollständige Mandantenisolation via tenant_id + RLS

### Out of Scope

- Vollständiger Layer-Kalender (alle 4 Layer) — Ausbaustufe 2, nicht MVP
- Komplexe Rule Engine mit bedingten Regelketten — zu komplex für MVP
- Multi-Profil-UI für Ärztezentren (mehrere MEDSTAR-Profile) — vorbereitet, nicht gebaut
- Mehrsprachige Prompt-Verwaltung im UI — Deutsch-only im MVP
- Automatisiertes Billing — manuell im MVP
- Outbound Recall / Kampagnen — nicht im MVP
- Automatische Feiertagslogik mit Sonderfällen — manuell konfigurierbar
- KI-Optimierungsempfehlungen — nicht im MVP
- Mobile App — Web-first

## Context

**Technischer Stack (festgelegt):**
- Next.js 16 + React 19 + TypeScript (strict), Tailwind CSS 4, shadcn/ui
- Supabase: Postgres + Realtime + Auth + Vault
- n8n Community Edition (Webhook-Orchestrierung — nicht sichtbar im Produkt)
- ElevenLabs Voice AI (hinter ARA-Med-Brand, niemals direkt sichtbar)
- MEDSTAR Praxisverwaltungssystem als Quelle der Wahrheit

**Architektur:**
- 3-Schichten: Voice-Ebene → n8n-Orchestrierung → Dashboard
- MEDSTAR ist Source of Truth — kein Replizieren von Patientendaten ins Dashboard
- Realtime via zwei Push-Ereignisse: Pre-Call (Webhook eingetroffen) + End-Call (Gespräch beendet)
- Alle externen API-Keys in Supabase Vault; n8n holt Keys als ersten Node-Schritt
- Intent-System: Intents als DB-Daten, Soft-to-Hard Mapping via `appointment_type_aliases`

**Markt und Kontext:**
- Österreichische Arztordinationen (Einzelpraxen bis Gruppenpraxen)
- DSGVO-konform: Telefonnummer maskiert (ohne Call-Detail-Recht), SVNR standardmäßig versteckt
- Mehrsprachigkeit vorbereitet (language_code auf allen Texten), UI MVP nur Deutsch
- Deployment: Vercel; Infrastruktur: Portainer https://194.242.35.77:9443, n8n https://n8n.srv895382.hstgr.cloud

## Constraints

- **Tech Stack**: Next.js 16 + Supabase + n8n — festgelegt, kein Wechsel
- **Multi-Tenant**: tenant_id auf jeder Tabelle, RLS auf jeder Tabelle — keine Ausnahme
- **Provider-Agnostik**: ElevenLabs, n8n, Supabase dürfen im Frontend nicht als Marke erscheinen
- **Sicherheit**: Service-Role Key nur in n8n / API Routes / Server Actions — nie im Browser
- **MEDSTAR**: Keine direkte Kommunikation im Dashboard — immer über n8n
- **DSGVO**: Telefonnummern, SVNR, Audio, Transkripte unterliegen expliziter Rechtesteuerung
- **Sprache**: UI im MVP ausschließlich Deutsch

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| MEDSTAR als Source of Truth, kein Daten-Sync | Kein Duplikat-Risiko, DSGVO-konform, kein Sync-Aufwand | — Pending |
| Supabase Realtime statt Polling | Kein wahrnehmbarer Lag im Dashboard bei Anruf-Ereignissen | — Pending |
| Intents als DB-Daten (nicht im Code) | Intents ohne Code-Deployment änderbar, Multi-Tenant-tauglich | — Pending |
| Alle Secrets in Supabase Vault | Keys nie in n8n-Nodes gespeichert, zentral rotierbar | — Pending |
| n8n als Orchestrierungs-Layer | MEDSTAR-API nie direkt aus Dashboard, Workflow-Änderungen ohne Deployment | — Pending |
| Provider-agnostische Produktmarke | Technologiepartner jederzeit austauschbar ohne Rebranding | — Pending |
| shadcn/ui + Tailwind CSS 4 | Konsistentes Design, schnelle Entwicklung, kein Custom-CSS-Overhead | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-22 after initialization*
