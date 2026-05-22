'use server'

import { z } from 'zod'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { InboxStatus } from '@/lib/types'

export interface UpdateInboxStatusState {
  success?: boolean
  error?: string
  newStatus?: InboxStatus
}

const updateInboxStatusSchema = z.object({
  itemId: z.string().uuid(),
  newStatus: z.enum(['open', 'in_progress', 'resolved', 'archived']),
})

const ALLOWED_ROLES = ['operator', 'ordination_admin']

export async function updateInboxStatusAction(
  itemId: string,
  newStatus: InboxStatus,
): Promise<UpdateInboxStatusState> {
  // 1. Zod validation — check before any auth call
  const parsed = updateInboxStatusSchema.safeParse({ itemId, newStatus })
  if (!parsed.success) {
    return { error: 'Ungültige Eingabe.' }
  }

  // 2. Auth — createServerClient must be awaited (STATE.md locked)
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Nicht authentifiziert.' }
  }

  // 3. Tenant ID from JWT app_metadata
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) {
    return { error: 'Kein Tenant zugewiesen.' }
  }

  // 4. Role gate — service-role bypasses RLS UPDATE policy, so app-level check is mandatory
  const araRole = user.app_metadata?.ara_role as string | undefined
  if (!araRole || !ALLOWED_ROLES.includes(araRole)) {
    return { error: 'Unzureichende Berechtigung.' }
  }

  // 5. Service-role write — sync (no await on createServiceRoleClient)
  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('inbox_items')
    .update({
      status: parsed.data.newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.itemId)
    .eq('tenant_id', tenantId) // Defense-in-depth: forged itemId from another tenant → zero rows

  if (dbError) {
    console.error('[updateInboxStatusAction] DB error:', dbError)
    return { error: 'Statusänderung fehlgeschlagen. Bitte erneut versuchen.' }
  }

  return { success: true, newStatus: parsed.data.newStatus }
}
