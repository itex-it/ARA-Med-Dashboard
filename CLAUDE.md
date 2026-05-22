# ARA-Med Dashboard — CLAUDE.md

## Projekt
Multi-Tenant SaaS Voice AI Platform für medizinische Ordinationen.
ElevenLabs Voice AI + MEDSTAR Praxisverwaltung + Next.js Dashboard.
Provider-agnostisch: im Produkt immer "ARA-MED Voice", "ARA-MED Nachricht" — nie "ElevenLabs" oder "n8n".

## Tech Stack
- Next.js 16 + React 19 + TypeScript (strict)
- Tailwind CSS 4 + shadcn/ui
- Supabase (Postgres + Realtime + Auth + Vault) — self-hosted auf 194.242.35.77
- Docker + Portainer (Deployment auf app.aramed.at via Caddy Docker Proxy)
- n8n Community Edition (Webhook-Orchestrierung)

## Projektstruktur
```
src/app/          → Next.js App Router
src/components/   → UI-Komponenten (shadcn/ui Basis)
src/lib/          → Supabase Client, Utilities, Types
supabase/         → Migrations, RLS-Policies, Seed
docs/source/      → Originaldokumente (Referenz)
docs/specs/       → Autoritative Spezifikationen (aktuelle Wahrheit)
n8n/              → Workflow-Exports
```

---

## Architekturprinzipien

### Multi-Tenant
- `tenant_id` auf jeder Tabelle — keine Ausnahme
- RLS auf jeder Tabelle — kein Bypass
- Alle API Routes validieren `tenant_id` aus JWT, nie aus Request Body

### Platform-Schichten (3 Layer)
- **Layer 1 — Core Engine:** Intent-Erkennung, Slot Filling, Eskalation (branchenagnostisch)
- **Layer 2 — Practice Type Schema:** Konfiguration pro Ordinationstyp in DB
- **Layer 3 — Tenant Config:** Praxis-spezifisch (Öffnungszeiten, Ärzte, Rufnummern)

### Intent-System
- Intents sind Daten in der DB — nie im Code
- Soft-to-Hard Mapping: natürliche Sprache → MEDSTAR API-Codes via `appointment_type_aliases`
- Tool Call feuert erst wenn `required_slots` vollständig gefüllt (Slot Filling)
- Triage vor jeder Aktion: NOTFALL → HEUTE → DRINGEND → ROUTINE
- KI erkennt Intent-Wechsel aktiv und meldet via Tool Call

### DID-Routing
- Fall 1: DID → spezifischer Arzt → Practice Schema sofort laden
- Fall 2: DID → Hauptnummer → Department Discovery → Schema nachladen
- Fall 3: Falsche Abteilung → KI informiert + vermittelt richtige Nummer

### KI-Kontext (Token-Budget)
- System Prompt gesamt: < 700 Token
- Always-On (~300 Token): Rolle + heutige Öffnungszeiten + Intent-Liste + Eskalationsnummer
- On-Demand nach Intent-Erkennung: Business Rules + required_slots
- On-Demand nach Patientenidentifikation: nächster Termin + Medikation + bekannt/neu Flag

### Realtime
- Supabase Realtime für alle Live-Updates (Call-Log, Status-Bar)
- Kein Polling

---

## Datenmodell-Regeln

### Pflichtfelder jeder Tabelle
```sql
tenant_id  uuid NOT NULL references tenants(id)
created_at timestamptz DEFAULT now()
-- RLS: auth.jwt() ->> 'tenant_id' = tenant_id
```

### Kerntabellen Intent-Engine
```
intent_definitions       → Intents pro Practice Type
intent_aliases           → natürliche Sprache → Intent
intent_routing_rules     → Business Rules (allow_booking, escalate...)
intent_action_mappings   → collected_context → MEDSTAR Parameter
appointment_type_aliases → "Bauchweh" → MEDSTAR appointment_type_code
```

### Kerntabellen Conversation
```
conversation_memory  → phone_hash + PID-Cache (15min TTL) + last_language
session_store        → große Laufzeit-Daten (slots, medication_list) — nie im Prompt
call_log             → jeder Anruf: Intent, Dauer, Status
call_actions         → Aktionen pro Anruf (Termin, Rezept, Storno...)
conversation_events  → jeder Turn — vollständiger Audit-Trail
```

### n8n Multi-Tenant Key Management
- Alle externen API-Keys in Supabase Vault
- Key-Format: `medstar_key_{tenant_id}`, `elevenlabs_key_{tenant_id}`
- n8n hat einen Supabase Service-Role-Key
- Erster Node jedes Workflows: Key aus Vault holen → als Variable weitergeben
- Keys niemals direkt in n8n Workflow-Nodes

---

## Coding Guidelines

### TypeScript
- `strict: true` — keine Ausnahmen
- Keine `any` — immer explizite Typen
- Supabase Types aus `supabase gen types typescript`

### Komponenten
- Server Components by default
- `'use client'` nur wenn zwingend nötig
- shadcn/ui als Basis

### Supabase
- Service-Role Key nur in: n8n, API Routes, Server Actions — nie im Frontend
- Realtime-Subscriptions nur in Client Components

### API Routes
- Zod-Validierung auf allen Inputs
- Keine direkte MEDSTAR-Kommunikation — immer über n8n

### n8n Workflows
- Node 1: Key aus Vault holen
- Node 2: tenant_id + DID validieren
- Fehler immer explizit behandeln — kein stilles Scheitern
- Exports versioniert in `/n8n/`

---

## Tool Response Format (Standard für alle n8n Tools)

```javascript
{
  ok: true,
  nextAction: "CONTINUE | ASK_* | ESCALATE | OFFER_CALLBACK",
  session_id: "uuid",          // KI trägt durch alle Turns

  speak_hint: "...",           // KI formuliert in eigenen Worten
  // ODER
  speak_verbatim: "<Exakter Pflichttext der gesprochen werden muss.>",

  // Aufzählungen mit Referenz
  items: [
    { ref: 1, label: "Metformin 500mg", phonetic: "Met-for-min", pzn: "1234567" },
    { ref: 2, label: "Ramipril 5mg",    phonetic: "Ra-mi-pril",  pzn: "7654321" }
    // Termine: { ref, label, phonetic?, slot_id }
  ]
}
```

**Regeln:**
- `speak_hint`: KI formuliert selbst — natürlicher Klang
- `speak_verbatim`: exakter Text in `<>` — für DSGVO-Hinweise, Rechtliches
- `items[].phonetic`: KI spricht Lautschrift, nicht Label — für Medikamentennamen
- `items[].ref`: Patient sagt "das zweite" → ref 2 → PZN/slot_id als harter Key
- Niemals ISO-Timestamps in Sprachtexten — immer "Montag, 12. März um 9 Uhr"
- Niemals Abkürzungen in Sprachtexten

---

## Sicherheit

### API Keys
- Externe Keys (MEDSTAR, ElevenLabs) nur in Supabase Vault
- n8n: erster Node = Key aus Vault holen
- Service-Role Key nur server-seitig

### Audit-Trail
- Jeder MEDSTAR-Aufruf → Eintrag in `call_actions`
- Jeder Tool Call → Eintrag in `conversation_events`

---

## Referenzen

### Spezifikationen (docs/specs/)
- `product-spec.md` — Produktspezifikation, 10 Module, RBAC
- `technical-architecture.md` — Stack, DB-Schema, Multi-Tenant
- `intent-engine.md` — Platform-Ansatz, 3-Layer, DID-Routing, Slot Filling
- `session-management.md` — Multi-Intent, Speech Pattern, Tool Response
- `medstar-api.md` — alle Endpoints, PID-Logik, Key-Management
- `medical-practice-requirements.md` — alle 8 Ordinationstypen, Business Rules

### Infrastruktur
- Portainer: https://194.242.35.77:9443 (Endpoint ID: 3)
- Reverse Proxy: lucaslorentz/caddy-docker-proxy — externes Docker-Netzwerk `caddy`
- Supabase: self-hosted auf 194.242.35.77 (Stack `supabase`)
- n8n: https://n8n.srv895382.hstgr.cloud
- GitHub: github.com/itex-it/ARA-Med-Dashboard
- Container Image: ghcr.io/itex-it/ara-med-dashboard:latest
- Dashboard URL: https://app.aramed.at

### Deployment-Pattern
- `Dockerfile` — multi-stage Next.js standalone build
- `docker-compose.yml` — Portainer Stack-Datei mit Caddy-Labels
- `next.config.ts` — `output: 'standalone'` erforderlich für Docker standalone build
- Caddy-Labels: `caddy: app.aramed.at` + `caddy.reverse_proxy: "{{upstreams 3000}}"`
- Netzwerk `caddy` ist extern (von caddy-docker-proxy Stack verwaltet)

### Sophie als Konzept-Referenz (nicht Code-Referenz)
- Intent-Schema Struktur: `intent_definitions`, `intent_aliases`, `intent_routing_rules`
- Soft-to-Hard Mapping Pattern: `svc_package_aliases` → hier `appointment_type_aliases`
- Tool Response Pattern: `ok`, `speak_hint`, `nextAction`, `items[]`
