# Technology Stack

**Project:** ARA-Med Dashboard — Multi-Tenant Medical Practice Voice AI SaaS
**Researched:** 2026-05-22
**Confidence:** HIGH (verified against official docs, Next.js 16 release notes, Supabase current docs)

---

## Decision Context

The stack is fixed by project constraints. This document records the authoritative versions, exact patterns, and the reasoning behind each choice, so all implementation phases start from verified facts rather than guesses.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 16.x (16.2.6 current) | Full-stack React framework | App Router gives Server Components by default — keeps Supabase service-role key out of browser. Server Actions replace REST round-trips for mutations. Fixed in project spec. |
| React | 19.x | UI layer | React 19 ships `useActionState`, async transitions, and `use()` — all needed for Server Action form handling without additional libraries. |
| TypeScript | 5.x strict | Type safety | `strict: true` catches RLS bypass bugs, undefined tenant_id, any-type leaks before runtime. Supabase generates types from schema — the only safe way to evolve DB + code together. |

**Critical Next.js 16 change:** `middleware.ts` is deprecated and renamed to `proxy.ts`. The exported function must also be renamed to `proxy`. The Edge runtime is NOT supported in `proxy.ts` — it defaults to Node.js. Run the official codemod if migrating: `npx @next/codemod@canary middleware-to-proxy .`

### Styling and Components

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x | Utility-first CSS | v4 is CSS-first: no `tailwind.config.js`, configuration lives in `globals.css`. 5x faster full rebuilds, 100x faster incremental builds. shadcn/ui fully supports v4 as of 2025. |
| shadcn/ui | current (CLI-based) | Component library | Not a dependency — components are copied into the repo. No version lock. 70+ components: DataTable, Sidebar, Chart, Dialog, Combobox, Calendar. Tailwind v4 and React 19 fully supported. `tw-animate-css` replaces the deprecated `tailwindcss-animate`. |

**Color system:** shadcn/ui now uses OKLCH instead of HSL for Tailwind v4 themes. Components include `data-slot` attributes for precise style targeting.

### Backend-as-a-Service

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase Postgres | managed | Primary database | Multi-tenant by design: `tenant_id` on every table, RLS on every table. Postgres extensions (`pgsodium`, `uuid-ossp`) available. No ORM — SQL migrations via Supabase CLI give full control over RLS policies. |
| Supabase Auth | current | Authentication | Native TOTP MFA with AAL (Authenticator Assurance Level) encoded in JWT `aal` claim. RLS policies can enforce `aal2` for sensitive tables. `app_metadata` stores `tenant_id` (server-writable, user-cannot-modify). |
| Supabase Realtime | current | Live push events | Postgres Changes subscription with `filter: 'tenant_id=eq.{uuid}'` gives per-tenant channel isolation. No polling. Channel naming: `calls:{tenant_id}`, `inbox:{tenant_id}`, `practice_status:{tenant_id}`. |
| Supabase Storage | current | Audio + transcript files | Private buckets only. Audio served via time-limited signed URLs (`createSignedUrl`), never permanent links. Signed URLs work directly as `<audio src="...">` — no Authorization header needed in the browser. DB stores only `storage_ref` + metadata. |
| Supabase Vault | current | Secret management | `vault.create_secret(value, name, description)` + read via `SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'medstar_key_{tenant_id}'`. n8n Postgres node executes this query as its first step. Keys never written to any other column. |

### JavaScript Client Libraries

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@supabase/supabase-js` | 2.x | Supabase JS client | Singleton pattern on client; new instance per server-side request. |
| `@supabase/ssr` | current | Cookie-based SSR auth | Replaces the deprecated `auth-helpers-nextjs`. `createBrowserClient` for Client Components, `createServerClient` for Server Components / Route Handlers / Server Actions. Required for proxy refresh pattern. |

**SSR auth pattern (mandatory):** Server Components cannot write cookies. The `proxy.ts` must call `supabase.auth.getClaims()` to refresh the token and propagate it via `request.cookies.set` + `response.cookies.set`. Always use `supabase.auth.getUser()` in server code — never `getSession()` which does not re-validate with the Auth server.

### Validation

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Zod | 4.x | Schema validation | Use on all API Route inputs, Server Action inputs, and n8n webhook payloads. v4 breaking changes: `z.string().email()` → `z.email()`, `z.string().uuid()` → `z.uuid()`. String format validators moved to top-level. 14x faster string parsing vs v3. |
| `@hookform/resolvers` | current | React Hook Form + Zod bridge | Use `zodResolver` for client-side form validation that shares the same schema as server-side Server Action validation. |
| react-hook-form | 7.x | Form state management | Client-only (`'use client'`). Pair with `useActionState` (React 19) for Server Action progressive enhancement. |

### Deployment and Infrastructure

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel | current | Hosting | Native Next.js deployment. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser-safe), `SUPABASE_SERVICE_ROLE_KEY` (server-only, never `NEXT_PUBLIC_`). The Vercel-Supabase integration syncs env vars automatically. Note: Supabase is migrating key formats to `sb_publishable_xxx` and `sb_secret_xxx` — plan for migration before end of 2026. |
| n8n Community | current | Workflow orchestration | Not visible in product. Receives webhook events from ElevenLabs, orchestrates MEDSTAR API calls, pushes events to Dashboard API. HMAC signature validation on the Dashboard webhook receiver (no built-in n8n support — implement in Code node or Next.js API Route). |

---

## Architecture-Specific Patterns

### Multi-Tenant RLS (Postgres)

Every tenant-scoped table requires both a mandatory column and a RLS policy:

```sql
-- Column (mandatory on every table)
tenant_id uuid NOT NULL REFERENCES tenants(id)

-- RLS policy pattern — tenant isolation
CREATE POLICY "tenant_isolation" ON call_log
  FOR ALL
  TO authenticated
  USING (
    tenant_id = (
      SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    )
  );

-- MFA enforcement for sensitive tables (operator/admin actions)
CREATE POLICY "require_mfa_for_settings" ON practice_settings
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'aal') = 'aal2'
    AND tenant_id = (
      SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    )
  );
```

`tenant_id` stored in `app_metadata` (server-writable, user-cannot-modify). JWT freshness: token refresh is handled by `proxy.ts` — if a user loses tenant access, the next request after JWT expiry enforces the removal.

### Supabase Realtime — Per-Tenant Channel Pattern

```typescript
// Client Component only ('use client')
const supabase = createBrowserClient(...)

useEffect(() => {
  const channel = supabase
    .channel(`calls:${tenantId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'call_log',
        filter: `tenant_id=eq.${tenantId}`,
      },
      (payload) => {
        // Update local state — do not refetch entire list
        handleCallUpdate(payload)
      }
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [tenantId])
```

Realtime subscriptions are Client Components only. Channel cleanup on logout is mandatory to prevent cross-session leaks.

### Supabase Vault — n8n Key Retrieval Pattern

n8n first Postgres node SQL:

```sql
SELECT decrypted_secret
FROM vault.decrypted_secrets
WHERE name = 'medstar_key_' || '{{$json.tenant_id}}'
LIMIT 1;
```

The result is stored as a workflow variable. Subsequent nodes reference the variable — the key is never stored in a node credential field. The n8n service-role key is the only Supabase credential stored in n8n environment variables.

### Audio Playback — Signed URL Pattern

```typescript
// Server Action — generates short-lived URL
export async function getAudioUrl(callId: string): Promise<string> {
  'use server'
  const supabase = createServerClient(...)
  const session = await supabase.auth.getUser()
  // Check call_audio permission for this tenant + user
  await assertPermission(session, 'call_audio', 'view')

  const call = await supabase
    .from('call_log')
    .select('audio_storage_ref')
    .eq('id', callId)
    .single()

  const { data } = await supabase.storage
    .from('call-audio')
    .createSignedUrl(call.data!.audio_storage_ref, 3600) // 1h TTL

  return data!.signedUrl
}
```

```tsx
// Client Component — use signed URL directly in audio element
<audio controls src={signedUrl} preload="none" />
```

No proxy needed — signed URLs are safe as `<audio src>` without Authorization headers. Supabase Storage supports byte-range requests (HTTP 206), so browser seeks work correctly.

### n8n Webhook Security — Dashboard Receiver

```typescript
// src/app/api/n8n-events/route.ts
import { createHmac, timingSafeEqual } from 'crypto'
import { z } from 'zod'

const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET! // server-only env var

export async function POST(request: Request) {
  const signature = request.headers.get('x-ara-signature')
  const rawBody = await request.text()

  // HMAC verification — timing-safe
  const expected = createHmac('sha256', N8N_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')
  const isValid = timingSafeEqual(
    Buffer.from(signature ?? ''),
    Buffer.from(expected)
  )
  if (!isValid) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = EventPayloadSchema.parse(JSON.parse(rawBody))
  // ...
}
```

### TypeScript Strict Patterns with Supabase Generated Types

```typescript
// Generate after every migration:
// supabase gen types typescript --local > src/lib/database.types.ts

import type { Database } from '@/lib/database.types'

type CallLog = Database['public']['Tables']['call_log']['Row']
type CallLogInsert = Database['public']['Tables']['call_log']['Insert']
type CallLogUpdate = Database['public']['Tables']['call_log']['Update']

// Supabase client with typed generic
const supabase = createServerClient<Database>(url, key, ...)

// Type-safe query — no 'any'
const { data, error } = await supabase
  .from('call_log')
  .select('id, main_intent, status, started_at')
  .eq('tenant_id', tenantId)
  .order('started_at', { ascending: false })
  .returns<Pick<CallLog, 'id' | 'main_intent' | 'status' | 'started_at'>[]>()
```

---

## Key Package Versions (2026-05)

```bash
# Core
next@16                      # proxy.ts (not middleware.ts)
react@19
react-dom@19
typescript@5

# Supabase
@supabase/supabase-js@2
@supabase/ssr                # replaces @supabase/auth-helpers-nextjs

# UI
tailwindcss@4
tw-animate-css               # replaces tailwindcss-animate
shadcn/ui                    # installed via CLI, no npm package

# Validation
zod@4                        # use z.email(), z.uuid() not z.string().email()
react-hook-form@7
@hookform/resolvers

# Optional: server state for client components needing background sync
@tanstack/react-query@5

# Types (auto-generated, committed to repo)
src/lib/database.types.ts    # supabase gen types typescript --local
```

---

## Alternatives Considered and Rejected

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Auth | Supabase Auth | NextAuth.js / Auth.js | Supabase Auth integrates natively with RLS, Vault, and MFA AAL claims. External auth requires JWT bridging and loses native RLS tenant enforcement. |
| Realtime | Supabase Realtime | Pusher / Ably / SSE | Supabase Realtime is already part of the BaaS — no extra vendor. Postgres Changes filter gives per-tenant isolation without a proxy layer. |
| ORM | Raw Supabase client + generated types | Prisma / Drizzle | Supabase's query builder is type-safe with generated types. ORMs add a layer that conflicts with RLS (Prisma uses its own connection pool that bypasses RLS unless carefully configured). |
| State management | React Server Components + Supabase Realtime | Redux / Zustand | Server Components eliminate most client state. Realtime handles live updates. React 19 `useActionState` handles mutation state. No global store needed. |
| Form library | react-hook-form + Zod | Formik / Tanstack Form | react-hook-form has zero re-renders on field change, smallest bundle. Zod v4 schema shared between client validation and Server Action validation. |
| CSS | Tailwind CSS 4 + shadcn/ui | MUI / Chakra UI / Ant Design | MUI/Chakra are black-box dependencies — styling conflicts with Tailwind. shadcn/ui's copy-paste model means full control over component code for DSGVO-specific modifications. |
| Deployment | Vercel | Self-hosted Next.js on Portainer | Vercel's native Next.js support handles ISR, streaming, Proxy/middleware, and env var syncing with Supabase automatically. Portainer is used for n8n, not the dashboard. |
| Validation | Zod 4 | Yup / Joi | Zod 4 is TypeScript-first, schema inference flows directly into TypeScript types. 14x faster than v3. No runtime type erasure. |

---

## DSGVO / Healthcare-Specific Implementation Notes

**Telefonnummer (phone number) handling:**
- Store as `caller_phone_hash` (SHA-256 of normalized number) for lookup
- Store as `caller_phone_masked` (e.g., `+43 *** *** 123`) for display
- Store as `caller_phone_encrypted` (bytea, optional) for authorized full access
- API Routes gate full number on `calls` permission level — never returned by default
- Server Components always receive pre-masked data from the API

**Audio and Transcript:**
- Private Supabase Storage bucket — zero public access
- Signed URLs generated server-side with 1-hour TTL maximum
- Separate permission check (`call_audio`, `call_transcripts`) before URL generation
- ElevenLabs auto-delete after 30 days (configurable per tenant via `tenant_features`)

**SVNR (Sozialversicherungsnummer):**
- Not stored by default — MEDSTAR holds it
- If stored: encrypted bytea + masked display only
- Requires separate `patient_data` permission

**Audit logging:**
- Every MEDSTAR API call → `call_actions` row
- Every permission change → `audit_log` row with `old_value` / `new_value` (sanitized JSONB)
- Every critical config change → `audit_log` (actor type: `user` | `system` | `n8n`)
- No PII in audit log `old_value`/`new_value` — only structural data

**Service role key isolation:**
- `SUPABASE_SERVICE_ROLE_KEY`: server-only env var, never `NEXT_PUBLIC_`
- Used in: API Routes, Server Actions, n8n Postgres node
- Never referenced in any `'use client'` file
- ESLint rule recommended: flag any import of service-role client in client-side files

---

## Sources

- Next.js 16 Release Notes: https://nextjs.org/blog/next-16
- Next.js Proxy (formerly Middleware) docs: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- Next.js Server Actions (Mutating Data): https://nextjs.org/docs/app/getting-started/mutating-data
- Supabase SSR with Next.js: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase Realtime Postgres Changes: https://supabase.com/docs/guides/realtime/postgres-changes
- Supabase Vault docs: https://supabase.com/docs/guides/database/vault
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase MFA via RLS: https://supabase.com/blog/mfa-auth-via-rls
- Supabase Storage serving: https://supabase.com/docs/guides/storage/serving/downloads
- shadcn/ui Tailwind v4 docs: https://ui.shadcn.com/docs/tailwind-v4
- Zod v4 release + migration: https://zod.dev/v4
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Vercel Supabase integration: https://supabase.com/blog/using-supabase-with-vercel
