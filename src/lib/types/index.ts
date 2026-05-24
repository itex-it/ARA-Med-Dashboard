/**
 * ARA-MED Domain Types
 * Zentrale Typen-Definitionen für das Multi-Tenant System
 */

/** Rollen im ARA-MED System */
export type AraRole = 'operator' | 'ordination_admin' | 'assistant' | 'viewer'

/** MFA Authenticator Assurance Level */
export type MfaLevel = 'aal1' | 'aal2'

/** Tenant-Konfiguration (entspricht der tenants Tabelle) */
export interface TenantRow {
  id: string
  name: string
  hostname: string | null
  medstar_server_url: string | null
  fallback_phone: string | null
  forwarding_phone: string | null
  require_mfa_level: MfaLevel
  active_features: Record<string, boolean>
  created_at: string
  // Phase 03: Status Bar columns (STATUS-01/02/03)
  ara_status: AraStatus
  practice_status: PracticeStatus
  active_mode: ActiveMode
}

/** Benutzer-Tenant-Rollenzuweisung (entspricht der user_tenant_roles Tabelle) */
export interface UserTenantRole {
  id: string
  user_id: string
  tenant_id: string
  role: AraRole
  permissions: Record<string, string>
  active: boolean
  created_at: string
}

// ============================================================
// Phase 02: n8n Event Ingestion Pipeline Types
// ============================================================

/** Call status lifecycle */
export type CallStatus = 'active' | 'completed' | 'failed' | 'forwarded' | 'abandoned'

/** Patient identification result from MEDSTAR lookup */
export type PidStatus = 'identified' | 'not_found' | 'multiple' | 'no_pid'

/** Classification of why an inbox item requires staff attention */
export type InboxCaseType =
  | 'unidentified_patient'
  | 'invalid_pid'
  | 'multiple_pid'
  | 'callback_needed'
  | 'prescription_blocked'
  | 'unclear_intent'
  | 'emergency'
  | 'technical_error'

/** Inbox item workflow state */
export type InboxStatus = 'open' | 'in_progress' | 'resolved' | 'archived'

/** Voice AI call record (entspricht der call_log Tabelle) */
export interface CallLogRow {
  id: string
  tenant_id: string
  session_id: string
  did_number: string | null
  phone_hash: string | null
  duration_seconds: number | null
  status: CallStatus
  intent_main: string | null
  intent_sub: string | null
  language_code: string
  summary_short: string | null
  summary_structured: Record<string, unknown> | null
  transcript_text: string | null
  audio_url: string | null
  pid_status: PidStatus | null
  patient_recognized: boolean
  inbox_qualifying: boolean
  created_at: string
  updated_at: string
  // Phase 03: Feedback & annotation columns (CALL-08/09)
  feedback_label: FeedbackLabel | null
  internal_note: string | null
  intent_corrected: string | null
}

/** Staff action item for calls requiring follow-up (entspricht der inbox_items Tabelle) */
export interface InboxItemRow {
  id: string
  tenant_id: string
  call_log_id: string | null
  case_type: InboxCaseType
  status: InboxStatus
  // Phase 04: INBOX-05 — note field (DB column existed in Phase 2 migration, type was missing)
  internal_note: string | null
  created_at: string
  updated_at: string
}

/** DID-to-tenant routing entry (entspricht der tenant_did_numbers Tabelle) */
export interface TenantDidNumberRow {
  id: string
  tenant_id: string
  did_number: string
  created_at: string
}

// ============================================================
// Phase 03: Status Bar & Call Detail Types
// ============================================================

/** STATUS-01: ARA-MED Voice AI system state */
export type AraStatus = 'active' | 'paused' | 'error'

/** STATUS-02: Medical practice open/closed state */
export type PracticeStatus = 'open' | 'closed' | 'special'

/** STATUS-03: Active operational mode */
export type ActiveMode = 'normal' | 'vacation' | 'deputy' | 'overload'

/** CALL-09: Staff quality feedback label on call classification */
export type FeedbackLabel = 'correct' | 'incorrect' | 'needs_training'

/** CALL-04/10: MEDSTAR action type executed during a call */
export type CallActionType =
  | 'appointment_booked'
  | 'appointment_cancelled'
  | 'appointment_rescheduled'
  | 'prescription_ordered'
  | 'message_created'
  | 'forwarding'
  | 'emergency_notice'

/** CALL-04/10: Result of the MEDSTAR API call for an action */
export type MedstarActionStatus = 'success' | 'error' | 'pending'

/** Executed MEDSTAR action per call (entspricht der call_actions Tabelle) */
export interface CallActionRow {
  id: string
  tenant_id: string
  call_log_id: string
  action_type: CallActionType
  medstar_status: MedstarActionStatus | null
  detail: Record<string, unknown> | null
  created_at: string
}

// ============================================================
// Phase 05: Configuration Types
// ============================================================

export type GreetingMode = 'normal' | 'vacation' | 'deputy' | 'own_service'

export type SpecialDayType = 'closure' | 'special_hours'

export type PidZeroBehavior = 'refuse' | 'waitlist' | 'book_normal' | 'forward'

export interface OpeningHoursRow {
  id: string
  tenant_id: string
  weekday: number
  open_from: string | null
  open_until: string | null
  is_closed: boolean
  created_at: string
}

export interface SpecialDayRow {
  id: string
  tenant_id: string
  date: string
  label: string
  type: SpecialDayType
  open_from: string | null
  open_until: string | null
  is_closed: boolean
  created_at: string
}

export interface DeputyPeriodRow {
  id: string
  tenant_id: string
  start_date: string
  end_date: string
  label: string | null
  active: boolean
  created_at: string
}

export interface AppointmentTypeRow {
  id: string
  tenant_id: string
  appointment_type_code: string
  display_name: string
  is_visible: boolean
  is_voice_bookable: boolean
  is_internal_only: boolean
  is_default: boolean
  pid_zero_allowed: boolean
  created_at: string
  updated_at: string
}

export interface AppointmentTypeSynonymRow {
  id: string
  tenant_id: string
  appointment_type_code: string
  synonym: string
  language_code: string
  created_at: string
}

export interface GreetingTextRow {
  id: string
  tenant_id: string
  mode: GreetingMode
  language_code: string
  eu_ai_act_disclosure: string
  eu_ai_act_disclosure_present: boolean
  user_text: string
  created_at: string
  updated_at: string
}

export interface FaqEntryRow {
  id: string
  tenant_id: string
  mode: 'all' | GreetingMode
  question: string
  answer: string
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface DeputyDoctorRow {
  id: string
  tenant_id: string
  name: string
  greeting_text: string | null
  forwarding_number: string
  start_date: string | null
  end_date: string | null
  pid_zero_behavior: PidZeroBehavior
  pid_zero_forward_number: string | null
  own_service_active: boolean
  own_service_prompt: string | null
  own_service_pid_zero_behavior: PidZeroBehavior | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface MedicationRow {
  id: string
  tenant_id: string
  pzn: string
  name: string
  phonetic: string | null
  active: boolean
  note: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// Phase 06: Routing & Communication Types
// ============================================================

export type RoutingConditionType = 'phone' | 'intent' | 'time_period' | 'mode'
export type RoutingActionType = 'direct_connect' | 'custom_prompt' | 'create_ticket' | 'offer_bypass_slot' | 'forward_to_number' | 'record_message'
export type CommDirection = 'intern' | 'patient'
export type CommChannel = 'inbox' | 'email' | 'telegram' | 'sms'
export type CommPriority = 'high' | 'normal' | 'low'
export type SendLogStatus = 'pending' | 'delivered' | 'failed'

export interface RoutingRuleRow {
  id: string
  tenant_id: string
  name: string
  condition_type: RoutingConditionType
  condition_value: Record<string, unknown>
  action_type: RoutingActionType
  action_value: Record<string, unknown>
  priority: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface VipNumberRow {
  id: string
  tenant_id: string
  phone_number: string
  label: string
  created_at: string
}

export interface CommRuleRow {
  id: string
  tenant_id: string
  direction: CommDirection
  event_type: string
  channel: CommChannel
  channel_target: string | null
  fallback_channel: CommChannel | null
  fallback_channel_target: string | null
  template_id: string | null
  priority: CommPriority
  time_window_from: string | null
  time_window_until: string | null
  retry_interval_minutes: number | null
  max_retries: number
  privacy_class: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface MessageTemplateRow {
  id: string
  tenant_id: string
  name: string
  channel: 'email' | 'sms' | 'telegram'
  language_code: string
  subject: string | null
  body: string
  version: number
  created_at: string
  updated_at: string
}

export interface SendLogRow {
  id: string
  tenant_id: string
  comm_rule_id: string | null
  event_type: string
  channel: string
  recipient_masked: string
  template_name: string | null
  template_version: number | null
  status: SendLogStatus
  error_reason: string | null
  sent_at: string
  created_at: string
}

// ============================================================
// Phase 07: Statistics & User Management Types
// ============================================================

export type PermissionLevel = 'none' | 'view' | 'edit' | 'manage' | 'admin'

export type ModuleCategory =
  | 'dashboard'
  | 'telefonate'
  | 'audio'
  | 'transkripte'
  | 'patientendaten'
  | 'inbox'
  | 'termine'
  | 'rezepte'
  | 'routing'
  | 'kommunikation'
  | 'kommunikation_templates'
  | 'oeffnungszeiten'
  | 'vertretung'
  | 'prompts'
  | 'training'
  | 'statistiken'
  | 'kosten'
  | 'benutzerverwaltung'
  | 'system_settings'
  | 'audit_log'

export type ModulePermissions = Record<ModuleCategory, PermissionLevel>

export interface TenantUserDisplay {
  id: string
  email: string
  role: AraRole
  permissions: Partial<ModulePermissions>
  active: boolean
  created_at: string
  last_sign_in_at: string | null
}

export interface StatsSummary {
  totalCalls: number
  avgDurationSeconds: number
  resolvedCount: number
  forwardedCount: number
  failedCount: number
  resolutionRate: number
  forwardingRate: number
  openTasksCount: number
  bookedAppointments: number
  prescriptionRequests: number
  emergencyCases: number
  estimatedSavedMinutes: number
}

export interface DailyCallVolume {
  date: string
  total: number
  resolved: number
  forwarded: number
}

export interface IntentFrequency {
  intent: string
  count: number
}

// ============================================================
// Phase 08: Audit Log Types
// ============================================================

export interface AuditLogRow {
  id: string
  tenant_id: string
  user_id: string
  action: string
  object_type: string
  object_id: string
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  ip_address: string
  user_agent: string
  created_at: string
}
