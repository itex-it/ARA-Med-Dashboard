---
phase: 3
plan: "03"
subsystem: call-log
tags: [realtime, call-log, dsgvo, table, hooks]
dependency_graph:
  requires: [03-02]
  provides: [CALL-01, CALL-02]
  affects: [03-04]
tech_stack:
  added: []
  patterns:
    - useRealtimeChannel with C10 INSERT-dedup pattern
    - Intl.DateTimeFormat de-AT locale for German time display
    - SHA-256 hash tail as stable DSGVO-safe display token
key_files:
  created:
    - src/lib/utils/phone.ts
    - src/lib/utils/format.ts
    - src/lib/hooks/useCallLog.ts
    - src/components/calls/CallStatusBadge.tsx
    - src/components/calls/CallLogTable.tsx
    - src/app/(dashboard)/telefonate/page.tsx
  modified: []
decisions:
  - PID column added between Patient and Intent (plan spec extends UI-SPEC column list)
  - intent_corrected takes precedence over intent_main in display (corrected label wins)
  - Loading skeleton uses div.animate-pulse instead of shadcn Skeleton (avoids install)
metrics:
  duration: "2m 23s"
  completed: "2026-05-22T22:20:20Z"
  tasks: 3
  files: 6
---

# Phase 3 Plan 03: /telefonate Call Log Page Summary

Live, chronological call log table for tenants with Supabase Realtime updates, DSGVO-safe phone masking, and German UI per ARA-MED branding.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Phone masking and formatting utilities | adc9d11 |
| 2 | useCallLog Realtime hook + CallStatusBadge | 23acfc5 |
| 3 | CallLogTable component and /telefonate page | f3880dc |

## What Was Built

### Utilities (`src/lib/utils/`)

**`phone.ts`** — `maskPhone(phoneHash)` converts a SHA-256 hash to a stable display token (`+** *** *** <last4>`). Returns "Unbekannt" for null. Raw phone numbers are never stored (DSGVO architectural constraint — enforced at DB level).

**`format.ts`** — Three formatting helpers:
- `formatCallTime(iso)`: de-AT locale `DD.MM. HH:mm` via `Intl.DateTimeFormat`
- `formatDuration(seconds)`: `M:SS` string, null/undefined returns em-dash
- `formatLanguage(code)`: uppercase 2-char code, null returns em-dash

### Hook (`src/lib/hooks/useCallLog.ts`)

Client hook combining initial Supabase fetch (last 100 rows, `created_at DESC`) with live `useRealtimeChannel` subscription on `call_log`. Implements C10 dedup: INSERT events with an already-known `id` are treated as UPDATEs (prevents phantom rows on network replay). DELETE events filter the row from state.

### Components (`src/components/calls/`)

**`CallStatusBadge.tsx`** — Badge rendering all five `CallStatus` values with German labels and semantic colors per UI-SPEC. Active calls show a pulsing dot indicator.

**`CallLogTable.tsx`** — Full-width table with 9 columns: Zeit, Nummer, Dauer, Patient, PID, Intent, Sprache, Status, Aktion. Features:
- Loading: 5-row skeleton (animated `div.bg-muted`)
- Empty state: German copy per UI-SPEC copywriting contract
- Active rows: `border-l-2 border-primary` left accent
- New rows: `animate-in slide-in-from-top-2 duration-300` entrance animation
- `intent_corrected` displayed in preference to `intent_main`
- Chevron-right affordance for future Call Detail Sheet (03-04)

### Route (`src/app/(dashboard)/telefonate/page.tsx`)

Server Component reading `tenant_id` from JWT `app_metadata`. Passes `tenantId` to `CallLogTable`. Renders as Dynamic SSR — confirmed in build output.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `onRowClick` prop on `CallLogTable` accepts a callback but the sheet panel (Call Detail) is not yet implemented — this will be wired in plan 03-04.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. All data access is tenant-scoped via existing RLS on `call_log` (tenant_id filter on both initial fetch and Realtime channel).

## Self-Check: PASSED

- All 6 files confirmed present on disk
- All 3 commit hashes confirmed in git log (adc9d11, 23acfc5, f3880dc)
- `npx tsc --noEmit`: no errors
- `npm run build`: succeeded, /telefonate listed as Dynamic route
