---
plan: 02-02
phase: 02-n8n-event-ingestion-pipeline
status: complete
tags: [webhook, hmac, zod, n8n, supabase, call_log, inbox_items]
requires: [02-01]
provides: [/api/internal/events, hmac-helper, webhook-schemas, n8n-vault-bootstrap]
affects: [call_log, inbox_items, tenant_did_numbers]
tech-stack:
  added: [node:crypto timingSafeEqual, Zod discriminatedUnion]
  patterns: [raw-body-before-json, upsert-onConflict, vault-rpc-only]
key-files:
  created:
    - src/lib/webhooks/hmac.ts
    - src/lib/webhooks/events.ts
    - src/lib/webhooks/hmac.test.ts
    - src/app/api/internal/events/route.ts
    - n8n/01-vault-key-bootstrap.json
decisions:
  - "callLogData typed as Record<string,unknown> to resolve Supabase generic union constraint on optional status field"
  - "Test imports use ./hmac (no .js extension) — project is CJS (no type:module in package.json)"
metrics:
  duration: ~10min
  completed: 2026-05-22
  tasks: 3
  files: 5
---

# Phase 02 Plan 02: n8n Webhook Endpoint Summary

HMAC-SHA256 verified `/api/internal/events` endpoint with DID-based tenant resolution, idempotent call_log/inbox_items upserts, and n8n Vault-key-bootstrap workflow export.

## Completed

- **Task 1:** HMAC-SHA256 helper (`verifyHmacSignature` + `HMAC_HEADER`), Zod v4 payload schemas (`webhookEventSchema` discriminatedUnion covering `call.started` and `call.completed`), 6-case unit test suite using `node:test`
- **Task 2:** `POST /api/internal/events` — HMAC gate (Step 3), Vault get_secret RPC for secret (Step 2), DID tenant resolution via `tenant_did_numbers` (Step 5, C9), `call_log` upsert `onConflict:session_id` (Step 6, C10), conditional `inbox_items` upsert `onConflict:call_log_id` (Step 7)
- **Task 3:** `n8n/01-vault-key-bootstrap.json` — 4 nodes (Webhook Trigger, Vault: Schlüssel laden, DID prüfen, Signatur + Dashboard POST), all keys from Vault expressions or n8n credential references, no literal secrets, `get_secret` call present, `x-aramed-signature` header set

## Verification

- `npx tsc --noEmit`: passed (0 exit code)
- `npx next build`: passed — `/api/internal/events` listed as dynamic route
- n8n JSON export: valid (nodes array + connections, `get_secret` call present, `x-aramed-signature` present)

## Key architectural decisions enforced

- `request.text()` called before any JSON parsing — HMAC verified on raw bytes, never on parsed object
- `tenant_did_numbers` is the ONLY source of `tenant_id` for DB writes (C9 — payload `tenant_id` never trusted)
- `upsert onConflict:session_id` on `call_log` guarantees idempotency for duplicate events (C10)
- `upsert onConflict:call_log_id` on `inbox_items` guarantees one item per call
- Vault accessed exclusively via `get_secret` RPC — `service_role` only path (migration 20260522000005)
- All error strings in German; no provider brand names (ElevenLabs/n8n) in user-facing responses

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript union type error on callLogData**
- **Found during:** Task 2 — first `npx tsc --noEmit` run
- **Issue:** Supabase `upsert()` generic constraint `RejectExcessProperties` rejected the ternary union because the `call.started` branch had `status: string` while the `call.completed` branch had `status: string | undefined`, making the union non-assignable
- **Fix:** Typed `callLogData` as `Record<string, unknown>` — preserves all runtime values, resolves the generic constraint without losing type safety on the spread-optional fields
- **Files modified:** `src/app/api/internal/events/route.ts`
- **Commit:** 9d04ede

**2. [Rule 3 - Adjustment] Test import extension**
- **Found during:** Task 1 — plan note check
- **Issue:** Plan noted `.js` extension for ESM; project has no `"type":"module"` in package.json (CJS)
- **Fix:** Used `./hmac` (no extension) in `hmac.test.ts` — correct for CJS TypeScript projects
- **Files modified:** `src/lib/webhooks/hmac.test.ts`
- **Commit:** 9929577

## Known Stubs

None — all code paths are fully implemented. The webhook route requires a live Supabase Vault entry (`n8n_webhook_secret`) and a populated `tenant_did_numbers` table to return success responses, but the code itself is not stubbed.

## Threat Flags

None — the new endpoint is protected by HMAC verification before any DB access. Tenant resolution is DID-only (C9). No new unprotected trust boundaries introduced.

## Self-Check: PASSED

- FOUND: src/lib/webhooks/hmac.ts
- FOUND: src/lib/webhooks/events.ts
- FOUND: src/lib/webhooks/hmac.test.ts
- FOUND: src/app/api/internal/events/route.ts
- FOUND: n8n/01-vault-key-bootstrap.json
- FOUND: .planning/phases/02-n8n-event-ingestion-pipeline/02-02-SUMMARY.md
- FOUND commit: 9929577 (Task 1)
- FOUND commit: 9d04ede (Task 2)
- FOUND commit: c560cf7 (Task 3)
