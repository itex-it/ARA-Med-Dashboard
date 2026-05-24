-- Migration: 20260524000021_phase6_routing_comm_tables.sql
-- Purpose: Create all 5 Phase 6 routing & communication tables
-- Security: RLS ENABLED on all tables — policies in 20260524000022_phase6_routing_comm_rls.sql
-- Note: Indexes use CREATE INDEX without the CONCURRENT option — migrations run inside transactions.
-- DSGVO: send_log has NO raw recipient column — only recipient_masked (TEXT).
-- FK order: message_templates must precede comm_rules (comm_rules.template_id FK dependency).

-- ============================================================
-- TABLE 1: routing_rules
-- Call routing rules per tenant (ROUTE-01/02/03)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.routing_rules (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  condition_type  TEXT        NOT NULL CHECK (condition_type IN ('phone','intent','time_period','mode')),
  condition_value JSONB       NOT NULL DEFAULT '{}',
  action_type     TEXT        NOT NULL CHECK (action_type IN ('direct_connect','custom_prompt','create_ticket','offer_bypass_slot','forward_to_number','record_message')),
  action_value    JSONB       NOT NULL DEFAULT '{}',
  priority        INTEGER     NOT NULL DEFAULT 10,
  active          BOOLEAN     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.routing_rules ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_routing_rules_tenant_created  ON public.routing_rules (tenant_id, created_at DESC);
CREATE INDEX idx_routing_rules_tenant_priority ON public.routing_rules (tenant_id, priority ASC);

COMMENT ON TABLE public.routing_rules IS
  'Call routing rules per tenant. condition_type determines what triggers the rule. '
  'action_type determines what the AI does when the rule matches. '
  'priority ASC — lower number = higher priority. '
  'RLS enabled — see 20260524000022_phase6_routing_comm_rls.sql.';

-- ============================================================
-- TABLE 2: message_templates
-- Reusable message templates per channel (COMM-03)
-- NOTE: Must precede comm_rules in DDL — comm_rules.template_id references this table.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.message_templates (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  channel       TEXT        NOT NULL CHECK (channel IN ('email','sms','telegram')),
  language_code TEXT        NOT NULL DEFAULT 'de',
  subject       TEXT,
  body          TEXT        NOT NULL DEFAULT '',
  version       INTEGER     NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_message_templates_tenant_created ON public.message_templates (tenant_id, created_at DESC);

COMMENT ON TABLE public.message_templates IS
  'Reusable message templates per tenant and channel. '
  'version: incremented on each edit to support audit trail in send_log. '
  'RLS enabled — see 20260524000022_phase6_routing_comm_rls.sql.';

-- ============================================================
-- TABLE 3: comm_rules
-- Communication rules per event type (COMM-01/02/04/05)
-- NOTE: Depends on message_templates (template_id FK).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.comm_rules (
  id                      uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id               uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  direction               TEXT        NOT NULL CHECK (direction IN ('intern','patient')),
  event_type              TEXT        NOT NULL,
  channel                 TEXT        NOT NULL CHECK (channel IN ('inbox','email','telegram','sms')),
  channel_target          TEXT,
  fallback_channel        TEXT        CHECK (fallback_channel IN ('inbox','email','telegram','sms')),
  fallback_channel_target TEXT,
  template_id             uuid        REFERENCES public.message_templates(id) ON DELETE SET NULL,
  priority                TEXT        NOT NULL DEFAULT 'normal' CHECK (priority IN ('high','normal','low')),
  time_window_from        TIME,
  time_window_until       TIME,
  retry_interval_minutes  INTEGER,
  max_retries             INTEGER     NOT NULL DEFAULT 3,
  privacy_class           TEXT        NOT NULL DEFAULT 'standard' CHECK (privacy_class IN ('standard','restricted','minimal')),
  active                  BOOLEAN     NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comm_rules ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_comm_rules_tenant_created ON public.comm_rules (tenant_id, created_at DESC);

COMMENT ON TABLE public.comm_rules IS
  'Communication rules per tenant and event type. '
  'direction: intern = staff notification, patient = patient-facing message. '
  'channel_target: email address, Telegram chat ID, or phone number depending on channel. '
  'fallback_channel/target: used if primary channel delivery fails. '
  'privacy_class: controls masking level in send_log — restricted and minimal reduce detail. '
  'RLS enabled — see 20260524000022_phase6_routing_comm_rls.sql.';

-- ============================================================
-- TABLE 4: vip_numbers
-- VIP phone numbers for priority routing (ROUTE-02)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vip_numbers (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone_number TEXT        NOT NULL,
  label        TEXT        NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone_number)
);

ALTER TABLE public.vip_numbers ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_vip_numbers_tenant_created ON public.vip_numbers (tenant_id, created_at DESC);

COMMENT ON TABLE public.vip_numbers IS
  'VIP phone numbers per tenant for priority call routing. '
  'Unique constraint: same phone number cannot be added twice for the same tenant. '
  'RLS enabled — see 20260524000022_phase6_routing_comm_rls.sql.';

-- ============================================================
-- TABLE 5: send_log
-- Delivery log for all outbound messages (COMM-05)
-- DSGVO: NO raw recipient column — only recipient_masked.
-- NOTE: Depends on comm_rules (comm_rule_id FK).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.send_log (
  id               uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  comm_rule_id     uuid        REFERENCES public.comm_rules(id) ON DELETE SET NULL,
  event_type       TEXT        NOT NULL,
  channel          TEXT        NOT NULL,
  recipient_masked TEXT        NOT NULL,
  template_name    TEXT,
  template_version INTEGER,
  status           TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed')),
  error_reason     TEXT,
  sent_at          timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.send_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_send_log_tenant_created ON public.send_log (tenant_id, created_at DESC);

COMMENT ON TABLE public.send_log IS
  'Delivery log for all outbound messages per tenant. '
  'recipient_masked: DSGVO-compliant masked recipient only — e.g. "+43 *** *** 789" or "m***a@beispiel.at". '
  'NO raw recipient column — masking applied at INSERT time in Server Action (Plan 06-04). '
  'template_name/version: snapshot of template at send time for audit purposes. '
  'RLS enabled — see 20260524000022_phase6_routing_comm_rls.sql.';
