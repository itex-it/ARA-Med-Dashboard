'use server'

import { z } from 'zod'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'

const ALLOWED_ROLES = ['operator', 'ordination_admin']

export interface OpeningHoursActionState {
  success?: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

export interface SpecialDayActionState {
  success?: boolean
  error?: string
}

export interface DeputyPeriodActionState {
  success?: boolean
  error?: string
}

const weekdaySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  open_from: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  open_until: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  is_closed: z.boolean(),
})

const openingHoursSchema = z.object({
  hours: z.array(weekdaySchema).length(7),
})

const addSpecialDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().min(1, 'Dieses Feld ist erforderlich.'),
  type: z.enum(['closure', 'special_hours']),
})

const deleteSpecialDaySchema = z.object({
  id: z.string().uuid(),
})

const addDeputyPeriodSchema = z
  .object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    label: z.string().optional(),
  })
  .refine((d) => d.end_date >= d.start_date, {
    message: 'Das Enddatum muss nach dem Startdatum liegen.',
    path: ['end_date'],
  })

const deleteDeputyPeriodSchema = z.object({
  id: z.string().uuid(),
})

async function getAuthContext() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { error: 'Nicht authentifiziert.' }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) return { error: 'Kein Tenant zugewiesen.' }

  const araRole = user.app_metadata?.ara_role as string | undefined
  if (!araRole || !ALLOWED_ROLES.includes(araRole)) return { error: 'Unzureichende Berechtigung.' }

  return { tenantId, userId: user.id }
}

export async function saveOpeningHoursAction(
  prevState: OpeningHoursActionState,
  formData: FormData,
): Promise<OpeningHoursActionState> {
  const hours = Array.from({ length: 7 }, (_, i) => ({
    weekday: i,
    open_from: (formData.get(`hours[${i}][open_from]`) as string | null) || null,
    open_until: (formData.get(`hours[${i}][open_until]`) as string | null) || null,
    is_closed: formData.get(`hours[${i}][is_closed]`) === 'on',
  }))

  const parsed = openingHoursSchema.safeParse({ hours })
  if (!parsed.success) {
    return { error: 'Ungültige Öffnungszeiten.' }
  }

  const auth = await getAuthContext()
  if (auth.error) return { error: auth.error }
  const { tenantId, userId } = auth as { tenantId: string; userId: string }

  const rows = parsed.data.hours.map((h) => ({
    tenant_id: tenantId!,
    weekday: h.weekday,
    open_from: h.is_closed ? null : h.open_from,
    open_until: h.is_closed ? null : h.open_until,
    is_closed: h.is_closed,
  }))

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('opening_hours')
    .upsert(rows, { onConflict: 'tenant_id,weekday' })

  if (dbError) {
    console.error('[saveOpeningHoursAction] DB error:', dbError)
    return { error: 'Speichern fehlgeschlagen. Bitte erneut versuchen.' }
  }

  await logAuditEvent({
    tenantId: tenantId!,
    userId,
    action: 'OPENING_HOURS_UPDATED',
    objectType: 'opening_hours',
    objectId: tenantId!,
    newValue: { hours: parsed.data.hours },
  })

  return { success: true }
}

export async function addSpecialDayAction(data: {
  date: string
  label: string
  type: string
}): Promise<SpecialDayActionState> {
  const parsed = addSpecialDaySchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  const auth = await getAuthContext()
  if (auth.error) return { error: auth.error }

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient.from('special_days').insert({
    tenant_id: auth.tenantId!,
    date: parsed.data.date,
    label: parsed.data.label,
    type: parsed.data.type,
    is_closed: parsed.data.type === 'closure',
  })

  if (dbError) {
    console.error('[addSpecialDayAction] DB error:', dbError)
    return { error: 'Sondertag konnte nicht gespeichert werden.' }
  }

  return { success: true }
}

export async function deleteSpecialDayAction(data: {
  id: string
}): Promise<SpecialDayActionState> {
  const parsed = deleteSpecialDaySchema.safeParse(data)
  if (!parsed.success) return { error: 'Ungültige ID.' }

  const auth = await getAuthContext()
  if (auth.error) return { error: auth.error }

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('special_days')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', auth.tenantId!)

  if (dbError) {
    console.error('[deleteSpecialDayAction] DB error:', dbError)
    return { error: 'Sondertag konnte nicht gelöscht werden.' }
  }

  return { success: true }
}

export async function addDeputyPeriodAction(data: {
  start_date: string
  end_date: string
  label?: string
}): Promise<DeputyPeriodActionState> {
  const parsed = addDeputyPeriodSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  const auth = await getAuthContext()
  if (auth.error) return { error: auth.error }

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient.from('deputy_periods').insert({
    tenant_id: auth.tenantId!,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    label: parsed.data.label ?? null,
    active: true,
  })

  if (dbError) {
    console.error('[addDeputyPeriodAction] DB error:', dbError)
    return { error: 'Vertretungszeitraum konnte nicht gespeichert werden.' }
  }

  return { success: true }
}

export async function deleteDeputyPeriodAction(data: {
  id: string
}): Promise<DeputyPeriodActionState> {
  const parsed = deleteDeputyPeriodSchema.safeParse(data)
  if (!parsed.success) return { error: 'Ungültige ID.' }

  const auth = await getAuthContext()
  if (auth.error) return { error: auth.error }

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('deputy_periods')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', auth.tenantId!)

  if (dbError) {
    console.error('[deleteDeputyPeriodAction] DB error:', dbError)
    return { error: 'Vertretungszeitraum konnte nicht gelöscht werden.' }
  }

  return { success: true }
}
