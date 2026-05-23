-- Migration: 20260523000018_phase5_config_tables.sql
-- Purpose: Create all 9 Phase 5 configuration tables
-- Security: RLS ENABLED on all tables — policies in 20260523000019_phase5_config_rls_policies.sql
-- Note: No CONCURRENTLY on indexes — migrations run inside transactions.

-- ============================================================
-- TABLE 1: opening_hours
-- Weekly opening hours per tenant (HOURS-01)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.opening_hours (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  weekday      smallint    NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  open_from    time                 ,
  open_until   time                 ,
  is_closed    boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, weekday)
);

ALTER TABLE public.opening_hours ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_opening_hours_tenant_created ON public.opening_hours (tenant_id, created_at DESC);

COMMENT ON TABLE public.opening_hours IS
  'Weekly opening hours per tenant. weekday 0=Monday..6=Sunday. '
  'is_closed=true means closed that day regardless of open_from/open_until. '
  'RLS enabled — see 20260523000019_phase5_config_rls_policies.sql.';

-- ============================================================
-- TABLE 2: special_days
-- One-off closure days and special hours overrides (HOURS-02)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.special_days (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  date         date        NOT NULL,
  label        text        NOT NULL DEFAULT '',
  type         text        NOT NULL DEFAULT 'closure'
               CHECK (type IN ('closure','special_hours')),
  open_from    time                 ,
  open_until   time                 ,
  is_closed    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.special_days ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_special_days_tenant_created ON public.special_days (tenant_id, created_at DESC);
CREATE INDEX idx_special_days_tenant_date    ON public.special_days (tenant_id, date);

COMMENT ON TABLE public.special_days IS
  'One-off closure days and special hours overrides per tenant. '
  'type=closure → is_closed=true, type=special_hours → open_from/until apply. '
  'RLS enabled — see 20260523000019_phase5_config_rls_policies.sql.';

-- ============================================================
-- TABLE 3: deputy_periods
-- Date ranges during which deputy mode is active (HOURS-03)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.deputy_periods (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  start_date   date        NOT NULL,
  end_date     date        NOT NULL,
  label        text                 ,
  active       boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deputy_periods_date_range CHECK (end_date >= start_date)
);

ALTER TABLE public.deputy_periods ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_deputy_periods_tenant_created ON public.deputy_periods (tenant_id, created_at DESC);

COMMENT ON TABLE public.deputy_periods IS
  'Date ranges during which deputy (Vertretung) mode is active per tenant. '
  'Voice AI switches to deputy configuration during these periods. '
  'RLS enabled — see 20260523000019_phase5_config_rls_policies.sql.';

-- ============================================================
-- TABLE 4: appointment_types
-- MEDSTAR appointment type configuration per tenant (APPT-01..05)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.appointment_types (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id             uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_type_code text        NOT NULL,
  display_name          text        NOT NULL DEFAULT '',
  is_visible            boolean     NOT NULL DEFAULT true,
  is_voice_bookable     boolean     NOT NULL DEFAULT false,
  is_internal_only      boolean     NOT NULL DEFAULT false,
  is_default            boolean     NOT NULL DEFAULT false,
  pid_zero_allowed      boolean     NOT NULL DEFAULT false,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, appointment_type_code)
);

ALTER TABLE public.appointment_types ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_appointment_types_tenant_created ON public.appointment_types (tenant_id, created_at DESC);

COMMENT ON TABLE public.appointment_types IS
  'MEDSTAR appointment type visibility and AI-booking flags per tenant. '
  'is_voice_bookable and is_internal_only are mutually exclusive (enforced in Server Action). '
  'is_default: used when AI cannot determine appointment type (APPT-04). '
  'pid_zero_allowed: enables booking without a valid PID (APPT-05, e.g. Führerscheinuntersuchung). '
  'RLS enabled — see 20260523000019_phase5_config_rls_policies.sql.';

-- ============================================================
-- TABLE 5: appointment_type_synonyms
-- Natural-language synonyms for appointment type codes (APPT-03)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.appointment_type_synonyms (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id             uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_type_code text        NOT NULL,
  synonym               text        NOT NULL,
  language_code         text        NOT NULL DEFAULT 'de',
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, appointment_type_code, synonym, language_code)
);

ALTER TABLE public.appointment_type_synonyms ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_appt_synonyms_tenant_code ON public.appointment_type_synonyms (tenant_id, appointment_type_code);

COMMENT ON TABLE public.appointment_type_synonyms IS
  'Natural-language synonyms used by the Voice AI for soft-to-hard intent mapping. '
  'Example: "Bauchweh" → appointment_type_code "ALLG". '
  'RLS enabled — see 20260523000019_phase5_config_rls_policies.sql.';

-- ============================================================
-- TABLE 6: greeting_texts
-- Mode-specific greeting text with EU AI Act disclosure (TEXT-01..04)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.greeting_texts (
  id                          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mode                        text        NOT NULL
                              CHECK (mode IN ('normal','vacation','deputy','own_service')),
  language_code               text        NOT NULL DEFAULT 'de',
  eu_ai_act_disclosure        text        NOT NULL DEFAULT 'Sie sprechen mit einem KI-gestützten Telefonsystem gemäß EU AI Act Art. 50.',
  eu_ai_act_disclosure_present boolean    NOT NULL DEFAULT true,
  user_text                   text        NOT NULL DEFAULT '',
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, mode, language_code)
);

ALTER TABLE public.greeting_texts ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_greeting_texts_tenant_created ON public.greeting_texts (tenant_id, created_at DESC);

COMMENT ON TABLE public.greeting_texts IS
  'Mode-specific greeting texts per tenant. '
  'eu_ai_act_disclosure is NOT NULL — Server Action always overwrites with the locked constant. '
  'eu_ai_act_disclosure_present is always true — UI shows it as non-editable lock block. '
  'user_text is the operator-editable portion appended after the disclosure. '
  'RLS enabled — see 20260523000019_phase5_config_rls_policies.sql.';

-- ============================================================
-- TABLE 7: faq_entries
-- Frequently asked questions per mode (TEXT-03)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.faq_entries (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mode         text        NOT NULL DEFAULT 'all'
               CHECK (mode IN ('all','normal','vacation','deputy','own_service')),
  question     text        NOT NULL DEFAULT '',
  answer       text        NOT NULL DEFAULT '',
  active       boolean     NOT NULL DEFAULT true,
  sort_order   integer     NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.faq_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_faq_entries_tenant_created ON public.faq_entries (tenant_id, created_at DESC);
CREATE INDEX idx_faq_entries_tenant_mode    ON public.faq_entries (tenant_id, mode, sort_order);

COMMENT ON TABLE public.faq_entries IS
  'FAQ entries used by the Voice AI per mode. '
  'mode=all means the FAQ applies in all modes. '
  'sort_order controls the order in which FAQs are considered. '
  'RLS enabled — see 20260523000019_phase5_config_rls_policies.sql.';

-- ============================================================
-- TABLE 8: deputy_doctors
-- Deputy doctor configuration with forwarding rules (DEPUTY-01..04)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.deputy_doctors (
  id                          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                        text        NOT NULL,
  greeting_text               text                 ,
  forwarding_number           text        NOT NULL,
  start_date                  date                 ,
  end_date                    date                 ,
  pid_zero_behavior           text        NOT NULL DEFAULT 'refuse'
                              CHECK (pid_zero_behavior IN ('refuse','waitlist','book_normal','forward')),
  pid_zero_forward_number     text                 ,
  own_service_active          boolean     NOT NULL DEFAULT false,
  own_service_prompt          text                 ,
  own_service_pid_zero_behavior text
                              CHECK (own_service_pid_zero_behavior IN ('refuse','waitlist','book_normal','forward')),
  active                      boolean     NOT NULL DEFAULT true,
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deputy_date_range CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

ALTER TABLE public.deputy_doctors ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_deputy_doctors_tenant_created ON public.deputy_doctors (tenant_id, created_at DESC);

COMMENT ON TABLE public.deputy_doctors IS
  'Deputy doctor configuration per tenant. '
  'pid_zero_behavior controls how the Voice AI handles non-identified patients during deputy periods. '
  'own_service_active enables the deputy''s own service mode with a separate greeting and PID-zero rule. '
  'RLS enabled — see 20260523000019_phase5_config_rls_policies.sql.';

-- ============================================================
-- TABLE 9: medications
-- Practice medication list for Voice AI PZN lookup (MED-01)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.medications (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  pzn          varchar(7)  NOT NULL,
  name         text        NOT NULL,
  phonetic     text                 ,
  active       boolean     NOT NULL DEFAULT true,
  note         text                 ,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, pzn)
);

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_medications_tenant_created ON public.medications (tenant_id, created_at DESC);

COMMENT ON TABLE public.medications IS
  'Practice medication list for Voice AI prescription assistance. '
  'pzn: 7-digit Austrian Pharmazentralnummer. '
  'phonetic: pronunciation hint for Text-to-Speech (e.g. "Met-for-min" for Metformin). '
  'RLS enabled — see 20260523000019_phase5_config_rls_policies.sql.';
