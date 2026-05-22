'use server'

import { z } from 'zod'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { AraRole } from '@/lib/types'

// ---------------------------------------------------------------------------
// Zod v4 Validierungsschema für Tenant-Einstellungen
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  hostname: z.string().optional(),
  medstar_server_url: z.url().optional(),
  fallback_phone: z.string().optional(),
  forwarding_phone: z.string().optional(),
  active_features: z.record(z.string(), z.boolean()).optional(),
})

// Feature-Flags die das Formular kennt (muss mit SettingsForm.tsx übereinstimmen)
const KNOWN_FEATURE_FLAGS = ['voice_ai', 'inbox', 'call_log', 'statistics', 'magic_link']

// ---------------------------------------------------------------------------
// Action-State Typ
// ---------------------------------------------------------------------------

export interface SettingsActionState {
  success?: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

// ---------------------------------------------------------------------------
// updateTenantAction — Server Action für das Einstellungsformular
//
// Sicherheit:
//   - tenant_id aus JWT app_metadata (niemals aus formData)
//   - Rollenprüfung: nur operator und ordination_admin
//   - Service Role Client für DB-Schreibzugriff (tenants hat kein RLS)
//   - Vault-Secrets werden NICHT verarbeitet
// ---------------------------------------------------------------------------

export async function updateTenantAction(
  prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  // Authentifizierung: getUser() — niemals getSession()
  const authClient = await createServerClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()

  if (authError || !user) {
    return { error: 'Nicht authentifiziert. Bitte melden Sie sich erneut an.' }
  }

  // tenant_id und ara_role aus JWT app_metadata — NICHT aus formData (T-04-01)
  const tenantId = user.app_metadata['tenant_id'] as string | undefined
  const araRole = user.app_metadata['ara_role'] as AraRole | undefined

  if (!tenantId) {
    return {
      error: 'Kein Tenant zugewiesen. Bitte wenden Sie sich an den Administrator.',
    }
  }

  // Rollenprüfung (T-04-03)
  const allowedRoles: AraRole[] = ['operator', 'ordination_admin']
  if (!araRole || !allowedRoles.includes(araRole)) {
    return {
      error: 'Unzureichende Berechtigung. Nur Operatoren und Administratoren dürfen Einstellungen ändern.',
    }
  }

  // Feature-Flag-Checkboxen aus FormData lesen (feature_{key} = "true" wenn aktiviert)
  const active_features: Record<string, boolean> = {}
  for (const flag of KNOWN_FEATURE_FLAGS) {
    active_features[flag] = formData.get(`feature_${flag}`) === 'true'
  }

  // FormData in Plain Object umwandeln (leere Strings als undefined behandeln)
  const rawData = {
    hostname: formData.get('hostname')?.toString().trim() || undefined,
    medstar_server_url: formData.get('medstar_server_url')?.toString().trim() || undefined,
    fallback_phone: formData.get('fallback_phone')?.toString().trim() || undefined,
    forwarding_phone: formData.get('forwarding_phone')?.toString().trim() || undefined,
    active_features,
  }

  // Zod-Validierung
  const parseResult = settingsSchema.safeParse(rawData)
  if (!parseResult.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const [field, errors] of Object.entries(parseResult.error.flatten().fieldErrors)) {
      if (errors) {
        fieldErrors[field] = errors
      }
    }
    return { error: 'Ungültige Eingabedaten', fieldErrors }
  }

  const updateData = parseResult.data

  // Sicherstellen dass mindestens ein Feld vorhanden ist
  const hasChanges = Object.values(updateData).some((v) => v !== undefined)
  if (!hasChanges) {
    return { error: 'Keine Änderungen vorgenommen.' }
  }

  // Service Role Client: tenants hat kein RLS — Anon-Key Client kann keine Zeilen schreiben
  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('tenants')
    .update(updateData)
    .eq('id', tenantId)

  if (dbError) {
    console.error('[updateTenantAction] DB-Fehler:', dbError.message)
    return { error: 'Fehler beim Speichern der Einstellungen. Bitte versuchen Sie es erneut.' }
  }

  return { success: true }
}
