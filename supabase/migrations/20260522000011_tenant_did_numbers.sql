-- Migration: 20260522000011_tenant_did_numbers.sql
-- Purpose: Create tenant_did_numbers table for authoritative DID-to-tenant routing
-- Security: RLS ENABLED — service_role reads via n8n webhook handler
-- Template: Phase 1 RLS template (D-14, D-15, D-16, D-17).

-- ============================================================
-- TABLE: public.tenant_did_numbers
-- Authoritative DID-to-tenant routing for inbound webhooks.
-- C9 mitigation: webhook handlers resolve tenant via did_number here,
-- never from payload.
-- Usage: SELECT tenant_id FROM tenant_did_numbers WHERE did_number = $1 LIMIT 1
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tenant_did_numbers (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  did_number  text        NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_did_numbers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INDEXES
-- D-15: Mandatory composite index on every tenant table.
-- NOTE: Do NOT use CONCURRENTLY — migrations run inside
--       transactions; CONCURRENTLY cannot run in a transaction.
-- ============================================================

CREATE INDEX idx_tenant_did_numbers_tenant_created ON public.tenant_did_numbers (tenant_id, created_at DESC);

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.tenant_did_numbers IS
  'Authoritative DID-to-tenant routing table for inbound Voice AI webhooks. '
  'C9 mitigation: n8n webhook resolves tenant_id from did_number here, '
  'never trusts tenant_id from the inbound payload. '
  'Usage: SELECT tenant_id FROM tenant_did_numbers WHERE did_number = $1 LIMIT 1';

COMMENT ON COLUMN public.tenant_did_numbers.did_number IS
  'E.164 format DID number (e.g. +4319999999). UNIQUE constraint ensures '
  'one DID maps to exactly one tenant — required for C9 security mitigation.';
