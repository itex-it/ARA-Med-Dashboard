'use server'

import 'server-only'

import { z } from 'zod'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'

// ---------------------------------------------------------------------------
// Role Gate
// ---------------------------------------------------------------------------

const ALLOWED_ROLES = ['operator', 'ordination_admin'] as const

// ---------------------------------------------------------------------------
// Action State Interfaces
// ---------------------------------------------------------------------------

export type CommRuleActionState = { success?: boolean; error?: string }
export type ToggleCommRuleState = { success?: boolean; error?: string; active?: boolean }

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const commRuleBaseSchema = z
  .object({
    direction: z.enum(['intern', 'patient']),
    event_type: z.string().min(1, 'Dieses Feld ist erforderlich.'),
    channel: z.enum(['inbox', 'email', 'telegram', 'sms']),
    channel_target: z.string().optional(),
    fallback_channel: z.enum(['inbox', 'email', 'telegram', 'sms']).optional().nullable(),
    fallback_channel_target: z.string().optional(),
    template_id: z.string().uuid().optional().nullable(),
    priority: z.enum(['high', 'normal', 'low']).default('normal'),
    time_window_from: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional()
      .nullable(),
    time_window_until: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional()
      .nullable(),
    retry_interval_minutes: z.coerce.number().int().positive().optional().nullable(),
    max_retries: z.coerce.number().int().min(1).max(10).default(3),
    privacy_class: z.enum(['standard', 'restricted', 'minimal']).default('standard'),
    active: z.boolean().default(true),
  })
  .refine(
    (d) => !(d.direction === 'patient' && d.channel === 'inbox'),
    {
      message: 'Patientenbenachrichtigungen unterstützen nur E-Mail und SMS.',
      path: ['channel'],
    },
  )
  .refine(
    (d) => !(d.direction === 'patient' && d.channel === 'telegram'),
    {
      message: 'Patientenbenachrichtigungen unterstützen nur E-Mail und SMS.',
      path: ['channel'],
    },
  )

const createCommRuleSchema = commRuleBaseSchema

const updateCommRuleSchema = commRuleBaseSchema.extend({
  id: z.string().uuid(),
})

const deleteCommRuleSchema = z.object({ id: z.string().uuid() })

const toggleCommRuleSchema = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
})

// ---------------------------------------------------------------------------
// Auth helper — shared sequence per update-inbox-status.ts locked pattern
// ---------------------------------------------------------------------------

async function getAuthedTenantId(): Promise<
  { tenantId: string; userId: string; error?: undefined } | { tenantId?: undefined; userId?: undefined; error: string }
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

  return { tenantId, userId: user.id }
}

// ---------------------------------------------------------------------------
// Helper: parse optional nullable string from formData
// ---------------------------------------------------------------------------

function optionalNullableString(value: FormDataEntryValue | null): string | null | undefined {
  if (value === null) return undefined
  const str = value.toString().trim()
  return str === '' ? null : str
}

// ---------------------------------------------------------------------------
// 1. createCommRuleAction
// ---------------------------------------------------------------------------

export async function createCommRuleAction(
  prevState: CommRuleActionState,
  formData: FormData,
): Promise<CommRuleActionState> {
  const raw = {
    direction: formData.get('direction')?.toString() ?? '',
    event_type: formData.get('event_type')?.toString().trim() ?? '',
    channel: formData.get('channel')?.toString() ?? '',
    channel_target: optionalNullableString(formData.get('channel_target')),
    fallback_channel: optionalNullableString(formData.get('fallback_channel')),
    fallback_channel_target: optionalNullableString(formData.get('fallback_channel_target')),
    template_id: optionalNullableString(formData.get('template_id')),
    priority: formData.get('priority')?.toString() ?? 'normal',
    time_window_from: optionalNullableString(formData.get('time_window_from')),
    time_window_until: optionalNullableString(formData.get('time_window_until')),
    retry_interval_minutes: optionalNullableString(formData.get('retry_interval_minutes')),
    max_retries: formData.get('max_retries')?.toString() ?? '3',
    privacy_class: formData.get('privacy_class')?.toString() ?? 'standard',
    active: formData.get('active') === 'true',
  }

  const parsed = createCommRuleSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  const auth = await getAuthedTenantId()
  if (auth.error) return { error: auth.error }
  const { tenantId, userId } = auth as { tenantId: string; userId: string }

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient.from('comm_rules').insert({
    ...parsed.data,
    tenant_id: tenantId,
    updated_at: new Date().toISOString(),
  })

  if (dbError) {
    console.error('[createCommRuleAction] DB error:', dbError)
    return { error: 'Regel konnte nicht gespeichert werden. Bitte erneut versuchen.' }
  }

  await logAuditEvent({
    tenantId,
    userId,
    action: 'COMM_RULE_CREATED',
    objectType: 'communication_rule',
    objectId: '',
    newValue: { direction: parsed.data.direction, event_type: parsed.data.event_type, channel: parsed.data.channel },
  })

  return { success: true }
}

// ---------------------------------------------------------------------------
// 2. updateCommRuleAction
// ---------------------------------------------------------------------------

export async function updateCommRuleAction(
  prevState: CommRuleActionState,
  formData: FormData,
): Promise<CommRuleActionState> {
  const raw = {
    id: formData.get('id')?.toString() ?? '',
    direction: formData.get('direction')?.toString() ?? '',
    event_type: formData.get('event_type')?.toString().trim() ?? '',
    channel: formData.get('channel')?.toString() ?? '',
    channel_target: optionalNullableString(formData.get('channel_target')),
    fallback_channel: optionalNullableString(formData.get('fallback_channel')),
    fallback_channel_target: optionalNullableString(formData.get('fallback_channel_target')),
    template_id: optionalNullableString(formData.get('template_id')),
    priority: formData.get('priority')?.toString() ?? 'normal',
    time_window_from: optionalNullableString(formData.get('time_window_from')),
    time_window_until: optionalNullableString(formData.get('time_window_until')),
    retry_interval_minutes: optionalNullableString(formData.get('retry_interval_minutes')),
    max_retries: formData.get('max_retries')?.toString() ?? '3',
    privacy_class: formData.get('privacy_class')?.toString() ?? 'standard',
    active: formData.get('active') === 'true',
  }

  const parsed = updateCommRuleSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  const auth = await getAuthedTenantId()
  if (auth.error) return { error: auth.error }
  const { tenantId, userId } = auth as { tenantId: string; userId: string }

  const { id, ...updateData } = parsed.data
  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('comm_rules')
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId) // Defense-in-depth: forged id from another tenant → zero rows

  if (dbError) {
    console.error('[updateCommRuleAction] DB error:', dbError)
    return { error: 'Regel konnte nicht aktualisiert werden. Bitte erneut versuchen.' }
  }

  await logAuditEvent({
    tenantId,
    userId,
    action: 'COMM_RULE_UPDATED',
    objectType: 'communication_rule',
    objectId: id,
    newValue: { direction: updateData.direction, event_type: updateData.event_type, channel: updateData.channel },
  })

  return { success: true }
}

// ---------------------------------------------------------------------------
// 3. deleteCommRuleAction
// ---------------------------------------------------------------------------

export async function deleteCommRuleAction(
  prevState: CommRuleActionState,
  formData: FormData,
): Promise<CommRuleActionState> {
  const raw = { id: formData.get('id')?.toString() ?? '' }

  const parsed = deleteCommRuleSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: 'Ungültige ID.' }
  }

  const auth = await getAuthedTenantId()
  if (auth.error) return { error: auth.error }
  const { tenantId, userId } = auth as { tenantId: string; userId: string }

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('comm_rules')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId) // Defense-in-depth: forged id from another tenant → zero rows

  if (dbError) {
    console.error('[deleteCommRuleAction] DB error:', dbError)
    return { error: 'Regel konnte nicht entfernt werden. Bitte erneut versuchen.' }
  }

  await logAuditEvent({
    tenantId,
    userId,
    action: 'COMM_RULE_DELETED',
    objectType: 'communication_rule',
    objectId: parsed.data.id,
    oldValue: { id: parsed.data.id },
    newValue: null,
  })

  return { success: true }
}

// ---------------------------------------------------------------------------
// 4. toggleCommRuleAction
// ---------------------------------------------------------------------------

export async function toggleCommRuleAction(
  prevState: ToggleCommRuleState,
  formData: FormData,
): Promise<ToggleCommRuleState> {
  const raw = {
    id: formData.get('id')?.toString() ?? '',
    active: formData.get('active') === 'true',
  }

  const parsed = toggleCommRuleSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: 'Ungültige Eingabe.' }
  }

  const auth = await getAuthedTenantId()
  if (auth.error) return { error: auth.error }
  const { tenantId } = auth

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('comm_rules')
    .update({ active: parsed.data.active, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId) // Defense-in-depth

  if (dbError) {
    console.error('[toggleCommRuleAction] DB error:', dbError)
    return { error: 'Status konnte nicht geändert werden.' }
  }

  return { success: true, active: parsed.data.active }
}
