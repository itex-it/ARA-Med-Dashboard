---
phase: 07-statistics-user-mgmt
plan: 02
subsystem: statistics
tags: [statistics, kpi, server-component, css-chart, multi-tenant]
dependency_graph:
  requires: [07-01]
  provides: [statistiken-page, statistics-components]
  affects: [src/app/(dashboard)/statistiken, src/components/statistics]
tech_stack:
  added: []
  patterns: [server-component, promise-all-queries, css-bar-chart, service-role-tenant-filter]
key_files:
  created:
    - src/components/statistics/KpiCard.tsx
    - src/components/statistics/DailyVolumeChart.tsx
    - src/components/statistics/IntentsTable.tsx
    - src/components/statistics/SavedTimeCard.tsx
  modified:
    - src/app/(dashboard)/statistiken/page.tsx
decisions:
  - CSS-only bar chart (no recharts) — avoids new dependency, aligns with T-07-SC accept disposition
  - All 5 DB queries in Promise.all — single request latency for all KPIs
  - tenantId from JWT app_metadata only — never from URL params (T-07-02 mitigation)
metrics:
  duration: ~15min
  completed: 2026-05-24
  tasks_completed: 3
  files_created: 5
---

# Phase 07 Plan 02: Statistics Module Summary

Full statistics page with 8 KPI cards, CSS bar chart for daily call volume, ranked top-intents table, and saved-time estimate card — all as Server Components with tenant-isolated service-role queries.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create 4 statistics components | aba2c6e | KpiCard, DailyVolumeChart, IntentsTable, SavedTimeCard |
| 2 | Build full statistiken/page.tsx | aba2c6e | statistiken/page.tsx |
| 3 | Git commit statistics module | aba2c6e | all 5 files |

## STAT Requirements Delivered

- **STAT-01:** totalCalls + avgDurationSeconds KPI cards
- **STAT-02:** resolutionRate + forwardingRate KPI cards
- **STAT-03:** openTasksCount + bookedAppointments + prescriptionRequests KPI cards
- **STAT-04:** topIntents table (top 8 by frequency) + emergencyCases KPI card
- **STAT-05:** estimatedSavedMinutes SavedTimeCard (resolved × 5 min)

## Architecture

- `statistiken/page.tsx`: Server Component, async searchParams (Next.js 16), Promise.all for 5 queries
- All queries: `serviceClient.from(...).eq('tenant_id', tenantId)` — tenantId from JWT app_metadata
- Time filter: URL searchParams `?tage=7|30|90` — plain anchor links, no JS required
- DailyVolumeChart: CSS flexbox bars, green=resolved portion, gray=total, last 14 days shown

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints or auth paths introduced. All queries use existing tables (call_log, call_actions, inbox_items) with explicit tenant_id isolation. T-07-02 and T-07-03 mitigations applied as specified.

## Self-Check: PASSED

- src/components/statistics/KpiCard.tsx: FOUND
- src/components/statistics/DailyVolumeChart.tsx: FOUND
- src/components/statistics/IntentsTable.tsx: FOUND
- src/components/statistics/SavedTimeCard.tsx: FOUND
- src/app/(dashboard)/statistiken/page.tsx: FOUND
- Commit aba2c6e: FOUND
- `npx tsc --noEmit`: exits 0
