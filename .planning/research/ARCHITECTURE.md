# Architecture Patterns: ARA-Med Multi-Tenant Voice AI Dashboard

**Domain:** Multi-tenant SaaS dashboard for medical practice voice AI
**Researched:** 2026-05-22
**Overall Confidence:** HIGH — stack is fixed, patterns are verified against official Supabase docs and production case studies

---

## System Topology

```
Patient
  └─ Phone call
       └─ ElevenLabs Voice Layer (ARA-Med Voice branding)
            └─ n8n (MCP tool orchestration)
                 ├─ MEDSTAR API  ← source of truth for patients/appointments
                 └─ Dashboard API (Next.js API Routes)
                      ├─ Postgres: config, logs, audit, inbox
                      ├─ Storage:  audio files, transcripts
                      └─ Realtime: live push to browser dashboard
```

Two event boundaries drive the entire dashboard:
- **Pre-Call Push** — n8n fires `call.started` immediately on webhook receipt
- **End-Call Push** — n8n fires `call.completed` with full summary after conversation ends

No polling anywhere. All dashboard state arrives via these two push events plus Supabase Realtime.

---

## Component Boundaries

| Component | Responsibility | Communicates With | Security Boundary |
|-----------|---------------|-------------------|-------------------|
| ElevenLabs Voice Layer | Speech I/O, turn management, tool call firing | n8n only | Never touches Dashboard directly |
| n8n Workflows | Tool dispatch, MEDSTAR orchestration, key retrieval from Vault, event write to Dashboard API | MEDSTAR API, Supabase Vault, Dashboard `/api/internal/*` | Uses shared secret header; has its own service-role-scoped DB writes |
| Dashboard API Routes (`/api/*`) | Auth validation, RBAC enforcement, data masking, audit writes | Supabase Postgres, Supabase Storage | Validates JWT tenant_id; never accepts tenant_id from request body |
| Dashboard Frontend (Next.js) | Operative UI — call log, inbox, config | Dashboard API Routes (data), Supabase Realtime (live events) | Anon key only; Service-Role key never in browser |
| Supabase Postgres | Canonical store for ARA-Med config + all call events | API Routes, n8n (service role), Realtime | RLS on every table; tenant_id on every row |
| Supabase Storage | Audio files, transcripts | API Routes generate signed URLs; n8n uploads | Per-tenant folder paths; private bucket; signed URLs only |
| Supabase Realtime | Live push of DB changes to browser | Dashboard Frontend (client components) | RLS respected; `postgres_changes` filtered by tenant_id |
| Supabase Vault | Encrypted API keys per tenant | n8n (service role reads `vault.decrypted_secrets`) | Access only via service-role; never readable from frontend |
| MEDSTAR | Patient records, appointments, prescriptions — source of truth | n8n only | Dashboard never calls MEDSTAR directly |

---

## Data Flow: Incoming Call (Full Path)

```
1. Patient calls DID number
2. ElevenLabs receives call → fires tool calls to n8n MCP endpoint

3. n8n Workflow Node 1: vault.decrypted_secrets WHERE name = 'medstar_key_{tenant_id}'
4. n8n Workflow Node 2: validate tenant_id + DID against tenants table
5. n8n calls MEDSTAR API for patient identification, slots, etc.

6. n8n fires POST /api/internal/events  { event: "call.started", tenant_id, call_data }
7. API Route: validate n8n shared secret header (HMAC-SHA256 over body + timestamp)
8. API Route: writes call_log row with status = "in_progress"
9. Supabase Realtime: broadcasts INSERT on call_log to channel `calls:{tenant_id}`
10. Dashboard browser: receives live event, prepends call to call log list

--- conversation continues ---

11. n8n fires POST /api/internal/events  { event: "call.completed", full summary }
12. API Route: upserts call_log (ended_at, summary, status, intent)
13. API Route: writes call_actions, conversation_events, decision_traces
14. API Route: creates inbox_task if task_type warranted
15. Supabase Realtime: broadcasts UPDATE on call_log + INSERT on inbox_tasks
16. Dashboard browser: updates call entry in list, increments inbox counter in Status-Bar
```

---

## Multi-Tenant Architecture

### Fundamental Rule

Every table that holds tenant data carries `tenant_id uuid NOT NULL REFERENCES tenants(id)`. No exception. RLS is enabled on every such table. Frontend-side filtering is additive convenience, never the security gate.

### Custom JWT Claims (Auth Hook)

tenant_id and ara_role are embedded in every JWT at login via a Supabase Custom Access Token hook. This means RLS policies never query a relationship table per row — the claim is already in the token.

```sql
-- Custom Access Token Hook (runs at every token issuance)
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
declare
  claims jsonb;
  v_tenant_id uuid;
  v_role      text;
begin
  -- user_tenant_roles is the join table: user_id, tenant_id, role
  select tenant_id, role
  into   v_tenant_id, v_role
  from   public.user_tenant_roles
  where  user_id = (event->>'user_id')::uuid
  limit  1;

  claims := event->'claims';

  if v_tenant_id is not null then
    claims := jsonb_set(claims, '{app_metadata,tenant_id}', to_jsonb(v_tenant_id));
    claims := jsonb_set(claims, '{app_metadata,ara_role}',  to_jsonb(v_role));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
```

Store in `app_metadata` (not `user_metadata`) — users cannot modify `app_metadata`, making it safe for authorization decisions.

**JWT staleness caveat:** Changes to tenant membership or role do not propagate until the next token refresh. For role revocation, also invalidate the session server-side via Supabase Auth Admin API.

### RLS Policy Pattern (All Tenant Tables)

The critical performance technique: wrap all auth function calls in `(SELECT ...)` so Postgres caches the result once per statement rather than per row. This delivers 94–99% overhead reduction on large tables.

```sql
-- Template for every tenant-scoped table
alter table public.call_log enable row level security;

-- SELECT: own tenant only
create policy "tenant_isolation_select" on public.call_log
  for select to authenticated
  using (
    tenant_id = (select (auth.jwt()->'app_metadata'->>'tenant_id')::uuid)
  );

-- INSERT: own tenant only, and tenant_id must match JWT (no injection)
create policy "tenant_isolation_insert" on public.call_log
  for insert to authenticated
  with check (
    tenant_id = (select (auth.jwt()->'app_metadata'->>'tenant_id')::uuid)
  );

-- UPDATE: own tenant, role-gated (operator or ordination_admin can edit classifications)
create policy "tenant_isolation_update" on public.call_log
  for update to authenticated
  using (
    tenant_id = (select (auth.jwt()->'app_metadata'->>'tenant_id')::uuid)
    and (select auth.jwt()->'app_metadata'->>'ara_role') in ('operator', 'ordination_admin', 'assistant')
  );
```

**Always add the `TO authenticated` clause.** Without it, the policy evaluates for every role including `anon`, wasting CPU.

### Required Index on Every Tenant Table

```sql
-- Every table with tenant_id needs this index
create index on public.call_log (tenant_id, started_at desc);
create index on public.inbox_tasks (tenant_id, status, created_at desc);
create index on public.call_actions (tenant_id, call_id);
-- etc.
```

### Role-Gated Policies for 4 RBAC Roles

ARA-Med has four roles: `operator`, `ordination_admin`, `assistant`, `viewer`.

The recommended pattern: one base tenant-isolation policy for SELECT (all authenticated roles), then separate stricter policies for INSERT/UPDATE/DELETE scoped to the roles that need write access. Avoid combining role checks and tenant checks into one complex policy — split them into two policies using `AND` logic per statement type.

For module-level permissions (the 20 categories like `call_audio`, `call_transcripts`, `patient_data`), enforce those in API Route middleware, not in RLS. RLS handles tenant isolation; API Routes handle module-level access control. This keeps RLS simple and fast while keeping business logic in TypeScript where it is testable.

```
RLS layer:    "Can this user's tenant see this row at all?"
API layer:    "Can this user's role/permission level access this endpoint?"
Frontend:     "Should this UI element be visible?" (additive only)
```

---

## Supabase Realtime: Channel Patterns

### Channel Naming Convention

```
calls:{tenant_id}           → call_log INSERT and UPDATE
inbox:{tenant_id}           → inbox_tasks INSERT and UPDATE
practice_status:{tenant_id} → practice_status row changes (ara_status, practice_mode)
```

Channel name is any string except `'realtime'`. Use tenant_id as the namespace discriminator — each tenant's browser session subscribes only to their own channels.

### Subscription Pattern (Next.js Client Component)

Realtime subscriptions live exclusively in `'use client'` components. They cannot run in Server Components.

```typescript
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CallLog } from '@/lib/types'

export function CallLogRealtimeProvider({
  tenantId,
  initialData,
  children,
}: {
  tenantId: string
  initialData: CallLog[]
  children: React.ReactNode
}) {
  const [calls, setCalls] = useState<CallLog[]>(initialData)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel(`calls:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',            // INSERT + UPDATE both relevant
          schema: 'public',
          table: 'call_log',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setCalls((prev) => [payload.new as CallLog, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setCalls((prev) =>
              prev.map((c) => (c.id === payload.new.id ? (payload.new as CallLog) : c))
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId, supabase])

  // Pass calls down via context or render children
  return <CallLogContext.Provider value={calls}>{children}</CallLogContext.Provider>
}
```

Key rules:
- Always clean up with `supabase.removeChannel(channel)` in the `useEffect` return
- `filter: 'tenant_id=eq.{tenantId}'` limits bandwidth — only this tenant's events arrive at the client
- RLS on `call_log` acts as a second security gate — even if the filter is bypassed, the DB returns only rows the user can read
- `DELETE` events cannot be filtered (Postgres architectural constraint) — tombstone/soft-delete pattern is preferred anyway

### Server Component + Client Component Split

```
app/(dashboard)/calls/page.tsx         ← Server Component
  Fetches initial call_log list via supabase server client (SSR)
  Passes initialData to:

  CallLogRealtimeProvider               ← Client Component ('use client')
    Holds live state, subscribes to Realtime
    Renders:

    CallLogTable                        ← Server Component (static markup)
    CallLogItem                         ← Can be Server Component
```

**Rule:** Server Components own initial data fetch and static markup. Client Components own only the realtime subscription state and interactive elements. This keeps the JS bundle small.

---

## Next.js App Router Security Patterns

### Middleware (Required)

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => cookies.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        ),
      },
    }
  )

  // Always use getUser() — validates JWT signature on every request
  // Never use getSession() in server code (cookie-based, can be spoofed)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !request.nextUrl.pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  return response
}
```

### API Route Pattern (All Protected Routes)

```typescript
// app/api/calls/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { z } from 'zod'

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(/* ... */)

  // Always use getUser() — validates JWT cryptographically
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Extract tenant_id from JWT claims — NEVER from request body or query params
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  const araRole  = user.app_metadata?.ara_role  as string | undefined
  if (!tenantId) return Response.json({ error: 'No tenant context' }, { status: 403 })

  // Check module-level permission (beyond what RLS enforces)
  if (!hasPermission(araRole, 'calls', 'view')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // RLS handles tenant isolation — query is still scoped to JWT tenant
  const { data, error: dbError } = await supabase
    .from('call_log')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(50)

  // Mask sensitive fields before returning
  const masked = data?.map(maskCallLogEntry(araRole)) ?? []
  return Response.json(masked)
}
```

### n8n Inbound Webhook Security

n8n calls the Dashboard API to write events. It is NOT an authenticated Supabase user — it uses a service role key for DB writes. For the HTTP boundary, authenticate n8n-to-API-Route calls with a shared secret:

```typescript
// app/api/internal/events/route.ts
const N8N_SHARED_SECRET = process.env.N8N_WEBHOOK_SECRET!

export async function POST(request: Request) {
  const signature = request.headers.get('x-ara-signature')
  const timestamp  = request.headers.get('x-ara-timestamp')
  const body = await request.text()

  // Reject stale requests (replay attack prevention)
  if (!timestamp || Date.now() - parseInt(timestamp) > 5 * 60 * 1000) {
    return Response.json({ error: 'Stale request' }, { status: 401 })
  }

  // Validate HMAC-SHA256 signature
  const expected = hmacSha256(`${timestamp}.${body}`, N8N_SHARED_SECRET)
  if (!timingSafeEqual(signature, expected)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Parse and validate payload
  const payload = EventSchema.parse(JSON.parse(body))

  // Use service-role client for writes (bypasses RLS intentionally for system writes)
  const adminClient = createServiceRoleClient()
  await adminClient.from('call_log').upsert(payload.call_data)

  return Response.json({ ok: true })
}
```

The `/api/internal/*` namespace is exclusively for n8n. All `/api/*` routes for dashboard users validate JWT instead.

---

## Audio Storage Architecture

### Bucket Structure

One private bucket: `ara-med-audio`

Folder path: `{tenant_id}/{year}/{month}/{call_id}.{ext}`

Example: `a3f4...b2/2026/05/c7d8...e1.mp3`

n8n uploads audio via service role (bypasses RLS intentionally — n8n is a system actor). The DB stores only the path reference in `call_log.audio_storage_ref`.

### Storage RLS Policy

```sql
-- Private bucket RLS — authenticated users can read their tenant's files only
create policy "tenant_audio_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ara-med-audio'
    and (storage.foldername(name))[1] =
        (select auth.jwt()->'app_metadata'->>'tenant_id')
  );

-- No direct INSERT from browser — n8n uploads via service role
-- No direct DELETE from browser — retention management is a background job
```

### Signed URL Generation

Audio URLs are **never** stored as permanent links. Generate a signed URL server-side per request:

```typescript
// In API Route or Server Action only — never in browser
const { data } = await adminClient.storage
  .from('ara-med-audio')
  .createSignedUrl(audioStorageRef, 3600) // 1 hour expiry

// Return the signedUrl in the API response for the audio player
```

The signed URL carries its own authorization — even if leaked, it expires. The `call_audio` module permission check happens before the URL is generated (API Route enforces it). RLS on storage provides the second layer.

---

## Supabase Vault: Key Management

### Key Naming Convention

```
medstar_key_{tenant_id}         → MEDSTAR API key for this tenant
elevenlabs_key_{tenant_id}      → ElevenLabs API key (if tenant-specific)
n8n_webhook_secret              → Shared secret for n8n→Dashboard calls
```

### n8n Retrieval Pattern (Node 1 of every workflow)

```javascript
// n8n Code node — executed with service role credentials
const { data } = await supabase.rpc('get_secret', {
  secret_name: `medstar_key_${tenantId}`
})
// data.decrypted_secret is the plaintext key
// Pass it as a variable to subsequent nodes; it never leaves n8n
```

The Postgres function wrapping vault access:

```sql
create or replace function public.get_secret(secret_name text)
returns text language sql security definer as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = secret_name
  limit 1;
$$;
-- Only service_role can execute this
revoke all on function public.get_secret from public, authenticated, anon;
grant execute on function public.get_secret to service_role;
```

**Critical:** `vault.decrypted_secrets` must not be accessible to `authenticated` or `anon` roles. Revoke explicitly.

---

## Suggested Build Order (Dependencies)

The following order respects hard dependencies between components:

### Phase 1 — Tenant Foundation (unblocks everything)
- Supabase project setup, migrations baseline
- `tenants`, `profiles`, `user_tenant_roles` tables with RLS
- Custom Access Token hook (tenant_id + ara_role in JWT)
- Middleware + `createServerClient` / `createBrowserClient` utilities
- Basic auth flow (login, session, logout)

**Why first:** Every other component depends on JWT claims containing `tenant_id`. Without this, no RLS policy works and no API route can safely identify the caller's tenant.

### Phase 2 — n8n Event Ingestion (unblocks dashboard data)
- `/api/internal/events` route with HMAC validation
- `call_log`, `call_actions`, `conversation_events`, `decision_traces` tables + RLS
- Supabase Vault setup + `get_secret` function
- n8n workflow skeleton: key fetch → tenant validate → Dashboard API write
- Supabase Realtime channel `calls:{tenant_id}` test

**Why second:** No dashboard data exists without this. The Realtime frontend depends on data arriving here first.

### Phase 3 — Call Log + Realtime Dashboard (core value)
- Server Component: initial call_log fetch with SSR
- Client Component: Realtime subscription provider
- Call log list UI with masked phone, intent, status
- Call detail page: audio player (signed URL), transcript, summary
- Status-Bar with live ara_status and open task count

**Why third:** This is the primary operative value — ordinationen need to see calls. Audio signed URL flow requires the Storage bucket and RLS from Phase 2 data.

### Phase 4 — Inbox + Task Management
- `inbox_tasks`, `inbox_task_comments` tables + RLS
- Inbox Realtime channel
- Task list UI, task detail, comment threads
- Task status transitions with audit log entries

**Why fourth:** Inbox depends on `inbox_task` rows being created by n8n (Phase 2), and on the call detail page for context (Phase 3).

### Phase 5 — Configuration Modules (Operator / Admin use)
- Opening hours, special days, substitution periods
- Appointment types + voice_bookable flags + synonyms
- Routing rules
- Greeting texts / FAQ / medication list
- Audit log for all config mutations

**Why fifth:** Voice AI uses this config; it can be seeded manually in dev. Dashboard config UI is lower priority than operative call review.

### Phase 6 — User Management + RBAC UI
- User invite flow (email → Supabase Auth invite → user_tenant_roles insert)
- Permission profile management
- Delegation rule enforcement (server-side check on PATCH /api/users/:id/permissions)
- Module permission guards throughout UI

**Why sixth:** RBAC enforcement in API routes is in from day one (Phase 1). The UI for managing it can come later without blocking other features.

### Phase 7 — Statistics + Audit Log UI
- KPI computations from existing tables (no separate KPI tables in MVP)
- Charts: call volume, resolution rate, top intents
- Audit log table with filtering

**Why last:** Purely read-path. No production blocker. Data accumulates during earlier phases.

---

## Security Boundaries Summary

| Boundary | Enforcement | Notes |
|----------|-------------|-------|
| Tenant isolation (data) | RLS policy on every table | tenant_id from JWT, never from request body |
| Module permission (calls, audio, transcripts, etc.) | API Route middleware | Checked before DB query |
| n8n → API authentication | HMAC-SHA256 shared secret + timestamp | Not Supabase Auth — n8n is a system actor |
| Service-Role key exposure | Never in browser, never in frontend env vars | Only in n8n + API Routes + Server Actions |
| Audio file access | Storage RLS (tenant folder) + signed URL (expiring) | Double-gated |
| Realtime channel data | RLS on `call_log` respected by postgres_changes | Filter param reduces bandwidth; RLS is the gate |
| Vault secrets | Only via `get_secret()` function callable by service_role | `vault.decrypted_secrets` not accessible to authenticated role |
| JWT claims | Custom Access Token hook, stored in `app_metadata` | Not user_metadata (user-modifiable) |
| DSGVO masking | Server-side before API response | Frontend masking is additive/cosmetic only |

---

## Critical Pitfall Flags

1. **RLS with `auth.uid()` not wrapped in SELECT** — causes per-row function evaluation, catastrophic on call_log with thousands of rows. Always use `(select auth.uid())` and `(select auth.jwt()->'app_metadata'->>'tenant_id')`.

2. **Missing index on tenant_id** — 100x+ query slowdown on tables with >10k rows. Every tenant-scoped table needs a composite index: `(tenant_id, primary_sort_column)`.

3. **JWT staleness after role change** — if an assistant is upgraded to ordination_admin, they retain assistant-level JWT claims until token refresh. Force refresh via Supabase Auth Admin API `signOut` or token invalidation for immediate effect.

4. **Realtime DELETE events are not filterable** — use soft deletes (`status = 'archived'`) for inbox tasks and call log entries, not hard deletes. This also preserves audit trail.

5. **tenant_id from request body** — n8n sends tenant_id in the event payload for system writes, but user-facing API routes must extract tenant_id exclusively from `user.app_metadata.tenant_id` (JWT). Never trust the body's tenant_id for access control decisions.

6. **Storage permanent URLs** — `supabase.storage.from('...').getPublicUrl()` should not be used for private buckets. Only `createSignedUrl()` server-side, only when the module permission check passes.

7. **Realtime auth cache** — Supabase Realtime caches the RLS check per connection, not per message. If a user's permissions are revoked, they keep receiving events until their WebSocket reconnects. Design for this: minimize how long sessions stay open without reauthentication for sensitive roles.

---

## Sources

- Supabase RLS documentation: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase RLS Performance: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
- Supabase Custom Access Token Hook: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
- Supabase Custom Claims & RBAC: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac
- Supabase Realtime Postgres Changes: https://supabase.com/docs/guides/realtime/postgres-changes
- Supabase Realtime Authorization: https://supabase.com/docs/guides/realtime/authorization
- Supabase Storage Access Control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase Vault: https://supabase.com/docs/guides/database/vault
- Supabase Next.js SSR Auth: https://supabase.com/docs/guides/auth/server-side/nextjs
- Multi-tenant RLS production case study: https://dev.to/blackie360/-enforcing-row-level-security-in-supabase-a-deep-dive-into-lockins-multi-tenant-architecture-4hd2
- n8n Webhook security: https://codehooks.io/blog/secure-zapier-make-n8n-webhooks-signature-verification
