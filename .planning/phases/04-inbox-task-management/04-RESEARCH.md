# Phase 4: Inbox & Task Management — Research

**Researched:** 2026-05-23
**Domain:** Next.js App Router · shadcn/ui · Supabase Realtime · Server Actions · TypeScript strict
**Confidence:** HIGH — all findings verified from codebase inspection and established Phase 3 patterns

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INBOX-01 | Alle Gespräche mit Handlungsbedarf erscheinen in der Inbox | `inbox_items` table exists, populated by n8n, Realtime already in publication — useInboxItems hook mirrors useCallLog pattern |
| INBOX-02 | Inbox-Fälle umfassen 8 case types | All 8 case_type values exist in DB CHECK constraint and `InboxCaseType` TypeScript union — display labels defined in UI-SPEC |
| INBOX-03 | Jeder Inbox-Fall hat einen Lifecycle-Status: offen / in_progress / resolved / archived | `status` column with CHECK constraint exists; `InboxStatus` type exists — status chip rendering mirrors CallStatusBadge pattern |
| INBOX-04 | User kann einen Fall durch die Lifecycle-Zustände führen | `updateInboxStatusAction` Server Action needed — same pattern as `toggleAraMedAction` with role gate + Zod validation |
| INBOX-05 | User kann interne Notizen zu Inbox-Fällen hinzufügen | `internal_note` column present in `InboxItemRow` type — same pattern as `saveCallFeedbackAction` |
</phase_requirements>

---

## Summary

Phase 4 is a pure UI + Server Action phase. The database is complete — `inbox_items` was created in Phase 2 migration `20260522000008`, all 8 case types and 4 status values are enforced by CHECK constraints, RLS is active (4 separate policies using the cached JWT subquery pattern), and the table is in the `supabase_realtime` publication with `REPLICA IDENTITY FULL`. No migrations are required.

The implementation reuses every pattern established in Phase 3: `useRealtimeChannel` for live updates, `useCallLog`-style initial fetch + delta merge, `CallDetailSheet`-style slide-in panel, and `saveCallFeedbackAction`-style Server Actions with Zod validation + service-role write. The only net-new primitives are three shadcn components (`tabs`, `tooltip`, `alert`) and two Server Actions for inbox-specific lifecycle management.

The key complexity is correct optimistic UI for status transitions — the UI-SPEC defines which buttons are valid from each state, and the RLS UPDATE policy already gates write to `operator` and `ordination_admin` roles only. The planner must ensure the Server Action enforces this role check too (service-role bypasses RLS).

**Primary recommendation:** Implement in a single wave of 4 tasks — (1) shadcn install, (2) useInboxItems hook + Server Actions, (3) InboxTable + page, (4) CaseDetailSheet + OpenTaskCounter link. No migrations, no new API routes.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Inbox item display (list + tabs) | Frontend Server (SSR page) + Browser (Client Component) | — | Page Server Component reads tenantId from JWT; InboxTable is 'use client' for Realtime |
| Lifecycle state transitions | API / Backend (Server Action) | Browser (optimistic) | Write must be server-side; RLS UPDATE policy gates by role |
| Internal note persistence | API / Backend (Server Action) | — | Same as call-feedback pattern; text write to DB |
| Realtime live updates (INSERT/UPDATE) | Browser / Client | Supabase Realtime | useRealtimeChannel already handles tenant-scoped postgres_changes |
| Permission gating (edit/manage rights) | Frontend Server (SSR page) | — | Computed server-side, passed as props to Client Components — never re-checked in browser |
| OpenTaskCounter → /inbox link | Browser / Client | — | StatusBar is already Client Component; add Link wrapper |

---

## Standard Stack

### Core — all already installed, no new packages

| Library | Version (installed) | Purpose | Source |
|---------|--------------------|---------|----|
| next | 16.x | App Router, Server Components, Server Actions | [VERIFIED: package.json] |
| react | 19.x | useTransition, useOptimistic, useActionState | [VERIFIED: package.json] |
| @supabase/ssr | installed | createServerClient, createServiceRoleClient | [VERIFIED: src/lib/supabase/server.ts] |
| @supabase/supabase-js | installed | createClient (browser), Realtime types | [VERIFIED: src/lib/hooks/useRealtimeChannel.ts] |
| zod | installed | Server Action input validation | [VERIFIED: src/app/actions/call-feedback.ts] |
| lucide-react | installed | Icons (ChevronRight, Loader2, AlertTriangle, Inbox) | [VERIFIED: components.json iconLibrary] |
| tailwindcss | 4.x | Utility classes, CSS variable tokens | [VERIFIED: components.json] |

### New shadcn components needed

| Component | shadcn slug | Already installed? | Usage |
|-----------|------------|-------------------|-------|
| Tabs | tabs | No — not in src/components/ui/ | Filter bar: Alle / Offen / In Bearbeitung / Erledigt / Archiviert |
| Tooltip | tooltip | No | Case-type chip hover description |
| Alert | alert | No | Emergency case banner (variant="destructive") |

**Install command (Wave 0 / Task 1):**
```bash
npx shadcn add tabs tooltip alert
```

Already installed (verified in `src/components/ui/`): badge, button, card, sheet, table, separator, textarea, select, switch, form, input, label.

### No third-party packages

This phase adds zero npm dependencies beyond the three shadcn components (which are code-gen, not runtime dependencies).

---

## Package Legitimacy Audit

No new npm runtime packages are introduced in this phase. The three shadcn component installs (`tabs`, `tooltip`, `alert`) are code generation from the official shadcn CLI against the already-installed radix-ui peer dependencies — they do not add new entries to `package.json` beyond what radix-ui already provides.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (staff)
  │
  ▼
/inbox (Server Component — page.tsx)
  │  reads tenantId from JWT app_metadata
  │  computes hasEditRight / hasManageRight / hasCallDetail from ara_role
  │
  ├─► <InboxTable tenantId hasEditRight hasManageRight hasCallDetail />  [Client Component]
  │     │
  │     ├─ Initial fetch: supabase.from('inbox_items').select(*).eq(tenant_id).order(created_at DESC).limit(200)
  │     │
  │     ├─ useRealtimeChannel(table='inbox_items', tenantId)
  │     │    INSERT → prepend row + animate-in
  │     │    UPDATE → replace row in-place (status change, note update)
  │     │
  │     ├─ Tab filter (client-side, no refetch) — URL param ?filter=
  │     │
  │     └─ Row click → <CaseDetailSheet item hasEditRight hasManageRight hasCallDetail />
  │           │
  │           ├─ Status buttons → updateInboxStatusAction(itemId, newStatus)
  │           │    Server Action: Zod validate → JWT auth → role check → serviceRole.update
  │           │    Client: useTransition + optimistic status update → Realtime confirmation
  │           │
  │           └─ Note textarea → saveInboxNoteAction(itemId, note)
  │                Server Action: Zod validate → JWT auth → serviceRole.update
  │                Client: useTransition → silent success (no toast)
  │
  └─► Supabase Realtime (postgres_changes on inbox_items, tenant-scoped)
        confirms INSERT / UPDATE events back to InboxTable
```

### Recommended Project Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── inbox/
│   │       └── page.tsx              ← Server Component (new)
│   └── actions/
│       ├── update-inbox-status.ts    ← Server Action (new)
│       └── save-inbox-note.ts        ← Server Action (new)
├── components/
│   ├── inbox/
│   │   ├── InboxTable.tsx            ← Client Component (new)
│   │   └── CaseDetailSheet.tsx       ← Client Component (new)
│   ├── status/
│   │   └── OpenTaskCounter.tsx       ← modify: wrap badge in <Link href="/inbox?filter=open">
│   └── ui/
│       ├── tabs.tsx                  ← shadcn add tabs (new)
│       ├── tooltip.tsx               ← shadcn add tooltip (new)
│       └── alert.tsx                 ← shadcn add alert (new)
└── lib/
    └── hooks/
        └── useInboxItems.ts          ← Client hook (new)
```

### Pattern 1: useInboxItems hook (mirrors useCallLog exactly)

```typescript
// Source: verified from src/lib/hooks/useCallLog.ts
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeChannel } from '@/lib/hooks/useRealtimeChannel'
import type { InboxItemRow } from '@/lib/types'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export function useInboxItems(tenantId: string) {
  const [items, setItems] = useState<InboxItemRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId) return
    const supabase = createClient()
    supabase
      .from('inbox_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (data) setItems(data as InboxItemRow[])
        setLoading(false)
      })
  }, [tenantId])

  useRealtimeChannel<InboxItemRow & { [key: string]: unknown }>({
    table: 'inbox_items',
    tenantId,
    events: ['INSERT', 'UPDATE', 'DELETE'],
    onChange: (payload: RealtimePostgresChangesPayload<InboxItemRow & { [key: string]: unknown }>) => {
      if (payload.eventType === 'INSERT') {
        const newRow = payload.new as InboxItemRow
        setItems(prev => {
          const exists = prev.some(r => r.id === newRow.id)
          if (exists) return prev.map(r => r.id === newRow.id ? newRow : r)
          return [newRow, ...prev]
        })
      } else if (payload.eventType === 'UPDATE') {
        const updated = payload.new as InboxItemRow
        setItems(prev => prev.map(r => r.id === updated.id ? updated : r))
      } else if (payload.eventType === 'DELETE') {
        const deleted = payload.old as { id: string }
        setItems(prev => prev.filter(r => r.id !== deleted.id))
      }
    },
  })

  return { items, loading }
}
```

**Critical note:** `InboxItemRow` lacks an index signature — the cast `InboxItemRow & { [key: string]: unknown }` is required for `useRealtimeChannel<T>` generic constraint (`T extends { [key: string]: unknown }`). This is the locked pattern from STATE.md: "Realtime hook generic constraint: useRealtimeChannel<T> uses `T extends { [key: string]: unknown }` not `Record<string,unknown>` — named interfaces (InboxItemRow) lack index signatures."

### Pattern 2: updateInboxStatusAction (mirrors toggleAraMedAction + saveCallFeedbackAction)

```typescript
// Source: verified from src/app/actions/toggle-ara-med.ts + call-feedback.ts
'use server'

import { z } from 'zod'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { InboxStatus } from '@/lib/types'

export interface UpdateInboxStatusState {
  success?: boolean
  error?: string
  newStatus?: InboxStatus
}

const VALID_STATUSES: InboxStatus[] = ['open', 'in_progress', 'resolved', 'archived']
// Role gate must mirror RLS UPDATE policy (operator / ordination_admin only)
const ALLOWED_ROLES = ['operator', 'ordination_admin']

const schema = z.object({
  itemId: z.string().uuid(),
  newStatus: z.enum(['open', 'in_progress', 'resolved', 'archived']),
})

export async function updateInboxStatusAction(
  itemId: string,
  newStatus: InboxStatus
): Promise<UpdateInboxStatusState> {
  const parsed = schema.safeParse({ itemId, newStatus })
  if (!parsed.success) return { error: 'Ungültige Eingabe.' }

  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Nicht authentifiziert.' }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  const araRole = user.app_metadata?.ara_role as string | undefined
  if (!tenantId) return { error: 'Kein Tenant zugewiesen.' }
  if (!araRole || !ALLOWED_ROLES.includes(araRole)) return { error: 'Unzureichende Berechtigung.' }

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('inbox_items')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('tenant_id', tenantId) // Defense-in-depth: forged itemId from another tenant matches zero rows

  if (dbError) return { error: 'Statusänderung fehlgeschlagen. Bitte erneut versuchen.' }
  return { success: true, newStatus }
}
```

**Important:** The RLS UPDATE policy restricts writes to `operator` and `ordination_admin`. The Server Action also enforces this (service-role bypasses RLS, so the role check is mandatory in application code).

### Pattern 3: saveInboxNoteAction (mirrors saveCallFeedbackAction exactly)

```typescript
// Source: verified from src/app/actions/call-feedback.ts
'use server'

import { z } from 'zod'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

export interface SaveInboxNoteState {
  success?: boolean
  error?: string
}

const schema = z.object({
  itemId: z.string().uuid(),
  note: z.string().max(4000),
})

export async function saveInboxNoteAction(
  itemId: string,
  note: string
): Promise<SaveInboxNoteState> {
  const parsed = schema.safeParse({ itemId, note })
  if (!parsed.success) return { error: 'Ungültige Eingabe.' }

  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Nicht authentifiziert.' }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) return { error: 'Kein Tenant zugewiesen.' }

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('inbox_items')
    .update({ internal_note: note, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('tenant_id', tenantId)

  if (dbError) return { error: 'Notiz konnte nicht gespeichert werden.' }
  return { success: true }
}
```

**Note:** `saveInboxNoteAction` does NOT gate by role — assistants can add notes but cannot change status. This matches INBOX-05 (all users with inbox access can add notes) vs INBOX-04 (lifecycle only for authorized roles).

### Pattern 4: Optimistic status transition (useTransition)

```typescript
// Source: locked decision from STATE.md — "Toggle action pattern: useOptimistic + useTransition"
// Applied to CaseDetailSheet status buttons:
const [optimisticStatus, setOptimisticStatus] = useState(item.status)
const [isPending, startTransition] = useTransition()

function handleStatusTransition(newStatus: InboxStatus) {
  const prev = optimisticStatus
  setOptimisticStatus(newStatus) // instant UI update
  startTransition(async () => {
    const result = await updateInboxStatusAction(item.id, newStatus)
    if (result.error) {
      setOptimisticStatus(prev) // revert on error
      toast.error(result.error) // "Statusänderung fehlgeschlagen. Bitte erneut versuchen."
    }
    // Success: Realtime UPDATE event will confirm and update InboxTable row
  })
}
```

### Pattern 5: Tab filter via URL param (searchParams, no re-fetch)

```typescript
// Source: UI-SPEC Implementation Notes #2
// page.tsx (Server Component):
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const params = await searchParams
  const initialFilter = params.filter ?? 'alle'
  // pass initialFilter to InboxTable — tab switch updates URL via router.push, no refetch
}
```

**Note:** In Next.js 16, `searchParams` is a Promise in Server Components (async prop). Must await.

### Pattern 6: Case type and status label maps

```typescript
// Source: UI-SPEC Case Type Labels and Copywriting Contract (verified)
export const CASE_TYPE_LABELS: Record<InboxCaseType, string> = {
  emergency: 'Notfall',
  callback_needed: 'Rückruf nötig',
  unidentified_patient: 'Patient nicht erkannt',
  invalid_pid: 'Ungültige PID',
  multiple_pid: 'Mehrere PID-Treffer',
  prescription_blocked: 'Rezept nicht möglich',
  unclear_intent: 'Unklares Anliegen',
  technical_error: 'Technischer Fehler',
}

export const INBOX_STATUS_LABELS: Record<InboxStatus, string> = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  resolved: 'Erledigt',
  archived: 'Archiviert',
}
```

### Pattern 7: InboxItemRow missing internal_note field

**Critical gap identified:** The existing `InboxItemRow` interface in `src/lib/types/index.ts` does NOT include `internal_note`. The DB column exists (created in Phase 2 migration), but the TypeScript type is incomplete.

```typescript
// Current in src/lib/types/index.ts (MISSING internal_note):
export interface InboxItemRow {
  id: string
  tenant_id: string
  call_log_id: string | null
  case_type: InboxCaseType
  status: InboxStatus
  created_at: string
  updated_at: string
  // internal_note is MISSING — must be added in Wave 0
}

// Must become:
export interface InboxItemRow {
  id: string
  tenant_id: string
  call_log_id: string | null
  case_type: InboxCaseType
  status: InboxStatus
  internal_note: string | null  // ← ADD THIS
  created_at: string
  updated_at: string
}
```

The planner must include a type-fix task before any component that reads `item.internal_note`.

### Anti-Patterns to Avoid

- **Fetching inbox items with anon client in a Client Component directly:** Use the hook pattern (useInboxItems) which uses `createClient()` — the anon key is safe for browser reads because RLS enforces tenant isolation. Do NOT call Server Actions to fetch list data (unnecessary round-trip).
- **Role check only in RLS:** Service-role Server Actions bypass RLS. Always duplicate the role check in application code for write operations (pattern confirmed in toggleAraMedAction).
- **useEffect for optimistic revert:** Do not use useEffect to detect Realtime confirmation — the Realtime UPDATE event naturally updates InboxTable state, which is the source of truth. CaseDetailSheet reads from local optimistic state only; if closed and reopened it re-reads from the hook (fresh).
- **toast on note save success:** UI-SPEC explicitly says no toast on success — "note visually updates in textarea." Use toast ONLY on error.
- **Pagination by default:** UI-SPEC specifies limit 200, "Ältere laden" button only if > 200. Do not implement full pagination in this phase.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slide-in panel | Custom drawer/modal | shadcn `<Sheet side="right">` | Already installed, handles focus trap, scroll lock, aria-modal |
| Filter tabs | Custom tab component | shadcn `<Tabs>` (Wave 0 install) | Keyboard nav, aria-selected, value/onValueChange wired to URL |
| Hover descriptions | Custom tooltip div | shadcn `<Tooltip>` (Wave 0 install) | Accessible, delay, Portal — handles edge cases |
| Emergency banner | Custom alert div | shadcn `<Alert variant="destructive">` (Wave 0 install) | Consistent with design system destructive color |
| Skeleton loading | Custom spinner | `div.h-11.w-full.bg-muted.animate-pulse` | Established in Phase 3 (CallLogTable) — no Skeleton component needed |
| Optimistic UI | Complex state machine | `useState` + `useTransition` | React 19 pattern, already used in StatusBar toggle |

---

## Common Pitfalls

### Pitfall 1: InboxItemRow type missing internal_note
**What goes wrong:** TypeScript strict mode errors when accessing `item.internal_note` in CaseDetailSheet — property does not exist on type.
**Why it happens:** The type was defined in Phase 2 before the note feature requirement was known; the DB column exists but type was never updated.
**How to avoid:** First task in Wave 0 must add `internal_note: string | null` to `InboxItemRow` in `src/lib/types/index.ts`. Run `npx tsc --noEmit` to verify before building components.
**Warning signs:** TS2339 error: "Property 'internal_note' does not exist on type 'InboxItemRow'"

### Pitfall 2: Service-role bypasses RLS — role check required in Server Actions
**What goes wrong:** `assistant` or `viewer` role user calls `updateInboxStatusAction` and successfully changes status — RLS UPDATE policy is bypassed by service-role client.
**Why it happens:** `createServiceRoleClient()` bypasses all RLS. The RLS UPDATE policy only protects anon/authenticated client calls.
**How to avoid:** Always extract `ara_role` from JWT in Server Actions that use service-role client. Gate write operations to allowed roles before calling `serviceClient.update()`. Pattern confirmed in `toggleAraMedAction`.
**Warning signs:** Staff with viewer role can change inbox status — obvious functional bug.

### Pitfall 3: searchParams is a Promise in Next.js 16
**What goes wrong:** `searchParams.filter` throws — `searchParams` is not directly an object.
**Why it happens:** Next.js 16 made `searchParams` a Promise in Server Components (breaking change from Next.js 14/15).
**How to avoid:** `const params = await searchParams` before reading any property.
**Warning signs:** TypeScript error accessing `.filter` on `Promise<{filter?: string}>`.

### Pitfall 4: Tab count badges must track Realtime deltas
**What goes wrong:** Tab count badges show stale counts after real-time INSERT/UPDATE events.
**Why it happens:** Badge counts are derived state — if maintained as a separate `useState`, they diverge from the actual filtered item list.
**How to avoid:** Derive tab counts directly from the `items` array in useInboxItems, not from a separate counter. `const openCount = items.filter(i => i.status === 'open').length`. This automatically stays in sync with Realtime updates.
**Warning signs:** Badge shows "3 offen" but filtered tab shows 4 rows.

### Pitfall 5: CaseDetailSheet note not refreshing on external update
**What goes wrong:** User A has CaseDetailSheet open. User B saves a note. User A's textarea still shows old note content even though Realtime UPDATE event fired.
**Why it happens:** `useState` for `noteValue` is initialized from `item.internal_note` on mount but not updated when the parent `item` prop changes.
**How to avoid:** Use `useEffect([item.internal_note])` to sync textarea value when the prop changes (Realtime UPDATE arrives). See UI-SPEC: "If sheet is open for that case: textarea content refreshes silently."
**Warning signs:** Open sheet shows stale note after another user saves.

### Pitfall 6: Emergency row border overrides selected row border
**What goes wrong:** An emergency case selected by the user shows primary border instead of destructive border.
**Why it happens:** CSS class order — if selected class is applied after emergency class, it overrides.
**How to avoid:** Compute className with emergency check first: `case_type === 'emergency' ? 'border-l-2 border-destructive' : isSelected ? 'border-l-2 border-primary' : ''`. Emergency border always wins regardless of selection state.
**Warning signs:** Selected emergency row shows primary (dark) left border instead of red.

### Pitfall 7: updated_at must be set manually with service-role client
**What goes wrong:** `updated_at` column stays at creation time after status/note updates.
**Why it happens:** `DEFAULT now()` only fires on INSERT. UPDATE does not trigger the default. There is no Supabase trigger for `updated_at` on `inbox_items`.
**How to avoid:** Always include `updated_at: new Date().toISOString()` in the update payload for both Server Actions.
**Warning signs:** `updated_at` timestamp never changes despite successful status transitions.

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `useOptimistic` hook (React 18 experimental) | `useState` + `useTransition` | Project uses React 19; both work but STATE.md locked pattern is useOptimistic + useTransition for toggle — same pattern applies here |
| `searchParams` as sync object (Next.js 14) | `await searchParams` (Next.js 16) | Breaking change — must await in Server Components |
| Per-event Realtime subscription loops | Single `event: '*'` subscription | Locked in STATE.md: "Use single `event: '*'` (ALL) filter on postgres_changes" |

---

## Validation Architecture

`nyquist_validation: true` in config.json — section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Not yet configured (no jest.config or vitest.config detected) |
| Config file | None — Wave 0 gap |
| Quick run command | `npx tsc --noEmit` (TypeScript check as proxy until test framework configured) |
| Full suite command | `npm run build` (full Next.js build — catches type errors, import errors, route issues) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INBOX-01 | Inbox page renders and shows items | smoke | `npm run build` — Dynamic route /inbox listed | Wave 0 — page not yet created |
| INBOX-02 | All 8 case types display correct German label | unit/visual | `npx tsc --noEmit` — CASE_TYPE_LABELS record typed against InboxCaseType | Wave 0 — labels map not yet created |
| INBOX-03 | Status chip renders all 4 states | unit/visual | `npx tsc --noEmit` — INBOX_STATUS_LABELS record typed against InboxStatus | Wave 0 — status chip not yet created |
| INBOX-04 | Valid status transitions only are offered per state | manual | Open sheet for each status, verify correct buttons shown | N/A — manual verification |
| INBOX-05 | Note saves and textarea reflects saved value | manual | Open sheet, type note, save, verify textarea shows note | N/A — manual verification |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npm run build`
- **Phase gate:** `npm run build` green + manual smoke test (inbox visible in browser, status transition works, note saves) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/components/ui/tabs.tsx` — install via `npx shadcn add tabs`
- [ ] `src/components/ui/tooltip.tsx` — install via `npx shadcn add tooltip`
- [ ] `src/components/ui/alert.tsx` — install via `npx shadcn add alert`
- [ ] `InboxItemRow.internal_note` — add field to `src/lib/types/index.ts`

---

## Environment Availability

Step 2.6: SKIPPED — no external dependencies. This phase is purely code changes (hooks, components, Server Actions) against an already-running Supabase instance. No new tools, CLIs, services, or databases.

---

## Runtime State Inventory

Step 2.5: SKIPPED — this is a greenfield feature addition, not a rename/refactor/migration phase. No runtime state contains strings that need renaming.

---

## Security Domain

`security_enforcement` is not set to false — section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `supabase.auth.getUser()` in every Server Action — locked pattern |
| V3 Session Management | yes | JWT 15-min expiry, Supabase SSR auto-refresh — already enforced |
| V4 Access Control | yes | `ara_role` from JWT checked in updateInboxStatusAction; RLS UPDATE policy for anon writes |
| V5 Input Validation | yes | Zod schema on all Server Action inputs (uuid, enum, string max) |
| V6 Cryptography | no | No new crypto — phone_hash already SHA-256 from Phase 2 |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant itemId (forged UUID from another tenant) | Spoofing | `.eq('tenant_id', tenantId)` on every update — service-role does not filter by RLS |
| Role escalation (assistant calls status transition) | Elevation of Privilege | `ara_role` check in Server Action before write — mirrors toggleAraMedAction pattern |
| Note injection (oversized text) | Tampering | Zod `z.string().max(4000)` — same limit as call feedback note |
| Realtime channel data leak (wrong tenant filter) | Information Disclosure | `useRealtimeChannel` always uses `filter: 'tenant_id=eq.' + tenantId` — locked C3 pattern |
| DSGVO: inbox items linked to phone_hash via call_log | Information Disclosure | `call_log_id` FK only — no phone number in inbox_items table itself |

### DSGVO / Permission Gates (from UI-SPEC)

| Element | Server-side check | Default for MVP |
|---------|------------------|-----------------|
| Inbox page access | `inbox` view right | All authenticated users (Phase 7 RBAC will gate) |
| Status lifecycle buttons | `inbox` edit right → `ara_role` check | operator + ordination_admin only |
| Archivieren button | `inbox` manage right | operator + ordination_admin (same role set for MVP) |
| "Gesprächsdetails anzeigen" | `call-detail` right | All authenticated users for MVP |

**Phase 4 simplification:** Full RBAC from `user_tenant_roles.permissions` is Phase 7. For Phase 4, use `ara_role` from JWT as the permission proxy — operator/ordination_admin get edit+manage, others get view only. Add a PHASE 7 comment in the page component.

---

## Open Questions

1. **Toast library availability**
   - What we know: Phase 3 used `toast.error()` in CallDetailSheet — implies a toast library is installed or shadcn's `sonner` component is present.
   - What's unclear: No `toast.tsx` found in `src/components/ui/`. Phase 3 SUMMARY mentions it but the component wasn't listed in the UI file listing.
   - Recommendation: Planner must verify if `sonner` or `react-hot-toast` is installed before writing toast calls. Fallback: use `console.error` + visible error state in the UI instead of toast for Phase 4 (simpler, no dependency).

2. **updated_at trigger vs manual set**
   - What we know: No trigger file found for `inbox_items.updated_at` in the migrations.
   - What's unclear: A trigger may have been added elsewhere or the pattern may be manual.
   - Recommendation: Include `updated_at: new Date().toISOString()` in both Server Actions as defensive practice. Safe regardless of trigger existence.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `updated_at` on inbox_items has no auto-update trigger — must be set manually in Server Actions | Pitfall 7, Code Examples | If trigger exists: harmless redundancy. If no trigger and not set: column stays stale. Low risk. |
| A2 | Toast library is available (implied by Phase 3 CallDetailSheet) but not verified via file listing | Open Questions | If no toast library: error display falls back to local state; planner must decide approach |

---

## Sources

### Primary (HIGH confidence — verified from codebase)

- `supabase/migrations/20260522000008_inbox_items.sql` — table schema, CHECK constraints, indexes
- `supabase/migrations/20260522000010_inbox_items_rls_policies.sql` — RLS policies, role gates
- `src/lib/types/index.ts` — InboxItemRow, InboxCaseType, InboxStatus (confirmed internal_note missing)
- `src/lib/hooks/useRealtimeChannel.ts` — generic constraint, channel naming, cleanup pattern
- `src/lib/hooks/useCallLog.ts` — initial fetch + Realtime delta merge pattern
- `src/lib/hooks/useOpenTaskCount.ts` — inbox_items Realtime delta pattern, confirmed already subscribed
- `src/app/actions/call-feedback.ts` — Server Action pattern (Zod + auth + service-role + eq filter)
- `src/app/actions/toggle-ara-med.ts` — role gate pattern in Server Action
- `src/app/(dashboard)/telefonate/page.tsx` — Server Component + tenantId from JWT pattern
- `src/app/(dashboard)/layout.tsx` — layout structure, nav (Inbox link already present)
- `src/components/status/OpenTaskCounter.tsx` — component to be modified with Link wrapper
- `src/components/calls/CallDetailSheet.tsx` — Sheet + section pattern to mirror
- `src/components/calls/CallLogTable.tsx` — Table + skeleton + empty state + row click pattern
- `components.json` — shadcn config (new-york, neutral, cssVariables, lucide)
- `.planning/phases/04-inbox-task-management/04-UI-SPEC.md` — design contract (authoritative)
- `.planning/STATE.md` — locked architecture decisions (RLS pattern, hook constraints, JWT patterns)

### Secondary (MEDIUM confidence)

- Phase 3 summaries (03-03-SUMMARY.md, 03-04-SUMMARY.md) — confirmed patterns, deviations, pitfalls encountered

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all verified from installed files
- Architecture: HIGH — all patterns verified from Phase 3 codebase
- Pitfalls: HIGH — 6 of 7 directly traceable to STATE.md locked decisions or codebase inspection; A1/A2 are LOW-risk assumptions
- Type gap (internal_note): HIGH — confirmed by reading src/lib/types/index.ts directly

**Research date:** 2026-05-23
**Valid until:** Until Phase 4 implementation — patterns are stable (no fast-moving dependencies)
