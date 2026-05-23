---
phase: "05"
plan: "03"
subsystem: terminarten-module
tags: [appointment-types, server-actions, client-component, zod, optimistic-ui]
dependency_graph:
  requires: [05-01, 05-02]
  provides: [appointment-types-actions, terminarten-tab]
  affects: [config-page]
tech_stack:
  added: []
  patterns: [delete-then-insert, clear-then-set, optimistic-switches, inline-sub-row-editor]
key_files:
  created:
    - src/app/actions/appointment-types.ts
    - src/components/config/TerminartenTab.tsx
  modified: []
decisions:
  - Mutual exclusivity (is_voice_bookable / is_internal_only) enforced at both Zod schema (.refine) and UI (disabled Switch)
  - All 4 flags sent in single action call to avoid partial state
  - Synonym replace uses delete-then-insert within same transition
  - Default setter uses clear-then-set pattern with tenant_id guard on both steps
metrics:
  duration: "~15 minutes"
  completed: "2026-05-23"
  tasks_completed: 6
  files_created: 2
---

# Phase 5 Plan 03: Terminarten Module Summary

## One-liner

Appointment types management with 3 Server Actions (flag-toggle, synonym replace, default setter) and an optimistic TerminartenTab with inline synonym editor and PID=0 tooltip.

## What Was Built

**src/app/actions/appointment-types.ts** — 3 Server Actions:
- `updateAppointmentTypeFlagsAction`: receives all 4 flags in one call; Zod `.refine()` enforces mutual exclusivity between `is_voice_bookable` and `is_internal_only`; service-role update guarded by both `id` and `tenant_id`
- `saveAppointmentSynonymsAction`: delete-then-insert replace pattern; guarded by `tenant_id` + `appointment_type_code`
- `setDefaultAppointmentTypeAction`: clear-then-set; Step 1 clears all defaults for the tenant, Step 2 sets the selected one with `tenant_id` defense-in-depth

**src/components/config/TerminartenTab.tsx** — Client Component:
- Table with 7 columns: Terminart, Sichtbar, KI-buchbar, Nur intern, Synonyme, Standard, PID=0
- Optimistic Switch updates with revert on error
- Mutual exclusivity in UI: KI-buchbar disabled when `is_internal_only=true`, Nur intern disabled when `is_voice_bookable=true`
- `opacity-60` on rows where `is_visible=false`
- Synonym badges (max 3 shown + overflow badge) with Pencil button opening inline sub-row editor (colSpan=7)
- PID=0 Switch wrapped in Tooltip
- Standard-Terminart Select below table calling `setDefaultAppointmentTypeAction`
- Refresh button (ghost, placeholder — no MEDSTAR fetch)
- Empty state message
- All Switches have `aria-label`
- `useTransition` throughout with Loader2 spinner

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed TS2532 on synonymsMap push**
- **Found during:** Task 4 (tsc --noEmit)
- **Issue:** `Record<string, string[]>` index returns `string[] | undefined` in strict mode; `.push()` on possibly-undefined triggered TS2532
- **Fix:** Added explicit cast `(map[code] as string[]).push(...)` after the guard `if (!map[code]) map[code] = []`
- **Files modified:** src/components/config/TerminartenTab.tsx line 54
- **Commit:** 79444f0 (same commit, fixed before commit)

## Commits

| Hash | Message |
|------|---------|
| 79444f0 | Phase 5 (05-03): Terminarten module — 3 Server Actions + TerminartenTab |

## Self-Check: PASSED

- src/app/actions/appointment-types.ts — FOUND
- src/components/config/TerminartenTab.tsx — FOUND
- Commit 79444f0 — FOUND
- `npx tsc --noEmit` — no errors
