# STATE: ARA-Med Dashboard

**Project:** ARA-Med Dashboard — Multi-Tenant SaaS Voice AI for Austrian Medical Practices
**Last updated:** 2026-05-22
**Mode:** mvp

---

## Project Reference

**Core Value:** Eine Ordination kann ARA-Med Voice AI aktivieren, alle Telefonate mit Ergebnissen in Echtzeit verfolgen und offene Aufgaben bearbeiten — ohne technisches Know-how.

**Stack:** Next.js 16 + React 19 + TypeScript strict + Tailwind CSS 4 + shadcn/ui + Supabase (Postgres + Realtime + Auth + Vault) + n8n CE + Vercel

**Constraint highlights:**
- tenant_id on every table, RLS on every table — no exceptions
- Service-Role Key only in n8n / API Routes / Server Actions — never in browser
- All external API keys (MEDSTAR, ElevenLabs) in Supabase Vault only
- Provider brand (ElevenLabs, n8n) never visible in the product
- UI in German only for MVP

---

## Current Position

**Current Phase:** 2 — n8n Event Ingestion Pipeline
**Current Plan:** 02-PLAN-01 (Phase 2, not yet started)
**Status:** Phase 1 COMPLETE — all 4 plans (01-PLAN-01, 01-PLAN-02, 01-PLAN-03, 01-PLAN-04) done

**Progress Bar:**
```
Phase 1 [████████] 100% COMPLETE (01-PLAN-01, 01-PLAN-02, 01-PLAN-03, 01-PLAN-04)
Phase 2 [        ] 0%
Phase 3 [        ] 0%
Phase 4 [        ] 0%
Phase 5 [        ] 0%
Phase 6 [        ] 0%
Phase 7 [        ] 0%
Phase 8 [        ] 0%
```

**Overall: 1/8 phases complete**

---

## Phase Summary

| Phase | Name | Requirements | Status |
|-------|------|-------------|--------|
| 1 | Tenant Foundation & Auth | AUTH-01..06, TENANT-01..05 (11 req) | Planned (4 plans, 3 waves) |
| 2 | n8n Event Ingestion Pipeline | REALTIME-01..03 (3 req) | Not started |
| 3 | Core Dashboard — Status Bar & Call Log | STATUS-01..05, CALL-01..10 (15 req) | Not started |
| 4 | Inbox & Task Management | INBOX-01..05 (5 req) | Not started |
| 5 | Configuration | HOURS-01..03, APPT-01..05, TEXT-01..04, DEPUTY-01..04, MED-01 (17 req) | Not started |
| 6 | Routing & Communication Rules | ROUTE-01..03, COMM-01..05 (8 req) | Not started |
| 7 | Statistics & User Management | STAT-01..05, RBAC-01..06 (11 req) | Not started |
| 8 | Audit Log & System Polish | AUDIT-01..03 (3 req) | Not started |

---

## Performance Metrics

**Requirements:** 73 total / 11 complete (AUTH-01..06, TENANT-01..05) / 62 remaining
**Phases:** 8 total / 1 complete (Phase 1)
**Plans:** 4 written (Phase 1) / 4 complete (01-PLAN-01, 01-PLAN-02, 01-PLAN-03, 01-PLAN-04)

---

## Accumulated Context

### Architecture Decisions (Locked)

- **Settings form pattern:** SettingsForm.tsx is a Client Component ('use client') using useActionState; Server Component page passes tenant data as props; Server Action returns non-void state (SettingsActionState) so cannot be used directly as <form action> in a Server Component
- **Vault write path:** supabase.schema('vault').from('secrets').insert() is the primary path for writing to vault.secrets; no custom RPC function required
- **Seed script isolation:** scripts/seed-tenant.ts uses @supabase/supabase-js createClient directly (not Next.js createServerClient); standalone script has no cookie store context
- **proxy.ts pattern:** supabase.auth.mfa.getAuthenticatorAssuranceLevel() — mfa object is on supabase.auth.mfa, not supabase.mfa
- **Turbopack CSS imports:** Bare node_modules CSS imports not supported in Turbopack — use relative paths or local copies for CSS packages
- **Next.js 16 NextConfig:** eslint property removed from NextConfig type; eslint still works but cannot be disabled via config
- **RLS pattern:** Always use `(SELECT auth.jwt() ->> 'tenant_id') = tenant_id::text` — never the uncached per-row form
- **tenant_id source:** Extracted from JWT only — never from request body
- **Service-Role Key:** Never in browser bundle. Use `import 'server-only'` in `/src/lib/supabase/server.ts`
- **n8n webhook auth:** DID number is the authoritative tenant lookup — never the payload's tenant_id field
- **Realtime channels:** Always scoped to tenant: `channel('call_log:' + tenantId)` — cleanup via `removeChannel()` in useEffect return
- **Audio URLs:** Generated on-demand via API route (15-min expiry), never at page-load time
- **Upsert pattern:** All n8n webhook handlers use `INSERT ... ON CONFLICT DO UPDATE` — never plain INSERT (idempotency)
- **Composite indexes:** Every table with tenant_id gets `CREATE INDEX idx_{table}_tenant_created ON {table} (tenant_id, created_at DESC)` in migration — without CONCURRENTLY (transactions cannot use it)
- **JWT expiry:** 15-minute sessions; Supabase SSR refreshes automatically; Realtime channels re-authenticated on `onAuthStateChange`
- **Hook security:** custom_access_token_hook uses SET search_path = public; get_secret uses SET search_path = vault, public — prevents search_path injection
- **Hook tenant_id cast:** Injected as ::text cast before to_jsonb() to ensure consistent UUID string representation in JWT app_metadata
- **Vault only path:** public.get_secret(text) is the only allowed path to vault.decrypted_secrets — revoked from all roles except service_role
- **Server Action form pattern:** Page is Server Component, form is extracted Client Component file; useActionState (React 19) returns [state, formAction, isPending]; react-hook-form handles client-side UX only
- **TOTP state machine:** Use unified state object with phase string field instead of discriminated union — preserves all fields (factorId, qrCode) across phase transitions without type casting
- **supabase.auth.admin.signOut signature:** Takes positional scope string, not object: `signOut(userId, 'global')` — not `{ scope: 'global' }`
- **revoke-session auth pattern:** Bearer token checked against SUPABASE_SERVICE_ROLE_KEY env var; route returns 401 if missing or mismatched before any DB operation

### Critical Pitfalls to Avoid (from Research)

- C1: RLS per-row JWT calls (performance collapse on large tables)
- C2: tenant_id from request body (cross-tenant data breach)
- C3: Realtime channel without tenant filter (data leakage)
- C4: Realtime subscription not cleaned up (memory leak + duplicate events)
- C5: Service role key in browser bundle (full DB exposure)
- C6: Health data without column-level access control (DSGVO Art. 9 violation)
- C7: Audio URL generated at page load (expiry mid-shift, CORS issues)
- C8: Stale JWT after role change (dismissed employee retains access)
- C9: n8n webhook accepts tenant_id from payload (cross-tenant poisoning)
- C10: ElevenLabs duplicate events (double-booked appointments, duplicate call log rows)

### Build Order Rationale

Phase 1 before anything: JWT + RLS is the security foundation. Every other phase depends on tenant isolation existing.
Phase 2 before UI: Dashboard has no data to display without the ingestion pipeline. Status bar and call log are empty shells without Phase 2.
Phase 3 is the core value loop: staff see all calls live. This is the product.
Phase 4 closes the operational loop: inbox turns call events into actionable tasks.
Phase 5 enables AI configuration: practice can control Voice AI behavior.
Phase 6 adds notification and routing config: communication channels configured.
Phase 7 adds reporting and admin: management visibility and user control.
Phase 8 hardens for launch: compliance and audit readiness.

### DSGVO Compliance Checklist (must be complete before Phase 8 sign-off)

- [ ] Phone numbers stored only as phone_hash (SHA-256)
- [ ] transcript_text accessible only via call-detail permission (view restriction)
- [ ] Audio presigned URLs generated on-demand, 15-min expiry, permission-checked
- [ ] SVNR never stored in dashboard DB (MEDSTAR only)
- [ ] AI-generated summaries restricted by call-detail permission
- [ ] EU AI Act Art. 50 disclosure enforced in all greeting text modes
- [ ] conversation_events retention policy (12-month Edge Function)
- [ ] DPIA documented for systematic health data processing

### Open Todos

- PHASE 1 COMPLETE: 01-PLAN-01, 01-PLAN-02, 01-PLAN-03, 01-PLAN-04 all done
- USER ACTION REQUIRED: Run `supabase db push` to apply all 6 migrations to Supabase project
- USER ACTION REQUIRED: Register Custom Access Token Hook in Supabase Dashboard (Auth > Hooks → public.custom_access_token_hook)
- USER ACTION REQUIRED: Run `scripts/seed-tenant.ts` with env vars to bootstrap first tenant + Vault keys
- USER ACTION REQUIRED: Verify login → TOTP → /dashboard → /settings end-to-end loop
- Start Phase 2: n8n Event Ingestion Pipeline (REALTIME-01..03)

### Active Blockers

- None

---

## Session Continuity

**To resume this project:**
1. Read `.planning/ROADMAP.md` to see current phase structure
2. Read `.planning/STATE.md` (this file) for architectural decisions and context
3. Read `.planning/REQUIREMENTS.md` for requirement details and traceability
4. Continue with 01-PLAN-04 (Wave 3 — DB push checkpoint, seed script, smoke test)

**Last session:** 2026-05-22 — Completed 01-PLAN-04 (Seed script, tenant settings API, settings page — Phase 1 COMPLETE)

**File locations:**
- Requirements: `.planning/REQUIREMENTS.md`
- Roadmap: `.planning/ROADMAP.md`
- State: `.planning/STATE.md` (this file)
- Project: `.planning/PROJECT.md`
- Research: `.planning/research/` (ARCHITECTURE.md, FEATURES.md, STACK.md, PITFALLS.md)
- Specs: `docs/specs/` (product-spec.md, technical-architecture.md, intent-engine.md, session-management.md, medstar-api.md, medical-practice-requirements.md)

---

*State initialized: 2026-05-22 after roadmap creation*
