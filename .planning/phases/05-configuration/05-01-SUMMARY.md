---
plan: 05-01
phase: 05-configuration
status: complete
completed: 2026-05-23
---

# 05-01 Summary: DB Foundation + Environment

## What was built

- **3 migration files** applied to self-hosted Supabase (api.supabase.itex.at):
  - `20260523000018` — 9 config tables with composite indexes
  - `20260523000019` — 36 RLS policies (cached JWT pattern)
  - `20260523000020` — Seed: 7 Austrian GP appointment types (empty until first tenant created)
- **`.env.local`** created with ANON_KEY + SERVICE_ROLE_KEY for api.supabase.itex.at
- **`src/lib/types/index.ts`** — 9 new Row interfaces + 3 union types (GreetingMode, SpecialDayType, PidZeroBehavior)
- **`src/app/(dashboard)/layout.tsx`** — Konfiguration nav link added between Inbox and Einstellungen
- **4 shadcn components** installed: calendar, popover, dialog, checkbox

## Verification

- 15 ARA-Med tables in public schema ✓
- 52 RLS policies total ✓
- TypeScript compiles clean (`npx tsc --noEmit` exits 0) ✓
- Supabase connection: api.supabase.itex.at (PostgreSQL 15.8) ✓

## Notes

- Appointment types seed returns 0 rows on fresh DB — correct, requires first tenant via `scripts/seed-tenant.ts`
- calendar.tsx: removed unsupported `table` classNames key (react-day-picker version mismatch in shadcn registry)
- Supabase accessed via Studio pg-meta API (Basic Auth) — Postgres not exposed externally
