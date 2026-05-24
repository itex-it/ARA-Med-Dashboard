# 06-04 SUMMARY — Templates + Send Log

**Status:** COMPLETE
**Completed:** 2026-05-24

## What was built

- `src/lib/actions/templates.ts` — 3 Server Actions: createTemplateAction (version=1), updateTemplateAction (version+1 via fetch-then-increment), deleteTemplateAction (deactivates dependent active comm_rules before delete). All 3 follow the canonical auth sequence from routing.ts: Zod parse → await createServerClient() → getUser() → tenant_id from app_metadata → role gate (operator|ordination_admin) → createServiceRoleClient() (sync) → DB op.
- `src/components/config/KommunikationTab.tsx` — Nachrichtenvorlagen sub-tab: full CRUD with Sheet (name, channel, subject conditional on email, language, body textarea with ref), variable insert buttons at cursor position using selectionStart/setSelectionRange, live preview with EXAMPLE_VALUES substitution (replaceAll), delete dialog mentioning dependent comm_rules deactivation. Versandprotokoll sub-tab: read-only table, DSGVO-masked recipient_masked column only, filter controls (event type, channel, status), "Ältere laden" pagination (25 per page), German datetime via Intl.DateTimeFormat('de-AT'), status badges with semantic colors, aria-label="Versandprotokoll" on table.
- `src/components/config/KonfigurationTabs.tsx` — Extended with messageTemplates: MessageTemplateRow[] and sendLog: SendLogRow[] props; passes to KommunikationTab as initialTemplates and initialSendLog.
- `src/app/(dashboard)/konfiguration/page.tsx` — Extended Promise.all from 12 to 14 queries, adding message_templates (ordered by name) and send_log (ordered by created_at desc, limit 100). Passes new props to KonfigurationTabs.

## Requirements satisfied

- COMM-04: Versandprotokoll read-only with DSGVO masking and filter controls
- COMM-05: Nachrichtenvorlagen CRUD with variable insert and live preview

## DSGVO

- recipient_masked is the only recipient column in schema (enforced in 06-01 migration)
- UI reads only log.recipient_masked; aria-label="Maskierte Empfängeradresse" on each cell
- No unmask option exists anywhere in the component
- Preview uses hardcoded EXAMPLE_VALUES only (Muster Maria, Ordination Beispiel, etc.) — no DB fetch, no real patient data ever used in preview

## Deviations from Plan

None — plan executed exactly as written. The simplified inline form approach (useTransition + handleTemplateSave) was adopted per the plan's own recommendation over the more complex useActionState approach.

## TypeScript

Compiles clean with strict mode (npx tsc --noEmit exits 0).

## Commits

- `2f5c96d` — feat(actions): Phase 6 template Server Actions — createTemplateAction, updateTemplateAction (version++), deleteTemplateAction (deactivates dependent comm_rules)
- `262cdc4` — feat(ui): Phase 6 Nachrichtenvorlagen + Versandprotokoll — template CRUD with variable insert + live preview; DSGVO-masked send log with filters
