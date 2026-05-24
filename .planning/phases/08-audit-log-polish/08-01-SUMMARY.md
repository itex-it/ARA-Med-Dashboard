---
phase: 08-audit-log-polish
plan: 01
subsystem: audit-log
status: COMPLETE
date: 2026-05-24
tags: [audit-log, migration, types, server-action-helper, navigation, stub-page]
dependency_graph:
  requires:
    - src/lib/supabase/server.ts (createServiceRoleClient)
    - src/app/(dashboard)/layout.tsx (nav pattern)
  provides:
    - supabase/migrations/20260524000023_audit_log.sql
    - src/lib/types/index.ts#AuditLogRow
    - src/lib/audit.ts#logAuditEvent
    - src/app/(dashboard)/audit-log/page.tsx
  affects:
    - src/app/(dashboard)/layout.tsx (Audit-Log nav link added)
tech_stack:
  added: []
  patterns:
    - "server-only guard (import 'server-only') for utility modules that are not Server Actions"
    - "try/catch audit wrapper — audit failure swallowed silently so primary action always completes"
    - "Service role client (createServiceRoleClient) for INSERT bypass of RLS — no user-facing INSERT policy"
    - "Server-side role gate in page (redirect to /dashboard for non-admin) — defense-in-depth (T-08-02)"
key_files:
  created:
    - supabase/migrations/20260524000023_audit_log.sql
    - src/lib/audit.ts
    - src/app/(dashboard)/audit-log/page.tsx
  modified:
    - src/lib/types/index.ts
    - src/app/(dashboard)/layout.tsx
decisions:
  - "logAuditEvent uses 'server-only' import (not 'use server' directive) — it is a utility module, not a Server Action file"
  - "audit_log has no user-facing INSERT RLS policy — service role only inserts via logAuditEvent"
  - "All audit_log columns are NOT NULL per AUDIT-02 — ip_address/user_agent/object_id default to empty string, old_value/new_value default to jsonb null"
  - "Migration applied via pg-meta Basic Auth at https://supabase.itex.at/api/platform/pg-meta/default/query (not 194.242.35.77:8085 — port is not externally exposed)"
metrics:
  duration: "~5 minutes"
  completed_date: 2026-05-24
  tasks_completed: 7
  files_changed: 5
---

# Phase 08 Plan 01: Foundation — audit_log Migration, logAuditEvent Helper, Nav Link, Stub Page Summary

**One-liner:** Audit log DB table (all-NOT-NULL columns, RLS read policy for admin roles), AuditLogRow type, try/catch logAuditEvent() server-only helper, role-gated nav link, and /audit-log stub page — the shared foundation that Plans 08-02 and 08-03 both depend on.

---

## What Was Built

### 1. supabase/migrations/20260524000023_audit_log.sql
- `public.audit_log` table: 11 columns, all NOT NULL per AUDIT-02
- Columns: id, tenant_id (FK→tenants), user_id (FK→auth.users), action, object_type, object_id (default ''), old_value (JSONB, default 'null'::jsonb), new_value (JSONB, default 'null'::jsonb), ip_address (default ''), user_agent (default ''), created_at
- 2 indexes: `audit_log_tenant_created_idx` (tenant_id, created_at DESC) and `audit_log_action_idx` (tenant_id, action)
- RLS enabled, single SELECT policy (`audit_log_read_policy`) for operator/ordination_admin using cached JWT subquery pattern
- No user-facing INSERT policy (T-08-01 mitigation)
- Migration applied live to Supabase (api.supabase.itex.at) via pg-meta API — HTTP 200 confirmed

### 2. src/lib/types/index.ts — Phase 08 block appended
- `AuditLogRow` interface after IntentFrequency (end of Phase 07 block)
- old_value/new_value typed as `Record<string, unknown> | null`

### 3. src/lib/audit.ts — new server-only module
- `import 'server-only'` guard (not `'use server'` — utility module, not a Server Action)
- `logAuditEvent()` async function: extracts ip from x-forwarded-for/x-real-ip headers, user-agent from headers, inserts via `createServiceRoleClient()` (synchronous, bypasses RLS)
- Full try/catch — audit failure never throws; primary action always completes (AUDIT-01 reliability requirement)

### 4. src/app/(dashboard)/layout.tsx — Audit-Log nav link
- Added after Benutzer link, before Einstellungen
- Same role gate as Benutzer: `['operator', 'ordination_admin'].includes(araRole)`
- Nav order: Übersicht → Telefonate → Inbox → Statistiken → Konfiguration → Benutzer (conditional) → Audit-Log (conditional) → Einstellungen

### 5. src/app/(dashboard)/audit-log/page.tsx — stub Server Component
- Authenticates user via `createServerClient()`, redirects to /auth/login if unauthenticated
- Extracts araRole from `user.app_metadata`, redirects to /dashboard if not operator/ordination_admin (T-08-02 mitigation)
- Returns heading "Audit-Log" with placeholder text — Plan 08-03 will overwrite with full implementation

---

## Verification Results

- `CREATE TABLE IF NOT EXISTS public.audit_log` present in migration ✓
- 12 NOT NULL occurrences in migration ✓
- `ROW LEVEL SECURITY` enabled ✓
- `audit_log_read_policy` created ✓
- Migration applied: HTTP 200, `SELECT 1 FROM public.audit_log LIMIT 1` returns [] ✓
- `Phase 08` section in types/index.ts ✓
- `AuditLogRow` interface exported ✓
- `import 'server-only'` in audit.ts ✓
- `export async function logAuditEvent` in audit.ts ✓
- try/catch in audit.ts ✓
- `Audit-Log` nav link in layout.tsx with role gate ✓
- `src/app/(dashboard)/audit-log/page.tsx` exists with `export default` and `ordination_admin` role check ✓
- `npx tsc --noEmit` exits 0 ✓

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pg-meta port 8085 not externally accessible**
- **Found during:** Task 2
- **Issue:** The plan specified `https://194.242.35.77:8085/query` but port 8085 is not exposed externally (connection refused). Previous phases documented the correct URL in `.planning/phases/05-configuration/.continue-here.md`.
- **Fix:** Used correct pg-meta URL `https://supabase.itex.at/api/platform/pg-meta/default/query` with Basic Auth credentials (`supabase_itex-it` / from continue-here.md), consistent with Phase 05 and 06 approach.
- **Files modified:** None (execution-only fix)
- **Commit:** ed8329b

None others — plan executed as written for all other tasks.

---

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| src/app/(dashboard)/audit-log/page.tsx | Placeholder text "Die Audit-Log-Ansicht wird in Kürze verfügbar sein." | Intentional — Plan 08-03 will overwrite with full paginated audit log UI |

The stub does NOT prevent the plan's goal (foundation for 08-02/08-03) from being achieved. The nav link and role gate are fully functional.

---

## Threat Flags

No new threat surface introduced beyond what is covered in the plan's threat model. All T-08-01/02/03 mitigations are implemented:
- T-08-01: No user INSERT policy — inserts only via service role in logAuditEvent ✓
- T-08-02: Server-side redirect in page.tsx checks araRole from JWT ✓
- T-08-03: SELECT RLS policy scopes to tenant_id from JWT app_metadata ✓

---

## Self-Check: PASSED

- `supabase/migrations/20260524000023_audit_log.sql` — FOUND
- `src/lib/types/index.ts` — Phase 08 section — FOUND
- `src/lib/audit.ts` — FOUND
- `src/app/(dashboard)/layout.tsx` — Audit-Log link — FOUND
- `src/app/(dashboard)/audit-log/page.tsx` — FOUND
- Commit ed8329b — FOUND (`git log --oneline -1` confirmed)
