---
phase: 04-inbox-task-management
plan: 02
subsystem: ui
tags: [react, nextjs, shadcn, tailwind, supabase-realtime, typescript]

requires:
  - phase: 04-01
    provides: InboxItemRow type, InboxCaseType/InboxStatus types, updateInboxStatusAction, saveInboxNoteAction, useInboxItems hook

provides:
  - CaseTypeBadge component with all 8 case types, German labels, color chips, and Tooltip
  - InboxStatusBadge component with all 4 lifecycle statuses, German labels, color chips
  - InboxTable with Realtime, 5-tab filter (client-side), emergency row highlighting, row-click sheet trigger
  - CaseDetailSheet with lifecycle buttons (only valid transitions), note textarea, emergency banner, optimistic updates
  - /inbox Server Component page reading tenantId from JWT, passing permission flags
  - OpenTaskCounter badge linked to /inbox?filter=open

affects: [phase-05, phase-06, phase-07]

tech-stack:
  added: []
  patterns:
    - Client-side tab filter from in-memory items array (no re-fetch on tab switch)
    - Optimistic status update via useTransition with revert-on-error pattern
    - Separate statusError / noteError state vars for independent error display
    - useEffect([item?.id]) for full reset + useEffect([item?.internal_note]) for Realtime note sync
    - Permission gates via typed props from Server Component (hasEditRight, hasManageRight, hasCallDetail)

key-files:
  created:
    - src/components/inbox/CaseTypeBadge.tsx
    - src/components/inbox/InboxStatusBadge.tsx
    - src/components/inbox/InboxTable.tsx
    - src/components/inbox/CaseDetailSheet.tsx
    - src/app/(dashboard)/inbox/page.tsx
  modified:
    - src/components/status/OpenTaskCounter.tsx

key-decisions:
  - "Tab filtering is client-side from the useInboxItems items array — tab switch never triggers a re-fetch"
  - "InboxTable uses a single TabsContent for filteredItems instead of per-tab content (avoids re-mount)"
  - "statusError and noteError are kept as separate state variables per CLAUDE.md constraint"
  - "Lifecycle buttons render only valid next transitions, not a full transition matrix"
  - "hasCallDetail gates both the Fallinformation call link and the Verknüpftes Gespräch button"

patterns-established:
  - "Lifecycle button visibility: derive from optimisticStatus ?? item.status, render only valid next states"
  - "Emergency row: border-l-2 border-destructive checked first, overrides selected border"
  - "Optimistic update pattern: setOptimisticState(next) → startTransition(action) → revert on error"

requirements-completed: [INBOX-01, INBOX-02, INBOX-03, INBOX-04, INBOX-05]

duration: 25min
completed: 2026-05-23
---

# Phase 04 Plan 02: Inbox UI Layer Summary

**Full inbox UI layer: CaseTypeBadge + InboxStatusBadge chips, InboxTable with Realtime tab filter, CaseDetailSheet with optimistic lifecycle buttons and note, /inbox Server Component page — npm run build passes with /inbox as dynamic route**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-23T00:00:00Z
- **Completed:** 2026-05-23T00:25:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- CaseTypeBadge renders all 8 InboxCaseType values as German-labeled, color-coded chips with shadcn Tooltip
- InboxStatusBadge renders all 4 lifecycle statuses as color-coded Badge chips
- InboxTable: 5-tab filter (Alle/Offen/In Bearbeitung/Erledigt/Archiviert), client-side from items array, emergency border, Realtime via useInboxItems, skeleton loading, two distinct empty state messages
- CaseDetailSheet: 5 sections with emergency banner, lifecycle buttons per valid-transition matrix, optimistic status updates with revert, separate statusError/noteError, Realtime note sync via useEffect
- /inbox Server Component page: awaits searchParams Promise, extracts tenantId from JWT, computes permission flags server-side
- OpenTaskCounter badge wrapped in Link to /inbox?filter=open

## Task Commits

1. **Task 1: CaseTypeBadge + InboxStatusBadge** - `2f15b37` (feat)
2. **Task 2: InboxTable + OpenTaskCounter** - `fd7af4c` (feat)
3. **Task 3: CaseDetailSheet + /inbox page + build gate** - `8de0d2b` (feat)

## Files Created/Modified

- `src/components/inbox/CaseTypeBadge.tsx` - Case type chip with CASE_TYPE_LABELS, CASE_TYPE_TOOLTIPS, CASE_TYPE_STYLES exports; Tooltip wrapper when showTooltip=true
- `src/components/inbox/InboxStatusBadge.tsx` - Status chip with INBOX_STATUS_LABELS, INBOX_STATUS_STYLES exports
- `src/components/inbox/InboxTable.tsx` - Full case list with shadcn Tabs, 6-column Table, CaseDetailSheet integration
- `src/components/inbox/CaseDetailSheet.tsx` - Slide-over sheet with 5 sections, optimistic transitions, note save, Realtime sync
- `src/app/(dashboard)/inbox/page.tsx` - Server Component, searchParams as Promise, JWT tenant extraction
- `src/components/status/OpenTaskCounter.tsx` - Added Link wrapper around count badge

## Decisions Made

- Client-side tab filter from useInboxItems items array — no re-fetch on tab switch
- Single TabsContent value={activeTab} with filteredItems avoids per-tab content re-mount
- statusError and noteError kept as separate state variables per plan constraint
- Both useEffect([item?.id]) for full reset and useEffect([item?.internal_note]) for Realtime note sync are present
- hasCallDetail gates both the Fallinformation call link and the Verknüpftes Gespräch section button

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — TypeScript strict mode passed on first check, build passed on first run.

## Known Stubs

None — all components are wired to real data sources (useInboxItems Realtime hook, updateInboxStatusAction, saveInboxNoteAction). No hardcoded empty values or placeholder data.

## Threat Flags

None — no new trust boundaries or endpoints introduced beyond what the plan's threat model anticipated. tenantId is always extracted from JWT in Server Component (T-04-09 accepted). hasEditRight prop is computed server-side (T-04-07 mitigated).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Inbox UI layer is complete and operational for Phase 5
- Navigation link to /inbox can be added to the sidebar in Phase 5 (Lucide Inbox icon per UI-SPEC)
- Phase 7 RBAC will replace the ara_role permission proxy with user_tenant_roles.permissions
- No blockers

## Self-Check: PASSED

All 6 files exist, no `any` types found in inbox components, all 3 task commits verified in git log, npm run build exits 0 with /inbox listed as dynamic route.

---
*Phase: 04-inbox-task-management*
*Completed: 2026-05-23*
