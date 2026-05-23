-- Migration: 20260523000019_phase5_config_rls_policies.sql
-- Purpose: RLS policies for all 9 Phase 5 configuration tables (4 policies each = 36 total)
-- Pattern: All policies use the cached (SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid
--          subquery form — NEVER the bare auth.jwt() call (C1 pitfall prevention).
-- Security: Tenant isolation via JWT app_metadata injected by Custom Access Token Hook.
-- Depends on: 20260523000018_phase5_config_tables.sql (tables + RLS enable)

-- ============================================================
-- opening_hours (4 policies)
-- ============================================================

CREATE POLICY opening_hours_tenant_isolation_select ON public.opening_hours
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY opening_hours_tenant_isolation_insert ON public.opening_hours
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY opening_hours_tenant_isolation_update ON public.opening_hours
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

CREATE POLICY opening_hours_tenant_isolation_delete ON public.opening_hours
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

-- ============================================================
-- special_days (4 policies)
-- ============================================================

CREATE POLICY special_days_tenant_isolation_select ON public.special_days
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY special_days_tenant_isolation_insert ON public.special_days
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY special_days_tenant_isolation_update ON public.special_days
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

CREATE POLICY special_days_tenant_isolation_delete ON public.special_days
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

-- ============================================================
-- deputy_periods (4 policies)
-- ============================================================

CREATE POLICY deputy_periods_tenant_isolation_select ON public.deputy_periods
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY deputy_periods_tenant_isolation_insert ON public.deputy_periods
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY deputy_periods_tenant_isolation_update ON public.deputy_periods
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

CREATE POLICY deputy_periods_tenant_isolation_delete ON public.deputy_periods
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

-- ============================================================
-- appointment_types (4 policies)
-- ============================================================

CREATE POLICY appointment_types_tenant_isolation_select ON public.appointment_types
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY appointment_types_tenant_isolation_insert ON public.appointment_types
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY appointment_types_tenant_isolation_update ON public.appointment_types
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

CREATE POLICY appointment_types_tenant_isolation_delete ON public.appointment_types
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

-- ============================================================
-- appointment_type_synonyms (4 policies)
-- ============================================================

CREATE POLICY appt_synonyms_tenant_isolation_select ON public.appointment_type_synonyms
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY appt_synonyms_tenant_isolation_insert ON public.appointment_type_synonyms
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY appt_synonyms_tenant_isolation_update ON public.appointment_type_synonyms
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

CREATE POLICY appt_synonyms_tenant_isolation_delete ON public.appointment_type_synonyms
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

-- ============================================================
-- greeting_texts (4 policies)
-- ============================================================

CREATE POLICY greeting_texts_tenant_isolation_select ON public.greeting_texts
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY greeting_texts_tenant_isolation_insert ON public.greeting_texts
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY greeting_texts_tenant_isolation_update ON public.greeting_texts
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

CREATE POLICY greeting_texts_tenant_isolation_delete ON public.greeting_texts
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

-- ============================================================
-- faq_entries (4 policies)
-- ============================================================

CREATE POLICY faq_entries_tenant_isolation_select ON public.faq_entries
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY faq_entries_tenant_isolation_insert ON public.faq_entries
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY faq_entries_tenant_isolation_update ON public.faq_entries
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

CREATE POLICY faq_entries_tenant_isolation_delete ON public.faq_entries
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

-- ============================================================
-- deputy_doctors (4 policies)
-- ============================================================

CREATE POLICY deputy_doctors_tenant_isolation_select ON public.deputy_doctors
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY deputy_doctors_tenant_isolation_insert ON public.deputy_doctors
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY deputy_doctors_tenant_isolation_update ON public.deputy_doctors
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

CREATE POLICY deputy_doctors_tenant_isolation_delete ON public.deputy_doctors
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

-- ============================================================
-- medications (4 policies)
-- ============================================================

CREATE POLICY medications_tenant_isolation_select ON public.medications
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY medications_tenant_isolation_insert ON public.medications
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY medications_tenant_isolation_update ON public.medications
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

CREATE POLICY medications_tenant_isolation_delete ON public.medications
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

-- ============================================================
-- TEMPLATE REFERENCE
-- Follows the exact 4-policy pattern from 20260522000010_inbox_items_rls_policies.sql:
--   1. RLS enabled on table (in 20260523000018_phase5_config_tables.sql)
--   2. CREATE POLICY for SELECT, INSERT, UPDATE, DELETE separately
--   3. Always use (SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid
--      — never the bare auth.jwt() form (C1 prevention)
--   4. Role-gate write policies to operator/ordination_admin minimum
-- ============================================================
