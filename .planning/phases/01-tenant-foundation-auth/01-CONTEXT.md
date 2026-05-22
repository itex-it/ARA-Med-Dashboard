# Phase 1: Tenant Foundation & Auth - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the secure multi-tenant base on which every other phase depends. By the end of Phase 1:
- Users can log in with email/password + TOTP 2FA (Operator and Arzt/Admin: mandatory AAL2)
- Every database table has RLS enforced via JWT `app_metadata` claims
- A tenant can be configured (hostname, MEDSTAR config, Vault keys)
- Revoking a user's role immediately invalidates their active session
- No feature outside of Auth and Tenant setup is built in this phase

**Out of scope for Phase 1:** Call log, inbox, status bar, n8n integration, any medical practice data, Supabase Realtime subscriptions, full Operator RBAC UI (Phase 7), magic link login (deferred post-MVP).

</domain>

<decisions>
## Implementation Decisions

### Custom Access Token Hook

- **D-01:** Use Supabase Auth **Custom Access Token Hook** (Edge Function) to inject `tenant_id` and `ara_role` into the JWT `app_metadata` at token issuance. This is the only pattern that makes RLS policies safe and cheap — no per-row table join needed, and `app_metadata` is server-writable only (users cannot modify it).
- **D-02:** Hook reads from `user_tenant_roles` table: `SELECT tenant_id, role FROM user_tenant_roles WHERE user_id = auth.uid() AND active = true LIMIT 1`. Returns both fields as `app_metadata.tenant_id` and `app_metadata.ara_role`.
- **D-03:** Token validity: 15 minutes (Supabase default with `@supabase/ssr` auto-refresh). Realtime re-authentication on `onAuthStateChange`.

### 2FA Enforcement

- **D-04:** 2FA (TOTP) is **mandatory** for Operator and Arzt/Admin roles — no grace period. On first login, if AAL1 only and role requires AAL2, redirect immediately to TOTP enrollment flow.
- **D-05:** Enforcement via `proxy.ts` (Next.js 16) — check `auth.jwt() ->> 'aal'` on every request for protected routes. AAL1 on an AAL2-required route → redirect to `/auth/setup-totp`.
- **D-06:** Assistenz and Viewer roles: 2FA configurable per tenant (default: optional). Tenant config stored in `tenants.require_mfa_level` field.
- **D-07:** TOTP setup uses Supabase `enrollMFA()` / `challengeMFA()` / `verifyMFA()` client methods. No external TOTP library needed.

### Tenant Creation Workflow (Phase 1 scope)

- **D-08:** Phase 1 provides the data model and Vault key storage. The Operator creates a tenant via a **minimal seed script or direct DB insert** (no full UI in Phase 1). Full Operator RBAC UI with tenant management is Phase 7.
- **D-09:** Tenant row includes: `id`, `name`, `hostname`, `medstar_server_url`, `fallback_phone`, `forwarding_phone`, `require_mfa_level` (default: 'aal2' for operator/admin), `active_features` (JSONB), `created_at`.
- **D-10:** MEDSTAR API key stored in Supabase Vault as `medstar_key_{tenant_id}`. ElevenLabs key as `elevenlabs_key_{tenant_id}`. Phase 1 establishes the Vault structure; n8n uses it from Phase 2.

### Session Invalidation (AUTH-06)

- **D-11:** When a user's role is revoked: call Supabase Admin API `supabase.auth.admin.signOut(userId, { scope: 'global' })` from a Server Action. This invalidates all active sessions immediately.
- **D-12:** All server-side code uses `supabase.auth.getUser()` (not `getSession()`) — `getUser()` re-validates with the Auth server on every call, detecting revoked sessions within the 15-minute token window.
- **D-13:** `proxy.ts` (not `middleware.ts` — Next.js 16) handles auth token refresh and redirects unauthenticated users. `import 'server-only'` in `src/lib/supabase/server.ts` to prevent accidental browser usage of the server client.

### RLS Baseline Template

- **D-14:** **Every table** uses the cached subquery RLS pattern — never the bare call:
  ```sql
  -- MANDATORY on all policies (prevents per-row function evaluation):
  (SELECT auth.jwt() ->> 'tenant_id') = tenant_id::text
  ```
- **D-15:** **Every table** gets a composite index in its migration (before any data):
  ```sql
  CREATE INDEX CONCURRENTLY idx_{table}_tenant_created
    ON {table} (tenant_id, created_at DESC);
  ```
- **D-16:** Phase 1 establishes the RLS migration template that ALL subsequent phases copy. This template is the single most important artifact of Phase 1.
- **D-17:** Separate RLS policies per operation: `SELECT` (tenant match), `INSERT` (tenant match + role check), `UPDATE` (tenant match + role check), `DELETE` (tenant match + manage/admin role only).

### Supabase Client Setup

- **D-18:** Use `@supabase/ssr` package (not deprecated `auth-helpers-nextjs`). Two client types:
  - `createBrowserClient()` — for Client Components only
  - `createServerClient()` — for Server Components, API Routes, Server Actions (via cookie store)
- **D-19:** Next.js 16 uses `proxy.ts` (not `middleware.ts`) for auth token refresh. The Supabase SSR guide's middleware section maps to `proxy.ts` in this project.
- **D-20:** Zod v4 for all input validation. Breaking syntax: `z.email()` not `z.string().email()`, `z.uuid()` not `z.string().uuid()`.

### Phase 1 Core Tables

- **D-21:** Core tables to create in Phase 1 migrations:
  - `tenants` — tenant config (no RLS — Operator-only access via service role)
  - `user_tenant_roles` — maps `auth.users.id` → `tenant_id` + `role` + `permissions` JSONB + `active`
  - No other tables in Phase 1 — subsequent phases add their own tables following the established template.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product Specification
- `docs/specs/product-spec.md` — Sections 6 (RBAC roles and permissions), 7 (Auth and security), 10 (Multilingualism / language_code)
- `docs/specs/technical-architecture.md` — DB schema rules, multi-tenant patterns, Supabase Vault key format

### Research Findings
- `.planning/research/ARCHITECTURE.md` — RLS patterns, Custom Access Token Hook SQL, n8n auth boundary, build order dependency analysis
- `.planning/research/STACK.md` — Next.js 16 proxy.ts pattern, @supabase/ssr setup, Zod v4 breaking changes, Supabase key format migration note
- `.planning/research/PITFALLS.md` — Critical pitfalls C1-C10, session invalidation, RLS performance

### Project Planning
- `.planning/REQUIREMENTS.md` — AUTH-01..06 and TENANT-01..05 requirement details
- `.planning/STATE.md` — Locked architecture decisions and DSGVO compliance checklist

### CLAUDE.md (project coding rules)
- `CLAUDE.md` — TypeScript strict, Supabase patterns, n8n key management, Tool Response format

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. Phase 1 establishes all patterns.

### Established Patterns
- All patterns established in Phase 1 serve as the template for every subsequent phase.
- RLS migration template (D-14, D-15) is the highest-value artifact.
- Supabase client setup (D-18, D-19) is the second-highest-value artifact.

### Integration Points
- `src/lib/supabase/server.ts` — server client (service-role, `import 'server-only'`)
- `src/lib/supabase/client.ts` — browser client
- `proxy.ts` — auth refresh + AAL enforcement
- `supabase/migrations/` — all DB migrations in order

</code_context>

<specifics>
## Specific Ideas

- Next.js 16: file is `proxy.ts`, not `middleware.ts` — official codemod available if migrating, but greenfield starts with `proxy.ts` directly.
- Supabase key format: new projects may use `sb_publishable_xxx` / `sb_secret_xxx` format — verify at project setup; old format works until end of 2026.
- AAL enforcement: `(auth.jwt() ->> 'aal') = 'aal2'` can be added to RLS policies for sensitive tables as an extra enforcement layer beyond the proxy check.
- Supabase Vault: verify `pgsodium` deprecation does not affect Vault during project creation; Vault is a separate layer.

</specifics>

<deferred>
## Deferred Ideas

- Full Operator tenant management UI — Phase 7
- Magic link login — post-MVP (TENANT-05 active features flag can enable it later)
- OAuth/OIDC/SSO — post-MVP (spec section 7 notes "preparation for later")
- Per-tenant custom email templates for auth flows — post-MVP
- Multiple active tenants per user (agency use case) — not in MVP scope

</deferred>

---

*Phase: 1-Tenant Foundation & Auth*
*Context gathered: 2026-05-22*
