-- Migration: 20260524000023_audit_log.sql
-- Phase 8: Audit Log table
-- All columns NOT NULL per AUDIT-02 requirement
-- Pattern: (SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid — cached subquery form (C1 prevention)
-- Security: No user-facing INSERT policy — logAuditEvent uses service role client to bypass RLS

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL,
  object_type TEXT        NOT NULL,
  object_id   TEXT        NOT NULL DEFAULT '',
  old_value   JSONB       NOT NULL DEFAULT 'null'::jsonb,
  new_value   JSONB       NOT NULL DEFAULT 'null'::jsonb,
  ip_address  TEXT        NOT NULL DEFAULT '',
  user_agent  TEXT        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Performance index for tenant-scoped time-ordered queries
CREATE INDEX IF NOT EXISTS audit_log_tenant_created_idx
  ON public.audit_log (tenant_id, created_at DESC);

-- Index for action-type filtering
CREATE INDEX IF NOT EXISTS audit_log_action_idx
  ON public.audit_log (tenant_id, action);

-- RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Operators and ordination_admin can read their tenant's audit log
CREATE POLICY "audit_log_read_policy"
  ON public.audit_log FOR SELECT
  USING (
    (SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator', 'ordination_admin')
  );

-- Service role inserts only — no user-facing INSERT policy
-- (logAuditEvent uses service role client which bypasses RLS)
