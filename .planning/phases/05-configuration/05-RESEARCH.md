# Phase 5: Configuration — Research

**Researched:** 2026-05-23
**Domain:** Multi-entity configuration forms (opening hours, appointment types, greeting texts, deputy management, medications) with EU AI Act compliance enforcement, Supabase Postgres backend, Next.js 16 + React 19 Server Actions
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from locked architecture decisions — STATE.md)

### Locked Decisions

- **Multi-tenant:** `tenant_id` on every table, RLS on every table — no exceptions
- **RLS pattern:** Always `(SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id` — never the uncached per-row form
- **tenant_id source:** JWT `app_metadata` only — never from request body or form
- **Service-Role Key:** Never in browser. Only in Server Actions / API Routes. `createServiceRoleClient()` is synchronous; `createServerClient()` is async (must `await`)
- **Form pattern:** Server Component page → props → Client Component form using `useActionState` (React 19) → `'use server'` Server Action with Zod, auth check, tenant_id from JWT
- **Composite indexes:** `CREATE INDEX idx_{table}_tenant_created ON {table} (tenant_id, created_at DESC)` — WITHOUT CONCURRENTLY
- **Migrations:** `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`
- **Optimistic toggles:** `useOptimistic` + `useTransition` — matches Phase 3 Switch pattern
- **UI language:** German only (de-AT). Never "ElevenLabs" or "n8n" in UI. Always "ARA-MED Voice" or "ARA-MED"
- **shadcn preset:** new-york / neutral / CSS variables

### Claude's Discretion

- Number of migration files (can split per entity or group logically)
- Number of plans (UI-SPEC suggests 5 modules; plan breakdown is implementation decision)
- Exact Server Action file organization (one per module or grouped)
- Whether to use URL search param or client-state for sub-tab in Begrüßungstexte module

### Deferred Ideas (OUT OF SCOPE for Phase 5)

- Multi-language prompt management UI (TEXT-04 scoped to Deutsch only for MVP; data model supports language_code but UI selector shows only "Deutsch (Standard)")
- Layer calendar (v2: KAL-01..03)
- Complex routing rule engine (Phase 6)
- Communication templates (Phase 6)
- RBAC granular permission UI (Phase 7)
- Automatic Austrian holiday logic (v2: CFG-04)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOURS-01 | User kann wöchentliche Öffnungszeiten (Tage und Uhrzeiten) für den Mandanten konfigurieren | DB: `opening_hours` table with weekday/time rows per tenant; Server Action upserts all 7 rows atomically |
| HOURS-02 | User kann Sondertage und Ausnahmen anlegen (Schließungen, Feiertage, Sonderzeiten) | DB: `special_days` table; add/delete rows; Calendar + Popover UI |
| HOURS-03 | User kann Vertretungszeiträume mit Start- und Enddatum konfigurieren | DB: `deputy_periods` join table (not the same as deputy doctors); separate from DEPUTY-01..04 |
| APPT-01 | MEDSTAR-Terminarten werden synchron angezeigt | `appointment_types` table seeded/synced per tenant from MEDSTAR; Server Action re-fetches; MVP: static config |
| APPT-02 | User kann je Terminart festlegen: sichtbar / KI-buchbar / nur intern | Boolean columns on `appointment_types`; Switch toggles via per-row Server Action |
| APPT-03 | User kann Synonyme und typische Formulierungen einer Terminart zuordnen | `appointment_type_synonyms` table; upsert by appointment_type_code |
| APPT-04 | User kann eine Standard-Terminart für unklare Beschwerden konfigurieren | `is_default` boolean on `appointment_types`; one row per tenant can be default |
| APPT-05 | Führerscheinuntersuchung ist mit PID=0-Regel konfigurierbar | `pid_zero_allowed` boolean on `appointment_types` |
| TEXT-01 | User kann Begrüßungstexte je Modus konfigurieren (Normal / Urlaub / Vertretung / Eigener Vertretungsdienst) | `greeting_texts` table keyed on (tenant_id, mode, language_code); upsert on save |
| TEXT-02 | EU-KI-Gesetz Art. 50 Offenlegungshinweis ist in Begrüßungstexten erzwungen und kann nicht entfernt werden | Enforced at Server Action level — disclosure stored as separate locked column OR checked before DB write; UI shows read-only block |
| TEXT-03 | User kann FAQ-Antworten pflegen (Parkmöglichkeiten, Adresse, Kasseninformation, etc.) | `faq_entries` table with (tenant_id, mode, question, answer, active, sort_order) |
| TEXT-04 | Begrüßungstexte unterstützen mehrere Sprachen (language_code); Deutsch als Standard | `language_code` column on `greeting_texts`; MVP: only 'de' in UI; data model supports future languages |
| DEPUTY-01 | User kann einen Vertretungsarzt anlegen (Name, Begrüßungstext, Weiterleitungsnummer) | `deputy_doctors` table; CRUD |
| DEPUTY-02 | User kann einem Vertretungsarzt einen Kalender-Zeitraum zuordnen | Date range columns on `deputy_doctors` OR separate `deputy_periods` linked to deputy_doctor_id |
| DEPUTY-03 | Vertretungsmodus hat konfigurierbares Verhalten für Nicht-Patienten (PID=0) | `pid_zero_behavior` enum column on `deputy_doctors` |
| DEPUTY-04 | Modus "Eigener Vertretungsdienst" mit separatem Prompt und PID=0-Speziallogik ist konfigurierbar | `own_service_active` boolean + `own_service_prompt` text + `own_service_pid_zero_behavior` on `deputy_doctors` |
| MED-01 | Operator kann eine globale Medikamentenliste für die Ordination verwalten (PZNR, Name, Aussprache, aktiv/inaktiv, Notiz) | `medications` table; full CRUD with inline edit form |
</phase_requirements>

---

## Summary

Phase 5 is the largest configuration phase in the MVP. It introduces six new database tables, five configuration modules under a tabbed UI at `/konfiguration`, and seventeen requirements. Every module follows the same established pattern: Server Component page fetches data and tenant context, Client Component renders the form with `useActionState`, and Server Actions with Zod validation + service-role Supabase writes handle all mutations.

The critical compliance constraint is EU AI Act Article 50 disclosure enforcement in greeting texts. This must be server-enforced — the Server Action must reject any save that attempts to clear the disclosure flag, and the UI must show the disclosure as a locked, non-editable block. The UI-SPEC locks the verbatim disclosure text and interaction pattern.

The MEDSTAR appointment types integration for MVP is intentionally simplified: the tenant admin has an `appointment_types` table seeded at tenant creation (or synced on demand), and the dashboard provides UI to configure per-type flags and synonyms. No direct MEDSTAR API call from the browser is ever made — the spec says all MEDSTAR communication goes through n8n.

**Primary recommendation:** Build Phase 5 as five plans aligned to the five UI modules (Öffnungszeiten, Terminarten, Begrüßungstexte, Vertretung, Medikamente). A Wave 0 plan creates all six tables in a single migration file. Each subsequent plan delivers one module end-to-end: migration additions (if needed), Server Action(s), Client Component, and page integration.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Opening hours weekly schedule | API / Backend (Server Action) | Database | Business logic (7-row upsert pattern) lives in Server Action; UI is pure display |
| Special days CRUD | API / Backend (Server Action) | Database | Insert/delete single rows; date validation in Server Action |
| Deputy period ranges | API / Backend (Server Action) | Database | Date range validation (end >= start) enforced server-side |
| Appointment type flag toggles | API / Backend (Server Action) | Database | Per-row PATCH; optimistic UI update in frontend |
| Synonym editing | API / Backend (Server Action) | Database | Upsert synonyms table by (tenant_id, appointment_type_code) |
| Default appointment type | API / Backend (Server Action) | Database | Transaction: clear all is_default, set one — must be atomic |
| Greeting text save | API / Backend (Server Action) | Database | EU AI Act compliance check in Server Action before write |
| EU AI Act disclosure enforcement | API / Backend (Server Action) | — | Server Action is the enforcement point — UI lock is UX only |
| FAQ entry CRUD | API / Backend (Server Action) | Database | Standard insert/delete pattern |
| Deputy doctor CRUD | API / Backend (Server Action) | Database | Form with multiple fields; date range validation |
| Medication CRUD | API / Backend (Server Action) | Database | Standard CRUD; PZN format validation (7 digits) in Zod |
| Tab navigation state | Browser / Client | — | URL search param `?tab=` synced via router; no server involvement |
| Optimistic Switch toggles | Browser / Client | API / Backend | `useOptimistic` + `useTransition` with server confirmation |

---

## Standard Stack

### Core (already installed — no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | ^16.2.6 | App Router, Server Actions, Server Components | Project stack (locked) |
| `react` | ^19.1.0 | `useActionState`, `useOptimistic`, `useTransition` | Project stack (locked) |
| `zod` | ^4.4.3 | Server Action input validation | Project standard (all prior phases) |
| `@supabase/ssr` | ^0.6.1 | `createServerClient()`, `createServiceRoleClient()` | Project standard |
| `lucide-react` | ^1.16.0 | Icons (Trash2, Pencil, Plus, Lock, RefreshCw, etc.) | Project standard (shadcn dependency) |

### New shadcn Components Required

Per UI-SPEC (05-UI-SPEC.md), four new shadcn components must be added before any module UI is built:

| Component | Install Command | Required By |
|-----------|-----------------|-------------|
| `calendar` | `npx shadcn add calendar` | HOURS-02 (date picker), DEPUTY-02 (date range) |
| `popover` | `npx shadcn add popover` | Calendar anchor (calendar dependency) |
| `dialog` | `npx shadcn add dialog` | Delete confirmations (medications, deputies, special days, FAQ) |
| `checkbox` | `npx shadcn add checkbox` | HOURS-01 weekday selection grid |

All from shadcn official registry — no third-party registries. [VERIFIED: 05-UI-SPEC.md Registry Safety section]

### Supporting (already installed)

| Library | Purpose | Already Present |
|---------|---------|-----------------|
| `react-hook-form` | Client-side field UX (validation display, field control) | Yes — Phase 1 |
| `@hookform/resolvers` | Zod resolver for react-hook-form | Yes — Phase 1 |
| `class-variance-authority` | Component variant management | Yes — Phase 1 |
| `tailwind-merge` | Class conflict resolution | Yes — Phase 1 |

**No new npm packages required for Phase 5.** [VERIFIED: package.json]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn `calendar` | react-day-picker directly | shadcn calendar wraps react-day-picker with project design tokens already applied — no additional configuration |
| Inline form pattern | Sheet for add forms | UI-SPEC explicitly specifies inline (Sheet reserved for full detail views, Dialog for confirmations) |
| URL search param for tab | Client useState | URL param survives refresh — required per UI-SPEC |

---

## Package Legitimacy Audit

No new npm packages are installed in Phase 5. The only additions are shadcn component registrations (which generate local source files, not npm installs). No external package legitimacy audit required.

| Package | Registry | Notes |
|---------|----------|-------|
| All required packages | Already installed | See package.json — no new dependencies |
| `calendar`, `popover`, `dialog`, `checkbox` | shadcn official registry | Not npm packages — generated local files via `npx shadcn add` |

**Packages removed due to slopcheck:** None (no new packages)
**Packages flagged as suspicious:** None

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Client Component)
  │  useActionState → formAction
  │  useOptimistic (Switch toggles)
  │  URL search param (?tab=) → tab state
  ▼
Next.js Server Action ('use server')
  │  1. Zod validate inputs
  │  2. await createServerClient() → supabase.auth.getUser()
  │  3. tenant_id from user.app_metadata.tenant_id
  │  4. Role check (operator | ordination_admin for writes)
  │  5. createServiceRoleClient() → .from(table).upsert/insert/update/delete
  │  6. Return ActionState { success, error }
  ▼
Supabase Postgres (self-hosted 194.242.35.77)
  │  RLS: (SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
  │  Tables: opening_hours, special_days, deputy_periods (HOURS)
  │          appointment_types, appointment_type_synonyms (APPT)
  │          greeting_texts, faq_entries (TEXT)
  │          deputy_doctors (DEPUTY)
  │          medications (MED)
  ▼
n8n (reads config at call time — no realtime push needed for config changes)
```

### Recommended Project Structure

```
src/
├── app/
│   └── (dashboard)/
│       └── konfiguration/
│           ├── page.tsx                      ← Server Component — reads JWT, passes tenantId
│           └── loading.tsx                   ← Optional skeleton
├── components/
│   └── config/
│       ├── OeffnungszeitenTab.tsx            ← Client Component — HOURS module
│       ├── TerminartenTab.tsx                ← Client Component — APPT module
│       ├── BegruesungsTexteTab.tsx           ← Client Component — TEXT module
│       ├── VertretungTab.tsx                 ← Client Component — DEPUTY module
│       └── MedikamenteTab.tsx                ← Client Component — MED module
└── app/
    └── actions/
        ├── opening-hours.ts                  ← 'use server' — HOURS Server Actions
        ├── appointment-types.ts              ← 'use server' — APPT Server Actions
        ├── greeting-texts.ts                 ← 'use server' — TEXT Server Actions (EU AI Act enforcement)
        ├── deputy.ts                         ← 'use server' — DEPUTY Server Actions
        └── medications.ts                    ← 'use server' — MED Server Actions
```

### Pattern 1: Multi-Row Upsert (Opening Hours Weekly Schedule)

**What:** Seven rows (one per weekday) for opening hours. User edits all 7 at once and saves. Server Action replaces all rows atomically.

**When to use:** When a fixed-cardinality set of rows represents a complete configuration (7 weekdays, not variable).

```typescript
// Source: established project pattern (see updateTenantAction, updateInboxStatusAction)
// src/app/actions/opening-hours.ts
'use server'

import { z } from 'zod'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

const weekdaySchema = z.object({
  weekday: z.number().int().min(0).max(6), // 0 = Montag, 6 = Sonntag
  open_from: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  open_until: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  is_closed: z.boolean(),
})

const openingHoursSchema = z.object({
  hours: z.array(weekdaySchema).length(7),
})

export async function saveOpeningHoursAction(
  prevState: OpeningHoursActionState,
  formData: FormData
): Promise<OpeningHoursActionState> {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Nicht authentifiziert.' }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) return { error: 'Kein Tenant zugewiesen.' }

  const araRole = user.app_metadata?.ara_role as string | undefined
  if (!['operator', 'ordination_admin'].includes(araRole ?? '')) {
    return { error: 'Unzureichende Berechtigung.' }
  }

  // Parse 7 weekday rows from formData, then:
  const serviceClient = createServiceRoleClient()
  const rows = parsed.data.hours.map(h => ({ ...h, tenant_id: tenantId }))

  const { error: dbError } = await serviceClient
    .from('opening_hours')
    .upsert(rows, { onConflict: 'tenant_id,weekday' })

  if (dbError) return { error: 'Speichern fehlgeschlagen.' }
  return { success: true }
}
```

### Pattern 2: Single-Row CRUD with Inline Add Form

**What:** Variable-length list (special days, FAQ entries, medications, deputies). Add via inline form, delete via Dialog confirmation.

**When to use:** Variable cardinality lists where items are added/removed individually.

```typescript
// Insert pattern (special days, FAQ, medications, deputies)
const { error } = await serviceClient
  .from('special_days')
  .insert({ tenant_id: tenantId, date: parsed.data.date, label: parsed.data.label, is_closed: true })

// Delete pattern (requires tenant_id filter — defense-in-depth)
const { error } = await serviceClient
  .from('special_days')
  .delete()
  .eq('id', parsed.data.id)
  .eq('tenant_id', tenantId)  // prevents cross-tenant delete via forged ID
```

### Pattern 3: EU AI Act Disclosure Enforcement

**What:** Greeting texts must always contain the EU AI Act Art. 50 disclosure. Users cannot remove it. Enforcement at Server Action level.

**When to use:** Any legally mandated content that must survive to storage.

```typescript
// src/app/actions/greeting-texts.ts
const EU_AI_ACT_DISCLOSURE = 'Sie sprechen mit einem KI-gestützten Telefonsystem.'

export async function saveGreetingTextAction(...): Promise<GreetingTextActionState> {
  // ... auth and tenant checks ...

  // EU AI Act Art. 50 enforcement — TEXT-02
  // The disclosure is stored as a separate column, not embedded in the user text.
  // The user_text field contains ONLY the editable portion.
  // The full spoken text is: disclosure + " " + user_text (assembled by n8n at call time)
  // This prevents any path (including direct API calls) from removing the disclosure.

  const { error } = await serviceClient
    .from('greeting_texts')
    .upsert({
      tenant_id: tenantId,
      mode: parsed.data.mode,
      language_code: 'de',
      eu_ai_act_disclosure: EU_AI_ACT_DISCLOSURE,  // always overwritten with locked value
      eu_ai_act_disclosure_present: true,           // always true — checked by n8n
      user_text: parsed.data.user_text,
    }, { onConflict: 'tenant_id,mode,language_code' })

  return { success: true }
}
```

**Key insight:** The disclosure is stored as a separate DB column (`eu_ai_act_disclosure`), not prepended to `user_text`. This means:
1. n8n always reads `eu_ai_act_disclosure` first, then `user_text` — never the combined string
2. Even if the API is called directly, the disclosure column is always reset to the locked value by the Server Action
3. The `eu_ai_act_disclosure_present` flag lets n8n assert the invariant and refuse to speak if somehow false

### Pattern 4: Default-One Row Pattern (Default Appointment Type)

**What:** Exactly one row in `appointment_types` per tenant must have `is_default = true`. Setting a new default must clear the old one atomically.

**When to use:** "Radio group" pattern where exactly one row in a filtered set can hold a flag.

```typescript
// APPT-04: Default appointment type — must be a transaction
// Two sequential updates wrapped in a DB function OR sequential service-role calls
// (Postgres transactions via supabase-js: use rpc or accept brief inconsistency window)

// Option A (simpler): two sequential service-role calls — acceptable for admin config
await serviceClient
  .from('appointment_types')
  .update({ is_default: false })
  .eq('tenant_id', tenantId)

await serviceClient
  .from('appointment_types')
  .update({ is_default: true })
  .eq('id', parsed.data.appointmentTypeId)
  .eq('tenant_id', tenantId)

// Option B: single upsert via SQL function (more correct)
// await serviceClient.rpc('set_default_appointment_type', { p_tenant_id: tenantId, p_id: parsed.data.appointmentTypeId })
```

The planner should choose Option A (simpler, no new DB function needed) — the brief inconsistency window is acceptable for an admin configuration action with a single user per tenant.

### Pattern 5: Optimistic Switch Toggle

**What:** Per-row boolean toggles (appointment type visibility, medication active) with instant UI feedback.

**When to use:** Matches Phase 3 `useOptimistic` + `useTransition` pattern already established.

```typescript
// Client Component — matches Phase 3 toggle pattern (STATE.md locked)
const [optimisticValue, setOptimistic] = useOptimistic(currentValue)
const [isPending, startTransition] = useTransition()

function handleToggle(newValue: boolean) {
  setOptimistic(newValue)
  startTransition(async () => {
    const result = await updateAppointmentTypeFlag({ id, field: 'is_voice_bookable', value: newValue })
    if (!result.success) {
      // Revert — useOptimistic reverts automatically when transition completes
    }
  })
}
```

### Anti-Patterns to Avoid

- **Cross-tenant delete via forged ID:** Always include `.eq('tenant_id', tenantId)` on every DELETE — not just the ID filter. A forged UUID from another tenant would otherwise succeed if RLS is bypassed by service-role.
- **Prepending disclosure to user_text:** Storing the EU AI Act disclosure as a prefix of `user_text` allows it to be overwritten. Use a separate column.
- **Storing MEDSTAR appointment type codes in formData only:** `appointment_type_code` used as the join key must be validated against the tenant's known codes in the Server Action.
- **is_default cleared before set without atomicity:** If clear and set are in separate requests, a race condition leaves no default row. Use sequential calls in a single Server Action invocation (single-user admin config — acceptable).
- **Calendar state as ISO string in formData:** German UI displays dd.MM.yyyy — always parse to ISO 8601 in Server Action before storing. Use Zod `.transform()` or server-side date parsing.
- **FAQ sort_order gaps:** After delete, sort_order values may have gaps. This is acceptable for MVP — re-ordering is v2.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date picker UI | Custom input with regex | shadcn `calendar` + `popover` | Keyboard navigation, locale formatting, accessibility — all provided |
| Delete confirmation flow | Custom confirm state | shadcn `dialog` | Focus trap, escape key, aria-modal — all provided by Radix |
| Optimistic UI for toggles | Manual state reversal | `useOptimistic` (React 19) | Built-in reversion on failed transition — matches Phase 3 pattern |
| Form validation UI | Manual error display | `useActionState` return state | Consistent error display pattern across all phases |
| Multi-row upsert loop | Sequential INSERT calls | Supabase `.upsert()` with `onConflict` | Single network round-trip; atomic at DB level |
| EU AI Act enforcement | UI-level lock only | Server Action column overwrite | UI lock is bypassable via direct API call — server enforcement is mandatory |
| Tenant isolation on DELETE | Rely on RLS with service-role | `.eq('tenant_id', tenantId)` + RLS | Service-role bypasses RLS; explicit filter is mandatory defense-in-depth |
| German date formatting | Custom format functions | `Intl.DateTimeFormat('de-AT')` | Already used in Phase 3 (`format.ts`) — no new utility needed |

**Key insight:** Every module in Phase 5 follows an established pattern from Phases 1–4. The main risk is the EU AI Act compliance enforcement — it requires server-side storage of the disclosure as a separate column, not a UI-only lock.

---

## DB Schema Design

### Table: `opening_hours` (HOURS-01)

```sql
CREATE TABLE IF NOT EXISTS public.opening_hours (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  weekday     smallint    NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=Mo, 6=So
  open_from   time,                  -- NULL when is_closed=true
  open_until  time,                  -- NULL when is_closed=true
  is_closed   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, weekday)        -- enables upsert ON CONFLICT
);
ALTER TABLE public.opening_hours ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_opening_hours_tenant_created ON public.opening_hours (tenant_id, created_at DESC);
```

**Design note:** `weekday` 0=Montag through 6=Sonntag (Monday-first, matching Austrian calendar convention). The `UNIQUE (tenant_id, weekday)` constraint is required for the upsert `onConflict: 'tenant_id,weekday'` pattern.

### Table: `special_days` (HOURS-02)

```sql
CREATE TABLE IF NOT EXISTS public.special_days (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  date        date        NOT NULL,
  label       text        NOT NULL,
  type        text        NOT NULL DEFAULT 'closure' CHECK (type IN ('closure', 'special_hours')),
  open_from   time,                  -- only if type='special_hours'
  open_until  time,                  -- only if type='special_hours'
  is_closed   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.special_days ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_special_days_tenant_created ON public.special_days (tenant_id, created_at DESC);
CREATE INDEX idx_special_days_tenant_date ON public.special_days (tenant_id, date);
```

**Design note:** Second index on `(tenant_id, date)` — n8n reads this table at call time to check if today is a special day. Date lookup must be fast.

### Table: `deputy_periods` (HOURS-03)

```sql
-- Note: HOURS-03 is "Vertretungszeiträume" in the opening hours context.
-- This is distinct from the deputy doctors managed in DEPUTY-01..04.
-- deputy_periods is a calendar range (start_date, end_date, label) managed from the
-- Öffnungszeiten tab. It tells n8n "during this period, use deputy/vacation mode."
-- The DEPUTY module (deputy_doctors table) is richer and links a named doctor + behavior.

CREATE TABLE IF NOT EXISTS public.deputy_periods (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  start_date  date        NOT NULL,
  end_date    date        NOT NULL CHECK (end_date >= start_date),
  label       text,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deputy_periods ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_deputy_periods_tenant_created ON public.deputy_periods (tenant_id, created_at DESC);
```

**Design note:** `deputy_periods` (HOURS-03) is the lightweight "when is this practice in deputy mode" calendar. It is managed from the Öffnungszeiten tab in the UI-SPEC Section C. The `deputy_doctors` table (DEPUTY-01..04) is the richer entity linking a named doctor, greeting text, forwarding number, and PID=0 behavior.

### Table: `appointment_types` (APPT-01..05)

```sql
CREATE TABLE IF NOT EXISTS public.appointment_types (
  id                   uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id            uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_type_code text       NOT NULL,  -- MEDSTAR code (source of truth)
  display_name         text        NOT NULL,  -- MEDSTAR name cached for display
  is_visible           boolean     NOT NULL DEFAULT true,   -- APPT-02: visible in AI
  is_voice_bookable    boolean     NOT NULL DEFAULT false,  -- APPT-02: AI can book
  is_internal_only     boolean     NOT NULL DEFAULT false,  -- APPT-02: internal flag
  is_default           boolean     NOT NULL DEFAULT false,  -- APPT-04: default for unclear
  pid_zero_allowed     boolean     NOT NULL DEFAULT false,  -- APPT-05: Führerschein rule
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, appointment_type_code)
);
ALTER TABLE public.appointment_types ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_appointment_types_tenant_created ON public.appointment_types (tenant_id, created_at DESC);
```

**Design note:** `is_voice_bookable` and `is_internal_only` are mutually exclusive in the UI (UI-SPEC), but the DB does not enforce this with a CHECK constraint — the Server Action enforces mutual exclusivity. Reason: CHECK constraints can make future flag additions harder; business rule enforcement at the Server Action layer is the project standard.

### Table: `appointment_type_synonyms` (APPT-03)

```sql
CREATE TABLE IF NOT EXISTS public.appointment_type_synonyms (
  id                   uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id            uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_type_code text       NOT NULL,
  synonym              text        NOT NULL,
  language_code        text        NOT NULL DEFAULT 'de',
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, appointment_type_code, synonym, language_code)
);
ALTER TABLE public.appointment_type_synonyms ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_appt_synonyms_tenant_code ON public.appointment_type_synonyms (tenant_id, appointment_type_code);
```

**Design note:** Upsert pattern via the UI sends the full synonym list for a given `appointment_type_code`, deletes old synonyms, and inserts new ones. Simpler than tracking individual synonym IDs from a textarea. Server Action: `DELETE ... WHERE tenant_id = ? AND appointment_type_code = ?`, then `INSERT ... VALUES (synonym1), (synonym2)...`

### Table: `greeting_texts` (TEXT-01..04)

```sql
CREATE TABLE IF NOT EXISTS public.greeting_texts (
  id                          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mode                        text        NOT NULL
                              CHECK (mode IN ('normal','vacation','deputy','own_service')),
  language_code               text        NOT NULL DEFAULT 'de',
  eu_ai_act_disclosure        text        NOT NULL DEFAULT 'Sie sprechen mit einem KI-gestützten Telefonsystem.',
  eu_ai_act_disclosure_present boolean    NOT NULL DEFAULT true,
  user_text                   text        NOT NULL DEFAULT '',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, mode, language_code)
);
ALTER TABLE public.greeting_texts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_greeting_texts_tenant_created ON public.greeting_texts (tenant_id, created_at DESC);
```

**Design note:** `eu_ai_act_disclosure` column always stores the locked verbatim text. The Server Action overwrites it with the constant on every save — it cannot be cleared via any API call. `eu_ai_act_disclosure_present` is an invariant flag (always `true`) that n8n can assert before speaking.

### Table: `faq_entries` (TEXT-03)

```sql
CREATE TABLE IF NOT EXISTS public.faq_entries (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mode          text        NOT NULL DEFAULT 'all'
                CHECK (mode IN ('all','normal','vacation','deputy','own_service')),
  question      text        NOT NULL,
  answer        text        NOT NULL,
  active        boolean     NOT NULL DEFAULT true,
  sort_order    integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.faq_entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_faq_entries_tenant_created ON public.faq_entries (tenant_id, created_at DESC);
CREATE INDEX idx_faq_entries_tenant_mode ON public.faq_entries (tenant_id, mode, sort_order);
```

**Design note:** `mode = 'all'` means the FAQ entry is active in all modes. The UI-SPEC shows FAQ per mode tab — so `mode` allows FAQ to be mode-specific or global. MVP defaults to 'all' for simplicity. Second index on `(tenant_id, mode, sort_order)` for n8n reads.

### Table: `deputy_doctors` (DEPUTY-01..04)

```sql
CREATE TABLE IF NOT EXISTS public.deputy_doctors (
  id                          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                        text        NOT NULL,
  greeting_text               text,
  forwarding_number           text        NOT NULL,
  start_date                  date,
  end_date                    date,
  -- DEPUTY-03: PID=0 behavior during deputy period
  pid_zero_behavior           text        NOT NULL DEFAULT 'refuse'
                              CHECK (pid_zero_behavior IN ('refuse','waitlist','book_normal','forward')),
  pid_zero_forward_number     text,       -- populated when pid_zero_behavior='forward'
  -- DEPUTY-04: Eigener Vertretungsdienst
  own_service_active          boolean     NOT NULL DEFAULT false,
  own_service_prompt          text,
  own_service_pid_zero_behavior text      CHECK (own_service_pid_zero_behavior IN ('refuse','waitlist','book_normal','forward')),
  active                      boolean     NOT NULL DEFAULT true,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  -- date range integrity
  CONSTRAINT deputy_date_range CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
ALTER TABLE public.deputy_doctors ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_deputy_doctors_tenant_created ON public.deputy_doctors (tenant_id, created_at DESC);
```

**Design note:** `deputy_periods` (HOURS-03) is the lightweight calendar range. `deputy_doctors` (DEPUTY-01..04) is the richer entity. Both tables are needed. A deputy doctor without a date range is "on file but not currently scheduled." The date range on `deputy_doctors` IS the DEPUTY-02 assignment.

### Table: `medications` (MED-01)

```sql
CREATE TABLE IF NOT EXISTS public.medications (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  pzn           varchar(7)  NOT NULL,
  name          text        NOT NULL,
  phonetic      text,       -- pronunciation hint for Voice AI
  active        boolean     NOT NULL DEFAULT true,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, pzn)
);
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_medications_tenant_created ON public.medications (tenant_id, created_at DESC);
```

**Design note:** PZN is a 7-digit Austrian medication code (Pharmazentralnummer). `varchar(7)` with Zod validation `z.string().regex(/^\d{7}$/)` in the Server Action. `UNIQUE (tenant_id, pzn)` prevents duplicate PZN entries per tenant.

---

## Common Pitfalls

### Pitfall 1: Service-Role Bypasses RLS on DELETE

**What goes wrong:** `createServiceRoleClient()` bypasses all RLS policies. A DELETE filtered only by `id` will delete any row in the table if an attacker crafts a valid UUID from another tenant.

**Why it happens:** Service-role is required for writes (RLS write policies have role gates), but it removes the tenant isolation RLS provides.

**How to avoid:** Always add `.eq('tenant_id', tenantId)` to every DELETE and UPDATE that uses service-role, regardless of RLS state. This is the project standard (STATE.md C2 pitfall).

**Warning signs:** A delete action that only filters by `id` without `tenant_id`.

### Pitfall 2: EU AI Act Disclosure UI Lock is Not Enforcement

**What goes wrong:** Marking the disclosure textarea as `readOnly` or `disabled` in the UI only prevents editing in the browser. A direct API call or `curl` to the Server Action can omit the disclosure.

**Why it happens:** Confusing "UX protection" with "compliance enforcement."

**How to avoid:** The Server Action must unconditionally set `eu_ai_act_disclosure` to the locked constant and `eu_ai_act_disclosure_present = true` on every save, regardless of what the client sends for those fields.

**Warning signs:** Disclosure stored as part of `user_text` (user could edit it), or disclosure not re-asserted in the Server Action.

### Pitfall 3: Mutual Exclusivity Not Enforced (is_voice_bookable vs is_internal_only)

**What goes wrong:** A row has both `is_voice_bookable = true` and `is_internal_only = true`. n8n reads both flags and behavior is undefined.

**Why it happens:** UI enforces it (UI-SPEC: "mutually exclusive"), but Server Action doesn't validate.

**How to avoid:** Add Zod refinement: `.refine(d => !(d.is_voice_bookable && d.is_internal_only), { message: 'KI-buchbar und Nur intern schließen sich gegenseitig aus.' })`

**Warning signs:** No `.refine()` on the appointment type flag schema.

### Pitfall 4: Date Range Validation Only Client-Side

**What goes wrong:** Deputy period or special day with `end_date < start_date` stored in DB because server validation was skipped.

**Why it happens:** Calendar UI enforces the constraint visually, but Server Action trusts the client.

**How to avoid:** Zod refinement: `.refine(d => !d.end_date || !d.start_date || d.end_date >= d.start_date, { message: 'Das Enddatum muss nach dem Startdatum liegen.' })`

**Warning signs:** Date validation only in Calendar popover component, not in Server Action schema.

### Pitfall 5: MEDSTAR Appointment Types Fetched Client-Side

**What goes wrong:** `appointment_types` data is fetched in a Client Component, exposing the fetch to the browser and creating auth complexity.

**Why it happens:** Forgetting that the UI-SPEC explicitly notes "MEDSTAR appointment types are fetched server-side and passed as props — never fetched client-side."

**How to avoid:** The `/konfiguration` Server Component page fetches `appointment_types` from Supabase and passes the array as props to `TerminartenTab`. The "Neu laden" button triggers a Server Action re-fetch (not a client-side fetch).

**Warning signs:** `useEffect` + `fetch('/api/...')` in `TerminartenTab.tsx`.

### Pitfall 6: Synonym Replace Pattern — Race Condition

**What goes wrong:** Delete-all-then-insert for synonyms has a window where zero synonyms exist if the insert fails.

**Why it happens:** Two separate DB calls; if the second fails, data is lost.

**How to avoid:** Accept this for MVP (single-user admin context; the user can re-save). Alternatively, wrap in a DB function. For MVP: delete + insert in two sequential service-role calls is acceptable. Log both operations.

**Warning signs:** Missing error handling on the insert after the delete.

### Pitfall 7: No Navigation Link for /konfiguration

**What goes wrong:** The layout.tsx sidebar does not have a "Konfiguration" link, so the new page is unreachable.

**Why it happens:** layout.tsx was built in Phase 1 and has hardcoded nav links. Phase 5 adds a new route.

**How to avoid:** Add `Konfiguration` link to layout.tsx sidebar as part of Wave 0 / DB plan. The current sidebar has: Übersicht, Telefonate, Inbox, Einstellungen — "Konfiguration" must be added.

---

## Code Examples

### Server Action: auth + tenant_id extraction pattern (canonical)

```typescript
// Source: established pattern from src/app/actions/update-inbox-status.ts
'use server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function exampleConfigAction(...) {
  const supabase = await createServerClient()  // must await (STATE.md locked)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Nicht authentifiziert.' }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) return { error: 'Kein Tenant zugewiesen.' }

  const araRole = user.app_metadata?.ara_role as string | undefined
  if (!['operator', 'ordination_admin'].includes(araRole ?? '')) {
    return { error: 'Unzureichende Berechtigung.' }
  }

  const serviceClient = createServiceRoleClient()  // sync — no await
  // ... DB operations with .eq('tenant_id', tenantId) on every write
}
```

### RLS Policy Template (4-policy pattern)

```sql
-- Source: established pattern from 20260522000010_inbox_items_rls_policies.sql
CREATE POLICY {table}_select ON public.{table}
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY {table}_insert ON public.{table}
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY {table}_update ON public.{table}
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

CREATE POLICY {table}_delete ON public.{table}
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));
```

### Page: Server Component fetching config data

```typescript
// Source: established pattern from src/app/(dashboard)/inbox/page.tsx
// src/app/(dashboard)/konfiguration/page.tsx
import { createServerClient } from '@/lib/supabase/server'

export default async function KonfigurationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const activeTab = params.tab ?? 'oeffnungszeiten'

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = user?.app_metadata?.tenant_id ?? ''
  const araRole = (user?.app_metadata?.ara_role as string | undefined) ?? ''
  const hasEditRight = ['operator', 'ordination_admin'].includes(araRole)

  // Fetch config data server-side, pass as props
  const { data: openingHours } = await supabase
    .from('opening_hours')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('weekday')

  return (
    <KonfigurationTabs
      tenantId={tenantId}
      initialTab={activeTab}
      hasEditRight={hasEditRight}
      openingHours={openingHours ?? []}
      // ... other data
    />
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useEffect` + client-side fetch for config data | Server Component fetches, passes as props | React 18 → 19 / Next.js 13 App Router | Config data never exposed to browser fetch; auth context guaranteed |
| `useState` for form state | `useActionState` (React 19) | React 19 (canary → stable) | Progressive enhancement; correct pending state without manual loading vars |
| Blocking optimistic UI with await | `useOptimistic` + `useTransition` | React 18 (useTransition) → React 19 (useOptimistic) | Instant perceived response; automatic rollback on error |
| Direct `fetch()` to API routes | Server Actions (`'use server'`) | Next.js 14 → 15/16 | No boilerplate API route; auth context automatic from cookies |
| Form `action="/api/..."` | `formAction` from `useActionState` | Next.js App Router | Type-safe; progressive enhancement |

**Deprecated/outdated:**
- `getServerSideProps` / `getStaticProps`: Not used — App Router with async Server Components replaces both
- `pages/api/*.ts` for mutation: Replaced by Server Actions for all Phase 5 config mutations

---

## EU AI Act Art. 50 — Compliance Architecture

This section is unique to Phase 5 and requires explicit planning attention.

### Legal Requirement

EU AI Act Article 50 mandates that any AI system interacting with humans must disclose its AI nature at the start of the interaction. For ARA-Med Voice, this means every call must begin with: "Sie sprechen mit einem KI-gestützten Telefonsystem."

### Implementation Strategy

**Layer 1 — Database (storage invariant):**
- `greeting_texts.eu_ai_act_disclosure` column stores the verbatim disclosure text
- `greeting_texts.eu_ai_act_disclosure_present` is a boolean invariant flag (always `true`)
- DB-level: column has `NOT NULL DEFAULT 'Sie sprechen...'` — cannot be NULL

**Layer 2 — Server Action (write enforcement):**
- Every `saveGreetingTextAction` call unconditionally sets both columns to their locked values
- User's `user_text` is stored separately — the disclosure is never part of it
- Server Action ignores any `eu_ai_act_disclosure` field from the client payload

**Layer 3 — UI (user experience):**
- Lock block rendered from a constant in the Client Component (not fetched from DB)
- `role="region"`, `aria-label="EU-KI-Gesetz Art. 50 Pflichthinweis"`, no focusable children
- Lock icon (`Lock` from lucide-react) + visual distinction per UI-SPEC

**Layer 4 — n8n (runtime assertion):**
- n8n reads `eu_ai_act_disclosure_present` before composing the spoken greeting
- If `false` (should never happen), n8n uses the hardcoded fallback disclosure
- Full spoken text = `eu_ai_act_disclosure + " " + user_text`

**DSGVO compliance note:** This enforcement also satisfies the DSGVO checklist item: "EU AI Act Art. 50 disclosure enforced in all greeting text modes" (STATE.md).

---

## Open Questions (RESOLVED)

1. **MEDSTAR Appointment Type Seeding** — RESOLVED
   - What we know: `appointment_types` rows must exist per tenant before the Terminarten UI has anything to show. The spec says "MEDSTAR appointment types come from an external API."
   - Resolution: 05-01 includes migration `20260523000020_phase5_seed_appointment_types.sql` that seeds 7 common Austrian GP appointment types (ALLG, BLUT, KIND, HAUS, REZEPT, UEBERW, IMPF) for all existing tenants via an idempotent CROSS JOIN INSERT with ON CONFLICT DO NOTHING. The "Neu laden" button in TerminartenTab is a placeholder for a future n8n webhook that will sync live MEDSTAR types. For MVP, the static seed satisfies APPT-01 (appointment types are visible on a fresh tenant). No live MEDSTAR API call is made from the browser or from any plan in Phase 5 — all MEDSTAR communication goes via n8n (CLAUDE.md constraint).

2. **HOURS-03 vs DEPUTY — UI overlap** — RESOLVED
   - What we know: UI-SPEC Section C under Öffnungszeiten shows "Vertretungszeiträume" (HOURS-03) as a simple date-range table. The Vertretung tab (DEPUTY-01..04) manages named deputy doctors with richer data.
   - Resolution: Kept independent for MVP. `deputy_periods` (HOURS-03) = lightweight calendar signal for n8n mode switching (start/end date, active flag, label). `deputy_doctors` (DEPUTY-01..04) = named deputy with behavior config (forwarding number, PID=0 rules, own-service mode). No `deputy_doctor_id` FK on `deputy_periods`. Linking is a v2 enhancement — tracked in Deferred Ideas.

3. **FAQ mode scoping** — RESOLVED
   - What we know: UI-SPEC shows FAQ section "below greeting in each sub-tab" implying FAQ is per-mode.
   - Resolution: `mode = 'all'` rows apply to every mode; mode-specific rows apply only to their mode. The BegruesungsTexteTab renders FAQ for the current sub-tab by filtering: `faqEntries.filter(e => e.mode === 'all' || e.mode === currentMode)`. This is implemented in plan 05-04. The DB schema supports this via the `mode` CHECK constraint including 'all'.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js build | Assumed present (prior phases work) | — | — |
| npm | shadcn add commands | Assumed present | — | — |
| `npx shadcn` | Install calendar/popover/dialog/checkbox | Present (used in Phases 1–4) | shadcn/ui latest | — |
| Supabase self-hosted | DB migrations | Present (prior phases complete) | — | — |

Step 2.6: No new external runtime dependencies beyond the existing project stack.

---

## Validation Architecture

Config forms are not unit-testable in the React sense (they require Supabase auth context). Validation for Phase 5 is primarily:

### Test Framework

| Property | Value |
|----------|-------|
| Framework | TypeScript strict (`tsc --noEmit`) + manual E2E |
| Config file | `tsconfig.json` (existing) |
| Quick run command | `npm run typecheck` |
| Full suite command | `npm run typecheck && npm run lint` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HOURS-01 | Opening hours save persists 7 rows | manual-E2E | — | — |
| HOURS-02 | Special day add/delete | manual-E2E | — | — |
| TEXT-02 | EU AI Act disclosure always present after save | manual-E2E + Server Action inspection | — | — |
| APPT-02 | is_voice_bookable / is_internal_only mutual exclusivity | Zod schema test | `npm run typecheck` (type-level) | — |
| MED-01 | PZN 7-digit validation rejects invalid input | Zod schema test | `npm run typecheck` (type-level) | — |

**Rationale for manual-E2E:** Phase 5 requires Supabase auth, tenant context, and UI interaction — no lightweight unit test harness is set up (nyquist_validation is true but the project has no test runner configured beyond TypeScript). The planner should include a human checkpoint after each module for smoke-test validation.

### Wave 0 Gaps

- No new test files required — validation is TypeScript strict + Zod schemas + human E2E checkpoints
- TypeScript types for all new tables must be added to `src/lib/types/index.ts`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | `supabase.auth.getUser()` in every Server Action |
| V3 Session Management | No (handled by Supabase Auth — established in Phase 1) | — |
| V4 Access Control | Yes | Role gate: `['operator','ordination_admin'].includes(araRole)` |
| V5 Input Validation | Yes | Zod schemas on all Server Action inputs |
| V6 Cryptography | No | No new cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant DELETE via forged UUID | Tampering | `.eq('tenant_id', tenantId)` on every service-role DELETE |
| EU AI Act disclosure removal via direct API call | Tampering | Server Action unconditionally overwrites disclosure column |
| Mutual exclusivity violation on appointment flags | Tampering | Zod `.refine()` on Server Action input |
| Date range reversal (end < start) | Tampering | Zod `.refine()` + DB CHECK constraint |
| PZN format injection | Tampering | Zod `z.string().regex(/^\d{7}$/)` |
| tenant_id from request body | Spoofing | Never — always from `user.app_metadata.tenant_id` (STATE.md C2) |
| Role escalation via config | Elevation | Role check before any write; config changes cannot modify `user_tenant_roles` |

---

## Sources

### Primary (HIGH confidence — codebase verified)

- `src/app/actions/update-inbox-status.ts` — canonical Server Action pattern with auth + role gate + service-role write
- `src/app/(dashboard)/settings/actions.ts` — upsert pattern and role gate
- `src/app/(dashboard)/inbox/page.tsx` — Server Component page pattern with searchParams and auth
- `src/app/(dashboard)/layout.tsx` — navigation structure (needs Konfiguration link)
- `supabase/migrations/20260522000008_inbox_items.sql` — table + RLS + index template
- `supabase/migrations/20260522000010_inbox_items_rls_policies.sql` — 4-policy RLS template
- `src/lib/types/index.ts` — current domain types (Phase 5 must extend this)
- `src/lib/supabase/server.ts` — `createServerClient()` async / `createServiceRoleClient()` sync
- `package.json` — confirmed installed packages (no new npm deps needed)
- `.planning/phases/05-configuration/05-UI-SPEC.md` — interaction contract, component specs, copy

### Secondary (HIGH confidence — project specs)

- `docs/specs/technical-architecture.md` — data model definitions (appointment_types, greeting_texts, medications, opening_hours, special_days, deputy_doctors)
- `.planning/STATE.md` — locked architecture decisions
- `CLAUDE.md` — project constraints and coding guidelines

### Tertiary (ASSUMED)

- MEDSTAR appointment type seeding strategy for MVP — not specified in any source
- FAQ mode scoping behavior ('all' vs strict per-mode) — inferred from UI-SPEC, not explicit

---

## Project Constraints (from CLAUDE.md)

All directives that apply to Phase 5 implementation:

| Directive | Impact on Phase 5 |
|-----------|-------------------|
| `tenant_id` on every table — no exception | All 6 new tables must have `tenant_id uuid NOT NULL` |
| RLS on every table — no bypass | All 6 tables: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + 4 policies each |
| Service-Role Key only in Server Actions / API Routes — never in browser | `createServiceRoleClient()` only in `src/app/actions/*.ts` |
| `strict: true` — no `any` | All new types must be explicit; use union types for enums |
| Server Components by default, `'use client'` only when necessary | Page: Server Component; Tab components: Client Component (useActionState, useOptimistic) |
| No direct MEDSTAR communication — always via n8n | "Neu laden" for appointment types calls an n8n webhook, not MEDSTAR directly |
| German UI only — never "ElevenLabs" or "n8n" | All labels, error messages, empty states in de-AT |
| Zod validation on all inputs | Every Server Action has a Zod schema before any auth or DB call |
| Supabase types from `supabase gen types typescript` | Phase 5 tables must be added to generated types after migration |
| Migrations: `CREATE TABLE IF NOT EXISTS`, no CONCURRENTLY | Phase 5 migration must follow this template |
| Composite indexes: `idx_{table}_tenant_created` | All 6 new tables need this index |
| Keys in Supabase Vault — n8n first node fetches | Not directly relevant to Phase 5 UI (no new external API keys) |
| Provider branding never visible | "ARA-MED Voice" not "ElevenLabs"; "ARA-MED" not "n8n" in all UI copy |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | MEDSTAR appointment types for MVP are seeded as a static list (not live-fetched at page load) | DB Schema / Open Questions | If live-fetch is required, needs an n8n webhook call and async loading state in the page |
| A2 | `deputy_periods` (HOURS-03) and `deputy_doctors` (DEPUTY-01..04) are independent tables with no FK link | DB Schema | If they should be linked, the `deputy_periods` table needs a `deputy_doctor_id FK` |
| A3 | FAQ entries with `mode='all'` display in every sub-tab (normal/vacation/deputy/own_service) | DB Schema / FAQ | If FAQ is strictly per-mode with no cross-tab entries, `mode='all'` column value is unused |
| A4 | `weekday` 0 = Montag through 6 = Sonntag (Monday-first, Austrian convention) | DB Schema | If MEDSTAR or n8n uses Sunday-first (0=Sunday), values will be off by one |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from package.json; shadcn components from UI-SPEC
- Architecture patterns: HIGH — verified from existing Server Action files in codebase
- DB schema design: HIGH — verified against technical-architecture.md and existing migration templates
- EU AI Act enforcement: HIGH — derived from REQUIREMENTS.md TEXT-02 and UI-SPEC disclosure section
- Pitfalls: HIGH — derived from STATE.md pitfalls list (C1..C10) and codebase patterns
- MEDSTAR seeding: LOW — no spec guidance; marked [ASSUMED]

**Research date:** 2026-05-23
**Valid until:** 2026-07-23 (stable stack — Supabase, Next.js 16, React 19 APIs unlikely to change in 60 days)
