-- Migration: 20260522000013_tenant_status_columns.sql
-- Purpose: Add operational status columns to the tenants table (Phase 3 Status Bar)
-- STATUS-01/02/03: ara_status, practice_status, active_mode for the live status bar.
-- Pattern: ADD COLUMN IF NOT EXISTS for idempotent re-runs.
-- Depends on: 20260522000001_tenants.sql

-- ============================================================
-- STATUS-01: ARA-MED Voice AI system state
-- STATUS-02: Medical practice open/closed state
-- STATUS-03: Active operational mode
-- ============================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS ara_status text NOT NULL DEFAULT 'active' CHECK (ara_status IN ('active','paused','error')),
  ADD COLUMN IF NOT EXISTS practice_status text NOT NULL DEFAULT 'open' CHECK (practice_status IN ('open','closed','special')),
  ADD COLUMN IF NOT EXISTS active_mode text NOT NULL DEFAULT 'normal' CHECK (active_mode IN ('normal','vacation','deputy','overload'));

COMMENT ON COLUMN public.tenants.ara_status IS 'STATUS-01: ARA-MED Voice AI system state';
COMMENT ON COLUMN public.tenants.practice_status IS 'STATUS-02: Medical practice open/closed state';
COMMENT ON COLUMN public.tenants.active_mode IS 'STATUS-03: Active operational mode';
