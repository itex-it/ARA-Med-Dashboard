---
status: partial
phase: 01-tenant-foundation-auth
source: [01-VERIFICATION.md]
started: 2026-05-22T00:00:00Z
updated: 2026-05-22T00:00:00Z
---

## Current Test

Awaiting human testing — requires a live Supabase project.

## Setup Before Testing

1. Create a Supabase project at https://supabase.com
2. Copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Run: `supabase login && supabase link --project-ref YOUR_PROJECT_REF`
4. Run: `supabase db push` (applies all 6 migrations)
5. In Supabase Dashboard > Authentication > Hooks: register Custom Access Token Hook pointing to `public.custom_access_token_hook`
6. Create a test user in Supabase Auth
7. Run seed script: `npx ts-node scripts/seed-tenant.ts` (with env vars set)

## Tests

### 1. supabase db push — all 6 migrations applied
expected: `supabase db push` completes without errors; Supabase Dashboard Table Editor shows `tenants` and `user_tenant_roles` tables; `supabase db diff` shows no changes
result: [pending]

### 2. Custom Access Token Hook — JWT contains tenant_id and ara_role
expected: After registering the hook and logging in, the JWT `app_metadata` contains `tenant_id` (UUID) and `ara_role` (one of: operator, ordination_admin, assistant, viewer)
result: [pending]

### 3. End-to-end login + TOTP + dashboard loop
expected: Log in at `/auth/login` with seeded operator credentials → proxy.ts detects AAL1 + operator role → redirect to `/auth/setup-totp` → enroll TOTP → verify → reach `/dashboard` → dashboard shows tenant_id from DB
result: [pending]

### 4. Session revocation — immediate invalidation
expected: POST to `/api/admin/revoke-session` with `{"userId": "..."}` and `Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY` header → immediately invalidates all sessions for that user → next request by that user is redirected to `/auth/login`
result: [pending]

### 5. Settings page — active_features toggles save
expected: Log in as operator → navigate to `/settings` → see tenant config form (no API key fields visible, Vault note shown) → toggle a feature flag → submit → feature saved to DB → confirmed via GET /api/settings/tenant
note: Verifier observed that Server Action schema (actions.ts) omits active_features while API route schema includes it — confirm the form uses the API route or update actions.ts schema to include active_features.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
