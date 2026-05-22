-- Migration: 20260522000017_realtime_publication_phase3.sql
-- Purpose: Add call_actions to supabase_realtime publication (Phase 3)
-- REALTIME-04: call_actions postgres_changes events required for live call detail view.
-- REPLICA IDENTITY FULL carries old+new row on UPDATE.
-- DO..EXCEPTION pattern handles idempotent re-runs gracefully.
-- Depends on: 20260522000015_call_actions.sql, 20260522000012_realtime_publication.sql

-- ============================================================
-- REALTIME-04: call_actions must be in the supabase_realtime
-- publication for postgres_changes events to fire on action inserts.
-- REPLICA IDENTITY FULL: ensures UPDATE events carry the complete
-- old row, enabling the client to diff medstar_status changes.
-- DO..EXCEPTION pattern handles idempotent re-runs gracefully.
-- ============================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.call_actions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.call_actions REPLICA IDENTITY FULL;
