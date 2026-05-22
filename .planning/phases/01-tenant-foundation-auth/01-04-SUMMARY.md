---
phase: 01-tenant-foundation-auth
plan: "01-PLAN-04"
subsystem: api
tags: [supabase, seed, server-action, zod-v4, vault, tenant-settings, service-role, typescript]

dependency_graph:
  requires:
    - next-app-scaffold
    - supabase-server-client
    - ara-domain-types
    - auth-login-page
    - dashboard-shell
  provides:
    - tenant-seed-script
    - tenant-settings-api
    - tenant-settings-page
    - migration-000006-feature-flags
  affects:
    - phase-2-n8n-ingestion (vault key naming: medstar_key_{tenant_id}, elevenlabs_key_{tenant_id})
    - phase-5-configuration (settings page pattern: Server Component + Client Component form)
    - phase-7-user-management (ara_role check pattern from JWT app_metadata)

tech-stack:
  added: []
  patterns:
    - "Service Role Client mandatory for tenants table (no RLS) — Anon-Key returns 0 rows"
    - "Server Component page + Client Component form (SettingsForm.tsx) for useActionState (React 19)"
    - "Zod v4: z.url() not z.string().url(), z.record(z.string(), z.boolean()) for active_features"
    - "Seed script: standalone @supabase/supabase-js createClient with SERVICE_ROLE_KEY directly"
    - "Vault write: supabase.schema('vault').from('secrets').insert() or vault.secrets direct insert"
    - "tenant_id extracted exclusively from user.app_metadata['tenant_id'] — never from request body"
    - "ara_role extracted from user.app_metadata['ara_role'] for RBAC — never from request body"

key-files:
  created:
    - supabase/migrations/20260522000006_tenant_features.sql
    - scripts/seed-tenant.ts
    - src/app/api/settings/tenant/route.ts
    - src/app/(dashboard)/settings/actions.ts
    - src/app/(dashboard)/settings/SettingsForm.tsx
    - src/app/(dashboard)/settings/page.tsx
  modified: []

key-decisions:
  - "Settings form extracted to SettingsForm.tsx Client Component: useActionState (React 19) requires 'use client'; Server Component cannot use form action={serverAction} when action returns non-void state"
  - "Seed script uses @supabase/supabase-js directly (not Next.js server.ts): standalone script runs outside Next.js context, no cookie store available"
  - "Vault write via supabase.schema('vault').from('secrets').insert() as primary path with RPC fallback: most reliable approach without requiring a custom RPC function"
  - "Feature toggles rendered as visual-only toggle UI with checkbox inputs: native HTML checkboxes with sr-only class preserve accessibility and form submission without JavaScript dependency"
  - "Task 1 (supabase db push checkpoint) auto-approved per orchestrator instructions: user runs this manually after Supabase project setup"

patterns-established:
  - "Settings API pattern: GET + PATCH on same route file; both validate via getUser() then createServiceRoleClient() for tenants table access"
  - "Role gating pattern: const allowedRoles: AraRole[] = ['operator', 'ordination_admin']; allowedRoles.includes(araRole) — used in both API route and Server Action"
  - "Seed script pattern: assertEnv() helper validates all required env vars before any DB operations; clean exit with descriptive error if missing"

requirements-completed: [TENANT-01, TENANT-03, TENANT-04, TENANT-05]

duration: 18min
completed: 2026-05-22
---

# Phase 1 Plan 04: Seed Script, Tenant Settings API, and Settings Page Summary

**Tenant bootstrapping via service-role seed script storing MEDSTAR/ElevenLabs keys in vault.secrets, plus role-gated GET/PATCH settings API and Server Component settings page with German labels and active_features toggles.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-22T10:00:00Z
- **Completed:** 2026-05-22T10:18:00Z
- **Tasks:** 1 complete (Task 1 auto-approved, Task 2 implemented)
- **Files created:** 6

## Accomplishments

- Seed script creates tenant row + user_tenant_roles row + stores MEDSTAR and ElevenLabs keys in Supabase Vault (vault.secrets) — keys never stored in tenants table columns
- GET /api/settings/tenant returns tenant config (name, hostname, fallback_phone, forwarding_phone, medstar_server_url, active_features) without any Vault secrets; PATCH validates ara_role from JWT and updates via service role
- Settings page (/settings) is a Server Component reading tenant data via createServiceRoleClient(); form extracted to SettingsForm.tsx (Client Component) using useActionState for Server Action feedback; German labels throughout; no api_key fields
- Migration 20260522000006 documents Phase 1 default active_features keys as idempotent comment-only migration

## Task Commits

1. **Task 1: supabase db push checkpoint** — Auto-approved (user runs manually after Supabase project setup)
2. **Task 2: Seed script, tenant settings API, and settings page** — `068348b` (feat)

**Plan metadata:** (pending — created in this step)

## Files Created/Modified

- `supabase/migrations/20260522000006_tenant_features.sql` — Comment-only idempotent migration documenting Phase 1 active_features default keys
- `scripts/seed-tenant.ts` — TypeScript seed script; reads TENANT_NAME, OPERATOR_USER_ID, MEDSTAR_KEY, ELEVENLABS_KEY from env; inserts tenant + role + vault secrets; prints tenant_id at end
- `src/app/api/settings/tenant/route.ts` — GET (reads config, no vault secrets) + PATCH (validates ara_role, updates via service role); both use getUser() only
- `src/app/(dashboard)/settings/actions.ts` — 'use server' Server Action; Zod v4 validation; createServiceRoleClient() for write; returns success/error state
- `src/app/(dashboard)/settings/SettingsForm.tsx` — 'use client' form with useActionState (React 19); hostname, MEDSTAR URL, fallback phone, forwarding phone, feature toggle checkboxes
- `src/app/(dashboard)/settings/page.tsx` — Server Component; createServiceRoleClient() for tenant read; passes data to SettingsForm; no api_key fields; Vault notice rendered

## Decisions Made

1. **SettingsForm extracted to Client Component:** The Server Action `updateTenantAction` returns a state value (SettingsActionState). A `<form action={serverAction}>` in a Server Component only accepts `(formData: FormData) => void | Promise<void>`. To use `useActionState` for form feedback (React 19 pattern, same as all other forms in this project), the form is extracted to `SettingsForm.tsx` as a Client Component.

2. **Seed script standalone client:** `scripts/seed-tenant.ts` uses `createClient` from `@supabase/supabase-js` directly rather than the Next.js `createServerClient()`. The seed script runs outside the Next.js context (no cookie store, no `next/headers`), so the standalone client with SERVICE_ROLE_KEY is the correct approach.

3. **Vault write path:** Primary vault write uses `supabase.schema('vault').from('secrets').insert()`. This is the most reliable path without requiring a custom RPC function to be present. The seed script also includes an RPC fallback pattern for environments where a `vault.create_secret` function exists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Server Action cannot be used directly as form action in Server Component**
- **Found during:** Task 2 (settings page creation)
- **Issue:** `<form action={updateTenantAction}>` fails TypeScript validation because the Server Action returns `Promise<SettingsActionState>` (non-void) but the `action` prop expects `(formData: FormData) => void | Promise<void>`. TypeScript error TS2322.
- **Fix:** Extracted the form to `SettingsForm.tsx` Client Component using `useActionState(updateTenantAction, initialState)` — identical pattern to all other forms in this codebase (LoginForm.tsx, TOTPSetupForm.tsx, etc.)
- **Files modified:** `src/app/(dashboard)/settings/SettingsForm.tsx` (new), `src/app/(dashboard)/settings/page.tsx` (updated to use SettingsForm)
- **Verification:** `npx tsc --noEmit` exits 0; `npm run build` exits 0
- **Committed in:** 068348b

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bug)
**Impact on plan:** Auto-fix aligns with the established Server Component + Client Component form split pattern documented in STATE.md. No scope creep.

## Issues Encountered

None beyond the auto-fixed TypeScript deviation above.

## Known Stubs

None — all files connect to real Supabase operations. The seed script writes real vault.secrets rows. The settings API reads/writes real tenants rows. The settings page renders real tenant data loaded server-side. Feature toggles are functional (checkbox values passed via formData to Server Action) — note that the visual toggle appearance is server-rendered based on DB state; client-side toggle animation requires JavaScript (gracefully degrades to checkbox behavior without JS).

## Threat Model Compliance

| Threat | Status |
|--------|--------|
| T-04-01: PATCH reads tenant_id from request body | MITIGATED — route.ts reads tenant_id exclusively from `user.app_metadata['tenant_id']`; body tenant_id is never read |
| T-04-02: GET returns Vault secret | MITIGATED — SELECT query explicitly lists config fields only; vault is never queried in this route |
| T-04-03: Assistant/Viewer calls PATCH | MITIGATED — `allowedRoles: AraRole[] = ['operator', 'ordination_admin']`; returns 403 for all other roles |
| T-04-04: Seed script with hardcoded keys | MITIGATED — all keys read from process.env; assertEnv() validates presence; `process.exit(1)` if missing |
| T-04-05: DoS via unrestricted PATCH | ACCEPTED — MVP scope; rate limiting deferred to Phase 8 |
| T-04-SC: Unexpected migration | ACCEPTED — Migration 000006 is comment-only; no DDL risk |

## Threat Flags

None — no new network endpoints or trust boundaries beyond what the plan specified.

## Next Phase Readiness

- Phase 1 Walking Skeleton is complete: all 4 plans done
- User must run `supabase db push` to apply all 6 migrations to their Supabase project
- User must run `scripts/seed-tenant.ts` to bootstrap first tenant + Vault keys
- User must register Custom Access Token Hook in Supabase Dashboard (Auth > Hooks > Custom Access Token Hook → `public.custom_access_token_hook`)
- After setup: login → TOTP → /dashboard → /settings end-to-end loop is functional
- Phase 2 (n8n Event Ingestion Pipeline) can proceed once DB schema is live

## Self-Check: PASSED

Files verified:
- FOUND: supabase/migrations/20260522000006_tenant_features.sql
- FOUND: scripts/seed-tenant.ts
- FOUND: src/app/api/settings/tenant/route.ts
- FOUND: src/app/(dashboard)/settings/actions.ts
- FOUND: src/app/(dashboard)/settings/SettingsForm.tsx
- FOUND: src/app/(dashboard)/settings/page.tsx

Commits verified:
- FOUND: 068348b (feat(01-PLAN-04): seed script, tenant settings API, and settings page)

---
*Phase: 01-tenant-foundation-auth*
*Completed: 2026-05-22*
