/**
 * ARA-MED Permission Utility Module
 * Shared module for permission constants and helpers.
 * No 'server-only' — constants are needed on the client for the permission matrix UI.
 */

import type {
  AraRole,
  ModuleCategory,
  ModulePermissions,
  PermissionLevel,
} from '@/lib/types'

// ============================================================
// Constants
// ============================================================

export const MODULE_CATEGORIES = [
  'dashboard',
  'telefonate',
  'audio',
  'transkripte',
  'patientendaten',
  'inbox',
  'termine',
  'rezepte',
  'routing',
  'kommunikation',
  'kommunikation_templates',
  'oeffnungszeiten',
  'vertretung',
  'prompts',
  'training',
  'statistiken',
  'kosten',
  'benutzerverwaltung',
  'system_settings',
  'audit_log',
] as const satisfies readonly ModuleCategory[]

export const MODULE_CATEGORY_LABELS: Record<ModuleCategory, string> = {
  dashboard: 'Dashboard-Übersicht',
  telefonate: 'Telefonate',
  audio: 'Audio',
  transkripte: 'Transkripte',
  patientendaten: 'Patientendaten',
  inbox: 'Inbox/Aufgaben',
  termine: 'Termine',
  rezepte: 'Rezepte',
  routing: 'Routing',
  kommunikation: 'Kommunikation',
  kommunikation_templates: 'Kommunikations-Templates',
  oeffnungszeiten: 'Öffnungszeiten',
  vertretung: 'Vertretung',
  prompts: 'Prompts/Texte',
  training: 'Training/FAQ',
  statistiken: 'Statistiken',
  kosten: 'Kosten',
  benutzerverwaltung: 'Benutzerverwaltung',
  system_settings: 'System-Settings',
  audit_log: 'Audit-Log',
}

export const PERMISSION_LEVELS = [
  'none',
  'view',
  'edit',
  'manage',
  'admin',
] as const satisfies readonly PermissionLevel[]

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = {
  none: 'Kein',
  view: 'Lesen',
  edit: 'Bearbeiten',
  manage: 'Verwalten',
  admin: 'Admin',
}

export const PERMISSION_LEVEL_ORDER: Record<PermissionLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
  manage: 3,
  admin: 4,
}

export const ROLE_HIERARCHY: Record<AraRole, number> = {
  viewer: 0,
  assistant: 1,
  ordination_admin: 2,
  operator: 3,
}

export const ROLE_LABELS: Record<AraRole, string> = {
  operator: 'Operator',
  ordination_admin: 'Arzt/Admin',
  assistant: 'Ordinationsassistenz',
  viewer: 'Viewer',
}

// ============================================================
// Default Permissions
// ============================================================

export const DEFAULT_PERMISSIONS: Record<AraRole, ModulePermissions> = {
  operator: {
    dashboard: 'admin',
    telefonate: 'admin',
    audio: 'admin',
    transkripte: 'admin',
    patientendaten: 'admin',
    inbox: 'admin',
    termine: 'admin',
    rezepte: 'admin',
    routing: 'admin',
    kommunikation: 'admin',
    kommunikation_templates: 'admin',
    oeffnungszeiten: 'admin',
    vertretung: 'admin',
    prompts: 'admin',
    training: 'admin',
    statistiken: 'admin',
    kosten: 'admin',
    benutzerverwaltung: 'admin',
    system_settings: 'admin',
    audit_log: 'admin',
  },
  ordination_admin: {
    dashboard: 'manage',
    telefonate: 'manage',
    audio: 'manage',
    transkripte: 'manage',
    patientendaten: 'manage',
    inbox: 'manage',
    termine: 'manage',
    rezepte: 'manage',
    routing: 'manage',
    kommunikation: 'manage',
    kommunikation_templates: 'manage',
    oeffnungszeiten: 'manage',
    vertretung: 'manage',
    prompts: 'manage',
    training: 'manage',
    statistiken: 'manage',
    kosten: 'view',
    benutzerverwaltung: 'manage',
    system_settings: 'none',
    audit_log: 'view',
  },
  assistant: {
    dashboard: 'view',
    telefonate: 'view',
    audio: 'view',
    transkripte: 'view',
    patientendaten: 'view',
    inbox: 'edit',
    termine: 'view',
    rezepte: 'view',
    routing: 'none',
    kommunikation: 'view',
    kommunikation_templates: 'none',
    oeffnungszeiten: 'view',
    vertretung: 'none',
    prompts: 'none',
    training: 'none',
    statistiken: 'view',
    kosten: 'none',
    benutzerverwaltung: 'none',
    system_settings: 'none',
    audit_log: 'none',
  },
  viewer: {
    dashboard: 'view',
    telefonate: 'view',
    audio: 'none',
    transkripte: 'none',
    patientendaten: 'none',
    inbox: 'view',
    termine: 'none',
    rezepte: 'none',
    routing: 'none',
    kommunikation: 'none',
    kommunikation_templates: 'none',
    oeffnungszeiten: 'none',
    vertretung: 'none',
    prompts: 'none',
    training: 'none',
    statistiken: 'view',
    kosten: 'none',
    benutzerverwaltung: 'none',
    system_settings: 'none',
    audit_log: 'none',
  },
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Returns true if grantor can grant the target permission level.
 * Grantor must have at least the same level they want to grant.
 */
export function canGrantPermission(
  grantorLevel: PermissionLevel,
  targetLevel: PermissionLevel
): boolean {
  return PERMISSION_LEVEL_ORDER[grantorLevel] >= PERMISSION_LEVEL_ORDER[targetLevel]
}

/**
 * Returns true if grantor can grant the target role.
 * Operator can grant any lower role; ordination_admin can only grant assistant/viewer.
 */
export function canGrantRole(grantorRole: AraRole, targetRole: AraRole): boolean {
  return ROLE_HIERARCHY[grantorRole] > ROLE_HIERARCHY[targetRole]
}

/**
 * Caps each module permission in targetPermissions to the grantor's ceiling.
 * Returns a complete ModulePermissions with every category set.
 */
export function applyDelegationCeiling(
  grantorPermissions: ModulePermissions,
  targetPermissions: Partial<ModulePermissions>
): ModulePermissions {
  const result = {} as ModulePermissions
  for (const cat of MODULE_CATEGORIES) {
    const grantorLevel = grantorPermissions[cat]
    const targetLevel = targetPermissions[cat] ?? 'none'
    const grantorOrder = PERMISSION_LEVEL_ORDER[grantorLevel]
    const targetOrder = PERMISSION_LEVEL_ORDER[targetLevel]
    result[cat] = targetOrder <= grantorOrder ? targetLevel : grantorLevel
  }
  return result
}

/**
 * Returns the default ModulePermissions for a given AraRole.
 */
export function getDefaultPermissions(role: AraRole): ModulePermissions {
  return DEFAULT_PERMISSIONS[role]
}
