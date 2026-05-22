-- Migration: 20260522000015_call_actions.sql
-- Purpose: Create call_actions table for MEDSTAR action audit trail
-- Security: RLS ENABLED — policies defined in 20260522000016_call_actions_rls_policies.sql
-- CALL-04/10: Every MEDSTAR action executed per call is recorded here.
-- Depends on: 20260522000001_tenants.sql, 20260522000007_call_log.sql

-- ============================================================
-- TABLE: public.call_actions
-- Executed MEDSTAR actions per call.
-- action_type: hard-coded domain verbs (appointment, prescription, etc.)
-- medstar_status: result of the MEDSTAR API call.
-- detail: full MEDSTAR response + request payload (jsonb, for audit).
-- RLS policies live in migration 20260522000016.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.call_actions (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  call_log_id     uuid        NOT NULL REFERENCES public.call_log(id) ON DELETE CASCADE,
  action_type     text        NOT NULL CHECK (action_type IN (
                                'appointment_booked',
                                'appointment_cancelled',
                                'appointment_rescheduled',
                                'prescription_ordered',
                                'message_created',
                                'forwarding',
                                'emergency_notice'
                              )),
  medstar_status  text        CHECK (medstar_status IN ('success','error','pending')),
  detail          jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.call_actions IS 'Executed MEDSTAR actions per call — backs CALL-04 and CALL-10';

ALTER TABLE public.call_actions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INDEXES
-- Composite on (tenant_id, created_at DESC) — standard pattern (D-15).
-- Secondary on call_log_id for JOIN lookups from the call detail view.
-- NOTE: Do NOT use CONCURRENTLY — migrations run inside transactions.
-- ============================================================

CREATE INDEX idx_call_actions_tenant_created ON public.call_actions (tenant_id, created_at DESC);
CREATE INDEX idx_call_actions_call_log ON public.call_actions (call_log_id);
