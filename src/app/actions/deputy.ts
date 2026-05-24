'use server'

import { z } from 'zod'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'

const ALLOWED_ROLES = ['operator', 'ordination_admin']

export interface DeputyDoctorActionState {
  success?: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Shared auth helper
// ---------------------------------------------------------------------------

async function getAuthContext(): Promise<{ tenantId: string; userId: string } | { error: string }> {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Nicht authentifiziert.' }
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) {
    return { error: 'Kein Tenant zugewiesen.' }
  }

  const araRole = user.app_metadata?.ara_role as string | undefined
  if (!araRole || !ALLOWED_ROLES.includes(araRole)) {
    return { error: 'Unzureichende Berechtigung.' }
  }

  return { tenantId, userId: user.id }
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const deputyFieldsSchema = z.object({
  name: z.string().min(1, 'Dieses Feld ist erforderlich.'),
  forwarding_number: z.string().min(1, 'Dieses Feld ist erforderlich.'),
  greeting_text: z.string().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  pid_zero_behavior: z.enum(['refuse', 'waitlist', 'book_normal', 'forward']),
  pid_zero_forward_number: z.string().optional().nullable(),
  own_service_active: z.boolean().default(false),
  own_service_prompt: z.string().optional(),
  own_service_pid_zero_behavior: z
    .enum(['refuse', 'waitlist', 'book_normal', 'forward'])
    .optional()
    .nullable(),
})

const addDeputyDoctorSchema = deputyFieldsSchema.refine(
  (d) => !d.start_date || !d.end_date || d.end_date >= d.start_date,
  { message: 'Das Enddatum muss nach dem Startdatum liegen.', path: ['end_date'] },
)

const updateDeputyDoctorSchema = z
  .object({ id: z.string().uuid() })
  .merge(deputyFieldsSchema.partial())
  .refine(
    (d) => !d.start_date || !d.end_date || d.end_date >= d.start_date,
    { message: 'Das Enddatum muss nach dem Startdatum liegen.', path: ['end_date'] },
  )

const deleteDeputyDoctorSchema = z.object({ id: z.string().uuid() })

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function addDeputyDoctorAction(
  data: unknown,
): Promise<DeputyDoctorActionState> {
  const auth = await getAuthContext()
  if ('error' in auth) return { error: auth.error }
  const { tenantId, userId } = auth as { tenantId: string; userId: string }

  const parsed = addDeputyDoctorSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('deputy_doctors')
    .insert({ tenant_id: tenantId, ...parsed.data })

  if (dbError) {
    console.error('[addDeputyDoctorAction] DB error:', dbError)
    return { error: 'Vertretungsarzt konnte nicht gespeichert werden.' }
  }

  await logAuditEvent({
    tenantId,
    userId,
    action: 'DEPUTY_MODE_UPDATED',
    objectType: 'deputy',
    objectId: tenantId,
    newValue: { name: parsed.data.name, forwarding_number: parsed.data.forwarding_number },
  })

  return { success: true }
}

export async function updateDeputyDoctorAction(
  data: unknown,
): Promise<DeputyDoctorActionState> {
  const auth = await getAuthContext()
  if ('error' in auth) return { error: auth.error }
  const { tenantId, userId } = auth as { tenantId: string; userId: string }

  const parsed = updateDeputyDoctorSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  const { id, ...rest } = parsed.data
  const updateData: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() }

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('deputy_doctors')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (dbError) {
    console.error('[updateDeputyDoctorAction] DB error:', dbError)
    return { error: 'Änderungen konnten nicht gespeichert werden.' }
  }

  await logAuditEvent({
    tenantId,
    userId,
    action: 'DEPUTY_MODE_UPDATED',
    objectType: 'deputy',
    objectId: id,
    newValue: { ...rest },
  })

  return { success: true }
}

export async function deleteDeputyDoctorAction(
  data: unknown,
): Promise<DeputyDoctorActionState> {
  const auth = await getAuthContext()
  if ('error' in auth) return { error: auth.error }
  const { tenantId, userId } = auth as { tenantId: string; userId: string }

  const parsed = deleteDeputyDoctorSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('deputy_doctors')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (dbError) {
    console.error('[deleteDeputyDoctorAction] DB error:', dbError)
    return { error: 'Vertretungsarzt konnte nicht entfernt werden.' }
  }

  await logAuditEvent({
    tenantId,
    userId,
    action: 'DEPUTY_MODE_UPDATED',
    objectType: 'deputy',
    objectId: parsed.data.id,
    oldValue: { id: parsed.data.id },
    newValue: null,
  })

  return { success: true }
}
