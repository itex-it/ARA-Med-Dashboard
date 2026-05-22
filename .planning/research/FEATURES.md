# Feature Landscape: ARA-Med Voice AI Dashboard

**Domain:** Voice AI call center + practice management dashboard for Austrian medical practices (Arztordinationen)
**Researched:** 2026-05-22
**Confidence:** HIGH (core features), MEDIUM (regulatory detail), HIGH (product spec alignment)

---

## Context and Framing

ARA-Med is not a generic call center tool. It is a vertically integrated Voice AI platform where the dashboard serves as the operational control center for the AI, not a standalone practice management system. MEDSTAR is the source of truth for patient data, appointments, and prescriptions. The dashboard controls *what the AI is allowed to do* and surfaces *what the AI did*.

This distinction shapes the feature priorities: features that duplicate MEDSTAR belong there; features that govern AI behavior, audit AI actions, and surface AI results belong here.

**Practice staff profile:** Ordinationsassistenz (medical receptionist) is the primary daily user. Arzt/Ordinationsadmin is the configuration owner. Operator is the platform provider. Viewer is a read-only observer (e.g., practice owner monitoring from home).

---

## Table Stakes

Features users expect in any product of this type. Absence causes abandonment or support escalation.

### 1. Call Log with AI-Generated Summary

| Attribute | Detail |
|-----------|--------|
| Why expected | Staff need to review what the AI handled — it's the baseline audit capability |
| Complexity | Medium (Supabase Realtime + audio storage + transcript rendering) |
| Regulatory note | Audio and transcript are separate rights categories (DSGVO Art. 9 — special category health data) |

Every call entry must show: timestamp, masked phone number, call duration, detected language, primary intent, resolution status (solved/open/escalated/failed), actions taken (appointment booked, prescription requested, callback created), and a one-paragraph AI summary. Expandable detail shows full transcript and audio player — gated behind explicit access rights, not just role.

**DSGVO implication:** Phone number must be masked by default; full number only visible to users with `call_detail` right. Audio and transcript behind a separate right (`audio`, `transcript`). This is not optional — it is legally required under Austrian health data processing rules.

---

### 2. Inbox / Task Queue for Unresolved Cases

| Attribute | Detail |
|-----------|--------|
| Why expected | The AI fails some cases — staff must have a structured place to handle them |
| Complexity | Low-Medium (filtered view of call_log + task status state machine) |
| Regulatory note | Unidentified patient records must not accumulate indefinitely (storage limitation principle) |

The Inbox aggregates every call that requires human action: unidentified caller, ambiguous intent, prescription not possible, callback requested, escalation triggered, MEDSTAR API failure. Each item has a status lifecycle: open → in-progress → done/archived. Without this, staff must scroll a raw call log to find what needs attention — unusable at scale.

**Dependency:** Requires Call Log (feature 1) as its data source.

---

### 3. Real-Time Status Bar (Live System State)

| Attribute | Detail |
|-----------|--------|
| Why expected | Staff need to know if the AI is active — if it is down, phones go unanswered |
| Complexity | Low (Supabase Realtime subscription to a status table) |
| Regulatory note | None specific |

A persistent header strip showing: ARA-Med Voice active/paused/error, current operating mode (Normal / Vacation / Deputy / Overload), practice open/closed, count of open inbox items, and a one-click toggle to pause the AI. This is the control panel equivalent of a power switch — absence means operators cannot respond to outages.

**Dependency:** Must be visible on every page, not a separate route.

---

### 4. Opening Hours Configuration

| Attribute | Detail |
|-----------|--------|
| Why expected | The AI must know when the practice is open to handle after-hours calls differently |
| Complexity | Low-Medium (weekly schedule + exception days + mode overrides) |
| Regulatory note | None specific, but incorrect hours cause wrong AI behavior — indirect liability |

Staff must be able to set weekly schedules, override individual days (holidays, training days, sudden closure), and configure what mode applies per time block. MVP: weekly grid + date-specific overrides. Full 4-layer calendar (with per-appointment-type and bypass slots) is explicitly deferred.

**Dependency:** Feeds the AI context token budget (always-on ~300 tokens include today's hours).

---

### 5. Appointment Type Management (Intent Mapping)

| Attribute | Detail |
|-----------|--------|
| Why expected | The practice controls which appointment types the AI can book — removing this control means the AI books things the practice never intended |
| Complexity | Medium (synced from MEDSTAR, enriched in dashboard) |
| Regulatory note | Booking unauthorized appointment types could constitute unauthorized medical action |

Each MEDSTAR appointment type must be flaggable as: AI-bookable / internal-only / visible-but-not-bookable. Staff must be able to add synonym phrases ("I have a bad stomach" → "Gastroenterologie Ersttermin") and set a default catch-all type for unclear complaints. The Führerscheinuntersuchung (driving license examination) edge case — always PID=0, no existing patient — must be a configurable flag on the appointment type, not hardcoded.

**Dependency:** Required before any call can result in a correct booking. Blocks AI launch.

---

### 6. Role-Based Access Control (RBAC)

| Attribute | Detail |
|-----------|--------|
| Why expected | Healthcare data is legally restricted by access category — a Viewer must not see audio or SVNR |
| Complexity | Medium (4 roles × 20 permission categories, enforced server-side) |
| Regulatory note | DSGVO Art. 32 — appropriate technical measures; Austrian health law requires role separation |

Four roles: Operator (platform admin), Arzt/Ordinationsadmin (practice owner), Ordinationsassistenz (receptionist), Viewer (read-only). Fine-grained permission categories cover each data type independently: phone number, audio, transcript, SVNR, patient identity, prescriptions, routing config, system settings, billing. A user may not grant more permissions than they themselves hold. Enforcement is server-side only — frontend visibility controls are cosmetic reinforcement, not the gate.

**Dependency:** Foundation layer. No other feature can be correctly scoped without this.

---

### 7. Audit Log

| Attribute | Detail |
|-----------|--------|
| Why expected | Austrian law and DSGVO require traceability of changes to health-data-adjacent system configuration |
| Complexity | Low (append-only log table, well-defined event set) |
| Regulatory note | DSGVO Art. 5(2) accountability principle; Austrian retention up to 10 years for health-adjacent data |

All configuration changes that affect AI behavior or patient data handling must be logged: who changed what, from what value, to what value, when, from which IP. This covers: routing rules, opening hours, appointment type config, user/role changes, AI activation/deactivation, communication templates, vacation/deputy mode. Raw audit entries are Operator-visible; a filtered view is visible to Arzt/Ordinationsadmin for their own tenant.

**Retention guidance (MEDIUM confidence):** Austrian WKO DSGVO guidance requires 7 years for business records; health-specific records require 10 years retention. Audit log entries should align with the longer period.

---

### 8. Basic KPI Dashboard / Statistics

| Attribute | Detail |
|-----------|--------|
| Why expected | Practice owners need to know if the AI is delivering value — this justifies the SaaS fee |
| Complexity | Low (aggregation queries over call_log, not real-time) |
| Regulatory note | Aggregated statistics with no PII are low-risk; underlying data pulls carry normal health data rules |

Minimum viable stats: call volume per day/week/month, AI resolution rate (calls resolved without human), escalation rate, open inbox items over time, most frequent intents, average call duration. A "time saved" metric (estimated minutes of receptionist time offset) is a strong retention and sales tool. Cost/token consumption per period is Operator-visible only.

**Industry benchmark for confidence (MEDIUM):** Best-in-class systems achieve 70%+ AI containment. A practice below 50% should see that signal and know to improve intent mappings.

---

### 9. Authentication with 2FA

| Attribute | Detail |
|-----------|--------|
| Why expected | Health data platform — weak auth is a regulatory and liability risk |
| Complexity | Low (Supabase Auth supports TOTP; Magic Link is built-in) |
| Regulatory note | Austrian Datenschutzbehörde guidance recommends MFA for systems handling health data; DSGVO Art. 32 |

Email/password + Magic Link for all roles. TOTP 2FA mandatory for Operator and Arzt/Ordinationsadmin. Rate limiting and account lockout on failed attempts. This is non-negotiable for a health-data-adjacent system.

---

### 10. AI Disclosure / EU AI Act Compliance

| Attribute | Detail |
|-----------|--------|
| Why expected | EU AI Act Article 50 mandates that patients be informed they are speaking with an AI at the start of every interaction |
| Complexity | Low (greeting text configuration must include disclosure; dashboard must enforce non-removal) |
| Regulatory note | EU AI Act Art. 50, enforceable from August 2026; fines up to €15M or 3% global turnover |

The dashboard must ensure that greeting texts for all modes contain the mandatory AI disclosure. The platform should prevent operators from removing the disclosure entirely — it can be phrased differently, but cannot be absent. This is a legal obligation, not a product preference.

**Confidence:** HIGH — EU AI Act Article 50 is in force; healthcare is explicitly called out as a context where "obvious from context" cannot be used as a defense against disclosure.

---

## Differentiators

Features that set ARA-Med apart. Not universally expected, but deliver clear competitive advantage in the Austrian practice market.

### D1. Intent-Based Routing Rules (per Caller / Intent / Time / Mode)

Standard voice AI platforms offer simple time-based routing. ARA-Med's routing layer is intent-aware: a call from a pharmacy or hospital triggers a different path than a patient requesting a prescription. This multi-axis routing (caller number + intent + time + mode) is a significant differentiator.

**Concrete value:** A practice can say "if the caller is the Apotheke Mayer (stored number), always connect directly without AI handling." Or "if intent is Führerscheinuntersuchung, route to a separate prompt with PID=0 logic." Competitors offer number-based allow/block lists; intent-aware routing is uncommon.

**DSGVO note:** Number-based VIP lists constitute a special processing context (retained phone numbers with special treatment). The basis is legitimate interest of the practice; must be documented in the processing register.

---

### D2. Deputy/Vacation Mode with Separate Identity

When the regular doctor is away, a deputy (Vertretungsarzt) covers the practice. ARA-Med can operate with a separate greeting, separate phone number, separate prompt context, and even PID=0 booking for non-registered patients (since the deputy serves a different patient population). No generic competitor offers this as a first-class feature.

**Concrete value:** A GP going on vacation can configure a deputy period, set the deputy's number and greeting, and the AI handles all "I'm calling about the deputy" calls correctly — including informing existing patients of the schedule change. This directly addresses a common Austrian practice workflow.

---

### D3. Medication List for Prescription Phonetics

The AI must speak medication names correctly to patients (and understand patients who say medication names with dialectal pronunciation). The dashboard provides a per-practice medication list with a phonetics field: the administrator enters the pronunciation hint and the AI uses that instead of the technical trade name.

**Concrete value:** "Voltaren" is understood differently than "Voltadol" depending on regional dialect. A practice can tune pronunciation hints per medication without touching code. This is a small but high-value feature that directly reduces prescription request errors.

---

### D4. Structured Prescription Request Workflow

Generic voice AI for healthcare handles appointment booking well. Prescription requests are harder because they require patient identification, medication selection from a known list, and routing to the physician for approval — all without the AI having direct write access to MEDSTAR.

ARA-Med models this as a structured intent with `required_slots` (patient PID, medication name/PZN, repeat or first request), creates a `call_action` record, and surfaces the request in the Inbox with all data pre-filled. The physician approves in MEDSTAR, not in ARA-Med.

**Concrete value:** Eliminates the most common source of AI failure for practice calls — "I need a prescription" with incomplete information goes to a structured task, not a dropped call.

---

### D5. Greeting Text and FAQ Editor per Mode

Most voice AI products offer a single prompt. ARA-Med offers mode-specific greeting texts (Normal, Vacation, Deputy, Overload) with an FAQ layer (parking, address, insurance info, test preparation instructions). Practices can self-edit without touching the AI model or calling support.

**Concrete value:** A practice can update "we are closed for the next two weeks" without filing a support ticket. This self-service editorial capability is the difference between a tool a practice depends on versus one that frustrates them.

---

### D6. Communication Rules Engine (Patient + Staff Notifications)

Outbound communication to patients (appointment confirmations, reminders, cancellations, "your prescription request is received") and to staff (inbox alerts, escalation notifications) through configurable rules — not hardcoded behavior.

Rules are structured as: trigger event → recipient group → channel (SMS, email, WhatsApp, Telegram, internal inbox) → template → fallback channel. This multi-channel, rule-driven approach with delivery logging is above what competitors typically offer.

**DSGVO note:** Patient outbound SMS/WhatsApp constitutes processing of contact data. Consent basis must be documented (appointment reminders are typically covered under treatment necessity; marketing or follow-up requires explicit consent). The dashboard must show consent basis per rule.

**EU AI Act note:** If outbound messages are AI-generated, they may require disclosure. Templates that are static text do not require disclosure; dynamically generated content does.

---

### D7. Decision Trace / AI Transparency Log per Call

For each call, the system records: which intent was detected, which rules were evaluated, which MEDSTAR API calls were made, what the AI decided. This is surfaced in the Call Detail view as a decision trace.

**Concrete value:** When a call goes wrong (wrong appointment type booked, wrong patient identified), the practice can see exactly what the AI did and why. This turns a black-box AI into an auditable system — essential for healthcare.

**DSGVO / EU AI Act note:** The EU AI Act high-risk AI systems category includes AI used for healthcare triage and patient routing decisions. Maintaining a decision trace is both a regulatory requirement and a competitive differentiator that signals trustworthiness.

---

### D8. Multi-Tenant Isolation with Tenant-Specific Configuration

Every configuration element — routing rules, intent mappings, greeting texts, medication list, opening hours, communication templates — is per-tenant with full isolation. An Operator can manage many practices from the same infrastructure without any cross-tenant data leakage.

**Concrete value for the operator (ARA-Med as a business):** One platform instance serves many practices. Adding a new practice requires tenant provisioning, not infrastructure changes. This is the technical foundation for SaaS scale.

---

### D9. Provider-Agnostic Architecture (Invisible Technology)

The dashboard never exposes ElevenLabs, n8n, or Supabase brand names. The AI voice is "ARA-Med Voice." The notification system is "ARA-Med Nachricht." This provider abstraction allows the underlying technology to be swapped without customer disruption.

**Concrete value:** If ElevenLabs pricing changes or a better voice provider emerges, the customer relationship is with ARA-Med, not with the underlying vendor. This is a business differentiator, not a technical feature — but it manifests as a design constraint in every UI component.

---

## Anti-Features (Deliberately Not in MVP)

Features to explicitly not build in MVP, with rationale and what to do instead.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full 4-Layer Calendar with per-slot overrides | Complex UI, complex backend rules, low practice benefit in MVP | Simple weekly schedule + exception days is sufficient; layer 3-4 calendar is phase 2 |
| Complex conditional rule chains | "If it's Tuesday and the caller has called more than 3 times and the intent is X, then..." chains compound errors and are impossible to debug | Simple flat rules with one condition set each; complexity can be added after validating the simpler form works |
| Multi-MEDSTAR-profile UI for group practices | The data model supports it (`medstar_profile_id`), but the UI is significantly more complex | One active profile per tenant in MVP; the model is already prepared |
| Multilingual UI | German-only for Austrian market; multilingual UI doubles translation overhead before product-market fit | `language_code` on all entities; add languages after validating the product |
| Automated billing and invoicing | Requires payment provider integration, dunning logic, legal compliance per country — distraction from core product | Manual billing with Operator-managed tenants in MVP |
| Outbound recall campaigns | Sending proactive calls to patients requires regulatory consent framework (opt-in, opt-out tracking, campaign management) — separate product category | Inbound-only in MVP; ARA-Med Erinnerung (reminders) is scoped separately |
| Automated holiday detection | Austrian holiday logic has canton/state variations and changes annually | Manual date-specific overrides; practice enters holidays themselves |
| AI optimization recommendations | "Your intent recognition for prescription requests is 60% — here's how to improve it" requires training data analysis, NLP feedback loops, a model training pipeline | Surface raw metrics; let the practice manually tune intent aliases |
| Mobile app | Native apps require separate development track and App Store compliance; web-first is sufficient for a receptionist sitting at a desk | Responsive web is acceptable; mobile-first is not necessary for this user persona |
| Patient-facing portal | Patients interact via phone (the AI) and receive notifications — they have no dashboard login | Outbound notifications are the patient-facing surface; a portal is a separate product |
| Full EHR integration beyond MEDSTAR | Each EHR integration is a significant engineering project; MEDSTAR is the validated target | MEDSTAR only in MVP; modular adapter pattern means adding EHRs later is possible |

---

## Feature Dependencies

```
Authentication + RBAC
  └─→ All other features (no feature can be safely exposed without role-gated access)

Opening Hours Config
  └─→ AI behavior (hours determine which mode the AI operates in)
  └─→ Status Bar (current mode display)

Appointment Type Management (Intent Mapping)
  └─→ AI can only book what is configured
  └─→ Call Log (intent labels in call entries come from configured intents)

Call Log
  └─→ Inbox (Inbox is a filtered view of Call Log)
  └─→ Statistics (aggregated from Call Log)
  └─→ Call Detail / Decision Trace

Medication List
  └─→ Prescription Request Workflow (AI selects from configured list)
  └─→ Inbox (prescription requests surface as inbox items)

Communication Rules
  └─→ Requires templates (cannot send without template)
  └─→ Requires trigger events (from Call Log / Inbox state changes)

Greeting Texts + FAQ
  └─→ AI behavior (system prompt for each mode is assembled from these)
  └─→ EU AI Act compliance (disclosure must be in every greeting)

Routing Rules
  └─→ Requires phone number registry (VIP/WIP numbers)
  └─→ Requires Intent Mapping (intent-based routing)
  └─→ Requires Opening Hours (time-based routing)

Audit Log
  └─→ Depends on all configuration features (every config change logs here)
```

---

## DSGVO / Regulatory Considerations per Feature Category

| Feature Area | Data Category | Key Requirement | Confidence |
|--------------|---------------|-----------------|------------|
| Call Log — phone number | Contact data | Masked by default; full number requires explicit right (`call_detail`) | HIGH |
| Call Log — audio recording | Special category (Art. 9) | Separate access right; retention period must be defined and enforced | HIGH |
| Call Log — transcript | Special category (Art. 9) | Same as audio; patients must be informed at call start (EU AI Act Art. 50) | HIGH |
| Call Log — SVNR (patient number) | Special category (Art. 9) | Masked by default; only visible when fachlich required; never logged in clear text in audit | HIGH |
| Inbox — patient identity | Special category (Art. 9) | Unresolved cases with PII must have a retention/deletion policy | MEDIUM |
| Communication rules — patient SMS/WhatsApp | Contact data | Consent basis must be documented per rule; appointment reminders = treatment necessity; follow-up = explicit consent | MEDIUM |
| Routing rules — VIP number list | Contact data | Processing basis: legitimate interest of practice; must be in processing register | MEDIUM |
| Medication list | Health data (indirect) | Internal use only; not transmitted to patients; low risk | HIGH |
| Audit log | Administrative data | 7-10 year retention per Austrian WKO guidance; Operator and Arzt/admin access only | MEDIUM |
| AI greeting / EU AI Act | Transparency obligation | AI identity disclosure required at start of every call; cannot be removed by tenant | HIGH |
| Statistics | Aggregated / anonymised | No PII in aggregate stats; safe to show to Viewer role | HIGH |

**Austrian-specific notes:**
- Telefonaufzeichnungen (call recordings) require patient notification at the start of the call. The EU AI Act Art. 50 disclosure ("You are speaking with an AI") and the recording notice can be combined in the greeting.
- Austrian health data retention: 10 years for practice-level health records (WKO Leitfaden). Audio recordings of purely administrative calls (booking, prescription requests) may fall under the shorter 7-year business record rule — legal review recommended before implementing auto-deletion.
- The Datenschutzbehörde (Austrian DPA) has issued guidance that AI systems processing health data must have a Data Protection Impact Assessment (DPIA) under Art. 35 DSGVO. This is a platform-level obligation (for ARA-Med as operator), not a per-tenant obligation.

---

## MVP Recommendation

**Prioritize (in dependency order):**

1. Authentication + RBAC — foundation; nothing else is safe without this
2. Status Bar — operators need system awareness on day one
3. Call Log + Inbox — the core operational loop that justifies the product
4. Opening Hours Configuration — required for AI to behave correctly
5. Appointment Type Management — required for AI to book correctly
6. Greeting Text Editor (with EU AI Act disclosure enforcement) — required for legal launch
7. Basic KPI Statistics — required for practice owner buy-in
8. Audit Log — required for regulatory compliance
9. Medication List — required for prescription workflow
10. Routing Rules (basic: number-based + mode-based) — table stakes for VIP/direct connect
11. Communication Rules (internal inbox notifications first, then patient SMS) — MVP can start with internal notifications only
12. Deputy/Vacation Mode — high practical value for Austrian practices; configure early

**Defer to Phase 2:**
- Intent-alias management UI (can be seeded from backend in Phase 1)
- Full communication channel matrix (WhatsApp, Telegram, Voicecall)
- Decision Trace UI (data is captured; display can come later)
- Complex routing rules (intent-based, multi-condition)
- Full 4-layer calendar

---

## Sources

- EU AI Act Article 50 transparency requirements: https://artificialintelligenceact.eu/transparency-rules-article-50/
- GDPR for Healthcare overview: https://drata.com/learn/gdpr/for-healthcare
- Austrian WKO DSGVO Leitfaden for healthcare professions: https://www.wko.at/oe/gewerbe-handwerk/gesundheitsberufe/leitfaden-datenschutzgrundverordnung-fuer-gesundheitsberufe
- KI Telefonassistent Arztpraxis comparison (German): https://medizinio.de/digitalisierung/telefonassistent-arztpraxis
- KI Telefonassistent features and pricing: https://abrechnungsstelle.com/ki-telefonassistent/
- Retell AI healthcare implementation guide: https://www.retellai.com/blog/ai-voice-agent-healthcare-implementation-guide
- Voice AI healthcare KPIs and metrics: https://www.balto.ai/blog/kpis-for-voice-ai-agents-in-contact-centers/
- Austrian DSGVO health data retention: https://www.edoeb.admin.ch/de/einsicht-aufbewahrung-und-loeschung-von-patientendaten
- EU AI Act and healthcare: https://www.inquira.health/en/blog/the-eu-ai-act-and-healthcare-ai-what-providers-need-to-know
- C5-Type2 cloud certification for healthcare (German context): https://medizinio.de/digitalisierung/telefonassistent-arztpraxis
- Prescription refill automation: https://www.retellai.com/blog/automating-prescription-refills
- Medical receptionist software features: https://www.getfreed.ai/resources/best-medical-receptionist-software
