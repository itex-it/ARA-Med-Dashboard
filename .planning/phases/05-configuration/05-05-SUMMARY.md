---
plan: 05-05
phase: 05-configuration
status: complete
completed: 2026-05-23
tags: [deputy, crud, pid-zero, own-service, server-actions]
---

# Phase 5 Plan 05: Vertretung Module Summary

## One-liner

Deputy doctor CRUD with PID=0 behavior selection, date-range validation, own-service toggle, and active-badge highlighting via three Server Actions + one Client Component.

## What was built

### src/app/actions/deputy.ts

Three Server Actions following the canonical auth pattern (createServerClient → getUser → tenant_id from app_metadata → role check against ALLOWED_ROLES):

- `addDeputyDoctorAction(data)` — validates with `addDeputyDoctorSchema` (includes date-range refine), inserts into `deputy_doctors` with `tenant_id`.
- `updateDeputyDoctorAction(data)` — validates with `updateDeputyDoctorSchema` (partial fields + id + date-range refine), updates with both `.eq('id')` and `.eq('tenant_id', tenantId)` filters, appends `updated_at`.
- `deleteDeputyDoctorAction(data)` — validates UUID, deletes with both `.eq('id')` and `.eq('tenant_id', tenantId)` filters.

All actions use `createServiceRoleClient()` (sync, no await) for the DB write after auth is verified via the async `createServerClient()`.

Zod v4 `.issues[0]` is used (not `.errors[0]`).

### src/components/config/VertretungTab.tsx

Client Component with:

- **Deputy list table** — columns: Name, Weiterleitungsnummer, Zeitraum, PID=0-Verhalten, Aktionen. Rows with an active deputy (start_date <= today <= end_date) get `bg-green-50` background and a green "Aktiv" badge.
- **Add/Edit form** — shown inline below the table. Fields: Name (Input), Weiterleitungsnummer (tel Input), Begrüßungstext (Textarea min-h-20), Zeitraum Von/Bis (Calendar/Popover date pickers with end-date disabled before start-date).
- **PID=0-Verhalten (DEPUTY-03)** — Select with four options (refuse/waitlist/book_normal/forward). When `forward` is selected, an additional tel Input for the forward number appears.
- **Eigener Vertretungsdienst (DEPUTY-04)** — Switch inside a bordered section. When active: Textarea for special prompt (min-h-24) + second PID=0-Verhalten Select.
- **Delete Dialog** — confirms removal with the doctor's name, calls `deleteDeputyDoctorAction`, removes from local state on success.
- All mutations run inside `startTransition`. Optimistic list update on add (placeholder UUID replaced on next navigation). Error shown via `role="alert"` paragraph.

## Key decisions

- Shared `getAuthContext()` helper extracted to avoid repeating the four-step auth sequence in each action.
- `formToActionData()` helper centralises form state → action payload conversion (including null-coalescing for optional fields).
- `satisfies DeputyDoctorRow` used on the optimistic insert object to catch shape mismatches at compile time.

## Deviations from plan

None — plan executed exactly as written. TypeScript strict mode passed with zero errors.

## Self-check

- `src/app/actions/deputy.ts` — created, 3 exported async functions confirmed.
- `src/components/config/VertretungTab.tsx` — created, all acceptance patterns confirmed.
- Commit: e450083
