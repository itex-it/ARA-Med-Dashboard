-- Migration: 20260522000010_inbox_items_rls_policies.sql
-- Purpose: RLS policies for inbox_items (4 separate policies per D-17)
-- Pattern: ALL policies use the cached (SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid
--          subquery form — NEVER the bare auth.jwt() call (D-14, C1 pitfall prevention).
-- Security: Tenant isolation via JWT app_metadata injected by Custom Access Token Hook (D-01).
-- Depends on: 20260522000008_inbox_items.sql (table + RLS enable)

-- ============================================================
-- POLICY: SELECT — tenant isolation
-- Who can read: any authenticated user, only their tenant's rows.
-- ============================================================

CREATE POLICY inbox_items_tenant_isolation_select ON public.inbox_items
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

-- ============================================================
-- POLICY: INSERT — tenant isolation
-- Who can insert: authenticated users, but only rows for their own tenant.
-- Prevents cross-tenant injection via INSERT (T-02-01).
-- ============================================================

CREATE POLICY inbox_items_tenant_isolation_insert ON public.inbox_items
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

-- ============================================================
-- POLICY: UPDATE — tenant isolation + role gate
-- Who can update: operator or ordination_admin only (not assistant/viewer).
-- Assistants cannot change inbox item status (D-17).
-- ============================================================

CREATE POLICY inbox_items_tenant_isolation_update ON public.inbox_items
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

-- ============================================================
-- POLICY: DELETE — tenant isolation + admin gate
-- Who can delete: operator or ordination_admin only.
-- Assistenz and Viewer cannot delete inbox items (D-17).
-- ============================================================

CREATE POLICY inbox_items_tenant_isolation_delete ON public.inbox_items
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

-- ============================================================
-- TEMPLATE REFERENCE (D-16)
-- Follows the exact 4-policy pattern from 20260522000003_rls_policies.sql:
--   1. RLS enabled on table (in 20260522000008_inbox_items.sql)
--   2. CREATE POLICY for SELECT, INSERT, UPDATE, DELETE separately
--   3. Always use (SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid
--      — never the bare auth.jwt() form
--   4. Role-gate write policies to operator/ordination_admin minimum
-- ============================================================
