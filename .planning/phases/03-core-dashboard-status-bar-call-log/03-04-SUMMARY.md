---
phase: 3
plan: "03-04"
subsystem: call-detail-sheet
tags: [calls, dsgvo, audio, feedback, sheet, realtime]
dependency_graph:
  requires: [03-03, 02-01, 02-02]
  provides: [CALL-03, CALL-04, CALL-05, CALL-06, CALL-07, CALL-08, CALL-09, CALL-10]
  affects: [telefonate-page, call-log-table]
tech_stack:
  added: []
  patterns:
    - On-demand audio presigned URL (GET /api/calls/[id]/audio, 15-min expiry)
    - call_actions API route (excludes health-sensitive detail column, DSGVO C6)
    - CallDetailSheet as 'use client' with 8 sections, lazy fetch on open
    - Permission gates (canSeeAudio, canSeeTranscript, canSeeDetail) passed as props
    - saveCallFeedbackAction: Zod v4 validated server action with partial update pattern
key_files:
  created:
    - src/app/api/calls/[id]/audio/route.ts
    - src/app/api/calls/[id]/actions/route.ts
    - src/app/actions/call-feedback.ts
    - src/components/calls/CallDetailSheet.tsx
  modified:
    - src/components/calls/CallLogTable.tsx
    - src/app/(dashboard)/telefonate/page.tsx
decisions:
  - "actions API route excludes call_actions.detail column at DB query level (DSGVO C6 — health-sensitive MEDSTAR data never returned unless Phase 7 RBAC adds separate gating)"
  - "CallDetailSheet fetches audio URL and call_actions only on open (STATE.md C7 decision honored)"
  - "Phone hash displayed as-is for canSeeDetail users with DSGVO note — raw phone numbers not stored per architectural constraint"
  - "SelectItem value='' for 'Keine Korrektur' — empty string used as no-selection sentinel for intentValue state"
metrics:
  duration_seconds: 265
  completed_date: "2026-05-22"
  tasks_completed: 3
  files_changed: 6
---

# Phase 3 Plan 04: Call Detail Sheet Summary

**One-liner:** Slide-in sheet with audio, transcript, MEDSTAR actions, note, and feedback for every call row — all DSGVO-gated and lazily loaded.

---

## What Was Built

### Task 1 — Audio presigned-URL API route (`727a663`)

`GET /api/calls/[id]/audio` generates a 15-minute Supabase Storage signed URL on demand. Cross-tenant defense is manual (service-role bypasses RLS — explicit `call.tenant_id === JWT tenant_id` check). Falls back to direct URL for legacy `https://` audio_url values. Never called at page-load.

### Task 2 — Call feedback Server Action (`baacd5e`)

`saveCallFeedbackAction` in `src/app/actions/call-feedback.ts`:
- Zod v4 schema validates callId (uuid), internalNote (max 4000), intentCorrected (max 200), feedbackLabel (enum)
- tenant_id from JWT only
- Partial update: only explicitly provided fields written to DB
- `.eq('tenant_id', tenantId)` filter as cross-tenant defense (forged callId matches zero rows)

### Task 3 — CallDetailSheet + wiring (`53cca5b`)

**CallDetailSheet** (`src/components/calls/CallDetailSheet.tsx`):
- 8 sections per UI-SPEC: Zusammenfassung, Kontaktdaten, Ausgeführte Aktionen, Gesprächsaufzeichnung, Transkript, KI-Entscheidungsweg, Interne Notiz, Feedback
- State reset via `useEffect([call?.id])` on call change
- Audio fetched via `/api/calls/[id]/audio` only when sheet opens and `canSeeAudio && call.audio_url`
- Actions fetched via `/api/calls/[id]/actions` only when `open && canSeeDetail`
- Transcript and KI-Entscheidungsweg are collapsible (collapsed by default)
- Note/intent save via `saveCallFeedbackAction`, feedback updates optimistically on success

**Call actions API route** (`src/app/api/calls/[id]/actions/route.ts`):
- Returns `call_actions` without `detail` column (health-sensitive — DSGVO C6 mitigation)
- Tenant verification before returning any rows

**CallLogTable** extended:
- New props: `canSeeAudio`, `canSeeTranscript`, `canSeeDetail` (all default `true`)
- Row click opens `CallDetailSheet` via local `selectedId` + `sheetOpen` state
- Sheet rendered inside the table's return fragment

**Telefonate page** updated:
- Passes `canSeeAudio={true} canSeeTranscript={true} canSeeDetail={true}`
- Phase 7 RBAC comment added for future server-side permission computation

---

## Deviations from Plan

### Auto-added Missing Critical Functionality

**1. [Rule 2 - Missing] Added `/api/calls/[id]/actions` API route**
- **Found during:** Task 3 implementation
- **Issue:** `CallDetailSheet` fetches `/api/calls/${call.id}/actions` to display MEDSTAR actions, but no such route existed in the plan. The plan specified the fetch in the component but did not include the API route as a separate task.
- **Fix:** Created `src/app/api/calls/[id]/actions/route.ts` with tenant verification and `detail` column excluded (DSGVO C6)
- **Files modified:** `src/app/api/calls/[id]/actions/route.ts`
- **Commit:** `53cca5b`

**2. [Rule 1 - Bug] Fixed TypeScript `unknown` → `ReactNode` type error in summary_structured render**
- **Found during:** Task 3 `npx tsc --noEmit`
- **Issue:** `{s.intent_main && (...)}` — when `s` is `Record<string, unknown>`, the short-circuit expression returns `unknown` not `ReactNode`. TSC error TS2322 on 3 lines.
- **Fix:** Replaced `s.field && (...)` with `Boolean(s.field) && (...)` to force boolean short-circuit
- **Files modified:** `src/components/calls/CallDetailSheet.tsx`
- **Commit:** `53cca5b`

---

## Known Stubs

None. All sections either render real data from `call` props or show appropriate empty states ("—", "Keine Aktionen", "kein Transkript vorhanden").

---

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new_api_endpoint | src/app/api/calls/[id]/actions/route.ts | New route exposes call_actions per call — tenant check is manual (service-role) + eq filter |

---

## Self-Check: PASSED

Files exist:
- src/app/api/calls/[id]/audio/route.ts — FOUND
- src/app/api/calls/[id]/actions/route.ts — FOUND
- src/app/actions/call-feedback.ts — FOUND
- src/components/calls/CallDetailSheet.tsx — FOUND

Commits exist:
- 727a663 — FOUND (feat(03-04): add audio presigned-URL API route)
- baacd5e — FOUND (feat(03-04): add call-feedback Server Action)
- 53cca5b — FOUND (feat(03-04): CallDetailSheet + call actions API + CallLogTable wiring)

Build: `npm run build` PASSED (15 routes compiled, 0 errors)
TypeScript: `npx tsc --noEmit` PASSED (0 errors)
