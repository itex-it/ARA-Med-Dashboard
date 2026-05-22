---
phase: "03"
plan: "02"
subsystem: "status-bar"
tags: ["shadcn", "realtime", "server-action", "status-bar", "optimistic-ui"]
dependency_graph:
  requires: ["03-01"]
  provides: ["STATUS-01", "STATUS-02", "STATUS-03", "STATUS-04", "STATUS-05"]
  affects: ["dashboard-layout", "tenant-settings"]
tech_stack:
  added: ["lucide-react", "shadcn/badge", "shadcn/sheet", "shadcn/table", "shadcn/separator", "shadcn/textarea", "shadcn/select", "shadcn/switch"]
  patterns: ["useOptimistic", "useTransition", "Supabase Realtime on tenants.id"]
key_files:
  created:
    - src/components/ui/badge.tsx
    - src/components/ui/sheet.tsx
    - src/components/ui/table.tsx
    - src/components/ui/separator.tsx
    - src/components/ui/textarea.tsx
    - src/components/ui/select.tsx
    - src/components/ui/switch.tsx
    - src/lib/hooks/useTenantStatus.ts
    - src/app/actions/toggle-ara-med.ts
    - src/lib/hooks/useActiveCallCount.ts
    - src/components/status/StatusBar.tsx
  modified:
    - src/app/(dashboard)/layout.tsx
    - package.json
    - package-lock.json
decisions:
  - "Realtime subscription on tenants uses filter: 'id=eq.' + tenantId (not tenant_id) per architecture constraint"
  - "createServerClient() is async — plan code had missing await, corrected in toggle-ara-med.ts"
  - "lucide-react installed separately (not bundled with shadcn) — required by select/sheet components"
metrics:
  duration: "~3 minutes"
  completed: "2026-05-23"
  tasks_completed: 3
  files_created: 11
  files_modified: 3
---

# Phase 03 Plan 02: StatusBar, Toggle Action & shadcn Components Summary

Live status bar with 5 real-time segments, optimistic ARA-MED toggle via Server Action, and 7 new shadcn UI components.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Install shadcn components + useTenantStatus hook | 49095ec |
| 2 | ARA-MED toggle Server Action | a30ecfb |
| 3 | useActiveCallCount, StatusBar, layout wiring | b9c9485 |

## What Was Built

### shadcn Components (7)
All 7 components installed into `src/components/ui/`: badge, sheet, table, separator, textarea, select, switch. lucide-react dependency added (required by select and sheet).

### useTenantStatus Hook
Client hook that fetches `ara_status`, `practice_status`, `active_mode` from the `tenants` table on mount, then subscribes via Supabase Realtime using `filter: 'id=eq.' + tenantId` (keyed on tenant `id`, not `tenant_id` — per architecture constraint). Cleans up channel on unmount.

### toggleAraMedAction Server Action
Server Action at `src/app/actions/toggle-ara-med.ts`:
- Validates `nextStatus` against allowed values (`active`, `paused`, `error`)
- Gets user via `getUser()` (never `getSession()`)
- Reads `tenant_id` and `ara_role` exclusively from `user.app_metadata` (never from args)
- Restricts to `operator` and `ordination_admin` roles
- Writes via `createServiceRoleClient()` (tenants table has no RLS)

### useActiveCallCount Hook
Mirrors `useOpenTaskCount` structure exactly: initial count from `call_log` with `status='active'`, live deltas via `useRealtimeChannel` on `call_log` table (INSERT/UPDATE/DELETE), clamped at 0.

### StatusBar Component
5-segment live status bar (`src/components/status/StatusBar.tsx`):
1. ARA-MED status (green pulse / yellow / red dot + label)
2. Praxis status (geöffnet / geschlossen / Sondermodus)
3. Aktiver Modus (Normalbetrieb / Urlaubsmodus / Vertretungsmodus / Überlastung)
4. Aktive Gespräche (live count badge)
5. Offene Aufgaben (via existing OpenTaskCounter)

Toggle switch visible only when `canToggle=true` (operator/ordination_admin). Uses `useOptimistic` + `useTransition` for instant UI feedback. Shows `Loader2` spinner during pending state.

### Dashboard Layout
`src/app/(dashboard)/layout.tsx` updated:
- `canToggle` computed from `user.app_metadata.ara_role`
- `OpenTaskCounter` import replaced with `StatusBar`
- StatusBar receives `tenantId` and `canToggle` as props

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing `await` on `createServerClient()` call**
- **Found during:** Task 2
- **Issue:** Plan showed `const supabase = createServerClient()` — but `createServerClient` in `src/lib/supabase/server.ts` is declared `async function`, so calling it without `await` would return a Promise, not a Supabase client. This is a TypeScript error under strict mode.
- **Fix:** Added `await` → `const supabase = await createServerClient()`
- **Files modified:** `src/app/actions/toggle-ara-med.ts`
- **Commit:** a30ecfb

**2. [Rule 3 - Blocking] lucide-react not installed**
- **Found during:** Task 1 (after shadcn install, tsc check)
- **Issue:** shadcn select.tsx and sheet.tsx import from `lucide-react` which was not in package.json. TypeScript check failed with TS2307.
- **Fix:** `npm install lucide-react`
- **Files modified:** package.json, package-lock.json
- **Commit:** 49095ec

## Known Stubs

None — StatusBar renders real Realtime-connected data. Loading states show `—` placeholder (intentional UX, not stub).

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. Server Action uses same auth pattern as existing `updateTenantAction`.

## Self-Check: PASSED

Files verified:
- src/lib/hooks/useTenantStatus.ts — FOUND
- src/app/actions/toggle-ara-med.ts — FOUND
- src/lib/hooks/useActiveCallCount.ts — FOUND
- src/components/status/StatusBar.tsx — FOUND
- src/components/ui/separator.tsx — FOUND
- src/components/ui/switch.tsx — FOUND

Commits verified:
- 49095ec — FOUND (feat(03-02): install shadcn components + useTenantStatus hook)
- a30ecfb — FOUND (feat(03-02): ARA-MED toggle Server Action)
- b9c9485 — FOUND (feat(03-02): StatusBar component, useActiveCallCount hook, layout wiring)

Build: `npm run build` — PASSED (14/14 pages, no errors)
TypeScript: `npx tsc --noEmit` — PASSED (no errors)
