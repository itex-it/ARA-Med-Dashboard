---
phase: 08-audit-log-polish
plan: 02
subsystem: audit
tags: [audit, server-actions, typescript, supabase]

# Dependency graph
requires:
  - phase: 08-audit-log-polish/08-01
    provides: logAuditEvent() in src/lib/audit.ts + audit_log table

provides:
  - All 11 critical Server Action files instrumented with logAuditEvent() calls
  - ARA_MED_TOGGLED, OPENING_HOURS_UPDATED, APPOINTMENT_TYPE_UPDATED,
    GREETING_TEXT_UPDATED, DEPUTY_MODE_UPDATED, MEDICATION_CREATED/UPDATED/DELETED,
    ROUTING_RULE_CREATED/UPDATED/DELETED, COMM_RULE_CREATED/UPDATED/DELETED,
    TEMPLATE_CREATED/UPDATED/DELETED, USER_CREATED/UPDATED/DEACTIVATED, SETTINGS_UPDATED
  - Auth helpers updated to expose userId for audit attribution
  - Secrets never logged (T-08-05 mitigated)

affects: [08-03-audit-log-page, STATE.md]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Auth helper returns userId alongside tenantId — audit attribution always uses JWT-sourced IDs"
    - "logAuditEvent placed after successful DB op, before return — failure is silent (try/catch inside)"
    - "Cast pattern: (auth as { tenantId: string; userId: string }) after error guard for TS strict compliance"
    - "SETTINGS_UPDATED logs only fields_changed array — never credential values (T-08-05)"

key-files:
  created: []
  modified:
    - src/app/actions/toggle-ara-med.ts
    - src/app/actions/opening-hours.ts
    - src/app/actions/appointment-types.ts
    - src/app/actions/greeting-texts.ts
    - src/app/actions/deputy.ts
    - src/app/actions/medications.ts
    - src/lib/actions/routing.ts
    - src/lib/actions/communication.ts
    - src/lib/actions/templates.ts
    - src/lib/actions/users.ts
    - src/app/(dashboard)/settings/actions.ts

key-decisions:
  - "Auth helper userId: All shared getAuthContext()/getAuthedTenantId() helpers updated to return userId — avoids separate getUser() call per action"
  - "Cast after error guard: Used (auth as { tenantId: string; userId: string }) after if (auth.error) return to satisfy TypeScript strict — non-null narrowing from implicit union not recognized by tsc"
  - "SETTINGS_UPDATED newValue: Only fields_changed string array logged — no hostname/URL values — defense against accidental secret logging"
  - "deputy.ts covers add/update/delete deputy doctors — all use DEPUTY_MODE_UPDATED action constant per taxonomy"
  - "opening-hours.ts also has addSpecialDay/deleteSpecialDay/addDeputyPeriod/deleteDeputyPeriod — only saveOpeningHoursAction instrumented per OPENING_HOURS_UPDATED scope"

patterns-established:
  - "Audit call position: immediately after if (dbError) return block, before the success return"
  - "objectId sourcing: use record.id for create/update, tenantId as objectId for tenant-scoped single objects"

requirements-completed:
  - AUDIT-01
  - AUDIT-02

# Metrics
duration: 35min
completed: 2026-05-24
---

# Phase 8 Plan 02: Audit Instrumentation Summary

**logAuditEvent() wired into all 11 Server Action files covering 22 distinct audit action constants — TypeScript strict compile-clean**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-24T15:30:00Z
- **Completed:** 2026-05-24T16:05:00Z
- **Tasks:** 12 (11 instrumentation + 1 final TS check + commit)
- **Files modified:** 11

## Accomplishments

- All 11 critical Server Action files now emit audit events after each successful mutation
- 22 distinct audit constants covered across tenants, configuration, users, and settings
- Auth helpers in 8 files updated to return `userId` alongside `tenantId` for proper audit attribution
- TypeScript strict mode passes with zero errors (`npx tsc --noEmit` exit 0)
- Secrets/credentials never logged — SETTINGS_UPDATED captures only `fields_changed` array (T-08-05)

## Task Commits

Single commit covers all 11 files (plan executed atomically — all or nothing for AUDIT-01):

1. **Tasks 1-12: All 11 files instrumented + TS clean** - `c03cc8f` (feat)

**Plan metadata:** (will be committed with SUMMARY.md)

## Files Created/Modified

- `src/app/actions/toggle-ara-med.ts` - ARA_MED_TOGGLED after tenants.update
- `src/app/actions/opening-hours.ts` - OPENING_HOURS_UPDATED after opening_hours.upsert; userId added to getAuthContext()
- `src/app/actions/appointment-types.ts` - APPOINTMENT_TYPE_UPDATED (flags, synonyms, default); userId added
- `src/app/actions/greeting-texts.ts` - GREETING_TEXT_UPDATED after greeting_texts.upsert; userId added
- `src/app/actions/deputy.ts` - DEPUTY_MODE_UPDATED for add/update/delete deputy doctors; userId added
- `src/app/actions/medications.ts` - MEDICATION_CREATED/UPDATED/DELETED; userId added
- `src/lib/actions/routing.ts` - ROUTING_RULE_CREATED/UPDATED/DELETED; userId added
- `src/lib/actions/communication.ts` - COMM_RULE_CREATED/UPDATED/DELETED; userId added
- `src/lib/actions/templates.ts` - TEMPLATE_CREATED/UPDATED/DELETED; userId added
- `src/lib/actions/users.ts` - USER_CREATED/UPDATED/DEACTIVATED using operator's user.id
- `src/app/(dashboard)/settings/actions.ts` - SETTINGS_UPDATED with fields_changed only

## Decisions Made

- **Auth helper userId pattern:** Rather than adding a separate `getUser()` call in each action's audit block, updated all shared auth helpers to return `userId: user.id` — single source of truth, no extra round-trips
- **TypeScript cast after error guard:** After `if (auth.error) return`, TypeScript's narrowing on the implicit union type doesn't eliminate `userId?: undefined`. Used `auth as { tenantId: string; userId: string }` cast — safe because the error guard proves we're in the success branch
- **SETTINGS_UPDATED safe logging:** `updateData` contains only hostname, medstar_server_url, fallback_phone, forwarding_phone, active_features — no secrets. Logs `{ fields_changed: [...] }` derived from `Object.keys(updateData).filter(v !== undefined)` for minimal surface
- **DEPUTY_MODE_UPDATED for all deputy ops:** Plan specified DEPUTY_MODE_UPDATED for the deputy.ts file — applied to add, update, and delete deputy doctor operations per the action taxonomy

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] TypeScript strict errors on userId: string | undefined**
- **Found during:** Task 12 (Final TypeScript check)
- **Issue:** After adding `userId` to auth helper returns, tsc reported 22 errors — `userId` typed as `string | undefined` in the discriminated union because TypeScript's narrowing after `if (auth.error) return` doesn't fully eliminate the `undefined` branch for non-error keys
- **Fix:** Applied `auth as { tenantId: string; userId: string }` cast at destructure point in all 8 files that use auth helper functions; used `auth.userId!` in `appointment-types.ts` which accesses via dot notation
- **Files modified:** All 11 action files (cast applied at destructure)
- **Verification:** `npx tsc --noEmit` exits 0 with no output
- **Committed in:** c03cc8f (included in single task commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — TypeScript correctness)
**Impact on plan:** Necessary for TypeScript strict compliance. No scope creep. Cast is safe because the error guard proves the success branch.

## Issues Encountered

- TypeScript union narrowing limitation: After `if (auth.error) return`, TypeScript did not fully narrow `userId` in the remaining union branches. Root cause: implicit inferred union return types with optional fields don't narrow the same way as explicit discriminated unions with a literal discriminant field. Fixed with cast pattern documented above.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. All changes are additive audit calls using existing service role client. `logAuditEvent` already uses `createServiceRoleClient()` which bypasses RLS — no new trust boundary created.

## Known Stubs

None — all audit calls use real tenantId/userId from JWT and real record IDs from DB operations.

## User Setup Required

None — no external service configuration required. `audit_log` table was created in Phase 08-01.

## Next Phase Readiness

- All Server Action mutations now produce audit log entries
- Phase 08-03 (audit log page) can query `audit_log` table and display entries — data will be present from first user interaction
- No blockers

---
*Phase: 08-audit-log-polish*
*Completed: 2026-05-24*
