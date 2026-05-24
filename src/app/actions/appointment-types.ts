'use server'

import { z } from 'zod'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'

const ALLOWED_ROLES = ['operator', 'ordination_admin']

export interface AppointmentTypeFlagsState { success?: boolean; error?: string }
export interface AppointmentSynonymsState { success?: boolean; error?: string }
export interface DefaultAppointmentTypeState { success?: boolean; error?: string }

// CRITICAL: updateFlagsSchema receives ALL 4 flags in one call.
// Mutual exclusivity enforced via .refine() — is_voice_bookable AND is_internal_only cannot both be true.
const updateFlagsSchema = z.object({
  id: z.string().uuid(),
  visible: z.boolean(),
  is_voice_bookable: z.boolean(),
  is_internal_only: z.boolean(),
  pid_zero_allowed: z.boolean(),
}).refine(d => !(d.is_voice_bookable && d.is_internal_only), {
  message: 'Ein Typ kann nicht gleichzeitig KI-buchbar und intern sein.',
  path: ['is_internal_only'],
})

const saveSynonymsSchema = z.object({
  appointmentTypeCode: z.string().min(1),
  synonyms: z.array(z.string().min(1)).max(50),
})

const setDefaultSchema = z.object({ id: z.string().uuid() })

async function getAuthContext() {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Nicht authentifiziert.' }
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) return { error: 'Kein Tenant zugewiesen.' }
  const araRole = user.app_metadata?.ara_role as string | undefined
  if (!araRole || !ALLOWED_ROLES.includes(araRole)) return { error: 'Unzureichende Berechtigung.' }
  return { tenantId, userId: user.id }
}

export async function updateAppointmentTypeFlagsAction(data: {
  id: string
  visible: boolean
  is_voice_bookable: boolean
  is_internal_only: boolean
  pid_zero_allowed: boolean
}): Promise<AppointmentTypeFlagsState> {
  const parsed = updateFlagsSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }

  const auth = await getAuthContext()
  if (auth.error) return { error: auth.error }

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('appointment_types')
    .update({
      is_visible: parsed.data.visible,
      is_voice_bookable: parsed.data.is_voice_bookable,
      is_internal_only: parsed.data.is_internal_only,
      pid_zero_allowed: parsed.data.pid_zero_allowed,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
    .eq('tenant_id', auth.tenantId!)

  if (dbError) {
    console.error('[updateAppointmentTypeFlagsAction] DB error:', dbError)
    return { error: 'Aktualisierung fehlgeschlagen.' }
  }

  await logAuditEvent({
    tenantId: auth.tenantId!,
    userId: auth.userId!,
    action: 'APPOINTMENT_TYPE_UPDATED',
    objectType: 'appointment_type',
    objectId: parsed.data.id,
    newValue: {
      visible: parsed.data.visible,
      is_voice_bookable: parsed.data.is_voice_bookable,
      is_internal_only: parsed.data.is_internal_only,
      pid_zero_allowed: parsed.data.pid_zero_allowed,
    },
  })

  return { success: true }
}

export async function saveAppointmentSynonymsAction(data: {
  appointmentTypeCode: string
  synonyms: string[]
}): Promise<AppointmentSynonymsState> {
  const parsed = saveSynonymsSchema.safeParse(data)
  if (!parsed.success) return { error: 'Ungültige Eingabe.' }

  const auth = await getAuthContext()
  if (auth.error) return { error: auth.error }

  const serviceClient = createServiceRoleClient()
  const { error: deleteError } = await serviceClient
    .from('appointment_type_synonyms')
    .delete()
    .eq('tenant_id', auth.tenantId!)
    .eq('appointment_type_code', parsed.data.appointmentTypeCode)

  if (deleteError) {
    console.error('[saveAppointmentSynonymsAction] delete error:', deleteError)
    return { error: 'Synonyme konnten nicht gespeichert werden.' }
  }

  if (parsed.data.synonyms.length > 0) {
    const { error: insertError } = await serviceClient
      .from('appointment_type_synonyms')
      .insert(parsed.data.synonyms.map(s => ({
        tenant_id: auth.tenantId!,
        appointment_type_code: parsed.data.appointmentTypeCode,
        synonym: s,
        language_code: 'de',
      })))
    if (insertError) {
      console.error('[saveAppointmentSynonymsAction] insert error:', insertError)
      return { error: 'Synonyme konnten nicht gespeichert werden.' }
    }
  }

  await logAuditEvent({
    tenantId: auth.tenantId!,
    userId: auth.userId!,
    action: 'APPOINTMENT_TYPE_UPDATED',
    objectType: 'appointment_type',
    objectId: parsed.data.appointmentTypeCode,
    newValue: { synonyms: parsed.data.synonyms },
  })

  return { success: true }
}

export async function setDefaultAppointmentTypeAction(data: {
  id: string
}): Promise<DefaultAppointmentTypeState> {
  const parsed = setDefaultSchema.safeParse(data)
  if (!parsed.success) return { error: 'Ungültige ID.' }

  const auth = await getAuthContext()
  if (auth.error) return { error: auth.error }

  const serviceClient = createServiceRoleClient()

  // Step 1: clear all defaults for this tenant
  const { error: clearError } = await serviceClient
    .from('appointment_types')
    .update({ is_default: false })
    .eq('tenant_id', auth.tenantId!)

  if (clearError) {
    console.error('[setDefaultAppointmentTypeAction] clear error:', clearError)
    return { error: 'Standard konnte nicht gesetzt werden.' }
  }

  // Step 2: set the selected one as default
  const { error: setError } = await serviceClient
    .from('appointment_types')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq('tenant_id', auth.tenantId!)

  if (setError) {
    console.error('[setDefaultAppointmentTypeAction] set error:', setError)
    return { error: 'Standard konnte nicht gesetzt werden.' }
  }

  await logAuditEvent({
    tenantId: auth.tenantId!,
    userId: auth.userId!,
    action: 'APPOINTMENT_TYPE_UPDATED',
    objectType: 'appointment_type',
    objectId: parsed.data.id,
    newValue: { is_default: true },
  })

  return { success: true }
}
