---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 5 — Configuration
current_plan: 04-02 COMPLETE (Phase 4 COMPLETE)
status: completed
last_updated: "2026-05-24T15:27:31.370Z"
progress:
  total_phases: 8
  completed_phases: 5
  total_plans: 28
  completed_plans: 29
  percent: 63
---

# STATE: ARA-Med Dashboard

**Project:** ARA-Med Dashboard — Multi-Tenant SaaS Voice AI for Austrian Medical Practices
**Last updated:** 2026-05-22
**Mode:** mvp

---

## Project Reference

**Core Value:** Eine Ordination kann ARA-Med Voice AI aktivieren, alle Telefonate mit Ergebnissen in Echtzeit verfolgen und offene Aufgaben bearbeiten — ohne technisches Know-how.

**Stack:** Next.js 16 + React 19 + TypeScript strict + Tailwind CSS 4 + shadcn/ui + Supabase self-hosted (Postgres + Realtime + Auth + Vault) + n8n CE + Docker/Portainer (app.aramed.at via Caddy)

**Constraint highlights:**

- tenant_id on every table, RLS on every table — no exceptions
- Service-Role Key only in n8n / API Routes / Server Actions — never in browser
- All external API keys (MEDSTAR, ElevenLabs) in Supabase Vault only
- Provider brand (ElevenLabs, n8n) never visible in the product
- UI in German only for MVP

---

## Current Position

**Current Phase:** 5 — Configuration
**Current Plan:** 04-02 COMPLETE (Phase 4 COMPLETE)
**Status:** Phase 4 complete — ready for Phase 5

**Progress Bar:**

```
Phase 1 [████████] 100% COMPLETE (01-PLAN-01, 01-PLAN-02, 01-PLAN-03, 01-PLAN-04)
Phase 2 [████████] 100% COMPLETE (02-01 DB schema+types, 02-02 webhook route, 02-03 Realtime hooks)
Phase 3 [████████] 100% COMPLETE (03-01 DB migration, 03-02 StatusBar, 03-03 Call Log, 03-04 Call Detail Sheet)
Phase 4 [████████] 100% COMPLETE (04-01 types+actions+hook, 04-02 InboxTable+CaseDetailSheet+/inbox page)
Phase 5 [        ] 0%
Phase 6 [        ] 0%
Phase 7 [        ] 0%
Phase 8 [        ] 0%
```

**Overall: 4/8 phases complete**

---

## Phase Summary

| Phase | Name | Requirements | Status |
|-------|------|-------------|--------|
| 1 | Tenant Foundation & Auth | AUTH-01..06, TENANT-01..05 (11 req) | COMPLETE (4 plans) |
| 2 | n8n Event Ingestion Pipeline | REALTIME-01..03 (3 req) | COMPLETE (3 plans) |
| 3 | Core Dashboard — Status Bar & Call Log | STATUS-01..05, CALL-01..10 (15 req) | COMPLETE (4 plans) |
| 4 | Inbox & Task Management | INBOX-01..05 (5 req) | COMPLETE (2 plans) |
| 5 | Configuration | HOURS-01..03, APPT-01..05, TEXT-01..04, DEPUTY-01..04, MED-01 (17 req) | Not started |
| 6 | Routing & Communication Rules | ROUTE-01..03, COMM-01..05 (8 req) | Not started |
| 7 | Statistics & User Management | STAT-01..05, RBAC-01..06 (11 req) | Not started |
| 8 | Audit Log & System Polish | AUDIT-01..03 (3 req) | Not started |

---

## Performance Metrics

**Requirements:** 73 total / 34 complete (AUTH-01..06, TENANT-01..05, REALTIME-01..03, STATUS-01..05, CALL-01..10, INBOX-01..05) / 39 remaining
**Phases:** 8 total / 4 complete (Phase 1, Phase 2, Phase 3, Phase 4)
**Plans:** 13 written / 13 complete (01-PLAN-01..04, 02-01..03, 03-01..04, 04-01..02)

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
- **Realtime hook generic constraint:** useRealtimeChannel<T> uses `T extends { [key: string]: unknown }` not `Record<string,unknown>` — named interfaces (InboxItemRow) lack index signatures
- **Realtime event subscription:** Use single `event: '*'` (ALL) filter on postgres_changes — not per-event loop — to get correct union type `RealtimePostgresChangesPayload<T>` in supabase-js v2
- **Initial count query:** Always include `.eq('tenant_id', tenantId)` alongside `.eq('status', ...)` — RLS is backstop but explicit filter is defense-in-depth
- **Status-bar layout:** layout.tsx main area is flex-col: status-bar div (border-b) above flex-1 content div; layout.tsx stays Server Component, OpenTaskCounter is Client Component
- **Realtime tenants filter:** useTenantStatus subscribes with filter 'id=eq.' + tenantId (NOT tenant_id) because tenants table is keyed on its primary key `id`
- **createServerClient is async:** Must await createServerClient() in Server Actions — it returns a Promise (uses next/headers cookies())
- **Toggle action pattern:** useOptimistic + useTransition for instant UI feedback on ARA-MED toggle; Loader2 spinner shown during pending; Switch disabled during transition
- **TOTP state machine:** Use unified state object with phase string field instead of discriminated union — preserves all fields (factorId, qrCode) across phase transitions without type casting
- **supabase.auth.admin.signOut signature:** Takes positional scope string, not object: `signOut(userId, 'global')` — not `{ scope: 'global' }`
- **revoke-session auth pattern:** Bearer token checked against SUPABASE_SERVICE_ROLE_KEY env var; route returns 401 if missing or mismatched before any DB operation
- **call_actions detail column:** Never returned from /api/calls/[id]/actions — excluded at DB query level (DSGVO C6: health-sensitive MEDSTAR data requires Phase 7 RBAC gating before exposure)
- **Audio URL on-demand:** Fetched in CallDetailSheet useEffect only when open && canSeeAudio && call.audio_url — never at page-load (C7 honored)
- **Boolean short-circuit for unknown types:** When rendering Record<string, unknown> fields in JSX, use Boolean(field) && (...) not field && (...) — unknown short-circuit returns unknown not ReactNode (TS2322)
- **audit.ts server guard:** Use `import 'server-only'` (not `'use server'`) for utility modules that are not Server Actions — 'use server' is for Next.js Server Action files only
- **pg-meta auth:** Self-hosted Supabase pg-meta accessible via https://supabase.itex.at/api/platform/pg-meta/default/query with Basic Auth (supabase_itex-it), NOT via raw IP port 8085 which is firewalled
- **audit_log INSERT:** No user-facing RLS INSERT policy — logAuditEvent always uses createServiceRoleClient() which bypasses RLS; this prevents users from forging audit records (T-08-01)

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
- DEPLOYMENT CHANGED: Vercel → Docker/Portainer (app.aramed.at). Dockerfile + docker-compose.yml created; next.config.ts has output: 'standalone'
- USER ACTION REQUIRED: Push image to ghcr.io/itex-it/ara-med-dashboard:latest (GitHub Actions or manual build)
- USER ACTION REQUIRED: Deploy Stack in Portainer (Endpoint 3) using docker-compose.yml; set env vars NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- USER ACTION REQUIRED: Run `supabase db push` to apply all 6 migrations to self-hosted Supabase
- USER ACTION REQUIRED: Register Custom Access Token Hook in Supabase Dashboard (Auth > Hooks → public.custom_access_token_hook)
- USER ACTION REQUIRED: Run `scripts/seed-tenant.ts` with env vars to bootstrap first tenant + Vault keys
- USER ACTION REQUIRED: Verify login → TOTP → /dashboard → /settings end-to-end loop
- PHASE 2 COMPLETE: 02-01 (DB schema+types), 02-02 (n8n webhook route), 02-03 (Realtime hooks + status-bar) all done
- PHASE 3 IN PROGRESS: 03-01 (DB migration: ara_status, practice_status, active_mode columns + RLS) COMPLETE
- PHASE 3 IN PROGRESS: 03-02 (shadcn install, useTenantStatus, toggleAraMedAction, useActiveCallCount, StatusBar, layout wiring) COMPLETE — STATUS-01..05 delivered
- PHASE 3 IN PROGRESS: 03-03 (/telefonate call log page, useCallLog hook, CallLogTable, CallStatusBadge, phone/format utils) COMPLETE — CALL-01, CALL-02 delivered
- PHASE 3 COMPLETE: 03-04 (Call Detail Sheet: audio API, call-feedback action, CallDetailSheet, call actions API) COMPLETE — CALL-03..10 delivered
- PHASE 3 COMPLETE: All 4 plans (03-01..04) done. STATUS-01..05, CALL-01..10 all delivered.
- Next: Phase 4 — Inbox & Task Management (INBOX-01..05)
- Realtime architecture decisions locked: useRealtimeChannel (tenant-scoped, removeChannel cleanup), useOpenTaskCount (initial count + delta), OpenTaskCounter (German UI, badge)
- StatusBar wired into layout.tsx: 5 segments live (ara_status, practice_status, active_mode, active calls, open tasks), toggle switch for operator/ordination_admin
- PHASE 4 COMPLETE: 04-01 (InboxItemRow type fix, updateInboxStatusAction, saveInboxNoteAction, useInboxItems, shadcn tabs/tooltip/alert) COMPLETE
- PHASE 4 COMPLETE: 04-02 (CaseTypeBadge, InboxStatusBadge, InboxTable with Realtime tab filter, CaseDetailSheet with lifecycle buttons, /inbox Server Component page, OpenTaskCounter link) COMPLETE — INBOX-01..05 all delivered
- Role gate pattern confirmed: ALLOWED_ROLES=['operator','ordination_admin'] app-level check required because service-role bypasses RLS UPDATE policy
- saveInboxNoteAction intentionally has no role gate — assistants/viewers can add notes per INBOX-05
- Both inbox Server Actions include updated_at in payload (no auto-update trigger on inbox_items)
- Tab filter pattern: client-side from useInboxItems items array — tab switch never re-fetches; filteredItems = activeTab === 'alle' ? items : items.filter(i => i.status === activeTab)
- Optimistic update pattern: setOptimisticStatus(next) → startTransition(action) → revert on error; separate statusError/noteError state vars
- Lifecycle buttons: only valid next transitions rendered per current status (open/in_progress/resolved/archived)
- Next: Phase 5 — Configuration (HOURS-01..03, APPT-01..05, TEXT-01..04, DEPUTY-01..04, MED-01)

### Active Blockers

- None

---

## Session Continuity

**To resume this project:**

1. Read `.planning/ROADMAP.md` to see current phase structure
2. Read `.planning/STATE.md` (this file) for architectural decisions and context
3. Read `.planning/REQUIREMENTS.md` for requirement details and traceability
4. Continue with Phase 5 — Configuration (/gsd:plan-phase 5)

**Last session:** 2026-05-24T15:27:31.362Z

**File locations:**

- Requirements: `.planning/REQUIREMENTS.md`
- Roadmap: `.planning/ROADMAP.md`
- State: `.planning/STATE.md` (this file)
- Project: `.planning/PROJECT.md`
- Research: `.planning/research/` (ARCHITECTURE.md, FEATURES.md, STACK.md, PITFALLS.md)
- Specs: `docs/specs/` (product-spec.md, technical-architecture.md, intent-engine.md, session-management.md, medstar-api.md, medical-practice-requirements.md)

---

*State initialized: 2026-05-22 after roadmap creation*
