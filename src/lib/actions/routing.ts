'use server'

import 'server-only'

import { z } from 'zod'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Role Gate
// ---------------------------------------------------------------------------

const ALLOWED_ROLES = ['operator', 'ordination_admin'] as const

// ---------------------------------------------------------------------------
// Action State Interfaces
// ---------------------------------------------------------------------------

export type RoutingRuleActionState = { success?: boolean; error?: string }
export type VipNumberActionState = { success?: boolean; error?: string }
export type ToggleRoutingRuleState = { success?: boolean; error?: string; active?: boolean }

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const CONDITION_TYPES = ['phone', 'intent', 'time_period', 'mode'] as const
const ACTION_TYPES = [
  'direct_connect',
  'custom_prompt',
  'create_ticket',
  'offer_bypass_slot',
  'forward_to_number',
  'record_message',
] as const

const routingRuleBaseSchema = z
  .object({
    name: z.string().min(1, 'Dieses Feld ist erforderlich.'),
    condition_type: z.enum(CONDITION_TYPES),
    condition_value: z.record(z.string(), z.unknown()),
    action_type: z.enum(ACTION_TYPES),
    action_value: z.record(z.string(), z.unknown()),
    priority: z.number().int().min(1),
  })
  .refine(
    (data) => {
      if (data.action_type === 'forward_to_number') {
        const num = data.action_value?.number
        return typeof num === 'string' && num.trim().length > 0
      }
      return true
    },
    {
      message: 'Bitte geben Sie eine Weiterleitungsnummer ein.',
      path: ['action_value'],
    },
  )

const createRoutingRuleSchema = routingRuleBaseSchema

const updateRoutingRuleSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1, 'Dieses Feld ist erforderlich.'),
    condition_type: z.enum(CONDITION_TYPES),
    condition_value: z.record(z.string(), z.unknown()),
    action_type: z.enum(ACTION_TYPES),
    action_value: z.record(z.string(), z.unknown()),
    priority: z.number().int().min(1),
  })
  .refine(
    (data) => {
      if (data.action_type === 'forward_to_number') {
        const num = data.action_value?.number
        return typeof num === 'string' && num.trim().length > 0
      }
      return true
    },
    {
      message: 'Bitte geben Sie eine Weiterleitungsnummer ein.',
      path: ['action_value'],
    },
  )

const deleteRoutingRuleSchema = z.object({ id: z.string().uuid() })

const toggleRoutingRuleSchema = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
})

const upsertVipNumberSchema = z.object({
  phone_number: z.string().min(1, 'Dieses Feld ist erforderlich.'),
  label: z.string().default(''),
})

const deleteVipNumberSchema = z.object({ id: z.string().uuid() })

// ---------------------------------------------------------------------------
// Helper: parse JSON string fields from FormData
// ---------------------------------------------------------------------------

function parseJsonField(value: FormDataEntryValue | null): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value.toString())
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return {}
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// Auth helper — shared sequence per update-inbox-status.ts locked pattern
// ---------------------------------------------------------------------------

async function getAuthedTenantId(): Promise<
  { tenantId: string; error?: undefined } | { tenantId?: undefined; error: string }
> {
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

  const araRole = user.app_metadata?.ara_role as string | undefined
  if (!araRole || !(ALLOWED_ROLES as readonly string[]).includes(araRole)) {
    return { error: 'Keine Berechtigung.' }
  }

  return { tenantId }
}

// ---------------------------------------------------------------------------
// 1. createRoutingRuleAction
// ---------------------------------------------------------------------------

export async function createRoutingRuleAction(
  prevState: RoutingRuleActionState,
  formData: FormData,
): Promise<RoutingRuleActionState> {
  const raw = {
    name: formData.get('name')?.toString().trim() ?? '',
    condition_type: formData.get('condition_type')?.toString() ?? '',
    condition_value: parseJsonField(formData.get('condition_value')),
    action_type: formData.get('action_type')?.toString() ?? '',
    action_value: parseJsonField(formData.get('action_value')),
    priority: Number(formData.get('priority') ?? 1),
  }

  const parsed = createRoutingRuleSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  const auth = await getAuthedTenantId()
  if (auth.error) return { error: auth.error }
  const { tenantId } = auth

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient.from('routing_rules').insert({
    ...parsed.data,
    tenant_id: tenantId,
  })

  if (dbError) {
    console.error('[createRoutingRuleAction] DB error:', dbError)
    return { error: 'Regel konnte nicht gespeichert werden. Bitte erneut versuchen.' }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// 2. updateRoutingRuleAction
// ---------------------------------------------------------------------------

export async function updateRoutingRuleAction(
  prevState: RoutingRuleActionState,
  formData: FormData,
): Promise<RoutingRuleActionState> {
  const raw = {
    id: formData.get('id')?.toString() ?? '',
    name: formData.get('name')?.toString().trim() ?? '',
    condition_type: formData.get('condition_type')?.toString() ?? '',
    condition_value: parseJsonField(formData.get('condition_value')),
    action_type: formData.get('action_type')?.toString() ?? '',
    action_value: parseJsonField(formData.get('action_value')),
    priority: Number(formData.get('priority') ?? 1),
  }

  const parsed = updateRoutingRuleSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  const auth = await getAuthedTenantId()
  if (auth.error) return { error: auth.error }
  const { tenantId } = auth

  const { id, ...updateData } = parsed.data
  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('routing_rules')
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId) // Defense-in-depth: forged id from another tenant → zero rows

  if (dbError) {
    console.error('[updateRoutingRuleAction] DB error:', dbError)
    return { error: 'Regel konnte nicht aktualisiert werden. Bitte erneut versuchen.' }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// 3. deleteRoutingRuleAction
// ---------------------------------------------------------------------------

export async function deleteRoutingRuleAction(
  prevState: RoutingRuleActionState,
  formData: FormData,
): Promise<RoutingRuleActionState> {
  const raw = { id: formData.get('id')?.toString() ?? '' }

  const parsed = deleteRoutingRuleSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: 'Ungültige ID.' }
  }

  const auth = await getAuthedTenantId()
  if (auth.error) return { error: auth.error }
  const { tenantId } = auth

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('routing_rules')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId) // Defense-in-depth: forged id from another tenant → zero rows

  if (dbError) {
    console.error('[deleteRoutingRuleAction] DB error:', dbError)
    return { error: 'Regel konnte nicht entfernt werden. Bitte erneut versuchen.' }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// 4. toggleRoutingRuleAction
// ---------------------------------------------------------------------------

export async function toggleRoutingRuleAction(
  prevState: ToggleRoutingRuleState,
  formData: FormData,
): Promise<ToggleRoutingRuleState> {
  const raw = {
    id: formData.get('id')?.toString() ?? '',
    active: formData.get('active') === 'true',
  }

  const parsed = toggleRoutingRuleSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: 'Ungültige Eingabe.' }
  }

  const auth = await getAuthedTenantId()
  if (auth.error) return { error: auth.error }
  const { tenantId } = auth

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('routing_rules')
    .update({ active: parsed.data.active, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId) // Defense-in-depth

  if (dbError) {
    console.error('[toggleRoutingRuleAction] DB error:', dbError)
    return { error: 'Status konnte nicht geändert werden.' }
  }

  return { success: true, active: parsed.data.active }
}

// ---------------------------------------------------------------------------
// 5. upsertVipNumberAction
// ---------------------------------------------------------------------------

export async function upsertVipNumberAction(
  prevState: VipNumberActionState,
  formData: FormData,
): Promise<VipNumberActionState> {
  const raw = {
    phone_number: formData.get('phone_number')?.toString().trim() ?? '',
    label: formData.get('label')?.toString().trim() ?? '',
  }

  const parsed = upsertVipNumberSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  const auth = await getAuthedTenantId()
  if (auth.error) return { error: auth.error }
  const { tenantId } = auth

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('vip_numbers')
    .upsert(
      { phone_number: parsed.data.phone_number, label: parsed.data.label, tenant_id: tenantId },
      { onConflict: 'tenant_id,phone_number' },
    )

  if (dbError) {
    console.error('[upsertVipNumberAction] DB error:', dbError)
    return { error: 'Nummer konnte nicht gespeichert werden. Bitte erneut versuchen.' }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// 6. deleteVipNumberAction
// ---------------------------------------------------------------------------

export async function deleteVipNumberAction(
  prevState: VipNumberActionState,
  formData: FormData,
): Promise<VipNumberActionState> {
  const raw = { id: formData.get('id')?.toString() ?? '' }

  const parsed = deleteVipNumberSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: 'Ungültige ID.' }
  }

  const auth = await getAuthedTenantId()
  if (auth.error) return { error: auth.error }
  const { tenantId } = auth

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('vip_numbers')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId) // Defense-in-depth

  if (dbError) {
    console.error('[deleteVipNumberAction] DB error:', dbError)
    return { error: 'Nummer konnte nicht entfernt werden. Bitte erneut versuchen.' }
  }

  return { success: true }
}
