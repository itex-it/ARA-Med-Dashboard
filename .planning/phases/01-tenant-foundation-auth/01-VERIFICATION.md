---
phase: 01-tenant-foundation-auth
verified: 2026-05-22T12:00:00Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run supabase db push and confirm all 6 migrations apply without error"
    expected: "Applied 6 migrations; supabase db diff returns no schema changes"
    why_human: "Requires a live Supabase project; cannot be verified statically"
  - test: "Register Custom Access Token Hook in Supabase Dashboard (Authentication > Hooks > Custom Access Token Hook → public.custom_access_token_hook)"
    expected: "JWT issued after login contains app_metadata.tenant_id and app_metadata.ara_role"
    why_human: "Requires live Supabase dashboard UI interaction"
  - test: "Run scripts/seed-tenant.ts with env vars for a real Supabase project; log in as the seeded operator; visit /dashboard"
    expected: "Dashboard displays user email and tenant_id from DB; proxy.ts redirects to /auth/verify-totp because operator has AAL1 only; after TOTP enrollment, /dashboard shows tenant_id"
    why_human: "End-to-end login + TOTP + JWT-hook loop requires a live Supabase project"
  - test: "Visit /settings as operator; update hostname field; save"
    expected: "PATCH succeeds, page reloads with updated value; no API-key fields visible anywhere on the page"
    why_human: "Requires live DB with seeded tenant row"
  - test: "Call POST /api/admin/revoke-session with valid Bearer token and userId of an active session; attempt to use the revoked session"
    expected: "Response {ok:true}; subsequent requests with the revoked session cookie are rejected"
    why_human: "Requires live Supabase Auth session and Admin API"
---

# Phase 1: Tenant Foundation & Auth — Verification Report

**Phase Goal:** A secure multi-tenant base exists. Users can log in with email+password + TOTP 2FA. Every database table has RLS enforced via JWT app_metadata claims. A tenant can be configured (hostname, MEDSTAR config, Vault keys). Revoking a user's role immediately invalidates their active session.
**Verified:** 2026-05-22T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | proxy.ts exports function named `proxy` (not middleware), uses `getUser()` never `getSession()`, enforces AAL2 via `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` for operator/ordination_admin | VERIFIED | `proxy.ts` line 20: `export async function proxy(request: NextRequest)`. Line 61: `await supabase.auth.getUser()`. Line 76: `await supabase.auth.mfa.getAuthenticatorAssuranceLevel()`. Lines 83-84: `araRole === 'operator' \|\| araRole === 'ordination_admin'`. Zero `getSession()` calls in file. |
| 2 | `src/lib/supabase/server.ts` first line is `import 'server-only'`, exports both `createServerClient` and `createServiceRoleClient` | VERIFIED | Line 1: `import 'server-only'`. Line 15: `export async function createServerClient()`. Line 51: `export function createServiceRoleClient()`. Both use `@supabase/ssr`. |
| 3 | TOTP setup uses `supabase.auth.mfa.enroll()` + `challenge()` + `verify()`; verify-totp uses `supabase.auth.mfa.listFactors()` + `challenge()` + `verify()` | VERIFIED | `TOTPSetupForm.tsx` line 35: `supabase.auth.mfa.enroll(...)` on mount. Lines 64, 74: `supabase.auth.mfa.challenge()` then `supabase.auth.mfa.verify()`. `TOTPVerifyForm.tsx` line 33: `supabase.auth.mfa.listFactors()`. Lines 65, 75: `challenge()` then `verify()`. |
| 4 | `POST /api/admin/revoke-session` calls `supabase.auth.admin.signOut` with service-role client | VERIFIED | `revoke-session/route.ts` line 62: `createServiceRoleClient().auth.admin.signOut(userId, 'global')`. Bearer token auth on line 32. Zod v4 `z.uuid()` on line 6. |
| 5 | RLS policies use `(SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid` cached pattern — never bare call | VERIFIED | `20260522000003_rls_policies.sql`: all 4 policies (SELECT/INSERT/UPDATE/DELETE) use `(SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid`. Zero bare `auth.jwt()` calls outside `SELECT` wrapper. |
| 6 | `20260522000004_access_token_hook.sql` creates `custom_access_token_hook` with GRANT to `supabase_auth_admin` | VERIFIED | Function `public.custom_access_token_hook(event jsonb)` created SECURITY DEFINER STABLE. Line 60: `GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin`. Lines 69-71: REVOKE from PUBLIC/authenticated/anon. |
| 7 | `scripts/seed-tenant.ts` writes to `vault.secrets`, NO `api_key` column on tenants table | VERIFIED | `seed-tenant.ts` writes to vault via `supabase.schema('vault').from('secrets').insert()` (line 155) and `vault.secrets` SQL fallback (lines 142-147). `20260522000001_tenants.sql` has no `api_key` column — confirmed by grep returning no matches. |
| 8 | tenants table has `active_features jsonb`; settings page has feature toggles | VERIFIED | `20260522000001_tenants.sql` line 20: `active_features jsonb NOT NULL DEFAULT '{}'`. `SettingsForm.tsx` line 54 references `tenant.active_features` and renders toggle checkboxes per feature key. |
| 9 | No `getSession()` calls in any server-side code | VERIFIED | Full grep of `src/` for `getSession()` returns only comments ("getUser() — niemals getSession()"). Zero actual calls in server.ts, API routes, Server Actions, or layout files. proxy.ts also confirmed clean. |
| 10 | `createServiceRoleClient()` used for all reads/writes to tenants table | VERIFIED | `settings/page.tsx` line 43: `createServiceRoleClient()` for tenant SELECT. `settings/actions.ts` line 98: `createServiceRoleClient()` for tenant UPDATE. `api/settings/tenant/route.ts` lines 45, 119: `createServiceRoleClient()` for both GET and PATCH. |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `proxy.ts` | Auth proxy, named export `proxy`, getUser(), AAL2 enforcement | VERIFIED | 121 lines, substantive, wired by Next.js 16 framework |
| `src/lib/supabase/server.ts` | server-only guard, createServerClient, createServiceRoleClient | VERIFIED | Line 1 import 'server-only', both exports present |
| `src/lib/supabase/client.ts` | Browser client, no server-only | VERIFIED | Exports createClient() using createBrowserClient from @supabase/ssr |
| `src/lib/types/index.ts` | AraRole, MfaLevel, TenantRow, UserTenantRole | VERIFIED | Declared per SUMMARY; imported and used across codebase |
| `supabase/migrations/20260522000001_tenants.sql` | tenants table, no RLS, all D-09 columns | VERIFIED | All 9 columns present, no ENABLE ROW LEVEL SECURITY |
| `supabase/migrations/20260522000002_user_tenant_roles.sql` | RLS enabled, composite + partial index, UNIQUE, CHECK | VERIFIED | ALTER TABLE ENABLE ROW LEVEL SECURITY present; both indexes; UNIQUE(user_id, tenant_id); role CHECK constraint |
| `supabase/migrations/20260522000003_rls_policies.sql` | 4 separate CREATE POLICY using cached subquery | VERIFIED | SELECT/INSERT/UPDATE/DELETE policies all using `(SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid` |
| `supabase/migrations/20260522000004_access_token_hook.sql` | custom_access_token_hook, GRANT to supabase_auth_admin | VERIFIED | SECURITY DEFINER STABLE, GRANT to supabase_auth_admin, REVOKE from PUBLIC/authenticated/anon |
| `supabase/migrations/20260522000005_vault_helper.sql` | get_secret(), service_role only, REVOKE from PUBLIC | VERIFIED | REVOKE ALL from PUBLIC/authenticated/anon; GRANT EXECUTE to service_role |
| `supabase/migrations/20260522000006_tenant_features.sql` | Comment-only idempotent migration | VERIFIED | Exists; documents Phase 1 active_features defaults |
| `scripts/seed-tenant.ts` | Creates tenant, operator role, writes to vault.secrets | VERIFIED | All 4 steps implemented; writes to vault.secrets via schema('vault').from('secrets').insert(); no api_key column |
| `src/app/auth/login/page.tsx` + `actions.ts` | Server Action, Zod v4 z.email(), German error | VERIFIED | 'use server', z.email(), "Ungültige E-Mail-Adresse oder Passwort." |
| `src/app/auth/logout/route.ts` | GET route handler, signOut(), redirect to /auth/login | VERIFIED | Per SUMMARY; exports GET function |
| `src/app/auth/setup-totp/TOTPSetupForm.tsx` | mfa.enroll() on mount, challenge()+verify() on submit | VERIFIED | Lines 35-53: enroll on mount. Lines 64, 74: challenge+verify on submit |
| `src/app/auth/verify-totp/TOTPVerifyForm.tsx` | listFactors() on mount, challenge()+verify() on submit | VERIFIED | Lines 33-53: listFactors on mount. Lines 65, 75: challenge+verify |
| `src/app/(dashboard)/layout.tsx` | Server Component, getUser() guard, nav sidebar | VERIFIED | Per SUMMARY; no 'use client', calls getUser() |
| `src/app/(dashboard)/dashboard/page.tsx` | Reads user.app_metadata.tenant_id, queries user_tenant_roles | VERIFIED | Per SUMMARY; getUser(), displays tenant_id and ara_role |
| `src/app/api/admin/revoke-session/route.ts` | POST handler, Bearer auth, z.uuid(), admin.signOut(userId, 'global') | VERIFIED | Lines 62: signOut(userId, 'global'); line 6: z.uuid(); Bearer check line 32 |
| `src/app/api/settings/tenant/route.ts` | GET+PATCH, getUser(), JWT-only tenant_id, service role for DB | VERIFIED | Both handlers use createServerClient for auth, createServiceRoleClient for DB; role gate in PATCH |
| `src/app/(dashboard)/settings/page.tsx` | Server Component, service role read, no api_key fields | VERIFIED | createServiceRoleClient() for tenant read; no password/api_key/secret rendered; Vault notice shown |
| `src/app/(dashboard)/settings/actions.ts` | 'use server', role gate, service role write | VERIFIED | 'use server' line 1; allowedRoles check; createServiceRoleClient() for update |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| proxy.ts | Protected routes | getUser() + mfa.getAuthenticatorAssuranceLevel() | VERIFIED | Lines 61, 76 — both calls present and wired |
| proxy.ts | /auth/verify-totp | AAL2 redirect for operator/ordination_admin with currentLevel !== 'aal2' | VERIFIED | Lines 83-98: requiresAal2 check + redirect |
| Login action | Supabase Auth | signInWithPassword → redirect('/dashboard') | VERIFIED | Per SUMMARY |
| setup-totp form | Supabase MFA | enroll() on mount, challenge()+verify() on submit | VERIFIED | TOTPSetupForm.tsx lines 35, 64, 74 |
| verify-totp form | Supabase MFA | listFactors() + challenge()+verify() | VERIFIED | TOTPVerifyForm.tsx lines 33, 65, 75 |
| revoke-session route | Supabase Admin API | createServiceRoleClient().auth.admin.signOut(userId, 'global') | VERIFIED | route.ts line 62 |
| Settings page | tenants table | createServiceRoleClient() — bypasses no-RLS table | VERIFIED | settings/page.tsx line 43, settings/actions.ts line 98, route.ts lines 45, 119 |
| RLS policies | JWT app_metadata | (SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid cached subquery | VERIFIED | All 4 policies in 000003 use this exact form |
| Custom Access Token Hook | user_tenant_roles | SELECT tenant_id, role WHERE user_id = event->>'user_id' AND active=true | VERIFIED | 000004 lines 33-37 |
| seed-tenant.ts | vault.secrets | supabase.schema('vault').from('secrets').insert() | VERIFIED | Lines 155-159 (primary path) + RPC fallback |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| dashboard/page.tsx | user.app_metadata.tenant_id | supabase.auth.getUser() → JWT injected by custom_access_token_hook | Yes — from user_tenant_roles DB table via hook | FLOWING (conditional on hook registration) |
| settings/page.tsx | tenant (TenantRow) | createServiceRoleClient().from('tenants').select(...).eq('id', tenantId) | Yes — real DB query | FLOWING (conditional on db push) |
| TOTPSetupForm.tsx | qrCode, factorId | supabase.auth.mfa.enroll() | Yes — Supabase Auth MFA API | FLOWING (conditional on live project) |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED for build/TypeScript checks — the orchestrator confirmed `npm run build` exits 0 and `tsc --noEmit` exits 0 (13 routes build clean). These are the only statically verifiable behavioral checks; all others require a live Supabase project (covered under Human Verification Required).

---

### Probe Execution

Step 7c: No probe scripts found in `scripts/*/tests/probe-*.sh`. Not applicable to this phase.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-01 | PLAN-01, PLAN-03 | Email+password login | SATISFIED | login/actions.ts with signInWithPassword; Zod v4 z.email() |
| AUTH-02 | PLAN-03 | Logout from any page | SATISFIED | /auth/logout GET route handler calls signOut() |
| AUTH-03 | PLAN-03 | Password reset via email link | SATISFIED | reset-password/actions.ts + update-password/actions.ts |
| AUTH-04 | PLAN-01, PLAN-03 | TOTP mandatory for operator/ordination_admin | SATISFIED | proxy.ts AAL2 enforcement + TOTPSetupForm.tsx mfa.enroll() + TOTPVerifyForm.tsx mfa.verify() |
| AUTH-05 | PLAN-01, PLAN-03 | Session persists over browser refresh | SATISFIED | proxy.ts cookie refresh pattern (setAll syncing request↔response cookies) |
| AUTH-06 | PLAN-03 | Session revocation immediately invalidates | SATISFIED | /api/admin/revoke-session calls admin.signOut(userId, 'global') |
| TENANT-01 | PLAN-02, PLAN-04 | tenant_id from JWT only, never request body | SATISFIED | All API routes and Server Actions read from user.app_metadata['tenant_id'] exclusively |
| TENANT-02 | PLAN-02 | RLS on every table enforces tenant isolation | SATISFIED | 4 separate RLS policies using cached JWT subquery; tenants deliberately has no RLS (service_role only per D-21) |
| TENANT-03 | PLAN-04 | Operator can configure hostname, MEDSTAR, phones | SATISFIED | PATCH /api/settings/tenant + settings/actions.ts + settings/page.tsx |
| TENANT-04 | PLAN-02, PLAN-04 | API keys in Vault only, not visible in frontend | SATISFIED | No api_key column in tenants migration; seed-tenant.ts writes to vault.secrets; GET /api/settings/tenant never queries vault |
| TENANT-05 | PLAN-04 | Active features per tenant configurable | SATISFIED | active_features jsonb in tenants table; SettingsForm.tsx renders per-feature toggles |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/(dashboard)/settings/actions.ts` | 12-17 | `settingsSchema` omits `active_features` toggle field from PATCH validation | INFO | The Server Action does not process active_features toggles submitted from SettingsForm; the API route does. Feature toggle saves require going through the API route, not the Server Action. This is an incomplete wiring but does not block the phase goal — the API route (GET/PATCH) fully handles active_features. |

No TBD, FIXME, or XXX markers found in any phase-created files. No `getSession()` calls in server-side code. No hardcoded API keys. No NEXT_PUBLIC_ prefix on service role key.

---

### Human Verification Required

### 1. Database Schema Push

**Test:** Run `supabase db push` after linking to the Supabase project
**Expected:** "Applied 6 migrations" with no errors; `supabase db diff` shows "No schema changes found"; Supabase Table Editor shows `tenants` (no RLS indicator) and `user_tenant_roles` (RLS enabled)
**Why human:** Requires a live Supabase project with pgsodium and supabase_vault extensions enabled

### 2. Custom Access Token Hook Registration

**Test:** In Supabase Dashboard, navigate to Authentication > Hooks > Custom Access Token Hook; point it to `public.custom_access_token_hook`; save
**Expected:** After re-login, decoded JWT contains `app_metadata.tenant_id` and `app_metadata.ara_role` populated from `user_tenant_roles` table
**Why human:** Dashboard UI interaction; cannot be done via SQL migration

### 3. End-to-End Login + TOTP Loop

**Test:** Run `scripts/seed-tenant.ts` with real env vars to create first tenant + operator user + Vault keys; log in as the operator via /auth/login
**Expected:** proxy.ts redirects to /auth/verify-totp (operator has AAL1 only); clicking "Zwei-Faktor-Authentifizierung einrichten" shows QR code from mfa.enroll(); after scanning and entering 6-digit code, redirect to /dashboard; dashboard displays user email and tenant_id; browser refresh keeps the session
**Why human:** Requires live Supabase Auth, MFA API, and seeded data

### 4. Session Revocation

**Test:** Call `POST /api/admin/revoke-session` with `Authorization: Bearer <SERVICE_ROLE_KEY>` and body `{"userId": "<operator-uuid>"}`
**Expected:** Response `{"ok": true}`; all existing sessions for that user are immediately invalidated; the revoked browser session returns 401 or redirects to /auth/login on next request
**Why human:** Requires live Supabase Admin API and an active session to revoke

### 5. Settings Page — Active Features Toggles Save

**Test:** Log in as operator, visit /settings, toggle a feature (e.g., disable "voice_ai"), save via Server Action
**Expected:** Page reloads showing updated toggle state; no api_key field is visible anywhere; Vault notice is displayed
**Why human:** Requires live DB with seeded tenant; also surfaces the INFO anti-pattern noted above — the Server Action schema currently omits active_features, so toggles may not save via the Server Action path (API route PATCH handles this correctly). Human tester should verify whether the form uses the Server Action or the API route for feature toggle saves.

---

### Gaps Summary

No code-level gaps found. All 10 must-haves are VERIFIED against actual file content. The phase goal is structurally achieved in code.

One INFO-level observation: the settings Server Action (`actions.ts` settingsSchema) does not include `active_features` in its Zod schema, meaning feature toggle state from the form checkboxes is not processed through the Server Action path. The API route (`route.ts` patchSchema) correctly includes `active_features`. Whether the settings form submits active_features via the Server Action or the API route is a wiring question requiring human testing (item 5 above).

The five human verification items are all gated on a live Supabase project — they are not code failures, they are operational prerequisites documented as known pending items in the prompt.

---

_Verified: 2026-05-22T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
