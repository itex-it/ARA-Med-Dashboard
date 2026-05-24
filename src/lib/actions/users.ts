'use server'

import 'server-only'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'
import {
  canGrantRole,
  applyDelegationCeiling,
  DEFAULT_PERMISSIONS,
} from '@/lib/permissions'
import type { AraRole, ModulePermissions } from '@/lib/types'

// ---------------------------------------------------------------------------
// Role Gate
// ---------------------------------------------------------------------------

const ALLOWED_ROLES: AraRole[] = ['operator', 'ordination_admin']

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const ROLE_VALUES = ['operator', 'ordination_admin', 'assistant', 'viewer'] as const

const createUserSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse.'),
  role: z.enum(ROLE_VALUES),
  permissions: z.string().min(1, 'Berechtigungen fehlen.'),
})

const updateUserSchema = z.object({
  targetUserId: z.string().uuid('Ungültige Benutzer-ID.'),
  role: z.enum(ROLE_VALUES),
  permissions: z.string().min(1, 'Berechtigungen fehlen.'),
  active: z.enum(['true', 'false']),
})

const deactivateUserSchema = z.object({
  targetUserId: z.string().uuid('Ungültige Benutzer-ID.'),
})

// ---------------------------------------------------------------------------
// Helper: Get current user's own permissions from user_tenant_roles
// ---------------------------------------------------------------------------

async function getCurrentUserPermissions(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  tenantId: string,
): Promise<ModulePermissions> {
  const { data } = await serviceClient
    .from('user_tenant_roles')
    .select('permissions, role')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .single()

  if (data?.permissions && typeof data.permissions === 'object') {
    return data.permissions as ModulePermissions
  }

  // Fallback: use role defaults
  const role = (data?.role as AraRole | undefined) ?? 'viewer'
  return DEFAULT_PERMISSIONS[role]
}

// ---------------------------------------------------------------------------
// Action Result Types
// ---------------------------------------------------------------------------

export type CreateUserResult = { ok: true; tempPassword: string } | { error: string }
export type UpdateUserResult = { ok: true } | { error: string }
export type DeactivateUserResult = { ok: true } | { error: string }

// ---------------------------------------------------------------------------
// 1. createUserAction
// ---------------------------------------------------------------------------

export async function createUserAction(formData: FormData): Promise<CreateUserResult> {
  // Parse & validate input
  const raw = {
    email: formData.get('email')?.toString().trim() ?? '',
    role: formData.get('role')?.toString() ?? '',
    permissions: formData.get('permissions')?.toString() ?? '',
  }

  const parsed = createUserSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  // 5-step auth sequence
  const authClient = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) {
    return { error: 'Nicht authentifiziert.' }
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) {
    return { error: 'Kein Tenant zugewiesen.' }
  }

  const currentUserRole = user.app_metadata?.ara_role as AraRole | undefined
  if (!currentUserRole || !ALLOWED_ROLES.includes(currentUserRole)) {
    return { error: 'Keine Berechtigung.' }
  }

  const serviceClient = createServiceRoleClient()

  // Delegation: role hierarchy check
  if (!canGrantRole(currentUserRole, parsed.data.role)) {
    return { error: 'Unzureichende Berechtigung: Diese Rolle kann nicht vergeben werden.' }
  }

  // Get caller's own permissions for delegation ceiling
  const currentUserOwnPermissions = await getCurrentUserPermissions(serviceClient, user.id, tenantId)

  // Parse target permissions and apply delegation ceiling
  let targetPerms: Partial<ModulePermissions>
  try {
    targetPerms = JSON.parse(parsed.data.permissions) as Partial<ModulePermissions>
  } catch {
    return { error: 'Ungültiges Berechtigungsformat.' }
  }

  const ceiledPermissions = applyDelegationCeiling(currentUserOwnPermissions, targetPerms)

  // Generate temp password
  const tempPassword = crypto.randomUUID().slice(0, 8).toUpperCase() + 'Med!1'

  // Create auth user via Admin API
  const { data: authData, error: createError } = await serviceClient.auth.admin.createUser({
    email: parsed.data.email,
    password: tempPassword,
    email_confirm: true,
  })

  if (createError || !authData.user) {
    return { error: createError?.message ?? 'Benutzer konnte nicht erstellt werden.' }
  }

  // Insert user_tenant_roles
  const { error: insertError } = await serviceClient.from('user_tenant_roles').insert({
    user_id: authData.user.id,
    tenant_id: tenantId,
    role: parsed.data.role,
    permissions: ceiledPermissions,
  })

  if (insertError) {
    console.error('[createUserAction] Insert error:', insertError)
    // Try to clean up the auth user we just created
    await serviceClient.auth.admin.deleteUser(authData.user.id)
    return { error: 'Benutzer konnte nicht in der Datenbank gespeichert werden.' }
  }

  await logAuditEvent({
    tenantId,
    userId: user.id,
    action: 'USER_CREATED',
    objectType: 'user',
    objectId: authData.user.id,
    newValue: { email: parsed.data.email, role: parsed.data.role },
  })

  revalidatePath('/benutzer')
  return { ok: true, tempPassword }
}

// ---------------------------------------------------------------------------
// 2. updateUserAction
// ---------------------------------------------------------------------------

export async function updateUserAction(formData: FormData): Promise<UpdateUserResult> {
  // Parse & validate input
  const raw = {
    targetUserId: formData.get('targetUserId')?.toString() ?? '',
    role: formData.get('role')?.toString() ?? '',
    permissions: formData.get('permissions')?.toString() ?? '',
    active: formData.get('active')?.toString() ?? '',
  }

  const parsed = updateUserSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  // 5-step auth sequence
  const authClient = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) {
    return { error: 'Nicht authentifiziert.' }
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) {
    return { error: 'Kein Tenant zugewiesen.' }
  }

  const currentUserRole = user.app_metadata?.ara_role as AraRole | undefined
  if (!currentUserRole || !ALLOWED_ROLES.includes(currentUserRole)) {
    return { error: 'Keine Berechtigung.' }
  }

  // Prevent self-role-change
  if (parsed.data.targetUserId === user.id) {
    return { error: 'Eigene Rolle nicht änderbar.' }
  }

  const serviceClient = createServiceRoleClient()

  // Verify target belongs to same tenant (defense-in-depth)
  const { data: targetRow, error: lookupError } = await serviceClient
    .from('user_tenant_roles')
    .select('user_id, role')
    .eq('user_id', parsed.data.targetUserId)
    .eq('tenant_id', tenantId)
    .single()

  if (lookupError || !targetRow) {
    return { error: 'Benutzer nicht gefunden.' }
  }

  // Delegation: role hierarchy check
  if (!canGrantRole(currentUserRole, parsed.data.role)) {
    return { error: 'Unzureichende Berechtigung.' }
  }

  // Get caller's own permissions for delegation ceiling
  const currentUserOwnPermissions = await getCurrentUserPermissions(serviceClient, user.id, tenantId)

  // Parse target permissions and apply delegation ceiling
  let targetPerms: Partial<ModulePermissions>
  try {
    targetPerms = JSON.parse(parsed.data.permissions) as Partial<ModulePermissions>
  } catch {
    return { error: 'Ungültiges Berechtigungsformat.' }
  }

  const ceiledPermissions = applyDelegationCeiling(currentUserOwnPermissions, targetPerms)
  const isActive = parsed.data.active === 'true'

  // Update user_tenant_roles
  const { error: updateError } = await serviceClient
    .from('user_tenant_roles')
    .update({ role: parsed.data.role, permissions: ceiledPermissions, active: isActive })
    .eq('user_id', parsed.data.targetUserId)
    .eq('tenant_id', tenantId)

  if (updateError) {
    console.error('[updateUserAction] Update error:', updateError)
    return { error: 'Benutzer konnte nicht aktualisiert werden.' }
  }

  await logAuditEvent({
    tenantId,
    userId: user.id,
    action: 'USER_UPDATED',
    objectType: 'user',
    objectId: parsed.data.targetUserId,
    newValue: { role: parsed.data.role, active: isActive },
  })

  // Invalidate session immediately (role change or deactivation)
  await serviceClient.auth.admin.signOut(parsed.data.targetUserId, 'global')

  revalidatePath('/benutzer')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// 3. deactivateUserAction
// ---------------------------------------------------------------------------

export async function deactivateUserAction(formData: FormData): Promise<DeactivateUserResult> {
  // Parse & validate input
  const raw = {
    targetUserId: formData.get('targetUserId')?.toString() ?? '',
  }

  const parsed = deactivateUserSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  // 5-step auth sequence
  const authClient = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) {
    return { error: 'Nicht authentifiziert.' }
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) {
    return { error: 'Kein Tenant zugewiesen.' }
  }

  const currentUserRole = user.app_metadata?.ara_role as AraRole | undefined
  if (!currentUserRole || !ALLOWED_ROLES.includes(currentUserRole)) {
    return { error: 'Keine Berechtigung.' }
  }

  // Prevent self-deactivation
  if (parsed.data.targetUserId === user.id) {
    return { error: 'Eigenen Account nicht deaktivierbar.' }
  }

  const serviceClient = createServiceRoleClient()

  // Verify target belongs to same tenant (defense-in-depth)
  const { data: targetRow, error: lookupError } = await serviceClient
    .from('user_tenant_roles')
    .select('user_id')
    .eq('user_id', parsed.data.targetUserId)
    .eq('tenant_id', tenantId)
    .single()

  if (lookupError || !targetRow) {
    return { error: 'Benutzer nicht gefunden.' }
  }

  // Deactivate
  const { error: updateError } = await serviceClient
    .from('user_tenant_roles')
    .update({ active: false })
    .eq('user_id', parsed.data.targetUserId)
    .eq('tenant_id', tenantId)

  if (updateError) {
    console.error('[deactivateUserAction] Update error:', updateError)
    return { error: 'Benutzer konnte nicht deaktiviert werden.' }
  }

  await logAuditEvent({
    tenantId,
    userId: user.id,
    action: 'USER_DEACTIVATED',
    objectType: 'user',
    objectId: parsed.data.targetUserId,
    newValue: { active: false },
  })

  // Invalidate session immediately
  await serviceClient.auth.admin.signOut(parsed.data.targetUserId, 'global')

  revalidatePath('/benutzer')
  return { ok: true }
}
