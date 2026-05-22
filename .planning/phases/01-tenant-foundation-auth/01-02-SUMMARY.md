---
phase: 01-tenant-foundation-auth
plan: "02"
subsystem: database
tags: [supabase, postgres, rls, jwt, vault, migrations, multi-tenant, auth-hook]

# Dependency graph
requires:
  - phase: 01-PLAN-01
    provides: Next.js scaffold, Supabase client utilities, proxy.ts, domain types

provides:
  - "tenants table (no RLS — service_role access only)"
  - "user_tenant_roles table with RLS, composite index, partial index"
  - "4 separate RLS policies on user_tenant_roles using cached JWT subquery pattern"
  - "Custom Access Token Hook (public.custom_access_token_hook) — injects tenant_id + ara_role into JWT app_metadata"
  - "Vault helper (public.get_secret) — callable by service_role only"
  - "RLS migration template for all subsequent phases"

affects:
  - 01-PLAN-03 (auth flow — depends on user_tenant_roles and RLS being live)
  - 01-PLAN-04 (tenant setup — seed script inserts into tenants table)
  - all-subsequent-phases (every phase copies the RLS policy pattern from this plan)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RLS cached subquery: (SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id — prevents per-row JWT evaluation"
    - "Separate RLS policies per DML operation (SELECT/INSERT/UPDATE/DELETE)"
    - "Composite index on (tenant_id, created_at DESC) on every tenant-scoped table"
    - "Custom Access Token Hook: SECURITY DEFINER, reads user_tenant_roles, injects into app_metadata"
    - "Vault accessor function: SECURITY DEFINER, REVOKE from PUBLIC/authenticated/anon, GRANT to service_role"
    - "No CREATE INDEX CONCURRENTLY in migrations (runs inside transactions)"

key-files:
  created:
    - supabase/migrations/20260522000001_tenants.sql
    - supabase/migrations/20260522000002_user_tenant_roles.sql
    - supabase/migrations/20260522000003_rls_policies.sql
    - supabase/migrations/20260522000004_access_token_hook.sql
    - supabase/migrations/20260522000005_vault_helper.sql
  modified: []

key-decisions:
  - "RLS pattern is (SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id — never the bare form (D-14)"
  - "tenants has NO RLS (service_role only); user_tenant_roles HAS RLS (D-21)"
  - "4 separate policies per table: SELECT (tenant match), INSERT (tenant match), UPDATE (tenant+role gate), DELETE (tenant+admin gate) — per D-17"
  - "Custom Access Token Hook stores claims in app_metadata (server-writable only), never user_metadata (D-01)"
  - "get_secret() is the ONLY path to Vault data — vault.decrypted_secrets never directly accessible to authenticated/anon"
  - "CREATE INDEX without CONCURRENTLY in migrations — CONCURRENTLY cannot run inside transactions"

patterns-established:
  - "RLS migration template: enable RLS in table migration, create 4 separate policies in dedicated _rls_policies migration"
  - "Index pattern: CREATE INDEX idx_{table}_tenant_created ON {table} (tenant_id, created_at DESC)"
  - "Vault pattern: get_secret(text) SECURITY DEFINER, REVOKE ALL from PUBLIC/authenticated/anon, GRANT to service_role"
  - "Hook pattern: custom_access_token_hook SECURITY DEFINER STABLE, GRANT to supabase_auth_admin, REVOKE from PUBLIC/authenticated/anon"

requirements-completed: [TENANT-01, TENANT-02, TENANT-04]

# Metrics
duration: 20min
completed: 2026-05-22
---

# Phase 1 Plan 02: Database Migrations Summary

**Five Supabase SQL migrations establishing the RLS template — tenants table, user_tenant_roles with 4 DML-separated policies using the cached JWT subquery, Custom Access Token Hook injecting tenant_id and ara_role into app_metadata, and a service_role-only Vault accessor function.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-22T00:00:00Z
- **Completed:** 2026-05-22
- **Tasks:** 2
- **Files created:** 5

## Accomplishments

- Created `tenants` table (no RLS — D-21 compliant) and `user_tenant_roles` with RLS, UNIQUE constraint, and both a composite index on (tenant_id, created_at DESC) and a partial index on (user_id) WHERE active=true
- Created 4 separate RLS policies (SELECT/INSERT/UPDATE/DELETE) on `user_tenant_roles` using the mandatory cached subquery `(SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid` — zero bare `auth.jwt()` calls remain (T-02-02 mitigated)
- Created `public.custom_access_token_hook`: SECURITY DEFINER function reads `user_tenant_roles WHERE active=true`, injects `app_metadata.tenant_id` and `app_metadata.ara_role` into every JWT at issuance — GRANT to `supabase_auth_admin`, REVOKE from PUBLIC/authenticated/anon
- Created `public.get_secret(text)`: SECURITY DEFINER Vault accessor — only callable by `service_role`, explicitly revoked from PUBLIC/authenticated/anon (T-02-03 mitigated)
- Established the RLS migration template (D-16) that all Phase 2–8 tables must follow

## Task Commits

Each task was committed atomically:

1. **Task 1: Core tables — tenants and user_tenant_roles migrations** - `21107d7` (feat)
2. **Task 2: RLS policies, Custom Access Token Hook, and Vault helper** - `2654a3a` (feat)

**Plan metadata:** (committed with SUMMARY.md and state updates)

## Files Created/Modified

- `supabase/migrations/20260522000001_tenants.sql` — tenants table, no RLS, all D-09 columns
- `supabase/migrations/20260522000002_user_tenant_roles.sql` — user_tenant_roles table, RLS enabled, composite index + partial index, UNIQUE(user_id, tenant_id), CHECK constraint on role
- `supabase/migrations/20260522000003_rls_policies.sql` — 4 separate CREATE POLICY statements (SELECT/INSERT/UPDATE/DELETE) using cached JWT subquery pattern; UPDATE/DELETE gated to operator|ordination_admin
- `supabase/migrations/20260522000004_access_token_hook.sql` — custom_access_token_hook function + GRANT to supabase_auth_admin + REVOKE from PUBLIC/authenticated/anon
- `supabase/migrations/20260522000005_vault_helper.sql` — get_secret(text) SECURITY DEFINER + REVOKE ALL from PUBLIC/authenticated/anon + GRANT to service_role

## Decisions Made

- Confirmed: `CREATE INDEX` without `CONCURRENTLY` in migration files (CONCURRENTLY cannot run inside transactions — note added as comment in migration 000002)
- Used `SET search_path = public` on the hook function and `SET search_path = vault, public` on get_secret to prevent search_path injection attacks
- Hook injects `tenant_id` as `::text` cast before `to_jsonb()` to ensure consistent UUID string representation in the JWT

## Deviations from Plan

None — plan executed exactly as written.

One notable clarification applied: The plan's `<interfaces>` section and D-15 reference `CREATE INDEX CONCURRENTLY` as the standard. The `<critical_context>` and plan note explicitly prohibit CONCURRENTLY in migration files (runs inside transactions). The migrations use `CREATE INDEX` without CONCURRENTLY — which is the correct form for migration files. This is consistent with the critical context override and the plan's own note.

## Issues Encountered

None.

## User Setup Required

**After running `supabase db push` (01-PLAN-04 blocking checkpoint):**

Register the Custom Access Token Hook in the Supabase Dashboard:
1. Go to: Authentication > Hooks > Custom Access Token Hook
2. Point it to: `public.custom_access_token_hook`
3. Save and verify that a test login returns a JWT with `app_metadata.tenant_id` and `app_metadata.ara_role` populated

Without this dashboard registration, the hook function exists in the DB but is never called by Supabase Auth — RLS policies will see no tenant_id in the JWT and deny all queries.

## Known Stubs

None — this plan creates SQL migration files only. No TypeScript, no UI components, no data-wiring required at this stage.

## Threat Flags

All threats from the plan's `<threat_model>` have been mitigated:

| Threat | Mitigation applied |
|--------|--------------------|
| T-02-01: RLS reads tenant_id from request body | Policies read exclusively from `(SELECT auth.jwt()->'app_metadata'->>'tenant_id')` |
| T-02-02: Bare auth.jwt() per-row evaluation | All 4 policies use the `(SELECT ...)` wrapper — grep verified zero bare calls |
| T-02-03: vault.decrypted_secrets accessible to authenticated | get_secret() REVOKEs from PUBLIC/authenticated/anon; vault table not directly queryable |
| T-02-04: Hook reads user_metadata (user-modifiable) | Hook reads `app_metadata` from `user_tenant_roles` table — not user_metadata |
| T-02-05: Role not validated in CHECK constraint | `role CHECK (role IN ('operator', 'ordination_admin', 'assistant', 'viewer'))` present |

## Next Phase Readiness

- **01-PLAN-03 (Auth Flow):** Can proceed immediately — `user_tenant_roles` table and RLS policies are defined; the Custom Access Token Hook function is ready. The auth flow will use these tables directly.
- **01-PLAN-04 (Tenant Setup + blocking checkpoint):** Will run `supabase db push` to apply all migrations. After push, the Supabase Dashboard hook registration (see User Setup Required above) is the only remaining manual step.
- **All future phases:** Copy the RLS policy pattern from migration 000003 — enable RLS in the table migration, create 4 separate DML policies in a dedicated `_rls_policies` migration, always use the `(SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid` form.

---

## Self-Check: PASSED

- `supabase/migrations/20260522000001_tenants.sql` — FOUND
- `supabase/migrations/20260522000002_user_tenant_roles.sql` — FOUND
- `supabase/migrations/20260522000003_rls_policies.sql` — FOUND
- `supabase/migrations/20260522000004_access_token_hook.sql` — FOUND
- `supabase/migrations/20260522000005_vault_helper.sql` — FOUND
- Commit `21107d7` — FOUND (Task 1)
- Commit `2654a3a` — FOUND (Task 2)

---
*Phase: 01-tenant-foundation-auth*
*Completed: 2026-05-22*
