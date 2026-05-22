-- Migration: 20260522000002_user_tenant_roles.sql
-- Purpose: Create user_tenant_roles join table (user ↔ tenant ↔ role mapping)
-- Security: RLS ENABLED — policies defined in 20260522000003_rls_policies.sql
-- Template: Phase 1 RLS template (D-14, D-15, D-16, D-17).

-- ============================================================
-- TABLE: public.user_tenant_roles
-- Maps auth.users → tenant + role + permissions JSONB.
-- The Custom Access Token Hook (migration 000004) reads this
-- table at token issuance to inject tenant_id and ara_role
-- into JWT app_metadata. See D-01, D-02.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_tenant_roles (
  id          uuid    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid    NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  tenant_id   uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role        text    NOT NULL CHECK (role IN ('operator', 'ordination_admin', 'assistant', 'viewer')),
  permissions jsonb   NOT NULL DEFAULT '{}',
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, tenant_id)
);

-- ============================================================
-- RLS: Enable on user_tenant_roles (policies in 000003)
-- D-21: tenants has NO RLS; user_tenant_roles DOES have RLS.
-- ============================================================

ALTER TABLE public.user_tenant_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INDEXES
-- D-15: Mandatory composite index on every tenant table.
-- NOTE: Do NOT use CONCURRENTLY — migrations run inside
--       transactions; CONCURRENTLY cannot run in a transaction.
-- ============================================================

-- Primary tenant isolation + time-ordered list index
CREATE INDEX idx_user_tenant_roles_tenant_created
  ON public.user_tenant_roles (tenant_id, created_at DESC);

-- Fast lookup for active assignments (used by Custom Access Token Hook)
CREATE INDEX idx_user_tenant_roles_user_id
  ON public.user_tenant_roles (user_id)
  WHERE active = true;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.user_tenant_roles IS
  'Join table: auth.users → tenant + RBAC role. '
  'RLS enabled — see migration 20260522000003_rls_policies.sql. '
  'Custom Access Token Hook reads this table to inject JWT claims (D-01, D-02).';

COMMENT ON COLUMN public.user_tenant_roles.role IS
  'RBAC role within the tenant. '
  'Valid values: operator | ordination_admin | assistant | viewer. '
  'Injected into JWT app_metadata.ara_role by the Custom Access Token Hook.';

COMMENT ON COLUMN public.user_tenant_roles.permissions IS
  'Per-user permission overrides (JSONB). '
  'Module-level permissions from product-spec.md Section 6. '
  'Evaluated in API Route middleware — not in RLS policies.';

COMMENT ON COLUMN public.user_tenant_roles.active IS
  'False = soft-revoked. '
  'The Custom Access Token Hook filters WHERE active = true. '
  'Revoking active=false does not invalidate existing JWT — '
  'call supabase.auth.admin.signOut(userId, {scope: "global"}) for immediate effect (D-11).';
