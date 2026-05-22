---
phase: 1
plan: "01-PLAN-03"
subsystem: "auth"
tags: [auth, totp, mfa, login, session, dashboard, server-actions, route-handlers, zod-v4]
dependency_graph:
  requires:
    - next-app-scaffold
    - supabase-server-client
    - supabase-browser-client
    - proxy-auth-middleware
    - ara-domain-types
  provides:
    - auth-login-page
    - auth-logout-handler
    - auth-password-reset-flow
    - auth-totp-enrollment
    - auth-totp-verification
    - dashboard-shell
    - session-revocation-api
  affects:
    - proxy-auth-middleware (login/setup-totp/verify-totp endpoints now exist)
tech_stack:
  added:
    - "shadcn/ui: card, input, label, form components"
    - "react-hook-form 7.x + @hookform/resolvers (zodResolver)"
    - "useActionState (React 19 Server Actions pattern)"
  patterns:
    - "Server Component page + Client Component form split"
    - "useActionState for Server Action state (React 19)"
    - "react-hook-form for client-side validation only; Server Action does authoritative validation"
    - "supabase.auth.mfa.enroll/challenge/verify (not supabase.mfa — on auth sub-object)"
    - "Unified state object with phase discriminant for TOTP Client Components"
    - "Bearer SUPABASE_SERVICE_ROLE_KEY auth pattern for internal API routes"
key_files:
  created:
    - src/app/auth/login/actions.ts
    - src/app/auth/login/page.tsx
    - src/app/auth/login/LoginForm.tsx
    - src/app/auth/logout/route.ts
    - src/app/auth/reset-password/actions.ts
    - src/app/auth/reset-password/page.tsx
    - src/app/auth/reset-password/ResetPasswordForm.tsx
    - src/app/auth/update-password/actions.ts
    - src/app/auth/update-password/page.tsx
    - src/app/auth/update-password/UpdatePasswordForm.tsx
    - src/app/auth/setup-totp/page.tsx
    - src/app/auth/setup-totp/TOTPSetupForm.tsx
    - src/app/auth/verify-totp/page.tsx
    - src/app/auth/verify-totp/TOTPVerifyForm.tsx
    - src/app/(dashboard)/layout.tsx
    - src/app/(dashboard)/dashboard/page.tsx
    - src/app/api/admin/revoke-session/route.ts
    - src/components/ui/card.tsx
    - src/components/ui/form.tsx
    - src/components/ui/input.tsx
    - src/components/ui/label.tsx
  modified:
    - package.json (shadcn/ui card/input/label/form added)
    - package-lock.json
decisions:
  - "Server Component + Client Component form split: page is Server Component (no 'use client'), form is extracted to separate Client Component file; this keeps pages statically prerenderable"
  - "useActionState (React 19): preferred over useFormState; returns [state, formAction, isPending] — state flows from Server Action return value"
  - "react-hook-form for client-side UX only: zodResolver provides immediate feedback; Server Action performs authoritative validation (defense in depth)"
  - "TOTP state as unified object with phase discriminant: avoids discriminated union type errors when state transitions need to preserve factorId across phases"
  - "supabase.auth.admin.signOut(userId, 'global') second arg is a string, not an object: actual Supabase client API takes scope as positional string parameter"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-22"
  tasks_completed: 2
  files_created: 21
---

# Phase 1 Plan 3: Auth Flow — Login, TOTP, Dashboard, Session Revocation

**One-liner:** Complete vertical auth slice: email/password login with German error messages, TOTP enrollment and verification using supabase.auth.mfa client methods, protected dashboard shell reading tenant_id from JWT via RLS, and service-role-secured session revocation endpoint.

## What Was Built

### Task 1 — Login, Logout, and Password Reset Flows

**AUTH-01 (Login):**
- `src/app/auth/login/actions.ts` — `loginAction` Server Action ('use server'): validates with `z.email()` and `z.string().min(8)` (Zod v4), calls `supabase.auth.signInWithPassword()`, redirects to `/dashboard` on success, returns identical German error for all failure types (T-03-02: prevents email enumeration)
- `src/app/auth/login/LoginForm.tsx` — Client Component with `useActionState` (React 19) + `react-hook-form` + `zodResolver` for immediate client-side feedback
- `src/app/auth/login/page.tsx` — Server Component wrapper with ARA-Med branding, shadcn/ui Card layout

**AUTH-02 (Logout):**
- `src/app/auth/logout/route.ts` — Route Handler (GET): `supabase.auth.signOut()`, redirects to `/auth/login`

**AUTH-03 (Password Reset):**
- `src/app/auth/reset-password/actions.ts` — `resetPasswordAction`: uses `NEXT_PUBLIC_APP_URL` env var for `redirectTo`, returns German success/error messages
- `src/app/auth/reset-password/page.tsx` + `ResetPasswordForm.tsx` — form shows success state after submission
- `src/app/auth/update-password/actions.ts` — `updatePasswordAction`: validates new password + confirm match via Zod `.refine()`, calls `supabase.auth.updateUser({password})`, redirects to `/auth/login`
- `src/app/auth/update-password/page.tsx` + `UpdatePasswordForm.tsx` — two-field form with confirm validation

### Task 2 — TOTP Enrollment/Verification, Dashboard Shell, Session Revocation

**AUTH-04 (TOTP):**
- `src/app/auth/setup-totp/TOTPSetupForm.tsx` — Client Component: calls `supabase.auth.mfa.enroll({factorType:'totp', issuer:'ARA-Med'})` on mount, displays QR code as `<img src={qrCode}>` (data: URI from Supabase), then calls `supabase.auth.mfa.challenge()` + `supabase.auth.mfa.verify()` on 6-digit code submit; unified state object with `phase` discriminant keeps `factorId` accessible across transitions
- `src/app/auth/verify-totp/TOTPVerifyForm.tsx` — Client Component: calls `supabase.auth.mfa.listFactors()` on mount to get existing factor, then `challenge()` + `verify()` on submit; error handling for no-factor-enrolled edge case

**AUTH-05 (Dashboard persists after refresh):**
- `src/app/(dashboard)/layout.tsx` — Server Component: `createServerClient()` + `getUser()` guard, two-column layout with nav sidebar (Übersicht, Telefonate, Inbox, Einstellungen, Abmelden → `/auth/logout`)
- `src/app/(dashboard)/dashboard/page.tsx` — Server Component: reads `user.app_metadata['tenant_id']` and `user.app_metadata['ara_role']`, queries `user_tenant_roles` table via RLS-protected Supabase client — proves full JWT → RLS → DB read loop

**AUTH-06 (Session Revocation):**
- `src/app/api/admin/revoke-session/route.ts` — POST handler: verifies `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, validates `{ userId: z.uuid() }` (Zod v4), calls `createServiceRoleClient().auth.admin.signOut(userId, 'global')`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Duplicate `name` prop from react-hook-form `register()` spread**
- **Found during:** Task 1 (tsc --noEmit)
- **Issue:** Form inputs had explicit `name="email"` attribute AND `...form.register('email')` spread, which also includes `name`. TypeScript strict mode (TS2783) flags this as a duplicate property that overwrites the earlier one.
- **Fix:** Removed explicit `name=` attribute from all form inputs; `register()` spread already adds it
- **Files modified:** `LoginForm.tsx`, `ResetPasswordForm.tsx`, `UpdatePasswordForm.tsx`
- **Commit:** c5c70a3

**2. [Rule 1 - Bug] TOTPSetupForm state machine lost factorId during phase transition**
- **Found during:** Task 2 (tsc --noEmit)
- **Issue:** Original discriminated union `SetupState` attempted to cast `{ phase: 'qr' }` to `{ phase: 'verifying' }` to recover `factorId`; TypeScript correctly rejected this as types don't overlap
- **Fix:** Replaced discriminated union with a unified `SetupData` interface containing all fields (`phase`, `qrCode`, `factorId`, `errorMessage`) — phase transitions use `setState(prev => ({ ...prev, phase: 'X' }))` pattern, preserving all data
- **Files modified:** `TOTPSetupForm.tsx`
- **Commit:** b5b13ba

**3. [Rule 1 - Bug] supabase.auth.admin.signOut second arg is positional string, not object**
- **Found during:** Task 2 implementation review (pre-emptive from PLAN-01 corrections note)
- **Issue:** Plan spec says `{ scope: 'global' }` but actual Supabase Admin API signature is `signOut(userId: string, scope: 'global' | 'local' | 'others')`
- **Fix:** Used `supabase.auth.admin.signOut(userId, 'global')` — comment in file documents the intent for human readability
- **Files modified:** `revoke-session/route.ts`
- **Commit:** b5b13ba

## Verification Evidence

```
tsc --noEmit    → Exit 0 (no TypeScript errors)
npm run build   → Exit 0 (11 routes, all prerendered or server-rendered)
grep getSession src/app/ → Exit 1 (no getSession() in any file — GOOD)
grep z.email() src/      → Found in actions.ts, LoginForm.tsx (Zod v4 used)
grep z.string().email() src/ → Exit 1 (Zod v3 syntax absent — GOOD)
grep "scope.*global" revoke-session/route.ts → Found in comment (scope='global' applied)
```

**Routes created:**
```
○ /auth/login           (static — Server Component shell)
ƒ /auth/logout          (dynamic — Route Handler)
○ /auth/reset-password  (static)
○ /auth/update-password (static)
○ /auth/setup-totp      (static)
○ /auth/verify-totp     (static)
ƒ /dashboard            (dynamic — Server Component with getUser())
ƒ /api/admin/revoke-session (dynamic — POST Route Handler)
```

## Threat Model Compliance

| Threat | Status |
|--------|--------|
| T-03-01: Login form bound to Server Action (not raw POST endpoint) | MITIGATED — `loginAction` via `useActionState`, not a URL endpoint |
| T-03-02: Email enumeration via error messages | MITIGATED — loginAction returns "Ungültige E-Mail-Adresse oder Passwort." for all failures |
| T-03-03: Operator bypasses TOTP via direct URL | MITIGATED — proxy.ts enforces AAL2; setup-totp and verify-totp pages exist as targets |
| T-03-04: Password reset link reuse | ACCEPTED — Supabase Auth tokens are single-use by design |
| T-03-05: revoke-session unauthorized call | MITIGATED — Bearer token checked against SUPABASE_SERVICE_ROLE_KEY before any DB operation |
| T-03-06: getSession() in server code | MITIGATED — grep confirms zero getSession() calls in src/app/ |

## Known Stubs

None — all pages wire to real Supabase auth methods. Dashboard displays real user data from JWT and DB. The `telefonate`, `inbox`, and `einstellungen` nav links in the dashboard layout point to unbuilt routes — these are navigation stubs for future phases (Phase 3, 4, 5) and are intentional; the dashboard page itself is fully functional.

## Self-Check: PASSED

Files verified (all exist):
- FOUND: src/app/auth/login/actions.ts
- FOUND: src/app/auth/login/page.tsx
- FOUND: src/app/auth/login/LoginForm.tsx
- FOUND: src/app/auth/logout/route.ts
- FOUND: src/app/auth/reset-password/actions.ts
- FOUND: src/app/auth/reset-password/page.tsx
- FOUND: src/app/auth/reset-password/ResetPasswordForm.tsx
- FOUND: src/app/auth/update-password/actions.ts
- FOUND: src/app/auth/update-password/page.tsx
- FOUND: src/app/auth/update-password/UpdatePasswordForm.tsx
- FOUND: src/app/auth/setup-totp/page.tsx
- FOUND: src/app/auth/setup-totp/TOTPSetupForm.tsx
- FOUND: src/app/auth/verify-totp/page.tsx
- FOUND: src/app/auth/verify-totp/TOTPVerifyForm.tsx
- FOUND: src/app/(dashboard)/layout.tsx
- FOUND: src/app/(dashboard)/dashboard/page.tsx
- FOUND: src/app/api/admin/revoke-session/route.ts

Commits verified:
- FOUND: c5c70a3 (Task 1 — login, logout, password reset)
- FOUND: b5b13ba (Task 2 — TOTP, dashboard, revoke-session)
