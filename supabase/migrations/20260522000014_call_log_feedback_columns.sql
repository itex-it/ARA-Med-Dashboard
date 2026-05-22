-- Migration: 20260522000014_call_log_feedback_columns.sql
-- Purpose: Add staff feedback, internal note, and intent correction columns to call_log
-- CALL-08/09: Staff can annotate calls with quality feedback and override misclassified intents.
-- Pattern: ADD COLUMN IF NOT EXISTS for idempotent re-runs.
-- Depends on: 20260522000007_call_log.sql

-- ============================================================
-- CALL-09: Staff quality feedback on call classification
-- CALL-08: Internal staff note and manual intent override
-- ============================================================

ALTER TABLE public.call_log
  ADD COLUMN IF NOT EXISTS feedback_label text CHECK (feedback_label IN ('correct','incorrect','needs_training')),
  ADD COLUMN IF NOT EXISTS internal_note text,
  ADD COLUMN IF NOT EXISTS intent_corrected text;

COMMENT ON COLUMN public.call_log.feedback_label IS 'CALL-09: Staff quality feedback on call classification';
COMMENT ON COLUMN public.call_log.internal_note IS 'CALL-08: Internal staff note for this call';
COMMENT ON COLUMN public.call_log.intent_corrected IS 'CALL-08: Manual intent override when AI misclassified';
