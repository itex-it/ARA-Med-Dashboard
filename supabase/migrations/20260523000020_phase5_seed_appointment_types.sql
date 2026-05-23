-- Migration: 20260523000020_phase5_seed_appointment_types.sql
-- Purpose: Seed appointment_types with 7 common Austrian GP appointment types for all existing tenants
-- Security: Uses dynamic SELECT from public.tenants — no hardcoded tenant UUIDs
-- Idempotent: ON CONFLICT DO NOTHING — safe to re-apply
-- Depends on: 20260523000018_phase5_config_tables.sql (appointment_types table must exist)

DO $$
BEGIN
  -- Insert 7 common Austrian GP appointment types for all existing tenants.
  -- is_voice_bookable defaults to false — operator must explicitly enable AI-booking per type.
  -- is_default defaults to false — operator configures via Terminarten UI (APPT-04).
  -- pid_zero_allowed defaults to false — operator enables for applicable types (APPT-05).
  -- ON CONFLICT DO NOTHING makes this idempotent and safe to re-run.
  INSERT INTO public.appointment_types
    (tenant_id, appointment_type_code, display_name, is_visible, is_voice_bookable, is_internal_only, is_default, pid_zero_allowed)
  SELECT
    t.id,
    v.appointment_type_code,
    v.display_name,
    true,   -- is_visible: all types visible by default
    false,  -- is_voice_bookable: operator configures per-practice
    false,  -- is_internal_only: not internal by default
    v.is_default,
    v.pid_zero_allowed
  FROM public.tenants t
  CROSS JOIN (VALUES
    ('ALLG',   'Allgemeinuntersuchung', false, false),
    ('BLUT',   'Blutabnahme',           false, false),
    ('KIND',   'Kinderuntersuchung',    false, false),
    ('HAUS',   'Hausbesuch',            false, false),
    ('REZEPT', 'Rezeptausstellung',     false, false),
    ('UEBERW', 'Überweisung',           false, false),
    ('IMPF',   'Impfung',              false, false)
  ) AS v(appointment_type_code, display_name, is_default, pid_zero_allowed)
  ON CONFLICT (tenant_id, appointment_type_code) DO NOTHING;
END $$;

-- Note: If no tenants exist at migration time, no rows are inserted.
-- New tenants created after this migration must be seeded separately
-- (e.g. via scripts/seed-tenant.ts or a future trigger).
