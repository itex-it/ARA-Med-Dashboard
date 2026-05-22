# Walking Skeleton — Phase 1: Tenant Foundation & Auth

**Phase:** 1
**Written:** 2026-05-22

---

## What the Walking Skeleton Proves

A single end-to-end path that exercises every architectural layer:

1. Browser opens `/auth/login`
2. User submits email + password → Supabase Auth validates credentials
3. Custom Access Token Hook fires → injects `tenant_id` and `ara_role` into JWT `app_metadata`
4. `proxy.ts` refreshes the session cookie and redirects to `/dashboard`
5. Dashboard Server Component calls `supabase.auth.getUser()` → reads `user.app_metadata.tenant_id`
6. Server Component queries `user_tenant_roles` — RLS allows only this tenant's row
7. Browser receives the protected dashboard page
8. User clicks "Abmelden" → Server Action calls `signOut` → session destroyed → redirect to `/auth/login`

This path proves:
- Supabase client wiring works (`@supabase/ssr`, `createServerClient`, `createBrowserClient`)
- `proxy.ts` auth refresh is functional (cookie-based sessions survive browser refresh)
- Custom Access Token Hook fires and `app_metadata` contains `tenant_id`
- RLS tenant isolation works (querying a table returns only rows for the authenticated tenant)
- Service-role key is never in the browser bundle
- TOTP enrollment gate activates for Operator and Arzt/Admin roles (AAL2 enforcement)

---

## What Gets Built

### Infrastructure (Plan 01 — Wave 1)
- `next.config.ts` configured for strict TypeScript
- `src/lib/supabase/server.ts` — `createServerClient()` with `import 'server-only'`
- `src/lib/supabase/client.ts` — `createBrowserClient()` singleton
- `proxy.ts` — auth token refresh + AAL2 enforcement + unauthenticated redirect
- `src/lib/types/database.types.ts` — placeholder until `supabase gen types` runs
- `src/lib/types/index.ts` — shared domain types (`TenantRow`, `UserTenantRole`)
- Tailwind v4 CSS setup in `src/app/globals.css`
- shadcn/ui initialized with OKLCH color system
- Zod v4 confirmed in `package.json`

### Database (Plan 02 — Wave 1)
- `supabase/migrations/20260522000001_tenants.sql` — `tenants` table (no RLS, operator-only via service role)
- `supabase/migrations/20260522000002_user_tenant_roles.sql` — `user_tenant_roles` table with RLS
- `supabase/migrations/20260522000003_rls_policies.sql` — RLS policies for `user_tenant_roles`, composite indexes
- `supabase/migrations/20260522000004_access_token_hook.sql` — Custom Access Token Hook function + grant
- `supabase/migrations/20260522000005_vault_helper.sql` — `get_secret()` function, revoke from public/authenticated/anon

### Auth Flow (Plan 03 — Wave 2)
- `src/app/auth/login/page.tsx` — Login form (email + password), Server Action, redirect on success
- `src/app/auth/logout/route.ts` — Route Handler calling `supabase.auth.signOut()`
- `src/app/auth/reset-password/page.tsx` — Password reset request form
- `src/app/auth/update-password/page.tsx` — Password update form (from email link)
- `src/app/auth/setup-totp/page.tsx` — TOTP enrollment (QR code + verification code)
- `src/app/auth/verify-totp/page.tsx` — TOTP challenge (second factor entry)
- `src/app/(dashboard)/layout.tsx` — Protected layout shell (nav + status placeholder)
- `src/app/(dashboard)/dashboard/page.tsx` — Minimal authenticated landing page (proves DB read works)

### Tenant & Vault Setup (Plan 04 — Wave 3)
- `scripts/seed-tenant.ts` — Script to create the first tenant row + assign operator user + store Vault keys
- `supabase/migrations/20260522000006_tenant_features.sql` — `active_features` JSONB default, `require_mfa_level` default
- `src/app/(dashboard)/settings/page.tsx` — Minimal tenant settings page (hostname, fallback phone, active features)
- `src/app/api/settings/tenant/route.ts` — GET/PATCH for tenant config (operator-only, service role)
- Schema push task runs `supabase db push`

---

## Architecture Decisions Locked In

| Decision | Choice | Reason |
|----------|--------|--------|
| Auth file | `proxy.ts` (not `middleware.ts`) | Next.js 16 renamed the file |
| SSR client | `@supabase/ssr` | Replaces deprecated `auth-helpers-nextjs` |
| Server client guard | `import 'server-only'` in `server.ts` | Prevents accidental browser import |
| JWT claims | Custom Access Token Hook → `app_metadata` | User cannot modify `app_metadata`; no per-row join needed |
| RLS pattern | `(SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid` | Cached subquery, not per-row evaluation |
| Zod version | v4 (`z.email()` not `z.string().email()`) | Breaking API change; must be consistent |
| tenant_id source | JWT `app_metadata` only, never request body | Core security constraint |
| Session invalidation | `supabase.auth.admin.signOut(userId, { scope: 'global' })` | Immediate cross-device revocation |
| Key storage | Supabase Vault only (`medstar_key_{tenant_id}`, `elevenlabs_key_{tenant_id}`) | Never in DB columns or env vars |
| Vault access | `get_secret()` function, callable by `service_role` only | `vault.decrepted_secrets` revoked from authenticated/anon |

---

## Success Definition

The Walking Skeleton is complete when ALL of the following are true:

1. `npm run dev` starts with zero TypeScript errors
2. `tsc --noEmit` exits 0
3. A developer can visit `http://localhost:3000/auth/login`, log in with a seeded user, and reach `/dashboard`
4. Browser DevTools network tab shows NO requests containing `SUPABASE_SERVICE_ROLE_KEY` or any secret
5. Logging in as an Operator/Arzt-Admin with only AAL1 redirects to `/auth/setup-totp`
6. Logging out terminates the session (redirect to login, protected routes return 401/redirect)
7. `supabase db diff` shows no uncommitted schema changes after migrations run
8. Querying `user_tenant_roles` as one tenant's user returns zero rows for another tenant's data

---

## What Is NOT Built (Out of Scope for Skeleton)

- Any call log, inbox, or status bar UI (Phase 2+)
- n8n integration or webhook endpoints (Phase 2)
- Full Operator RBAC management UI (Phase 7)
- Magic link login (deferred post-MVP)
- Complete settings UI beyond minimal tenant config (Phase 5+)
- Statistics, audit log, or reporting (Phase 7-8)
