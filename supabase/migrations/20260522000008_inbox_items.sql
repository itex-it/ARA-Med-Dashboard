-- Migration: 20260522000008_inbox_items.sql
-- Purpose: Create inbox_items table for calls requiring staff action
-- Security: RLS ENABLED — policies defined in 20260522000010_inbox_items_rls_policies.sql
-- Template: Phase 1 RLS template (D-14, D-15, D-16, D-17).

-- ============================================================
-- TABLE: public.inbox_items
-- Calls requiring staff action. UNIQUE on call_log_id is required for
-- ON CONFLICT upsert in the 02-02 webhook (Postgres ON CONFLICT needs UNIQUE,
-- not just an index).
-- Open-task counter (REALTIME-03) counts rows WHERE status = 'open'.
-- RLS policies live in migration 20260522000010.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inbox_items (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  call_log_id  uuid        UNIQUE REFERENCES public.call_log(id) ON DELETE CASCADE,
  case_type    text        NOT NULL
               CHECK (case_type IN ('unidentified_patient','invalid_pid','multiple_pid',
                                    'callback_needed','prescription_blocked','unclear_intent',
                                    'emergency','technical_error')),
  status       text        NOT NULL DEFAULT 'open'
               CHECK (status IN ('open','in_progress','resolved','archived')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INDEXES
-- D-15: Mandatory composite index on every tenant table.
-- NOTE: Do NOT use CONCURRENTLY — migrations run inside
--       transactions; CONCURRENTLY cannot run in a transaction.
-- ============================================================

CREATE INDEX idx_inbox_items_tenant_created ON public.inbox_items (tenant_id, created_at DESC);

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.inbox_items IS
  'Calls requiring staff action (unidentified patients, callbacks, prescriptions, etc.). '
  'UNIQUE on call_log_id enables ON CONFLICT upsert from the 02-02 webhook. '
  'Open-task counter (REALTIME-03) counts rows WHERE status = ''open''. '
  'RLS enabled — see migration 20260522000010_inbox_items_rls_policies.sql.';

COMMENT ON COLUMN public.inbox_items.call_log_id IS
  'FK to call_log. UNIQUE constraint enables ON CONFLICT upsert in webhook handler. '
  'NULL allowed for inbox items created outside a specific call context.';

COMMENT ON COLUMN public.inbox_items.case_type IS
  'Classification of why this item requires staff attention. '
  'Used for routing and priority display in the dashboard inbox.';

COMMENT ON COLUMN public.inbox_items.status IS
  'Workflow state. open → in_progress → resolved | archived. '
  'REALTIME-03: open count badge subscribes to changes on this column.';
