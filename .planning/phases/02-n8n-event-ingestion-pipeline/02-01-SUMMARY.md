---
plan: 02-01
phase: 02-n8n-event-ingestion-pipeline
status: tasks-complete-checkpoint-pending
completed_tasks: [1, 2]
blocking_task: 3
subsystem: database
tags: [migrations, rls, realtime, types, schema]
requires: [01-01, 01-02, 01-03, 01-04]
provides: [call_log-table, inbox_items-table, tenant_did_numbers-table, realtime-publication]
affects: [02-02-webhook, 02-03-dashboard-components]
tech_stack:
  added: []
  patterns: [cached-jwt-subquery-rls, replica-identity-full, on-conflict-upsert-via-unique]
key_files:
  created:
    - supabase/migrations/20260522000007_call_log.sql
    - supabase/migrations/20260522000008_inbox_items.sql
    - supabase/migrations/20260522000009_call_log_rls_policies.sql
    - supabase/migrations/20260522000010_inbox_items_rls_policies.sql
    - supabase/migrations/20260522000011_tenant_did_numbers.sql
    - supabase/migrations/20260522000012_realtime_publication.sql
  modified:
    - src/lib/types/index.ts
decisions:
  - "UNIQUE on call_log.session_id enables ON CONFLICT DO UPDATE idempotency (C10)"
  - "UNIQUE on inbox_items.call_log_id enables ON CONFLICT upsert in 02-02 webhook (Postgres requires UNIQUE not just index)"
  - "REPLICA IDENTITY FULL on both tables so UPDATE events carry old+new row for client diff"
  - "DO..EXCEPTION block on ALTER PUBLICATION makes migration idempotent on re-runs"
  - "tenant_did_numbers.did_number UNIQUE enforces C9: one DID maps to exactly one tenant"
metrics:
  duration: ~8min
  completed_date: 2026-05-22
  tasks_completed: 2
  tasks_total: 3
  files_created: 6
  files_modified: 1
---

# Phase 02 Plan 01: DB Schema Foundation Summary

DB schema foundation for the n8n event ingestion pipeline: three tables, eight RLS policies, Realtime publication membership, and TypeScript domain types — all awaiting `supabase db push`.

## Completed

### Task 1: Table Migrations (3 files)

- `20260522000007_call_log.sql` — call_log table with `session_id UNIQUE` (C10 idempotency key), `status` and `pid_status` CHECK constraints, RLS enabled, composite index `(tenant_id, created_at DESC)`, no CONCURRENTLY
- `20260522000008_inbox_items.sql` — inbox_items table with `call_log_id UNIQUE` (required for Postgres ON CONFLICT upsert in 02-02 webhook), `case_type` and `status` CHECK constraints, RLS enabled, composite index
- `20260522000011_tenant_did_numbers.sql` — tenant_did_numbers table with `did_number UNIQUE` (C9 mitigation: one DID → one tenant, resolved server-side never from payload), RLS enabled, composite index

### Task 2: RLS Policies, Realtime Publication, TypeScript Types (4 files + 1 modified)

- `20260522000009_call_log_rls_policies.sql` — 4 policies on call_log using cached JWT subquery `(SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid` (D-14 pattern). SELECT/INSERT: tenant isolation. UPDATE/DELETE: role-gated to operator/ordination_admin.
- `20260522000010_inbox_items_rls_policies.sql` — identical 4-policy structure for inbox_items, policies named `inbox_items_tenant_isolation_*`
- `20260522000012_realtime_publication.sql` — `ALTER PUBLICATION supabase_realtime ADD TABLE` for both tables (DO..EXCEPTION for idempotency), `REPLICA IDENTITY FULL` on both (REALTIME-01/02/03)
- `src/lib/types/index.ts` — appended: `CallStatus`, `PidStatus`, `InboxCaseType`, `InboxStatus`, `CallLogRow`, `InboxItemRow`, `TenantDidNumberRow`. Existing `AraRole`, `MfaLevel`, `TenantRow`, `UserTenantRole` preserved. `tsc --noEmit` passes with zero errors.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1 | c44a956 | 20260522000007, 20260522000008, 20260522000011 |
| 2 | b0ee9e3 | 20260522000009, 20260522000010, 20260522000012, src/lib/types/index.ts |

## Blocking Checkpoint

Waiting for human to run `supabase db push` and verify:
1. 6 migrations applied (000007–000012), no errors
2. `supabase db diff` shows no schema changes
3. `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';` lists call_log and inbox_items
4. Table Editor confirms call_log, inbox_items, tenant_did_numbers with RLS ON
5. DID mapping seed row inserted for testing

## Deviations from Plan

None — plan executed exactly as written. All 6 migration files match the specified DDL including exact column definitions, CHECK constraints, UNIQUE constraints, and comment structure.

## Known Stubs

None. This plan is schema-only — no UI components or data-wired components were created.

## Self-Check: PASSED

- supabase/migrations/20260522000007_call_log.sql: EXISTS
- supabase/migrations/20260522000008_inbox_items.sql: EXISTS
- supabase/migrations/20260522000009_call_log_rls_policies.sql: EXISTS
- supabase/migrations/20260522000010_inbox_items_rls_policies.sql: EXISTS
- supabase/migrations/20260522000011_tenant_did_numbers.sql: EXISTS
- supabase/migrations/20260522000012_realtime_publication.sql: EXISTS
- src/lib/types/index.ts: AraRole and CallLogRow both present
- tsc --noEmit: exit 0 (zero errors)
- Commits c44a956 and b0ee9e3: verified in git log
