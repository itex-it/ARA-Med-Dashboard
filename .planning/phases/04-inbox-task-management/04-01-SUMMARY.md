---
phase: 04-inbox-task-management
plan: 01
subsystem: ui
tags: [typescript, supabase, realtime, server-actions, zod, shadcn, role-gate]

requires:
  - phase: 02-call-log-pipeline
    provides: inbox_items table schema and InboxItemRow type base
  - phase: 03-status-bar
    provides: toggle-ara-med role gate pattern and createServerClient/createServiceRoleClient

provides:
  - InboxItemRow TypeScript type with internal_note field
  - updateInboxStatusAction Server Action with role gate (operator/ordination_admin only)
  - saveInboxNoteAction Server Action (any authenticated tenant user)
  - useInboxItems hook with Realtime INSERT/UPDATE/DELETE and dedup
  - shadcn Tabs, Tooltip, Alert UI components

affects: [04-02, inbox-ui, case-detail-sheet, inbox-table]

tech-stack:
  added: [shadcn/tabs, shadcn/tooltip, shadcn/alert]
  patterns:
    - Server Action role gate via ara_role from JWT app_metadata
    - Dual .eq() filters (id + tenant_id) for cross-tenant spoofing defense
    - InboxItemRow & { [key: string]: unknown } cast for useRealtimeChannel generic
    - Service-role write with app-level role check (RLS UPDATE bypass awareness)

key-files:
  created:
    - src/app/actions/update-inbox-status.ts
    - src/app/actions/save-inbox-note.ts
    - src/lib/hooks/useInboxItems.ts
    - src/components/ui/tabs.tsx
    - src/components/ui/tooltip.tsx
    - src/components/ui/alert.tsx
  modified:
    - src/lib/types/index.ts

key-decisions:
  - "Role gate on updateInboxStatusAction (operator/ordination_admin): service-role bypasses RLS UPDATE policy — app-level check is the only enforcement layer"
  - "No role gate on saveInboxNoteAction: assistants and viewers can add notes per INBOX-05 design"
  - "Both Server Actions include updated_at in payload: inbox_items has no auto-update trigger"
  - "useInboxItems limit 200 (vs 100 for call_log): inbox items accumulate slower and staff need broader view"

patterns-established:
  - "updateInboxStatusAction: Zod → createServerClient → getUser → tenantId → araRole → serviceClient write"
  - "saveInboxNoteAction: Zod max(4000) → createServerClient → getUser → tenantId → serviceClient write (no role gate)"
  - "useInboxItems: mirrors useCallLog exactly — initial fetch + Realtime with INSERT dedup by id"

requirements-completed: [INBOX-01, INBOX-04, INBOX-05]

duration: 2min
completed: 2026-05-22
---

# Phase 4 Plan 1: Inbox Foundation (Types + Actions + Hook) Summary

**InboxItemRow type fixed with internal_note field; updateInboxStatusAction with operator-only role gate; saveInboxNoteAction open to all authenticated users; useInboxItems hook with Realtime dedup — foundation for Wave 2 UI**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-22T23:13:07Z
- **Completed:** 2026-05-22T23:15:22Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Fixed missing `internal_note: string | null` field in InboxItemRow TypeScript interface
- Created updateInboxStatusAction with ALLOWED_ROLES=['operator','ordination_admin'] gate, Zod UUID+enum validation, dual .eq() tenant isolation, and updated_at payload
- Created saveInboxNoteAction with Zod max(4000) note validation, no role gate, tenant isolation
- Created useInboxItems hook mirroring useCallLog exactly (limit 200, DESC, Realtime INSERT/UPDATE/DELETE with id dedup)
- Installed shadcn Tabs, Tooltip, Alert components via shadcn CLI
- `npx tsc --noEmit` exits 0 after all tasks

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix InboxItemRow type + install shadcn tabs/tooltip/alert** - `f744642` (feat)
2. **Task 2: updateInboxStatusAction Server Action** - `3d1ed41` (feat)
3. **Task 3: saveInboxNoteAction + useInboxItems hook** - `a645c73` (feat)

## Files Created/Modified

- `src/lib/types/index.ts` - Added `internal_note: string | null` to InboxItemRow interface
- `src/app/actions/update-inbox-status.ts` - Server Action: role gate + Zod + service-role write to inbox_items
- `src/app/actions/save-inbox-note.ts` - Server Action: Zod note validation + service-role write (no role gate)
- `src/lib/hooks/useInboxItems.ts` - Client hook: tenant-scoped fetch + Realtime subscription with dedup
- `src/components/ui/tabs.tsx` - shadcn Tabs component (generated)
- `src/components/ui/tooltip.tsx` - shadcn Tooltip component (generated)
- `src/components/ui/alert.tsx` - shadcn Alert component (generated)

## Decisions Made

- Role gate is mandatory on updateInboxStatusAction because service-role client bypasses RLS UPDATE policy — the app-level check is the only enforcement layer (T-04-02)
- saveInboxNoteAction has no role gate intentionally — assistants and viewers need to add notes per INBOX-05
- Both Server Actions include `updated_at: new Date().toISOString()` in update payload because inbox_items has no DB-level auto-update trigger
- useInboxItems uses limit 200 (vs 100 for call_log) because inbox items accumulate slower and staff need a broader view

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — all 3 tasks executed cleanly, TypeScript strict mode passed throughout.

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|-----------|
| T-04-01: Spoofing via forged itemId | `.eq('tenant_id', tenantId)` on every update in updateInboxStatusAction |
| T-04-02: Role elevation bypass | ALLOWED_ROLES=['operator','ordination_admin'] app-level gate before service-role write |
| T-04-03: Note content tampering | `z.string().max(4000)` Zod validation in saveInboxNoteAction |
| T-04-05: Spoofing via forged itemId | `.eq('tenant_id', tenantId)` filter in saveInboxNoteAction |

## Known Stubs

None - no placeholder data, hardcoded values, or wired-to-empty props introduced in this plan.

## Next Phase Readiness

All Wave 2 dependencies are satisfied:
- InboxItemRow has internal_note — InboxTable and CaseDetailSheet can use the field
- updateInboxStatusAction is importable by status-change UI controls
- saveInboxNoteAction is importable by the note editor in CaseDetailSheet
- useInboxItems provides the data source for InboxTable
- shadcn Tabs/Tooltip/Alert are available for UI composition

---
*Phase: 04-inbox-task-management*
*Completed: 2026-05-22*
