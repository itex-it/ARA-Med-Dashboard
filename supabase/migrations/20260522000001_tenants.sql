-- Migration: 20260522000001_tenants.sql
-- Purpose: Create the tenants table (platform root entity)
-- Security: No RLS — accessed by service_role only (Operator operations)
-- Template: This is the Phase 1 migration template all subsequent phases follow.

-- ============================================================
-- TABLE: public.tenants
-- Stores one row per medical practice (tenant).
-- Columns per D-09 (01-CONTEXT.md).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tenants (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name                text        NOT NULL,
  hostname            text,
  medstar_server_url  text,
  fallback_phone      text,
  forwarding_phone    text,
  require_mfa_level   text        NOT NULL DEFAULT 'aal2',
  active_features     jsonb       NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- No RLS: accessed by service_role only (Operator operations).
-- Supabase Anon and Authenticated roles have no direct access.
-- See D-21: tenants has no RLS; user_tenant_roles has RLS.

COMMENT ON TABLE public.tenants IS
  'Platform root entity: one row per medical practice. '
  'No RLS — read/write exclusively via service_role (Operator operations). '
  'Phase 1 establishes the RLS migration template (D-16).';

COMMENT ON COLUMN public.tenants.require_mfa_level IS
  'Minimum AAL required for this tenant: ''aal2'' for Operator/Admin (mandatory), '
  '''aal1'' if tenant opts out for Assistenz/Viewer roles. Default: aal2.';

COMMENT ON COLUMN public.tenants.active_features IS
  'JSONB flags for per-tenant feature toggles (e.g. {"magic_link": false}). '
  'Used by proxy.ts and API routes for conditional feature gating.';
