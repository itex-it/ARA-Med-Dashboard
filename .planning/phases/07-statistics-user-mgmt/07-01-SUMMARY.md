---
phase: 07-statistics-user-mgmt
plan: 01
status: COMPLETE
date: 2026-05-24
subsystem: types, permissions, navigation, routing
tags: [types, permissions, rbac, navigation, stub-pages]
dependency_graph:
  requires: []
  provides:
    - src/lib/types/index.ts#phase07
    - src/lib/permissions.ts
    - src/app/(dashboard)/statistiken/page.tsx
    - src/app/(dashboard)/benutzer/page.tsx
  affects:
    - src/app/(dashboard)/layout.tsx
tech_stack:
  added: []
  patterns:
    - "Server Component role gate (araRole from JWT app_metadata → redirect)"
    - "Delegation ceiling pattern (applyDelegationCeiling caps per-module permissions)"
key_files:
  created:
    - src/lib/permissions.ts
    - src/app/(dashboard)/statistiken/page.tsx
    - src/app/(dashboard)/benutzer/page.tsx
  modified:
    - src/lib/types/index.ts
    - src/app/(dashboard)/layout.tsx
decisions:
  - "permissions.ts has no 'server-only' import — constants needed on client for permission matrix UI"
  - "araRole extracted from JWT app_metadata (server-side) in layout — not from request params"
  - "Benutzer nav link conditionally rendered server-side; /benutzer page adds second server-side redirect as defense-in-depth (T-07-01)"
metrics:
  duration: "~15 minutes"
  completed_date: 2026-05-24
  tasks_completed: 5
  files_changed: 5
---

# Phase 07 Plan 01: Foundation — Types, Permissions, Nav Links, Stub Pages Summary

**One-liner:** Phase 07 foundation: 7 new types, permissions utility with 20 MODULE_CATEGORIES and 4-role DEFAULT_PERMISSIONS, Statistiken/Benutzer nav links, and stub Server Component pages for /statistiken and /benutzer.

---

## What Was Built

### 1. src/lib/types/index.ts — Phase 07 type block appended

Seven new exported types added after the existing Phase 06 section:

- `PermissionLevel` — union: `'none' | 'view' | 'edit' | 'manage' | 'admin'`
- `ModuleCategory` — union of 20 DB-safe module keys
- `ModulePermissions` — `Record<ModuleCategory, PermissionLevel>`
- `TenantUserDisplay` — combined auth.users + user_tenant_roles for rendering
- `StatsSummary` — statistics aggregation interface (12 fields)
- `DailyCallVolume` — per-day call volume breakdown
- `IntentFrequency` — intent name + count pair

No existing types modified.

### 2. src/lib/permissions.ts — New permissions utility module

Exported constants:
- `MODULE_CATEGORIES` — readonly const tuple, 20 entries
- `MODULE_CATEGORY_LABELS` — German display names for all 20 categories
- `PERMISSION_LEVELS` — readonly const tuple: `['none', 'view', 'edit', 'manage', 'admin']`
- `PERMISSION_LEVEL_LABELS` — German: Kein / Lesen / Bearbeiten / Verwalten / Admin
- `PERMISSION_LEVEL_ORDER` — numeric order for comparisons
- `ROLE_HIERARCHY` — numeric order for role comparisons
- `ROLE_LABELS` — German display names for all 4 AraRole values
- `DEFAULT_PERMISSIONS` — `Record<AraRole, ModulePermissions>` for all 4 roles:
  - operator: all 20 modules = 'admin'
  - ordination_admin: most 'manage', kosten='view', system_settings='none', audit_log='view'
  - assistant: inbox='edit', core modules='view', admin modules='none'
  - viewer: dashboard/telefonate/inbox/statistiken='view', everything else='none'

Exported functions:
- `canGrantPermission(grantorLevel, targetLevel): boolean`
- `canGrantRole(grantorRole, targetRole): boolean`
- `applyDelegationCeiling(grantorPermissions, targetPermissions): ModulePermissions`
- `getDefaultPermissions(role): ModulePermissions`

No 'server-only' — shared module used on both client and server.

### 3. src/app/(dashboard)/layout.tsx — Nav links added

- Extracted `araRole` from `user.app_metadata?.ara_role` (server-side, JWT)
- Replaced inline role check with `araRole` variable (used for both `canToggle` and nav gates)
- Added Statistiken link after Inbox, before Konfiguration (all authenticated users)
- Added Benutzer link after Konfiguration, before Einstellungen (operator/ordination_admin only)
- Final nav order: Übersicht → Telefonate → Inbox → Statistiken → Konfiguration → Benutzer (conditional) → Einstellungen

### 4. src/app/(dashboard)/statistiken/page.tsx — Stub Server Component

- Authenticates user via createServerClient; redirects to /auth/login if not authenticated
- No role gate — accessible to all authenticated users
- Returns heading "Statistiken" + placeholder card "Statistiken werden geladen…"
- Plans 07-02 will overwrite with full statistics implementation

### 5. src/app/(dashboard)/benutzer/page.tsx — Stub Server Component with role gate

- Authenticates user; redirects to /auth/login if not authenticated
- Extracts araRole from JWT app_metadata; redirects to /dashboard if not operator/ordination_admin
- Returns heading "Benutzerverwaltung" + placeholder card "Benutzer werden geladen…"
- Server-side redirect implements T-07-01 mitigation (elevation of privilege defense)
- Plan 07-03 will overwrite with full user management implementation

---

## Verification Results

| Check | Result |
|-------|--------|
| `grep "Phase 07" src/lib/types/index.ts` | PASS — section header present |
| All 7 new types in index.ts | PASS |
| `grep -c "export const MODULE_CATEGORIES" src/lib/permissions.ts` | PASS — 1 |
| `grep -c "export function" src/lib/permissions.ts` | PASS — 4 functions |
| `grep "Statistiken" layout.tsx` | PASS — nav link present |
| `grep "Benutzer" layout.tsx` with role condition | PASS — conditional on ordination_admin |
| Both stub pages exist with default export | PASS |
| `npx tsc --noEmit` | PASS — 0 errors |

---

## Commit

| Hash | Message |
|------|---------|
| fc32347 | feat(phase-07): foundation — Phase 07 types, permissions utility, nav links, stub pages |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Threat Surface Scan

No new network endpoints or auth paths introduced. The /benutzer route adds a server-side redirect (T-07-01 mitigation as planned). No unplanned threat surface.

---

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| src/app/(dashboard)/statistiken/page.tsx | Placeholder card text | Intentional — Plan 07-02 will replace with full statistics implementation |
| src/app/(dashboard)/benutzer/page.tsx | Placeholder card text | Intentional — Plan 07-03 will replace with full user management implementation |

These stubs do not prevent the plan's goal (foundation for 07-02/07-03) from being achieved.

---

## Self-Check: PASSED

- src/lib/types/index.ts: FOUND (modified, Phase 07 section present)
- src/lib/permissions.ts: FOUND (created)
- src/app/(dashboard)/layout.tsx: FOUND (modified, nav links present)
- src/app/(dashboard)/statistiken/page.tsx: FOUND (created)
- src/app/(dashboard)/benutzer/page.tsx: FOUND (created)
- Commit fc32347: FOUND
- TypeScript: 0 errors
