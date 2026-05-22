# Phase 1 Discussion Log

**Date:** 2026-05-22
**Mode:** --auto (fully autonomous)
**Areas covered:** 5

---

## Area 1: Custom Access Token Hook

**Q:** How to embed tenant_id + ara_role into JWT?
**Options considered:**
  A. Supabase Auth Custom Access Token Hook (Edge Function) — injects into app_metadata at token issuance (RECOMMENDED)
  B. Per-request join on user_tenant_roles in RLS policy
**Selected:** A — Edge Function Hook
**Rationale:** app_metadata is server-writable only (users cannot modify); evaluated once per token issuance, not per row; eliminates per-row join overhead in RLS.

---

## Area 2: 2FA Enforcement Flow

**Q:** What happens when Operator/Arzt/Admin first logs in without TOTP configured?
**Options considered:**
  A. Immediate mandatory TOTP enrollment redirect — no grace period (RECOMMENDED)
  B. Grace period (7 days) before enforcement
**Selected:** A — Immediate mandatory redirect
**Rationale:** Regulatory risk (DSGVO, EU AI Act) too high for grace period. AAL check in proxy.ts handles enforcement.

---

## Area 3: Tenant Creation Workflow (Phase 1 scope)

**Q:** How does the Operator create a tenant in Phase 1?
**Options considered:**
  A. DB seed/script for Phase 1; full Operator RBAC UI in Phase 7 (RECOMMENDED)
  B. Build partial Operator UI in Phase 1
**Selected:** A — Minimal seed, full UI deferred to Phase 7
**Rationale:** Full Operator UI is a Phase 7 deliverable (RBAC-01). Phase 1 only needs the data model and Vault key structure.

---

## Area 4: Session Invalidation Mechanism (AUTH-06)

**Q:** How to implement immediate session invalidation on role revocation?
**Options considered:**
  A. Admin API signOut(userId, { scope: 'global' }) from Server Action + getUser() everywhere (RECOMMENDED)
  B. Wait for next JWT refresh (up to 15 min window)
**Selected:** A — Admin signOut + getUser()
**Rationale:** AUTH-06 requires immediate invalidation. getUser() re-validates with Auth server on every call, detecting revoked tokens.

---

## Area 5: RLS Baseline Template

**Q:** Which RLS pattern to standardize across all tables?
**Options considered:**
  A. Cached subquery `(SELECT auth.jwt() ->> 'tenant_id')` on every policy + composite index mandatory (RECOMMENDED)
  B. Bare auth.jwt() call (simpler but per-row evaluation)
**Selected:** A — Cached subquery pattern
**Rationale:** Already locked in STATE.md from research. 94-99% overhead reduction on production table sizes. Non-negotiable for performance at scale.

---

## Deferred Ideas

- Full Operator tenant management UI → Phase 7
- Magic link login → post-MVP
- OAuth/OIDC/SSO → post-MVP
- Per-tenant custom auth email templates → post-MVP

---

## Claude's Discretion

- Zod v4 syntax enforced throughout (z.email(), z.uuid() — not string chains)
- Supabase key format: verify sb_publishable/sb_secret vs legacy at project creation time
- AAL2 can be added as RLS policy condition on sensitive tables as additional enforcement layer
