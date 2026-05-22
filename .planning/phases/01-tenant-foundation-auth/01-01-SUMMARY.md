---
phase: 1
plan: "01-PLAN-01"
subsystem: "infrastructure"
tags: [nextjs, typescript, tailwind, shadcn, supabase, auth, proxy]
dependency_graph:
  requires: []
  provides:
    - next-app-scaffold
    - supabase-server-client
    - supabase-browser-client
    - proxy-auth-middleware
    - ara-domain-types
  affects: []
tech_stack:
  added:
    - "next@16.2.6"
    - "react@19.2.6"
    - "react-dom@19.2.6"
    - "typescript@5.x"
    - "tailwindcss@4.3.0"
    - "tw-animate-css@1.4.0"
    - "@supabase/supabase-js@2.x"
    - "@supabase/ssr@0.6.1"
    - "zod@4.4.3"
    - "react-hook-form@7.x"
    - "@hookform/resolvers@3.x"
    - "class-variance-authority@0.7.1"
    - "clsx@2.x"
    - "tailwind-merge@3.x"
    - "radix-ui@1.4.3"
    - "shadcn/ui (CLI, neutral theme)"
  patterns:
    - "Tailwind v4 CSS-first configuration (no tailwind.config.js)"
    - "OKLCH color system for shadcn/ui"
    - "@supabase/ssr cookie-based SSR auth"
    - "server-only import guard for server client"
    - "proxy.ts replaces middleware.ts (Next.js 16)"
    - "getUser() over getSession() — server-side auth validation"
key_files:
  created:
    - package.json
    - tsconfig.json
    - next.config.ts
    - .gitignore
    - .env.local.example
    - components.json
    - src/app/globals.css
    - src/app/layout.tsx
    - src/app/page.tsx
    - src/styles/tw-animate.css
    - src/lib/utils.ts
    - src/components/ui/button.tsx
    - proxy.ts
    - src/lib/supabase/server.ts
    - src/lib/supabase/client.ts
    - src/lib/types/index.ts
  modified: []
decisions:
  - "tw-animate-css local copy: Turbopack cannot resolve bare CSS package imports from node_modules; copied dist/tw-animate.css to src/styles/tw-animate.css and use relative @import"
  - "eslint.ignoreDuringBuilds removed from next.config.ts: property does not exist in Next.js 16 NextConfig type"
  - "supabase.auth.mfa.getAuthenticatorAssuranceLevel() not supabase.mfa: mfa object lives on the auth client, not the top-level Supabase client"
metrics:
  duration: "594 seconds (~10 minutes)"
  completed: "2026-05-22"
  tasks_completed: 2
  files_created: 16
---

# Phase 1 Plan 1: Next.js 16 Project Scaffold Summary

**One-liner:** Next.js 16 project scaffold with TypeScript strict, Tailwind v4 OKLCH theme, shadcn/ui neutral, @supabase/ssr cookie auth, proxy.ts AAL2 enforcement for operator/ordination_admin roles.

## What Was Built

### Task 1 — Next.js 16 Project Initialization

Full project scaffold created from scratch (greenfield):

- **package.json**: All dependencies installed (next@16.2.6, react@19, tailwindcss@4, zod@4, @supabase/ssr, react-hook-form@7, shadcn/ui component dependencies)
- **tsconfig.json**: strict: true, noUncheckedIndexedAccess: true, @/* path alias, moduleResolution: bundler, target ES2022
- **next.config.ts**: TypeScript strict build errors enabled (ignoreBuildErrors: false)
- **src/app/globals.css**: Tailwind v4 CSS-first with @import "tailwindcss", full OKLCH color system for shadcn/ui neutral theme (--background, --foreground, --primary, etc.)
- **src/app/layout.tsx**: RootLayout Server Component with lang="de" (German UI as per CLAUDE.md)
- **src/components/ui/button.tsx**: shadcn/ui button component added via CLI
- **.env.local.example**: Documents correct env var naming (NEXT_PUBLIC_ safe, SUPABASE_SERVICE_ROLE_KEY server-only)

### Task 2 — Supabase Client Utilities and proxy.ts

- **proxy.ts**: Next.js 16 auth proxy (not middleware.ts — D-13). Exports function named `proxy`. Implements:
  - Session cookie refresh (copies updated cookies from Supabase response to Next.js response)
  - Unauthenticated redirect to /auth/login (all non-/auth/* routes)
  - AAL2 enforcement via `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` — never getSession()
  - Redirects operator/ordination_admin with AAL1 to /auth/verify-totp (D-05)
  - config.matcher excludes static assets, images, favicon

- **src/lib/supabase/server.ts**: First line is `import 'server-only'` (build-time guard). Exports:
  - `createServerClient()` — async, reads cookies via next/headers, uses NEXT_PUBLIC anon key
  - `createServiceRoleClient()` — sync, uses SUPABASE_SERVICE_ROLE_KEY, no cookie management, no auto-refresh

- **src/lib/supabase/client.ts**: Exports `createClient()` — createBrowserClient singleton factory, no server-only import

- **src/lib/types/index.ts**: AraRole, MfaLevel, TenantRow, UserTenantRole types

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Turbopack cannot resolve bare CSS node_modules imports**
- **Found during:** Task 1 (first build attempt)
- **Issue:** `@import "tw-animate-css"` and `@import "tw-animate-css/dist/tw-animate.css"` both fail in Turbopack — Turbopack uses a different CSS module resolution algorithm than Webpack and cannot resolve bare package names in CSS `@import` statements
- **Fix:** Copied `node_modules/tw-animate-css/dist/tw-animate.css` to `src/styles/tw-animate.css` and changed globals.css to `@import "../styles/tw-animate.css"` (relative path always resolves)
- **Files modified:** src/app/globals.css, src/styles/tw-animate.css (new)
- **Commit:** 22750d1

**2. [Rule 1 - Bug] next.config.ts eslint property does not exist in NextConfig type**
- **Found during:** Task 1 (tsc --noEmit)
- **Issue:** `eslint.ignoreDuringBuilds` is not a valid property on Next.js 16 NextConfig type
- **Fix:** Removed eslint block from next.config.ts (ESLint is still active; just not configurable via this property in this version)
- **Files modified:** next.config.ts
- **Commit:** 22750d1

**3. [Rule 1 - Bug] supabase.mfa does not exist — correct path is supabase.auth.mfa**
- **Found during:** Task 2 (tsc --noEmit)
- **Issue:** The MFA API is nested on the auth client: `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`, not `supabase.mfa.getAuthenticatorAssuranceLevel()`
- **Fix:** Updated proxy.ts to use correct path
- **Files modified:** proxy.ts
- **Commit:** 583f4ad

**4. [Rule 2 - Missing Type Safety] CookieOptions type annotation required in strict mode**
- **Found during:** Task 2 (tsc --noEmit)
- **Issue:** TypeScript strict mode cannot infer types for cookie callback parameters
- **Fix:** Imported CookieOptions from @supabase/ssr and explicitly typed the setAll callback parameter in both server.ts and proxy.ts
- **Files modified:** src/lib/supabase/server.ts, proxy.ts
- **Commit:** 583f4ad

## Verification Evidence

```
npm run build  → Exit 0 ✓ (Next.js 16.2.6 Turbopack, no TypeScript errors)
tsc --noEmit   → Exit 0 ✓ (strict: true, noUncheckedIndexedAccess: true)
proxy.ts       → export async function proxy (not middleware) ✓
proxy.ts       → no getSession() function calls (only comments) ✓
server.ts L1   → import 'server-only' ✓
server.ts      → exports createServerClient, createServiceRoleClient ✓
client.ts      → no server-only import ✓
types/index.ts → exports AraRole, MfaLevel, TenantRow, UserTenantRole ✓
globals.css    → @import "tailwindcss" and --background: OKLCH ✓
button.tsx     → src/components/ui/button.tsx exists ✓
```

## Threat Model Compliance

All T-01-xx mitigations implemented:

| Threat | Mitigation Status |
|--------|-------------------|
| T-01-01: createBrowserClient in server file | MITIGATED — `import 'server-only'` in server.ts causes build failure if imported in browser bundle |
| T-01-02: SUPABASE_SERVICE_ROLE_KEY via NEXT_PUBLIC_ | MITIGATED — .env.local.example documents correct naming with explicit warning comment |
| T-01-03: getSession() in proxy | MITIGATED — proxy.ts uses getUser() exclusively; getSession not imported |
| T-01-04: AAL1 user on AAL2-required route | MITIGATED — proxy.ts checks ara_role from app_metadata + aalData.currentLevel, redirects to /auth/verify-totp |
| T-01-SC: npm package integrity | MITIGATED — all packages are well-known (Supabase, Vercel, shadcn, Radix ecosystem) |

## Known Stubs

None — all files create structural foundations, no placeholder data that flows to UI rendering.

## Self-Check: PASSED

Files verified:
- FOUND: proxy.ts
- FOUND: src/lib/supabase/server.ts
- FOUND: src/lib/supabase/client.ts
- FOUND: src/lib/types/index.ts
- FOUND: src/app/globals.css
- FOUND: src/components/ui/button.tsx
- FOUND: .env.local.example
- FOUND: package.json
- FOUND: tsconfig.json
- FOUND: next.config.ts

Commits verified:
- FOUND: 22750d1 (Task 1 — scaffold)
- FOUND: 583f4ad (Task 2 — Supabase clients + proxy)
