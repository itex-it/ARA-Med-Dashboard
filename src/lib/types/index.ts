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
