---
plan: 05-04
phase: 05-configuration
status: complete
completed: 2026-05-23
commit: cddd032
---

# Phase 5 Plan 04: Begrüßungstexte Module Summary

## One-Liner

EU AI Act Art. 50 enforced server-side greeting text management with four-mode tabs and per-mode FAQ CRUD.

## What Was Built

### Task 1: `src/app/actions/greeting-texts.ts`

Three Server Actions with shared `getAuthContext` helper following the canonical auth pattern from `update-inbox-status.ts`:

- **`saveGreetingTextAction`** — Form action (useActionState-compatible) that upserts `greeting_texts` rows. `eu_ai_act_disclosure` is set unconditionally to the server-side constant `EU_AI_ACT_DISCLOSURE`; it is not a field in the Zod schema and cannot be influenced by client input. `eu_ai_act_disclosure_present: true` is always written.
- **`addFaqEntryAction`** — Inserts a new `faq_entries` row; validates via `addFaqSchema` (mode, question min 1, answer min 1).
- **`deleteFaqEntryAction`** — Deletes a `faq_entries` row using both `.eq('id', ...)` and `.eq('tenant_id', tenantId)` for defense-in-depth against cross-tenant ID forgery.

All actions:
- Validate input with Zod v4 (uses `.issues[0]` not `.errors[0]`)
- Read `tenant_id` and `ara_role` from JWT `app_metadata` (never from request body)
- Gate on `ALLOWED_ROLES = ['operator', 'ordination_admin']`
- Use `createServiceRoleClient()` (sync, no await) for DB writes

### Task 2: `src/components/config/BegruesungsTexteTab.tsx`

Client Component with shadcn `Tabs` providing four sub-tabs: Normal / Urlaub / Vertretung / Eigener Vertretungsdienst.

Each tab renders three sections:

**TEXT-02: EU AI Act Lock Block**
- `role="region"` landmark with `aria-label="EU-KI-Gesetz Art. 50 Pflichthinweis"`
- Lock icon + label + italic disclosure text + explanatory note
- Display text is a client-side literal constant (`EU_AI_ACT_DISPLAY_TEXT`) — not from the database

**TEXT-01: Greeting Text Form**
- `useActionState(saveGreetingTextAction, {})` per sub-component instance
- Hidden `mode` field, language Select locked to "Deutsch (Standard)"
- Textarea with character count tracking via local state
- Success auto-hides after 3 seconds via `useEffect` cleanup timer
- `Loader2` spinner while `isPending`

**TEXT-03: FAQ Section**
- Table with Frage / Antwort / Aktionen columns
- `mode='all'` entries merged into every mode's initial list
- Optimistic local state update on successful add (new row appears immediately)
- Add form: Input + Textarea + "Hinzufügen" button (disabled until both fields non-empty)
- Delete: Trash2 icon triggers Dialog confirm with destructive Button
- `useTransition` for add and delete to keep UI responsive

## Key Decisions

- `EU_AI_ACT_DISCLOSURE` constant lives only in the Server Action file — the component has its own display constant with a different name to make the separation explicit.
- Sub-tab state is lifted to the parent `BegruesungsTexteTab` component (`activeSubTab`) so mode tracking is centralized; each sub-component (`GreetingTextForm`, `FaqSection`) is stateless regarding mode.
- FAQ map is initialized once from `initialFaqEntries` prop — `mode='all'` entries are merged into all four mode arrays at initialization time.
- `createServiceRoleClient()` is called without `await` (it is synchronous), matching the pattern established in `update-inbox-status.ts`.

## Acceptance Checks (all passed)

- `EU_AI_ACT_DISCLOSURE` constant present in actions file
- `eu_ai_act_disclosure_present: true` hardcoded in upsert
- `role="region"` on disclosure block
- `Sie sprechen mit einem KI-gestützten Telefonsystem.` in component
- `npx tsc --noEmit` — zero errors

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. Server Actions follow established auth pattern; service-role writes are scoped by `tenant_id` from JWT.
