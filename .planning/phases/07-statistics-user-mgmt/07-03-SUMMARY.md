---
phase: 07-statistics-user-mgmt
plan: "03"
subsystem: user-management
tags: [rbac, user-management, delegation, server-actions, supabase-admin]
dependency_graph:
  requires: [07-01]
  provides: [user-management-ui, rbac-enforcement]
  affects: [benutzer-page]
tech_stack:
  added: []
  patterns: [5-step-auth, delegation-ceiling, service-role-admin-api, useTransition-formdata]
key_files:
  created:
    - src/lib/actions/users.ts
    - src/components/users/BenutzerTable.tsx
    - src/components/users/InviteUserSheet.tsx
    - src/components/users/EditUserSheet.tsx
  modified:
    - src/app/(dashboard)/benutzer/page.tsx
decisions:
  - "applyDelegationCeiling called server-side before every insert/update — UI ceiling is UX-only"
  - "auth.admin.signOut(userId, 'global') on every mutation (not just deactivation)"
  - "createUser cleanup: delete orphaned auth user if user_tenant_roles insert fails"
  - "myPermissions passed as currentUserPermissions prop to BenutzerTable so sheets inherit ceiling"
metrics:
  duration: "~25 min"
  completed: "2026-05-24"
  tasks: 4
  files: 5
---

# Phase 07 Plan 03: User Management Summary

Built the full User Management module: three Server Actions (`createUserAction`, `updateUserAction`, `deactivateUserAction`) with server-enforced RBAC delegation ceiling, plus four UI components and the full `benutzer/page.tsx` Server Component.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create src/lib/actions/users.ts | 25f394f | src/lib/actions/users.ts |
| 2 | Create user management components | 25f394f | BenutzerTable, InviteUserSheet, EditUserSheet |
| 3 | Build full benutzer/page.tsx | 25f394f | src/app/(dashboard)/benutzer/page.tsx |
| 4 | Git commit | 25f394f | all 5 files |

## What Was Built

**src/lib/actions/users.ts** — Three Server Actions with full security:
- `createUserAction`: Zod-validated, 5-step auth, `canGrantRole` + `applyDelegationCeiling`, Supabase Admin API `createUser`, temp password returned once, cleanup on insert failure
- `updateUserAction`: Self-role-change protection, same-tenant verification, session invalidation on every mutation
- `deactivateUserAction`: Self-deactivation protection, same-tenant verification, `signOut('global')`

**src/components/users/BenutzerTable.tsx** — Table with role badge (ROLE_LABELS), active/inactive badge, edit/deactivate actions gated by `canGrantRole`, confirmation Dialog for deactivation with `useTransition`

**src/components/users/InviteUserSheet.tsx** — Email input, role selector (only grantable roles), 20-module permission matrix with radio buttons disabled above caller's ceiling (`PERMISSION_LEVEL_ORDER`), one-time temp password display on success

**src/components/users/EditUserSheet.tsx** — Same permission matrix, role selector, active Switch, initializes from existing user permissions, `updateUserAction` on submit

**src/app/(dashboard)/benutzer/page.tsx** — Full Server Component: parallel fetch of `user_tenant_roles` + `auth.admin.listUsers`, in-app join by `emailMap`, passes `myPermissions` to `BenutzerTable` for delegation ceiling propagation

## Security Properties Verified

- T-07-04: `canGrantRole` blocks ordination_admin from creating operator/ordination_admin
- T-07-05: `applyDelegationCeiling` applied server-side — client cannot inflate permissions
- T-07-06: `tenantId` always from `user.app_metadata.tenant_id`, never from formData
- T-07-07: All `user_tenant_roles` updates include `.eq('tenant_id', tenantId)`
- T-07-08: Self-deactivation/self-role-change blocked with explicit errors
- T-07-09: `auth.admin.signOut(userId, 'global')` on every role change or deactivation
- T-07-10: Server-side `redirect('/dashboard')` for assistant/viewer — not bypassable client-side

## RBAC Requirements Coverage

- RBAC-01: operator can create ordination_admin, assistant, viewer
- RBAC-02: ordination_admin can only create assistant, viewer
- RBAC-03: role displayed per user with ROLE_LABELS badge
- RBAC-04: 20-module permission matrix in InviteUserSheet and EditUserSheet
- RBAC-05: `applyDelegationCeiling` server-side + disabled radio inputs client-side
- RBAC-06: All 3 Server Actions gate on ALLOWED_ROLES=['operator','ordination_admin']

## Deviations from Plan

**1. [Rule 2 - Missing Critical Functionality] Orphan cleanup on createUser failure**
- Found during: Task 1
- Issue: If `user_tenant_roles` insert fails after auth user is created, auth user would be orphaned
- Fix: Added `await serviceClient.auth.admin.deleteUser(authData.user.id)` in error path
- Files: src/lib/actions/users.ts

**2. [Rule 2 - Missing prop] currentUserPermissions added to BenutzerTable**
- Found during: Task 3
- Issue: Plan's page.tsx render showed BenutzerTable without `currentUserPermissions` prop, but InviteUserSheet/EditUserSheet require it for delegation ceiling UI
- Fix: Added `currentUserPermissions={myPermissions}` prop to BenutzerTable; added prop to BenutzerTableProps interface
- Files: src/components/users/BenutzerTable.tsx, src/app/(dashboard)/benutzer/page.tsx

## Known Stubs

None — all data is wired. User list fetches live from `user_tenant_roles` + `auth.admin.listUsers`.

## Threat Flags

None — no new network endpoints or trust boundaries beyond what the plan's threat model covers.

## Self-Check: PASSED

- src/lib/actions/users.ts exists: FOUND
- src/components/users/BenutzerTable.tsx exists: FOUND
- src/components/users/InviteUserSheet.tsx exists: FOUND
- src/components/users/EditUserSheet.tsx exists: FOUND
- src/app/(dashboard)/benutzer/page.tsx exists: FOUND
- Commit 25f394f: FOUND
- npx tsc --noEmit: exit 0
