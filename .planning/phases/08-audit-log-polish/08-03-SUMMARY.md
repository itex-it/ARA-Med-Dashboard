---
phase: 08-audit-log-polish
plan: "03"
subsystem: audit-ui
tags: [audit-log, server-component, client-component, role-gate, url-filters]
dependency_graph:
  requires: ["08-01-PLAN.md"]
  provides: ["/audit-log page", "AuditLogTable component", "AuditLogFilters component"]
  affects: ["src/app/(dashboard)/audit-log/", "src/components/audit/"]
tech_stack:
  added: []
  patterns:
    - "Server Component page with URL-based filters (no client state)"
    - "Client Component filter bar (useRouter for action dropdown, anchor tags for date buttons)"
    - "Parallel Promise.all fetches: audit rows + auth users + distinct actions"
    - "Double tenant isolation: JWT tenant_id + explicit .eq() + RLS"
key_files:
  created:
    - src/components/audit/AuditLogTable.tsx
    - src/components/audit/AuditLogFilters.tsx
  modified:
    - src/app/(dashboard)/audit-log/page.tsx
decisions:
  - "Date-range filter uses plain anchor tags preserving action filter param in href"
  - "Action filter uses useRouter.push to allow client-side navigation without full reload"
  - "Distinct actions query covers full tenant history (no date filter) so dropdown shows all ever-used action types"
  - "Pre-existing TS error in opening-hours.ts left untouched (out of scope for this plan)"
metrics:
  duration: "8 minutes"
  completed: "2026-05-24"
  tasks_completed: 4
  files_created: 2
  files_modified: 1
requirements:
  - AUDIT-03
---

# Phase 8 Plan 03: Audit-Log UI — Summary

**One-liner:** Role-gated /audit-log page with Server Component table (color-coded badges, email lookup) and Client Component filter bar (date range buttons + action dropdown), fully URL-driven with no client state.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create AuditLogTable.tsx | e186a2f | src/components/audit/AuditLogTable.tsx |
| 2 | Create AuditLogFilters.tsx | e186a2f | src/components/audit/AuditLogFilters.tsx |
| 3 | Build full /audit-log page | e186a2f | src/app/(dashboard)/audit-log/page.tsx |
| 4 | Git commit audit-log UI | e186a2f | all 3 files |

## What Was Built

### AuditLogTable.tsx (Server Component)
- Props: `{ rows: AuditLogRow[], userEmailMap: Map<string, string> }`
- Color-coded action badge by prefix: USER_ → blue, SETTINGS_ → purple, ARA_MED_ → green, OPENING_HOURS_/DEPUTY_ → amber, ROUTING_/COMM_/TEMPLATE_ → indigo, APPOINTMENT_TYPE_/MEDICATION_/GREETING_ → teal, default → gray
- Columns: Zeitpunkt (de-AT locale, Europe/Vienna tz), Benutzer (email with 30-char truncation), Aktion (badge), Objekt (type: id truncated to 20 chars), Details (JSON preview of new_value or old_value, monospace, 80-char limit)
- Empty state: "Keine Audit-Einträge für diesen Zeitraum."
- Card wrapper with zebra striping on even rows

### AuditLogFilters.tsx (Client Component, 'use client')
- Props: `{ currentDays: number, currentAction: string, availableActions: string[] }`
- Date range buttons [7 Tage] [30 Tage] [90 Tage] — anchor tags preserving action filter in href
- Action dropdown — `<select>` with useRouter().push, includes "Alle Aktionen" default
- Active date button: bg-blue-600 text-white; inactive: border bg-white text-gray-700

### /audit-log/page.tsx (Server Component — full implementation)
- Replaced stub from 08-01
- Role gate: operator and ordination_admin only → redirect('/dashboard') otherwise (T-08-07)
- searchParams typed as `Promise<{ tage?: string; action?: string }>` (Next.js 16 async)
- Days validation: only 7/30/90 accepted, defaults to 7 if invalid
- createServiceRoleClient() (synchronous — no await)
- Parallel Promise.all: audit rows + auth.admin.listUsers({ perPage: 1000 }) + distinct actions
- Double tenant isolation: .eq('tenant_id', tenantId) + RLS (T-08-08)
- 500-row limit with note when hit
- userEmailMap: Map<string, string> from auth users list

## Deviations from Plan

None — plan executed exactly as written. The pre-existing TypeScript error in `src/app/actions/opening-hours.ts` (line 119) was noted as out of scope and logged to deferred items.

## Known Stubs

None — the page fetches real data from audit_log. If the table is empty it shows the documented empty state message, which is correct behavior (not a stub).

## Threat Surface Scan

No new threat surface beyond what was documented in the plan's threat model:
- T-08-07: Role gate enforced (operator/ordination_admin only)
- T-08-08: Double tenant isolation (JWT + explicit .eq())
- T-08-09: User emails within-tenant (accepted)

No new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- FOUND: src/components/audit/AuditLogTable.tsx
- FOUND: src/components/audit/AuditLogFilters.tsx
- FOUND: src/app/(dashboard)/audit-log/page.tsx
- FOUND commit: e186a2f (feat(phase-08): audit-log page — role-gated table with date and action filters (AUDIT-03))
