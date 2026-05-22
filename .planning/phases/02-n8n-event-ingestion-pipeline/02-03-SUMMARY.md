---
plan: 02-03
phase: 02-n8n-event-ingestion-pipeline
status: complete
subsystem: realtime
tags: [realtime, hooks, status-bar, client-components, supabase-realtime]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [useRealtimeChannel, useOpenTaskCount, OpenTaskCounter, status-bar-shell]
  affects: [dashboard-layout, inbox-display]
tech_stack:
  added: []
  patterns: [postgres_changes-subscription, onChangeRef-stale-closure-guard, initial-count-then-delta]
key_files:
  created:
    - src/lib/hooks/useRealtimeChannel.ts
    - src/lib/hooks/useOpenTaskCount.ts
    - src/components/status/OpenTaskCounter.tsx
  modified:
    - src/app/(dashboard)/layout.tsx
decisions:
  - Used '*' (ALL) event filter in useRealtimeChannel instead of per-event loop — resolves TypeScript overload ambiguity in supabase-js v2 while preserving runtime behavior
  - Changed generic constraint from Record<string,unknown> to { [key: string]: unknown } to accept named interfaces (InboxItemRow) without explicit index signatures
  - Added tenant_id filter to initial count query in useOpenTaskCount (plan omitted it — Rule 2 correctness fix)
  - Restructured layout main area to flex-col to accommodate status-bar above content
metrics:
  duration_minutes: 15
  completed_date: "2026-05-22"
  tasks_completed: 3
  files_changed: 4
---

# Phase 02 Plan 03: Realtime Hooks & Status-Bar Counter Summary

Tenant-scoped Supabase Realtime hook system with live open-task badge wired into the dashboard layout as a Server Component.

## Completed

- Task 1: `useRealtimeChannel<T>` — tenant-scoped postgres_changes channel (`${table}:${tenantId}`), server-side filter `tenant_id=eq.${tenantId}` (C3), `removeChannel()` cleanup in useEffect return (C4), `onChangeRef` pattern to prevent stale closures
- Task 2: `useOpenTaskCount` — initial count query (head: true, count: exact, tenant-filtered) + live INCREMENT/DECREMENT from Realtime INSERT/UPDATE/DELETE event deltas; `OpenTaskCounter` Client Component with German label "Offene Aufgaben" and destructive/muted badge styling
- Task 3: `layout.tsx` — status-bar shell `<div>` with Phase 3 comment above children, `OpenTaskCounter` mounted with `tenantId` read from `user.app_metadata` (JWT, server-side), layout stays Server Component

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript overload ambiguity — used '*' event filter instead of per-event loop**
- **Found during:** Task 1
- **Issue:** The plan's approach of casting `'postgres_changes' as Parameters<typeof channel.on>[0]` does not resolve to the correct overload in supabase-js v2 because `Parameters` on overloaded functions only returns the last overload's parameters. Looping over individual events with separate `.on()` calls produces overload resolution errors.
- **Fix:** Use a single `.on('postgres_changes', { event: '*', ... }, callback)` call which maps to the union overload returning `RealtimePostgresChangesPayload<T>`. Runtime behavior is identical (INSERT/UPDATE/DELETE all fire the callback).
- **Files modified:** `src/lib/hooks/useRealtimeChannel.ts`
- **Commit:** 53974a5

**2. [Rule 1 - Bug] Generic constraint incompatible with named interfaces**
- **Found during:** Task 2
- **Issue:** `T extends Record<string, unknown>` requires an index signature that named TypeScript interfaces (like `InboxItemRow`) do not have.
- **Fix:** Changed constraint to `T extends { [key: string]: unknown }` and call site uses intersection `InboxItemRow & { [key: string]: unknown }`.
- **Files modified:** `src/lib/hooks/useRealtimeChannel.ts`, `src/lib/hooks/useOpenTaskCount.ts`
- **Commit:** e3779fb

**3. [Rule 2 - Missing critical functionality] Initial count query missing tenant_id filter**
- **Found during:** Task 2
- **Issue:** Plan's `useOpenTaskCount` initial query used `.eq('status', 'open')` without a tenant filter — would return counts across all tenants for any user without RLS.
- **Fix:** Added `.eq('tenant_id', tenantId)` to the initial count query. RLS provides the backstop but defense-in-depth requires explicit filtering.
- **Files modified:** `src/lib/hooks/useOpenTaskCount.ts`
- **Commit:** e3779fb

## Verification

- `npx tsc --noEmit`: passed (0 errors)
- `npx next build`: passed (all 14 routes generated, no errors)

## Key links

- useRealtimeChannel cleanup: `supabase.removeChannel(channel)` in useEffect return (C4)
- useOpenTaskCount: `count: 'exact', head: true` head query + Realtime event delta with Math.max(0, ...) guard
- layout.tsx: reads `tenantId` from `user.app_metadata?.tenant_id` (JWT), stays Server Component

## Known Stubs

None — OpenTaskCounter is wired to a real Supabase query and Realtime subscription. The counter will show 0 until `inbox_items` rows exist (expected — no data seeded yet).

## Threat Flags

None — no new network endpoints introduced. Realtime subscription uses anon key (browser-safe). Initial count query is tenant-filtered and covered by RLS.

## Self-Check: PASSED

- src/lib/hooks/useRealtimeChannel.ts: FOUND
- src/lib/hooks/useOpenTaskCount.ts: FOUND
- src/components/status/OpenTaskCounter.tsx: FOUND
- src/app/(dashboard)/layout.tsx: MODIFIED (verified)
- Commit 53974a5: FOUND (useRealtimeChannel)
- Commit e3779fb: FOUND (useOpenTaskCount + OpenTaskCounter)
- Commit 894c7f0: FOUND (layout.tsx)
