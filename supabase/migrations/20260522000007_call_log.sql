-- Migration: 20260522000007_call_log.sql
-- Purpose: Create call_log table for Voice AI call records
-- Security: RLS ENABLED — policies defined in 20260522000009_call_log_rls_policies.sql
-- Template: Phase 1 RLS template (D-14, D-15, D-16, D-17).

-- ============================================================
-- TABLE: public.call_log
-- every Voice AI call. session_id is the idempotency key for
-- ON CONFLICT upserts (C10).
-- RLS policies live in migration 20260522000009.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.call_log (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id          text        NOT NULL UNIQUE,
  did_number          text,
  phone_hash          text,
  duration_seconds    integer,
  status              text        NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','completed','failed','forwarded','abandoned')),
  intent_main         text,
  intent_sub          text,
  language_code       text        NOT NULL DEFAULT 'de',
  summary_short       text,
  summary_structured  jsonb,
  transcript_text     text,
  audio_url           text,
  pid_status          text
                      CHECK (pid_status IN ('identified','not_found','multiple','no_pid')),
  patient_recognized  boolean     NOT NULL DEFAULT false,
  inbox_qualifying    boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.call_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INDEXES
-- D-15: Mandatory composite index on every tenant table.
-- NOTE: Do NOT use CONCURRENTLY — migrations run inside
--       transactions; CONCURRENTLY cannot run in a transaction.
-- ============================================================

CREATE INDEX idx_call_log_tenant_created ON public.call_log (tenant_id, created_at DESC);

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.call_log IS
  'Every Voice AI call record. '
  'session_id is the idempotency key for ON CONFLICT upserts (C10). '
  'RLS enabled — see migration 20260522000009_call_log_rls_policies.sql.';

COMMENT ON COLUMN public.call_log.session_id IS
  'ElevenLabs / n8n session identifier. UNIQUE — used as idempotency key for '
  'ON CONFLICT upserts from the inbound webhook (02-02).';

COMMENT ON COLUMN public.call_log.did_number IS
  'DID number the caller dialled. Used for tenant resolution and intent routing.';

COMMENT ON COLUMN public.call_log.phone_hash IS
  'SHA-256 hash of caller phone number for privacy-compliant identification '
  'without storing raw MSISDN (DSGVO compliance).';

COMMENT ON COLUMN public.call_log.inbox_qualifying IS
  'True if this call generated an inbox_items row requiring staff action.';
