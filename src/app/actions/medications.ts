'use server'

import { z } from 'zod'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['operator', 'ordination_admin']

export interface MedicationActionState {
  success?: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const addMedicationSchema = z.object({
  pzn: z.string().regex(/^\d{7}$/, 'Bitte geben Sie eine gültige 7-stellige PZN ein.'),
  name: z.string().min(1, 'Dieses Feld ist erforderlich.'),
  phonetic: z.string().optional(),
  note: z.string().optional(),
  active: z.boolean().default(true),
})

const toggleActiveSchema = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
})

const deleteMedicationSchema = z.object({
  id: z.string().uuid(),
})

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function getAuthContext(): Promise<
  { tenantId: string } | { error: string }
> {
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

  return { tenantId }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function addMedicationAction(
  prevState: MedicationActionState,
  formData: FormData,
): Promise<MedicationActionState> {
  const pzn = formData.get('pzn') as string | null
  const name = formData.get('name') as string | null
  const phonetic = formData.get('phonetic') as string | null
  const note = formData.get('note') as string | null
  // Checkbox absent = active (default true); only false when explicitly set to 'false'
  const active = formData.get('active') !== 'false'

  const parsed = addMedicationSchema.safeParse({
    pzn: pzn ?? '',
    name: name ?? '',
    phonetic: phonetic || undefined,
    note: note || undefined,
    active,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  const auth = await getAuthContext()
  if ('error' in auth) return { error: auth.error }
  const { tenantId } = auth

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('medications')
    .insert({
      tenant_id: tenantId,
      pzn: parsed.data.pzn,
      name: parsed.data.name,
      phonetic: parsed.data.phonetic ?? null,
      note: parsed.data.note ?? null,
      active: parsed.data.active,
    })

  if (dbError) {
    console.error('[addMedicationAction] DB error:', dbError)
    return { error: 'Medikament konnte nicht gespeichert werden. Bitte erneut versuchen.' }
  }

  return { success: true }
}

export async function toggleMedicationActiveAction(data: {
  id: string
  active: boolean
}): Promise<MedicationActionState> {
  const auth = await getAuthContext()
  if ('error' in auth) return { error: auth.error }
  const { tenantId } = auth

  const parsed = toggleActiveSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('medications')
    .update({ active: parsed.data.active, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId) // Defense-in-depth: prevents cross-tenant mutation

  if (dbError) {
    console.error('[toggleMedicationActiveAction] DB error:', dbError)
    return { error: 'Status konnte nicht geändert werden.' }
  }

  return { success: true }
}

export async function deleteMedicationAction(data: {
  id: string
}): Promise<MedicationActionState> {
  const auth = await getAuthContext()
  if ('error' in auth) return { error: auth.error }
  const { tenantId } = auth

  const parsed = deleteMedicationSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('medications')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId) // Defense-in-depth: prevents cross-tenant deletion

  if (dbError) {
    console.error('[deleteMedicationAction] DB error:', dbError)
    return { error: 'Medikament konnte nicht gelöscht werden.' }
  }

  return { success: true }
}
