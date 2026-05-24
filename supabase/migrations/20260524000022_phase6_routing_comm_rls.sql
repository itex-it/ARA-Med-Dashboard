-- Migration: 20260524000022_phase6_routing_comm_rls.sql
-- Purpose: RLS policies for all 5 Phase 6 routing & communication tables (4 policies each = 20 total)
-- Pattern: All policies use the cached (SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid
--          subquery form — NEVER the bare auth.jwt() call (C1 pitfall prevention, T-06-05).
-- Security: Tenant isolation via JWT app_metadata injected by Custom Access Token Hook.
-- Depends on: 20260524000021_phase6_routing_comm_tables.sql (tables + RLS enable)

-- ============================================================
-- routing_rules (4 policies) — abbr: rr
-- ============================================================

CREATE POLICY rr_tenant_isolation_select ON public.routing_rules
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY rr_tenant_isolation_insert ON public.routing_rules
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY rr_tenant_isolation_update ON public.routing_rules
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

CREATE POLICY rr_tenant_isolation_delete ON public.routing_rules
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

-- ============================================================
-- message_templates (4 policies) — abbr: mt
-- ============================================================

CREATE POLICY mt_tenant_isolation_select ON public.message_templates
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY mt_tenant_isolation_insert ON public.message_templates
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY mt_tenant_isolation_update ON public.message_templates
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

CREATE POLICY mt_tenant_isolation_delete ON public.message_templates
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

-- ============================================================
-- comm_rules (4 policies) — abbr: cr
-- ============================================================

CREATE POLICY cr_tenant_isolation_select ON public.comm_rules
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY cr_tenant_isolation_insert ON public.comm_rules
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY cr_tenant_isolation_update ON public.comm_rules
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

CREATE POLICY cr_tenant_isolation_delete ON public.comm_rules
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

-- ============================================================
-- vip_numbers (4 policies) — abbr: vip
-- ============================================================

CREATE POLICY vip_tenant_isolation_select ON public.vip_numbers
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY vip_tenant_isolation_insert ON public.vip_numbers
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY vip_tenant_isolation_update ON public.vip_numbers
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

CREATE POLICY vip_tenant_isolation_delete ON public.vip_numbers
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

-- ============================================================
-- send_log (4 policies) — abbr: sl
-- Note: send_log rows are never deleted via UI, but RLS must be defined for completeness.
-- ============================================================

CREATE POLICY sl_tenant_isolation_select ON public.send_log
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY sl_tenant_isolation_insert ON public.send_log
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY sl_tenant_isolation_update ON public.send_log
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

CREATE POLICY sl_tenant_isolation_delete ON public.send_log
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

-- ============================================================
-- TEMPLATE REFERENCE
-- Follows the exact 4-policy pattern from 20260523000019_phase5_config_rls_policies.sql:
--   1. RLS enabled on table (in 20260524000021_phase6_routing_comm_tables.sql)
--   2. One policy per operation: SELECT, INSERT, UPDATE, DELETE
--   3. Always use (SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid
--      — never the bare auth.jwt() form (C1 prevention, T-06-05 mitigation)
--   4. Role-gate write policies to operator/ordination_admin minimum (T-06-04 mitigation)
-- ============================================================
