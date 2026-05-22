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
}

/** Staff action item for calls requiring follow-up (entspricht der inbox_items Tabelle) */
export interface InboxItemRow {
  id: string
  tenant_id: string
  call_log_id: string | null
  case_type: InboxCaseType
  status: InboxStatus
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
