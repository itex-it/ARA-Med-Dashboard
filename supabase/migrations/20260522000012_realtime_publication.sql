-- Migration: 20260522000012_realtime_publication.sql
-- Purpose: Add call_log and inbox_items to supabase_realtime publication
-- REALTIME-01/02/03: postgres_changes events require tables in this publication.
-- REPLICA IDENTITY FULL carries old+new row on UPDATE (required for diff on status changes).
-- Depends on: 20260522000007_call_log.sql, 20260522000008_inbox_items.sql

-- ============================================================
-- REALTIME-01/02/03: call_log and inbox_items must be in the
-- supabase_realtime publication for postgres_changes events to fire.
-- REPLICA IDENTITY FULL carries old+new row on UPDATE.
-- DO..EXCEPTION pattern handles idempotent re-runs gracefully.
-- ============================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.call_log;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- REPLICA IDENTITY FULL: ensures UPDATE events carry the complete old row,
-- enabling the client to diff status changes for the open-task counter (REALTIME-03)
-- and for call_log live-update in the call log view (REALTIME-01).
ALTER TABLE public.call_log REPLICA IDENTITY FULL;
ALTER TABLE public.inbox_items REPLICA IDENTITY FULL;

COMMENT ON TABLE public.call_log IS
  'Every Voice AI call record. '
  'session_id is the idempotency key for ON CONFLICT upserts (C10). '
  'RLS enabled — see migration 20260522000009_call_log_rls_policies.sql. '
  'Realtime publication: supabase_realtime (REALTIME-01). REPLICA IDENTITY FULL.';

COMMENT ON TABLE public.inbox_items IS
  'Calls requiring staff action (unidentified patients, callbacks, prescriptions, etc.). '
  'UNIQUE on call_log_id enables ON CONFLICT upsert from the 02-02 webhook. '
  'Open-task counter (REALTIME-03) counts rows WHERE status = ''open''. '
  'RLS enabled — see migration 20260522000010_inbox_items_rls_policies.sql. '
  'Realtime publication: supabase_realtime (REALTIME-02/03). REPLICA IDENTITY FULL.';
