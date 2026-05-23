---
phase: 5
slug: 05-configuration
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-23
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Config forms require Supabase auth context — primary validation is TypeScript strict + manual E2E checkpoints.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript strict (`tsc --noEmit`) + manual E2E |
| **Config file** | `tsconfig.json` (existing) |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~30 seconds (tsc) / ~2 min (build) |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full build must pass + human E2E checkpoint at 05-06 Task 4
- **Max feedback latency:** 30 seconds (tsc)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Automated Command | Status |
|---------|------|------|-------------|------------|-------------------|--------|
| 05-01-T1 | 05-01 | 1 | — | — | `npx tsc --noEmit` (pre-migration) | ⬜ pending |
| 05-01-T2 | 05-01 | 1 | — | — | `npx tsc --noEmit` | ⬜ pending |
| 05-01-T3 | 05-01 | 1 | — | — | `supabase db push` [BLOCKING, human] | ⬜ pending |
| 05-01-T4 | 05-01 | 1 | APPT-01 | — | `npx tsc --noEmit` (seed migration) | ⬜ pending |
| 05-02-T1 | 05-02 | 2 | HOURS-01..03 | T-05-B | `npx tsc --noEmit` | ⬜ pending |
| 05-02-T2 | 05-02 | 2 | HOURS-01..03 | — | `npx tsc --noEmit` | ⬜ pending |
| 05-03-T1 | 05-03 | 2 | APPT-01..05 | T-05-A | `npx tsc --noEmit` | ⬜ pending |
| 05-03-T2 | 05-03 | 2 | APPT-01..05 | — | `npx tsc --noEmit` | ⬜ pending |
| 05-04-T1 | 05-04 | 2 | TEXT-01..04 | T-05-C | `npx tsc --noEmit` | ⬜ pending |
| 05-04-T2 | 05-04 | 2 | TEXT-01..04 | — | `npx tsc --noEmit` | ⬜ pending |
| 05-05-T1 | 05-05 | 2 | DEPUTY-01..04 | T-05-D | `npx tsc --noEmit` | ⬜ pending |
| 05-05-T2 | 05-05 | 2 | DEPUTY-01..04 | — | `npx tsc --noEmit` | ⬜ pending |
| 05-06-T1 | 05-06 | 3 | MED-01 | T-05-E | `npx tsc --noEmit` | ⬜ pending |
| 05-06-T2 | 05-06 | 3 | MED-01 | — | `npx tsc --noEmit` | ⬜ pending |
| 05-06-T3 | 05-06 | 3 | All | — | `npx tsc --noEmit` | ⬜ pending |
| 05-06-T4 | 05-06 | 3 | All | — | `npm run build` + human E2E [human] | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

- No new test runner required — validation is TypeScript strict + Zod schemas + human E2E checkpoints
- TypeScript types for all new tables added in 05-01 Task 2 to `src/lib/types/index.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Opening hours save persists 7 rows to DB | HOURS-01 | Requires Supabase auth context + live DB | Navigate /konfiguration → Öffnungszeiten, set Mon–Fri 08:00–17:00, save, reload, verify values persist |
| Special day add/delete visible in table | HOURS-02 | Requires live DB + UI interaction | Add a Sondertag for next Monday, verify it appears in table, delete it |
| Deputy period date range saved correctly | HOURS-03 | Requires live DB + UI interaction | Add a Vertretungszeitraum for 2026-06-01..2026-06-15, verify dates persist |
| EU AI Act disclosure always present after save | TEXT-02 | Requires live DB write + read-back | Edit greeting text, save, reload, verify disclosure block is unchanged |
| APPT flags mutual exclusivity enforced | APPT-02 | Zod refine is server-side; UI-level test needs network | Attempt to set is_voice_bookable=true + is_internal_only=true simultaneously; expect German error "Ein Typ kann nicht gleichzeitig KI-buchbar und intern sein." |
| Medication PZN 7-digit validation | MED-01 | Requires UI + Zod server error response | Enter PZN "123" (too short), verify German error message appears |
| All 5 config tabs render without error | All | Full integration requires all Wave 2 plans complete | Navigate /konfiguration, click each of the 5 tabs, verify no broken page or console error |

---

## Validation Sign-Off

- [x] All tasks have `<automated>npx tsc --noEmit</automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (no new test files required)
- [x] No watch-mode flags in any task's automated command
- [x] Feedback latency < 60s (tsc runs in ~30s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
