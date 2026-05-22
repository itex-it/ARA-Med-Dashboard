# ROADMAP: ARA-Med Dashboard

**Project:** ARA-Med Dashboard — Multi-Tenant SaaS Voice AI for Austrian Medical Practices
**Milestone:** MVP
**Granularity:** Standard (5-8 phases)
**Requirements:** 73 v1 requirements across 8 phases
**Created:** 2026-05-22

---

## Phases

- [ ] **Phase 1: Tenant Foundation & Auth** - Secure multi-tenant base with authentication, 2FA, and RLS isolation
- [ ] **Phase 2: n8n Event Ingestion Pipeline** - Data flowing in from Voice AI via secured webhook endpoint
- [ ] **Phase 3: Core Dashboard — Status Bar & Call Log** - The product's core value loop: live call visibility
- [ ] **Phase 4: Inbox & Task Management** - Operational loop closed: actionable cases tracked to resolution
- [ ] **Phase 5: Configuration — Hours, Appointments, Texts, Deputy, Medications** - AI behavior fully configurable per practice
- [ ] **Phase 6: Routing & Communication Rules** - Notification channels and call routing configured
- [ ] **Phase 7: Statistics & User Management** - Reporting visibility and role-based access control
- [ ] **Phase 8: Audit Log & System Polish** - Compliance-ready, launch-hardened

---

## Phase Details

### Phase 1: Tenant Foundation & Auth
**Goal:** A tenant can be created, users can log in with 2FA, and every database query is isolated to the authenticated tenant — nothing else in the system functions without this base.
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, TENANT-01, TENANT-02, TENANT-03, TENANT-04, TENANT-05
**Success Criteria** (what must be TRUE):
  1. A user can log in with email and password, complete TOTP 2FA, and reach the dashboard — and their session persists across browser refresh
  2. A user can log out from any page and the session is immediately terminated server-side
  3. A user can reset their password via an email link and regain access
  4. When an operator revokes a user's role, the affected user's active session is invalidated immediately (within the next request) — no waiting for JWT expiry
  5. All database tables have RLS enabled with tenant-scoped policies using the cached `(SELECT auth.jwt() ->> 'tenant_id')` pattern — cross-tenant reads return zero rows
  6. An operator can configure a tenant (hostname, MEDSTAR config, fallback numbers) and manage API keys stored exclusively in Supabase Vault
**Plans:** TBD

### Phase 2: n8n Event Ingestion Pipeline
**Goal:** Call events from ElevenLabs Voice AI flow through n8n into the dashboard database in real time — the dashboard has data to display.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** REALTIME-01, REALTIME-02, REALTIME-03
**Success Criteria** (what must be TRUE):
  1. A simulated pre-call webhook from n8n reaches `/api/internal/events`, passes HMAC signature verification, and creates a `call_log` row for the correct tenant
  2. A simulated end-call webhook upserts the same `call_log` row with full results — sending the same event twice produces exactly one row (idempotent)
  3. Supabase Realtime fires a `postgres_changes` event on `call_log` INSERT/UPDATE that a subscribed client receives within 2 seconds
  4. The open-task counter in the status bar updates in real time when a new inbox-qualifying event arrives — no page refresh required
  5. Keys (MEDSTAR, ElevenLabs) are fetched from Supabase Vault as the first node of every n8n workflow — no secrets appear in n8n node configuration
**Plans:** TBD
**UI hint**: yes

### Phase 3: Core Dashboard — Status Bar & Call Log
**Goal:** Practice staff can see the current ARA-Med status, toggle it live, and review every call with its transcript, audio, AI summary, and executed actions.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** STATUS-01, STATUS-02, STATUS-03, STATUS-04, STATUS-05, CALL-01, CALL-02, CALL-03, CALL-04, CALL-05, CALL-06, CALL-07, CALL-08, CALL-09, CALL-10
**Success Criteria** (what must be TRUE):
  1. On every page, the status bar shows: ARA-Med state (active/paused/error), practice state (open/closed/special), active mode, and open-task count — all updating live without refresh
  2. A user with the toggle permission can activate or pause ARA-Med via a single click — the change takes effect immediately and is reflected in the status bar
  3. The call log shows a chronological list of all calls with timestamp, masked phone number, duration, patient-recognized flag, intent, language, and status per entry
  4. A user with call-detail rights can click a call and see the unmasked phone number, full transcript, play the audio recording via a 15-minute presigned URL, and view the AI summary (short + structured)
  5. Executed actions per call (appointment booked, prescription ordered, escalation triggered, etc.) are visible in the call detail view with MEDSTAR API response status
  6. A user can add an internal note to a call, manually correct the intent category, and mark the call with a feedback label (correct/incorrect/needs-training)
**Plans:** TBD
**UI hint**: yes

### Phase 4: Inbox & Task Management
**Goal:** Practice staff can see all calls requiring action in a unified inbox, manage each case through its lifecycle, and close the operational loop without missing anything.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** INBOX-01, INBOX-02, INBOX-03, INBOX-04, INBOX-05
**Success Criteria** (what must be TRUE):
  1. All calls with an unresolved action trigger (unidentified patient, invalid PID, multiple PID matches, callback needed, prescription blocked, unclear intent, emergency flag, technical error) appear in the inbox automatically
  2. Each inbox case displays its case type, originating call reference, and current lifecycle status (open / in progress / resolved / archived)
  3. A user can move a case through all lifecycle states — open → in progress → resolved → archived — and the transition is reflected immediately
  4. A user can add an internal note to any inbox case, and notes persist across sessions and are visible to other users of the same tenant
**Plans:** TBD
**UI hint**: yes

### Phase 5: Configuration — Hours, Appointments, Texts, Deputy, Medications
**Goal:** A practice can fully configure how ARA-Med Voice behaves: when it is active, which appointment types it can book, what it says in each mode, who covers during absences, and which medications it knows about.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** HOURS-01, HOURS-02, HOURS-03, APPT-01, APPT-02, APPT-03, APPT-04, APPT-05, TEXT-01, TEXT-02, TEXT-03, TEXT-04, DEPUTY-01, DEPUTY-02, DEPUTY-03, DEPUTY-04, MED-01
**Success Criteria** (what must be TRUE):
  1. A user can configure weekly opening hours (days + times), add special closure days and exceptions, and configure deputy periods with start and end dates — all changes persist and the Voice AI uses them on the next call
  2. MEDSTAR appointment types are displayed from the live source; a user can mark each as visible / AI-bookable / internal-only and assign natural-language synonyms (e.g. "Bauchweh" → Allgemeinuntersuchung)
  3. A user can set a default appointment type for unclear complaints, and configure the PID=0 rule for Führerscheinuntersuchung
  4. A user can create and edit greeting texts per mode (Normal / Urlaub / Vertretung / Eigener Vertretungsdienst) — the EU AI Act Art. 50 disclosure is always present and cannot be removed
  5. A user can add a deputy doctor (name, greeting text, forwarding number), assign them a calendar period, and configure PID=0 behavior for non-patients during that period
  6. An operator can maintain the practice's medication list (PZN, name, phonetic pronunciation for Voice AI, active/inactive, note)
**Plans:** TBD
**UI hint**: yes

### Phase 6: Routing & Communication Rules
**Goal:** A practice can configure how calls are routed by number, intent, time, and mode — and define which notifications are sent to staff and patients via which channels.
**Mode:** mvp
**Depends on:** Phase 5
**Requirements:** ROUTE-01, ROUTE-02, ROUTE-03, COMM-01, COMM-02, COMM-03, COMM-04, COMM-05
**Success Criteria** (what must be TRUE):
  1. A user can create a routing rule specifying a match condition (phone number, intent, time period, mode) and a resulting action (connect directly, custom prompt, create ticket, offer bypass slot, forward to number, record message)
  2. VIP/WIP numbers can be configured so calls always connect regardless of other routing rules
  3. A user can configure internal notification rules (new inbox event → email/Telegram/SMS) and patient notification rules (appointment confirmation, reminder, cancellation, prescription received) with channel, fallback channel, template, priority, time window, retry logic, and privacy class
  4. Every send attempt is logged with event type, channel, masked recipient, template version, status, error reason, and timestamp — visible to the user
  5. A user can create and edit message templates with variables (patient_name, appointment_date, etc.) and language versions via language_code
**Plans:** TBD
**UI hint**: yes

### Phase 7: Statistics & User Management
**Goal:** Practice management can view call KPIs and saved-time estimates, and the operator can manage users and roles with server-enforced permission delegation.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** STAT-01, STAT-02, STAT-03, STAT-04, STAT-05, RBAC-01, RBAC-02, RBAC-03, RBAC-04, RBAC-05, RBAC-06
**Success Criteria** (what must be TRUE):
  1. A user can view call volume by day/week/month, average call duration, auto-resolution rate, and forwarding rate — all scoped to their tenant
  2. A user can view count of open tasks, booked appointments, prescription requests, top intents by frequency, and critical/escalated cases
  3. A user can view estimated saved phone time based on resolved calls
  4. An operator can create tenants and assign Arzt/Admin users; an Arzt/Admin can manage Assistenz and Viewer users — each can only grant rights up to their own permission level (server-enforced)
  5. Every user has an assigned role (Operator / Arzt+Ordinationsadmin / Ordinationsassistenz / Viewer) with granular module rights (none/view/edit/manage/admin) — permission checks run exclusively server-side on every API route and Server Action
**Plans:** TBD
**UI hint**: yes

### Phase 8: Audit Log & System Polish
**Goal:** All critical configuration changes are permanently logged with full context, the system passes a DSGVO compliance review, and the product is ready for live tenant onboarding.
**Mode:** mvp
**Depends on:** Phase 7
**Requirements:** AUDIT-01, AUDIT-02, AUDIT-03
**Success Criteria** (what must be TRUE):
  1. Every critical change (user management, permission changes, ARA activate/deactivate, opening hours, routing rules, communication rules, templates, appointment config, deputy mode, prompts, API/system settings) generates an audit log entry automatically
  2. Each audit entry contains: tenant, user, action, object, old value, new value, timestamp, IP address, and user agent — no fields are nullable for these attributes
  3. Operator and Arzt/Admin users can view the full audit log for their tenant via the dashboard, filtered by date range and action type
  4. A manual DSGVO compliance review confirms: phone numbers stored only as hashed values, transcripts accessible only to users with call-detail rights, audio URLs generated on-demand with 15-minute expiry, SVNR never stored in the dashboard DB, and tenant data isolation verified across all tables
**Plans:** TBD
**UI hint**: yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Tenant Foundation & Auth | 0/? | Not started | - |
| 2. n8n Event Ingestion Pipeline | 0/? | Not started | - |
| 3. Core Dashboard — Status Bar & Call Log | 0/? | Not started | - |
| 4. Inbox & Task Management | 0/? | Not started | - |
| 5. Configuration — Hours, Appointments, Texts, Deputy, Medications | 0/? | Not started | - |
| 6. Routing & Communication Rules | 0/? | Not started | - |
| 7. Statistics & User Management | 0/? | Not started | - |
| 8. Audit Log & System Polish | 0/? | Not started | - |

---

## Coverage

| Category | Requirements | Phase |
|----------|-------------|-------|
| Authentication | AUTH-01..06 (6) | Phase 1 |
| Multi-Tenant Foundation | TENANT-01..05 (5) | Phase 1 |
| Realtime Updates | REALTIME-01..03 (3) | Phase 2 |
| Status Bar | STATUS-01..05 (5) | Phase 3 |
| Call Log | CALL-01..10 (10) | Phase 3 |
| Inbox & Tasks | INBOX-01..05 (5) | Phase 4 |
| Opening Hours | HOURS-01..03 (3) | Phase 5 |
| Appointment Types | APPT-01..05 (5) | Phase 5 |
| Greeting Texts & FAQ | TEXT-01..04 (4) | Phase 5 |
| Deputy Management | DEPUTY-01..04 (4) | Phase 5 |
| Medication List | MED-01 (1) | Phase 5 |
| Routing Rules | ROUTE-01..03 (3) | Phase 6 |
| Communication Rules | COMM-01..05 (5) | Phase 6 |
| Statistics & KPIs | STAT-01..05 (5) | Phase 7 |
| User Management & RBAC | RBAC-01..06 (6) | Phase 7 |
| Audit Log | AUDIT-01..03 (3) | Phase 8 |

**Total mapped: 73/73 v1 requirements** — no orphans

---

*Created: 2026-05-22*
*Next: `/gsd:plan-phase 1`*
