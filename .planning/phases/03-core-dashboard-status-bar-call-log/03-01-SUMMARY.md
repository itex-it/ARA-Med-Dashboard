---
phase: "03"
plan: "01"
subsystem: "database"
tags: ["migrations", "rls", "realtime", "types", "multi-tenant"]
dependency_graph:
  requires: ["02-01", "02-02", "02-03"]
  provides: ["call_actions table", "tenant status columns", "call_log feedback columns", "Phase 3 TS types"]
  affects: ["03-02", "03-03", "03-04"]
tech_stack:
  added: []
  patterns: ["ADD COLUMN IF NOT EXISTS idempotency", "4-policy RLS pattern (cached JWT)", "DO..EXCEPTION realtime publication", "REPLICA IDENTITY FULL"]
key_files:
  created:
    - supabase/migrations/20260522000013_tenant_status_columns.sql
    - supabase/migrations/20260522000014_call_log_feedback_columns.sql
    - supabase/migrations/20260522000015_call_actions.sql
    - supabase/migrations/20260522000016_call_actions_rls_policies.sql
    - supabase/migrations/20260522000017_realtime_publication_phase3.sql
  modified:
    - src/lib/types/index.ts
decisions:
  - "Phase 03 types defined at file-bottom with forward-reference — TypeScript hoists type aliases, no runtime issue"
  - "REPLICA IDENTITY FULL on call_actions matches pattern from call_log/inbox_items (migration 000012)"
  - "No CONCURRENTLY on indexes — migrations run inside transactions (documented in comments)"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-23"
  tasks_completed: 3
  files_created: 5
  files_modified: 1
---

# Phase 3 Plan 01: DB Foundation (Wave 1) Summary

**One-liner:** 5 idempotent SQL migrations adding tenant status columns, call_log feedback columns, call_actions table with 4-policy RLS and REPLICA IDENTITY FULL realtime, plus TypeScript type extensions — all `npx tsc --noEmit` clean.

## What Was Built

### Task 1 — Tenant status + call_log feedback column migrations (commits: 17a28b0)

**`supabase/migrations/20260522000013_tenant_status_columns.sql`**
- Adds `ara_status` (STATUS-01), `practice_status` (STATUS-02), `active_mode` (STATUS-03) to `public.tenants`
- All three columns: `NOT NULL`, `DEFAULT` values, `CHECK` constraints with exact enum values
- `ADD COLUMN IF NOT EXISTS` for idempotent re-runs

**`supabase/migrations/20260522000014_call_log_feedback_columns.sql`**
- Adds `feedback_label` (CALL-09), `internal_note` (CALL-08), `intent_corrected` (CALL-08) to `public.call_log`
- `feedback_label` has `CHECK` constraint; `internal_note` and `intent_corrected` are nullable free-text
- `ADD COLUMN IF NOT EXISTS` for idempotent re-runs

### Task 2 — call_actions table, RLS, realtime (commit: f99bd23)

**`supabase/migrations/20260522000015_call_actions.sql`**
- New table `public.call_actions`: `id`, `tenant_id`, `call_log_id`, `action_type` (CHECK 7 values), `medstar_status` (CHECK 3 values), `detail` (jsonb), `created_at`
- `RLS ENABLED`
- Composite index `(tenant_id, created_at DESC)` + secondary index on `call_log_id`
- No `CONCURRENTLY` (migrations run in transactions)

**`supabase/migrations/20260522000016_call_actions_rls_policies.sql`**
- 4 separate RLS policies following the exact pattern from `20260522000009_call_log_rls_policies.sql`
- All use cached subquery form: `(SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id`
- SELECT/INSERT: any authenticated user (tenant-scoped)
- UPDATE/DELETE: `operator` or `ordination_admin` only (role-gated)

**`supabase/migrations/20260522000017_realtime_publication_phase3.sql`**
- Adds `call_actions` to `supabase_realtime` publication via `DO..EXCEPTION` idempotent pattern
- Sets `REPLICA IDENTITY FULL` on `call_actions`

### Task 3 — TypeScript domain types (commit: 90f5866)

**`src/lib/types/index.ts`** extended with:
- `AraStatus`, `PracticeStatus`, `ActiveMode` type aliases (STATUS-01/02/03)
- `FeedbackLabel` type alias (CALL-09)
- `CallActionType` union (7 values matching SQL CHECK), `MedstarActionStatus` union
- `CallActionRow` interface (maps `call_actions` table exactly)
- `TenantRow` extended: `ara_status`, `practice_status`, `active_mode`
- `CallLogRow` extended: `feedback_label | null`, `internal_note | null`, `intent_corrected | null`
- `npx tsc --noEmit` passes with zero errors

## Migration Sequence

| Migration | Purpose | Depends on |
|-----------|---------|------------|
| 000013 | `tenants` status columns | 000001 |
| 000014 | `call_log` feedback columns | 000007 |
| 000015 | `call_actions` table + RLS enable | 000001, 000007 |
| 000016 | `call_actions` RLS policies (4) | 000015 |
| 000017 | Realtime publication + REPLICA IDENTITY | 000015 |

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | 17a28b0 | chore(03-01): add tenant status columns + call_log feedback columns migrations |
| 2 | f99bd23 | chore(03-01): add call_actions table, RLS policies, realtime publication |
| 3 | 90f5866 | feat(03-01): extend domain types for Phase 3 schema |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan only creates DB schema and TypeScript types, no UI or data fetching.

## Threat Flags

None — all new tables have RLS enabled with the standard cached JWT pattern. No new network endpoints introduced. No new auth paths.

## Awaiting Human Action (Task 4 — Blocking Checkpoint)

**Please apply the migrations and verify:**

1. Run `supabase db push` from the project root
2. Confirm all 5 migrations applied with no error
3. In Supabase Studio Table Editor: verify `call_actions` table exists with RLS ON (shield icon)
4. Verify `call_log` has `feedback_label`, `internal_note`, `intent_corrected` columns
5. Verify `tenants` has `ara_status`, `practice_status`, `active_mode` columns
6. In SQL Editor run: `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';` — confirm `call_actions` appears

Type "approved" to continue to Wave 2.
