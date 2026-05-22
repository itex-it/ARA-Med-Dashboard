# Domain Pitfalls

**Domain:** Multi-Tenant Healthcare SaaS + Voice AI Dashboard
**Stack:** Next.js 16 + Supabase (Postgres/Realtime/Auth/Vault) + n8n + ElevenLabs
**Researched:** 2026-05-22

---

## Critical Pitfalls

Mistakes that cause rewrites, data breaches, regulatory penalties, or cross-tenant leakage.

---

### Pitfall C1: RLS Enabled But auth.jwt() Called Per-Row (Performance Collapse)

**What goes wrong:** RLS policies written as `auth.jwt() ->> 'tenant_id' = tenant_id::text` call the JWT function for every row scanned. On `call_log` or `conversation_events` with 100k+ rows per tenant, queries degrade from milliseconds to seconds.

**Why it happens:** Developers copy the naive RLS example from Supabase docs without understanding that Postgres evaluates the policy expression row-by-row unless the optimizer can cache the result. The function call is not automatically hoisted.

**Consequences:** Dashboard call-log page times out. Analytics queries block. Under load, connection pool exhaustion. Realtime subscription join latency spikes.

**Prevention:**
- Wrap every JWT function call in a `SELECT` subquery inside the policy:
  ```sql
  -- WRONG (evaluated per row):
  auth.jwt() ->> 'tenant_id' = tenant_id::text

  -- CORRECT (evaluated once per statement, cached):
  (SELECT auth.jwt() ->> 'tenant_id') = tenant_id::text
  ```
- Enable Supabase's Performance Advisor — it flags uncached function calls in policies.
- Add composite index: `CREATE INDEX CONCURRENTLY idx_call_log_tenant_created ON call_log (tenant_id, created_at DESC);`

**Detection:** Run `EXPLAIN ANALYZE` on the call-log query. Look for `initPlan` in the output — its absence with function calls in policies is a red flag.

**Phase to address:** Database schema phase (before any data). Add the composite index pattern as a migration template.

---

### Pitfall C2: tenant_id Accepted from Request Body Instead of JWT

**What goes wrong:** An API route or Server Action accepts `tenant_id` from the request body and uses it to scope queries. An attacker sends a different tenant's ID in the body and reads or writes their data.

**Why it happens:** Developer wants to make the frontend flexible ("just pass the tenant you want"). The Service Role Key bypasses RLS, so if the route uses the service client, there is no database-level backstop.

**Consequences:** Full cross-tenant data read/write. In a healthcare context: patient call history, medication lists, AI summaries exposed to a competitor's account. DSGVO Article 5(1)(f) violation.

**Prevention:**
- `tenant_id` is extracted from `auth.jwt()` in every API Route/Server Action — never from the request body.
- Use the anon client (not service client) when the query is user-scoped. Let RLS enforce isolation.
- Service client is used only for operations that genuinely need to bypass RLS (e.g., n8n webhook ingestion), and those operations must validate `tenant_id` from a lookup, not from input.
- Add Zod validation that explicitly strips any `tenant_id` field from user-submitted payloads.

**Detection:** Code review: grep for `req.body.tenant_id` or `formData.get('tenant_id')` used in DB queries.

**Phase to address:** Auth + multi-tenant foundation phase. Establish the pattern in the first API route written; it propagates everywhere.

---

### Pitfall C3: Realtime Channel Crossing Tenants (No RLS on realtime.messages)

**What goes wrong:** Supabase Realtime `postgres_changes` subscriptions respect RLS, but only if RLS is enabled and the user's JWT contains valid `tenant_id` claims. If a client subscribes to a generic channel like `channel('call_log')` without tenant-scoped filtering, and if RLS is misconfigured or the table is in the `supabase_realtime` publication without RLS, all tenants receive all rows.

**Why it happens:** Developer enables Realtime on `call_log` by adding it to the publication, tests with a single user in development, and never tests with two different tenant sessions simultaneously.

**Consequences:** Practice A sees real-time call events for Practice B. Audio transcripts, patient names (if stored), and call outcomes leak in real time.

**Prevention:**
- Always add a `.filter('tenant_id', 'eq', tenantId)` to every `postgres_changes` subscription.
- RLS on the subscribed table is mandatory — the `.filter()` is defense in depth, not the primary control.
- Create RLS policies on `realtime.messages` if using Broadcast channels.
- Disable "Allow public access" in Supabase Realtime settings — enforce private channels.
- Test with two separate browser sessions logged in as different tenants. Verify events do not cross.

**Detection:** In development, open two browser tabs as different tenants. Trigger a call event on tenant A. Verify tenant B's dashboard shows nothing.

**Phase to address:** Realtime integration phase. Write cross-tenant isolation tests before the feature ships.

---

### Pitfall C4: Realtime Subscription Not Cleaned Up on Route Change

**What goes wrong:** A `useEffect` subscribes to a Supabase Realtime channel without returning a cleanup function that calls `supabase.removeChannel()`. When the user navigates away and back, a new subscription is created without removing the old one. After N navigations, N channels exist, all firing the same events and N-duplicating every UI update.

**Why it happens:** React Strict Mode (development) runs effects twice, masking the bug — it looks like duplicates in dev are normal. The problem only surfaces in production under sustained navigation.

**Consequences:** Memory leak, duplicate call-log entries appearing in the UI, WebSocket connection pool exhaustion (`TooManyChannels` error from Supabase), stale tenant data appearing after tenant context switch.

**Prevention:**
```typescript
useEffect(() => {
  const channel = supabase
    .channel(`call_log:${tenantId}`)  // tenant-scoped channel name
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_log',
        filter: `tenant_id=eq.${tenantId}` }, handleInsert)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);  // MANDATORY cleanup
  };
}, [tenantId]);  // Re-subscribe if tenant changes
```
- Include `tenantId` in the channel name to prevent channel name collisions across tenants.
- Add Supabase's channel count monitoring — alert if channel count exceeds expected number.

**Detection:** React DevTools Profiler or browser network tab — count WebSocket frames. If count grows with navigation, cleanup is missing.

**Phase to address:** Realtime integration phase. Establish the hook pattern in a shared `useRealtimeChannel` hook used everywhere.

---

### Pitfall C5: Service Role Key Exposed in Browser Bundle

**What goes wrong:** A developer adds `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` to environment variables (or imports the service client into a component without `import 'server-only'`), causing the key to be bundled into the client-side JavaScript.

**Why it happens:** The developer needs to bypass RLS for a specific query and takes the fastest path. `NEXT_PUBLIC_` prefix is copied from the anon key setup. The mistake ships silently — no build error, no runtime error.

**Consequences:** The service role key bypasses every RLS policy. Anyone inspecting the browser's network tab or the JS bundle can exfiltrate the entire database including all tenants, all call history, all configuration. GitGuardian and automated scanners pick up leaked keys from public repos within minutes.

**Prevention:**
- `SUPABASE_SERVICE_ROLE_KEY` — never `NEXT_PUBLIC_` prefix. Ever.
- Create `/src/lib/supabase/server.ts` with `import 'server-only'` at the top. This causes a build error if any client component imports it.
- Create `/src/lib/supabase/client.ts` using only the anon key. No service role anywhere in this file.
- n8n is the only non-browser consumer of the service role key — and it gets it from Vault, not environment variables.

**Detection:** Run `npx supabase inspect db` or search the built JS bundle for the service role key string. GitGuardian scans repos automatically.

**Phase to address:** Project setup phase (Day 0). The file structure and `server-only` import must exist before any feature code is written.

---

### Pitfall C6: DSGVO/GDPR Article 9 Violation — Uncontrolled Storage of Health Data

**What goes wrong:** Call transcripts, AI summaries, and symptom descriptions (e.g., "patient called about chest pain") are stored in `call_log` or `conversation_events` without access controls mapped to DSGVO Article 9 (special category health data). Any authenticated user of any role can query them.

**Why it happens:** Developer treats these as "just call logs" rather than health data. RBAC UI is built for the dashboard but the underlying DB columns have no role-based visibility. MEDSTAR data is protected (it's not stored here), but the AI-derived summaries are not considered equivalent.

**Consequences:** In Austria, the Datenschutzbehörde can impose fines up to 4% of global annual turnover (DSGVO Art. 83(4)). The Austrian DSG and TKG 2021 require explicit consent before recording, and the Gesundheitstelematikgesetz 2012 applies additional obligations to electronic health data. A complaint from a single patient can trigger an audit.

**Prevention:**
- `transcript_text`, `ai_summary`, `symptom_hints` columns must be nullable. Users without the `call_detail` permission get `NULL` returned via a DB view or RLS policy.
- Create explicit column-level RLS using views: `call_log_public` (no sensitive columns) and `call_log_detail` (full columns, restricted by role).
- Phone numbers are stored only as `phone_hash` (SHA-256 or bcrypt). Display format uses the masked version. Only `call_detail` role sees the last 4 digits.
- Audio file URLs in Supabase Storage: generate presigned URLs only for users with the `audio_playback` permission. Never expose the raw storage path.
- SVNR (Sozialversicherungsnummer) is never stored in the dashboard DB. It lives only in MEDSTAR.
- Implement a data retention policy: `conversation_events` older than 12 months are deleted or anonymized by a scheduled Supabase Edge Function.

**Detection:** DSGVO compliance check: enumerate every column containing patient-derived data. Verify it has a corresponding RLS policy or view restriction.

**Phase to address:** Database schema phase + Auth/RBAC phase. Must be complete before any real call data flows into the system.

---

### Pitfall C7: Audio Playback CORS and Presigned URL Race Condition

**What goes wrong:** Audio files from ElevenLabs/call recordings are stored in Supabase Storage with presigned URLs generated at page load. The URL expires (default: 1 hour) while the user is still on the page, causing playback failure with a confusing CORS or 403 error in the browser. Additionally, Supabase Storage does not support byte-range requests in all configurations, breaking iOS audio players and seek functionality.

**Why it happens:** Presigned URLs are generated server-side and embedded in JSON responses without considering user session length. Audio player components make direct browser requests, exposing the URL in the DOM. Byte-range support is not tested on mobile browsers.

**Consequences:** Users see unexplained audio playback failures mid-shift. Support tickets spike. iOS users (common among medical staff) cannot seek audio.

**Prevention:**
- Generate presigned audio URLs on-demand via an API route, not at page-load time. Set expiry to 15 minutes.
- The API route checks `audio_playback` permission before signing.
- Set `Content-Type: audio/mpeg` and `Content-Disposition: inline` on Storage objects at upload time.
- Test byte-range (`Range: bytes=0-`) support explicitly — use `curl -H "Range: bytes=0-1023"` against the presigned URL. If byte-range is not supported, proxy audio through a Next.js API route that pipes the stream.
- Never embed raw Storage bucket paths in the frontend — always route through the signing endpoint.

**Detection:** Open browser DevTools Network tab. Filter for audio requests. Check response headers for `Accept-Ranges: bytes`. Test on iOS Safari.

**Phase to address:** Call log + audio player phase.

---

### Pitfall C8: JWT Claims Stale After Role Change or Tenant Switch

**What goes wrong:** An admin changes a user's role from `viewer` to `arzt` in the dashboard. The user continues using the application with the old JWT (which still has `role: viewer` in its claims) for up to the JWT expiry window (Supabase default: 1 hour). RLS policies based on `auth.jwt() ->> 'role'` continue to enforce the old role. The user complains their new permissions aren't working.

**Conversely:** A user is demoted or removed from a tenant. Their existing JWT still grants access for up to 1 hour. In a healthcare context, a dismissed employee retains access to call history during that window.

**Why it happens:** JWTs are stateless — the server does not maintain session state. Policy changes in the database do not propagate to existing tokens.

**Consequences:** Terminated employee reads patient call data for up to 1 hour after removal. Security incident, DSGVO obligation to notify.

**Prevention:**
- Use Supabase Custom Access Token Hook to inject `tenant_id` and `role` into JWTs at token issuance.
- For sensitive role changes (removal, demotion), force token refresh server-side: invalidate the user's refresh token via the Supabase admin API (`auth.admin.signOut(userId)`). This forces re-authentication on next request.
- Always call `supabase.auth.getUser()` (validates against DB) rather than `supabase.auth.getSession()` (reads local JWT) for permission checks in Server Actions.
- Set JWT expiry to 15 minutes for dashboard sessions. Supabase SSR refreshes automatically.

**Detection:** Change a user's role. Without forcing a refresh, attempt to access a resource the new role should allow/deny. Verify the access matches the new role, not the old JWT.

**Phase to address:** Auth + RBAC phase.

---

### Pitfall C9: n8n Webhook Accepts Any tenant_id Without Validation

**What goes wrong:** An n8n workflow receives a webhook from ElevenLabs with a `tenant_id` field in the payload (set when the ElevenLabs agent was configured). The workflow skips the validation node and proceeds directly to writing to `call_log` using the payload's `tenant_id`. An attacker who can send a POST to the webhook URL can write entries into any tenant's call log by supplying a different `tenant_id`.

**Why it happens:** n8n makes it easy to skip nodes during development ("Disable node" for testing). The validation node gets disabled, the workflow ships, and the disabled node is forgotten.

**Consequences:** Cross-tenant data poisoning. Fake call entries in a competitor's dashboard. MEDSTAR API calls triggered on behalf of the wrong tenant.

**Prevention:**
- Node 1 of every workflow: fetch tenant config from Supabase using the DID number as the lookup key — never from the webhook payload's `tenant_id`. The DID is the authoritative tenant identifier.
- Node 2: validate that the DID belongs to an active tenant. If not found or inactive, return 400 and stop. Log the invalid attempt.
- Validate ElevenLabs webhook signatures (HMAC + timestamp, 30-minute window) before any processing.
- Use n8n's Error Workflow setting to route all workflow failures to an alerting workflow (Slack/email). Never let failures be silent.
- Never disable validation nodes — use n8n's "Test with mock data" feature instead.

**Detection:** Send a webhook with a fake `tenant_id` to the n8n endpoint. Verify the workflow rejects it, does not write to DB, and logs the rejection.

**Phase to address:** n8n workflow foundation phase (first workflow built). Establish the DID-lookup-as-auth-pattern before any tenant-specific workflows.

---

### Pitfall C10: ElevenLabs Webhook Duplicate Events and Pre-Call/End-Call Race Condition

**What goes wrong:** The pre-call webhook (call started) and end-call webhook (call completed) can arrive out of order or be duplicated. ElevenLabs retries failed webhook deliveries up to 5 times. If the n8n endpoint times out on first delivery and succeeds on retry, the call log entry is created twice. Pre-call and end-call events occasionally arrive within milliseconds of each other; if both attempt to `INSERT` the same `conversation_id`, a constraint error occurs.

**Why it happens:** Webhooks are unreliable by design — exactly-once delivery is not guaranteed. The n8n workflow is written assuming sequential delivery.

**Consequences:** Duplicate entries in `call_log`. Double-counted KPIs. Call actions (appointment bookings) triggered twice. MEDSTAR receives duplicate booking requests.

**Prevention:**
- `call_log` has a unique constraint on `(conversation_id, tenant_id)`.
- All n8n webhook handlers use `INSERT ... ON CONFLICT (conversation_id, tenant_id) DO NOTHING` or `DO UPDATE SET` (upsert) — never plain `INSERT`.
- For end-call events: upsert with the full payload. For pre-call: insert with minimal data, end-call fills in the rest.
- Verify ElevenLabs webhook signatures (`ElevenLabs-Signature` header) before processing — this prevents replays from external sources.
- Log every webhook receipt with `conversation_id` + timestamp to a `webhook_log` table. Use this for debugging ordering issues.

**Detection:** Use a webhook testing tool (ngrok + replay) to send the same event twice. Verify only one `call_log` row results.

**Phase to address:** n8n + Realtime integration phase.

---

### Pitfall C11: Missing Composite Indexes on tenant_id + created_at

**What goes wrong:** Supabase does not automatically create indexes on foreign key columns. `call_log.tenant_id` is a foreign key to `tenants.id` but has no index. Queries like "show me all calls for this tenant in the last 7 days" perform a sequential scan of the entire `call_log` table and filter by tenant, then by date. With 10 tenants and 1000 calls/tenant, this is imperceptible. With 100 tenants and 10,000 calls/tenant, every dashboard page load takes seconds.

**Why it happens:** The schema looks correct — foreign keys exist, RLS is enabled. Nobody runs `EXPLAIN ANALYZE` during development because dev data is small.

**Consequences:** Dashboard becomes unusably slow in production. Supabase query timeout (8-second default). Users complain about blank pages.

**Prevention:**
- Every table with `tenant_id` gets a composite index in its migration:
  ```sql
  CREATE INDEX CONCURRENTLY idx_{table}_tenant_created
    ON {table} (tenant_id, created_at DESC);
  ```
- `call_log`: index on `(tenant_id, created_at DESC)` and `(tenant_id, status)`.
- `conversation_events`: index on `(tenant_id, call_id, created_at)`.
- `call_actions`: index on `(tenant_id, action_type, created_at DESC)`.
- Use `CREATE INDEX CONCURRENTLY` — required for live production migrations (does not lock the table).
- Run Supabase's Index Advisor before each phase ships.

**Detection:** `npx supabase inspect db unused-indexes` and `npx supabase inspect db index-sizes`. EXPLAIN ANALYZE on the call-log query with realistic data volume.

**Phase to address:** Database schema phase (add to every migration template) and before each production deployment.

---

### Pitfall C12: RLS Enabled But No Policies Defined (Silent Full Access)

**What goes wrong:** A developer runs `ALTER TABLE call_log ENABLE ROW LEVEL SECURITY;` without adding any SELECT policy. In this state, Supabase denies all access to anon users — but the service role still sees everything. If the n8n workflow uses the service role key (correct), and the dashboard uses the anon client with RLS (correct), the table appears to work but all dashboard queries return empty results because no SELECT policy exists yet.

**Why it happens:** The developer assumes "enable RLS" means "safe." They do not realize that "no policy" means "no access for non-superusers," which is not the same as "tenant-scoped access."

**The mirror mistake:** A developer adds an overly broad policy `USING (true)` to silence the empty-result bug. Now all authenticated users see all tenants' data.

**Consequences:** Either: empty dashboard that "works" only in n8n (silent denial). Or: every authenticated user reads every tenant's data (silent over-permission).

**Prevention:**
- Every table's migration file includes both the `ENABLE ROW LEVEL SECURITY` statement AND the policies in the same file.
- Use a migration template that includes the standard tenant isolation policies:
  ```sql
  ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "{table}_tenant_select"
    ON {table} FOR SELECT TO authenticated
    USING ((SELECT auth.jwt() ->> 'tenant_id') = tenant_id::text);

  CREATE POLICY "{table}_tenant_insert"
    ON {table} FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.jwt() ->> 'tenant_id') = tenant_id::text);
  ```
- Write RLS integration tests: for each table, test (1) correct tenant can read, (2) other tenant cannot read, (3) unauthenticated user cannot read.

**Detection:** `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';` — flag any table where `rowsecurity = true` but no policies exist in `pg_policies`.

**Phase to address:** Database schema phase. Make the test a CI check.

---

## Moderate Pitfalls

Mistakes that cause bugs, regressions, or compliance gaps but do not require rewrites.

---

### Pitfall M1: Frontend-Only RBAC Permission Checks

**What goes wrong:** UI elements are hidden based on the user's role stored in React state. The underlying API routes do not re-validate the role from the JWT. An `assistenz` user who should not be able to delete call log entries can call the delete API route directly via `curl`.

**Prevention:**
- Every API route and Server Action performs its own permission check using `supabase.auth.getUser()` (not `getSession()`).
- Permission matrix is defined once server-side (e.g., in `/src/lib/permissions.ts`) and imported by routes.
- UI hiding is UX only. "The frontend is for UX, the backend is the security line."

**Phase to address:** Auth + RBAC phase.

---

### Pitfall M2: n8n Secrets in Workflow Node Configuration

**What goes wrong:** A developer configures the MEDSTAR API key directly in an n8n HTTP Request node ("Authorization: Bearer xxxxxx") rather than fetching it from Supabase Vault. The key is now stored in the n8n database in plaintext. A Portainer access or n8n DB backup exposes all tenant MEDSTAR keys.

**Prevention:**
- Node 1 of every workflow: fetch key from Vault using the pattern `medstar_key_{tenant_id}`.
- The n8n instance has one service-role Supabase key (in environment variables, not a workflow node).
- Export all workflows to `/n8n/` versioned JSON before deployment. Audit exports for hardcoded secrets.

**Detection:** Search `/n8n/` exports for known key patterns: `grep -r "Bearer" n8n/` should find nothing.

**Phase to address:** n8n workflow foundation phase.

---

### Pitfall M3: Supabase Migration Run Against Production Without CONCURRENTLY

**What goes wrong:** A developer runs a migration that adds an index on `call_log` (a large table in production) using `CREATE INDEX` without `CONCURRENTLY`. This takes an `AccessShareLock` on the table, blocking all reads and writes for the duration of index creation (potentially minutes).

**Prevention:**
- All `CREATE INDEX` statements in migrations use `CONCURRENTLY`.
- `DROP INDEX` uses `CONCURRENTLY` as well.
- Never run `ALTER TABLE ... ADD COLUMN NOT NULL` without a `DEFAULT` on a live table (Postgres pre-11: full table rewrite. Postgres 12+: instant for NULL default, but still rewrite for non-NULL).
- Test migrations against a staging environment with production data volume first.

**Phase to address:** Any phase that adds indexes or alters large tables.

---

### Pitfall M4: Transcript Data Stored Without Encryption at Rest

**What goes wrong:** `conversation_events.transcript_text` stores verbatim patient-caller dialogue, including symptom descriptions, medication names, and patient identifiers spoken during the call. Supabase encrypts the database at the storage level, but the column is readable by anyone with DB access (Portainer → DB shell, n8n service key, developer laptop).

**Prevention:**
- Use Supabase Vault's `vault.encrypt()` for the `transcript_text` and `ai_summary` columns, or use Postgres `pgcrypto` column-level encryption.
- Alternatively: store full transcripts in an encrypted Supabase Storage object (not the DB column); store only the anonymized AI summary in the DB column.
- Document the encryption approach in the Data Protection Impact Assessment (DPIA), which is required under DSGVO Article 35 for systematic processing of health data.

**Phase to address:** Database schema phase + DSGVO compliance review.

---

### Pitfall M5: DID Number Used as Tenant Lookup Without Active-Status Check

**What goes wrong:** The n8n webhook looks up a tenant by DID number and finds a match. It proceeds to load the tenant config and process the call. The tenant has been suspended (non-payment) but the DID record still exists in the DB. The suspended tenant's calls continue to be processed and billed to the platform.

**Prevention:**
- Tenant lookup always includes `AND status = 'active'`. Not just `WHERE phone_number = $did`.
- DID routing query: `SELECT * FROM tenant_dids WHERE phone_number = $did AND tenant.status = 'active'`.
- When a tenant is suspended, the suspension is applied to the Supabase tenant record immediately, not deferred.

**Phase to address:** n8n workflow foundation phase and billing/tenant management phase.

---

### Pitfall M6: Realtime JWT Expiry Disconnects Live Dashboard

**What goes wrong:** A user leaves the dashboard open while on a long shift. The Supabase JWT expires (default: 1 hour). Supabase Realtime disconnects the channel when it detects the JWT has expired. The user does not see new call events. No visible error is shown — the dashboard appears live but is stale.

**Prevention:**
- Use `supabase.auth.onAuthStateChange` to detect token refresh events and re-subscribe channels with the new JWT.
- The Realtime client must receive the new JWT via `channel.updateAuth(newToken)` after refresh — it does not automatically pick up refreshed sessions.
- Show a "connection status" indicator on the dashboard status bar. Display "Offline" or "Reconnecting" when the Realtime connection drops.

**Phase to address:** Realtime integration phase.

---

## Minor Pitfalls

Mistakes that cause friction, minor bugs, or technical debt.

---

### Pitfall MI1: Channel Name Not Scoped to Tenant

**What goes wrong:** Realtime channel named `'call_log'` is used by all tenants. Even with RLS correctly filtering events, channel names are shared in the WebSocket multiplexer. If a bug in Supabase's Realtime server-side broadcasting causes a routing issue, two tenants could theoretically receive each other's events.

**Prevention:** Always scope channel names to tenant: `channel('call_log:' + tenantId)`. This also makes debugging easier (identifiable in Supabase Realtime dashboard).

**Phase to address:** Realtime integration phase.

---

### Pitfall MI2: ISO Timestamps in Voice Responses

**What goes wrong:** The n8n tool response includes an ISO-8601 timestamp (`"2024-03-12T09:00:00+01:00"`) in a `speak_hint`. The ElevenLabs voice AI reads it aloud literally: "two thousand twenty-four hyphen zero three hyphen twelve tee zero nine..."

**Prevention:** All tool responses format dates as human speech: "Montag, 12. März um 9 Uhr". Never pass `new Date().toISOString()` to any `speak_hint` or `speak_verbatim` field. Add a `formatForSpeech(date: Date): string` utility and use it everywhere.

**Phase to address:** n8n + Voice AI integration phase.

---

### Pitfall MI3: NEXT_PUBLIC_ Environment Variables Containing Internal URLs

**What goes wrong:** `NEXT_PUBLIC_N8N_WEBHOOK_URL` exposes the internal n8n webhook endpoint to the browser bundle. Competitors or bots discover the endpoint and send malicious webhook payloads directly.

**Prevention:** n8n webhook calls are made from API routes (server-side) only. The webhook URL is a server-only environment variable (no `NEXT_PUBLIC_` prefix).

**Phase to address:** Project setup phase.

---

### Pitfall MI4: supabase gen types typescript Not Run After Schema Change

**What goes wrong:** A migration adds a `triage_level` column to `call_log`. The TypeScript types are stale. The dashboard component accesses `row.triage_level` — TypeScript does not catch the type drift because the generated types weren't regenerated. The component ships with a runtime `undefined` access.

**Prevention:** `supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/lib/database.types.ts` is run after every migration and committed. Add this to the migration runbook.

**Phase to address:** All phases with schema changes.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| DB Schema (Phase 1) | Missing indexes, RLS with no policies, auth.jwt() per-row | Use migration template with composite index + RLS pattern from day one |
| Auth + RBAC (Phase 2) | Service role key in browser, JWT stale after role change, frontend-only checks | `server-only` import, force re-auth on role change, server-side permission matrix |
| n8n Webhooks (Phase 3) | tenant_id from payload, silent failures, hardcoded secrets | DID-lookup auth pattern, Error Workflow, Vault key fetching |
| Realtime (Phase 4) | Channel not cleaned up, no tenant scope, JWT expiry | `useRealtimeChannel` hook, tenant-scoped channel names, auth state listener |
| Call Log + Audio (Phase 5) | CORS, presigned URL expiry, transcript without access control | On-demand signing endpoint, column-level access view, byte-range test |
| DSGVO Compliance (all phases) | Health data without controls, no consent flow, no retention policy | Article 9 audit per column, DPIA, retention Edge Function |
| ElevenLabs Integration | Duplicate events, pre-call/end-call ordering | Unique constraint on conversation_id, upsert pattern, HMAC verification |
| Production Go-Live | Missing CONCURRENTLY on indexes, migration locking live tables | Test migrations on staging with production data volume |

---

## Sources

- Supabase RLS Performance Best Practices: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
- Supabase Realtime Authorization: https://supabase.com/docs/guides/realtime/authorization
- Supabase Realtime TooManyChannels Error: https://supabase.com/docs/guides/troubleshooting/realtime-too-many-channels-error
- Supabase RLS Multi-Tenant Best Practices (Makerkit): https://makerkit.dev/blog/tutorials/supabase-rls-best-practices
- Service Role Key Risks (Securie.ai): https://securie.ai/guides/supabase-service-role-key
- Service Role JWT Leak Remediation (GitGuardian): https://www.gitguardian.com/remediation/supabase-service-role-jwt
- Hacking Misconfigured Supabase Instances (DeepStrike): https://deepstrike.io/blog/hacking-thousands-of-misconfigured-supabase-instances-at-scale
- Next.js Server Actions Security (Makerkit): https://makerkit.dev/blog/tutorials/secure-nextjs-server-actions
- ElevenLabs Post-Call Webhooks: https://elevenlabs.io/docs/agents-platform/workflows/post-call-webhooks
- ElevenLabs Webhook Duplicate Events: https://dev.to/137foundry/why-your-webhook-endpoint-keeps-getting-duplicate-events-and-how-to-fix-it-3d9c
- n8n Error Handling Best Practices: https://dev.to/ciphernutz/n8n-error-handling-best-practices-stop-letting-silent-failures-break-your-business-1j8h
- DSGVO Healthcare AI Compliance Austria (Kiteworks): https://www.kiteworks.com/gdpr-compliance/healthcare-ai-gdpr-compliance-austria/
- GDPR Article 9 Health Data and Voice AI: https://answeringagent.com/blog/gdpr-compliance-for-ai-voice-agents
- Austrian Phone Recording Law DACH (Famulor): https://www.famulor.io/blog/recording-phone-calls-legal-guide-for-the-dach-region-ai-usage
- Supabase Storage CORS and Presigned URLs: https://corsproxy.io/blog/fix-supabase-cors-errors/
- Supabase Custom JWT Claims RBAC: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac
- Supabase JWT Troubleshooting: https://supabase.com/docs/guides/auth/troubleshooting
- n8n Multi-Tenant Workflow Orchestration: https://medium.com/@2nick2patel2/n8n-on-kubernetes-multi-tenant-workflow-orchestration-that-survives-failures-995f9c62e348
- Supabase Index Management: https://supabase.com/docs/guides/database/postgres/indexes
- React useEffect Realtime Cleanup: https://github.com/orgs/supabase/discussions/8573
