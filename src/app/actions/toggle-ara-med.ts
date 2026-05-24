'use server'

import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit'
import type { AraStatus } from '@/lib/types'

export interface ToggleAraMedState {
  success?: boolean
  error?: string
  ara_status?: AraStatus
}

const ALLOWED_STATUSES: AraStatus[] = ['active', 'paused', 'error']
const ALLOWED_ROLES = ['operator', 'ordination_admin']

export async function toggleAraMedAction(nextStatus: AraStatus): Promise<ToggleAraMedState> {
  if (!ALLOWED_STATUSES.includes(nextStatus)) {
    return { error: 'Ungültiger Status.' }
  }

  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Nicht authentifiziert.' }
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  const araRole = user.app_metadata?.ara_role as string | undefined

  if (!tenantId) {
    return { error: 'Kein Tenant zugewiesen.' }
  }

  if (!araRole || !ALLOWED_ROLES.includes(araRole)) {
    return { error: 'Unzureichende Berechtigung.' }
  }

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('tenants')
    .update({ ara_status: nextStatus })
    .eq('id', tenantId)

  if (dbError) {
    console.error('[toggleAraMedAction] DB error:', dbError)
    return { error: 'Aktion fehlgeschlagen. Bitte erneut versuchen.' }
  }

  await logAuditEvent({
    tenantId,
    userId: user.id,
    action: 'ARA_MED_TOGGLED',
    objectType: 'tenant',
    objectId: tenantId,
    newValue: { enabled: nextStatus },
  })

  return { success: true, ara_status: nextStatus }
}
