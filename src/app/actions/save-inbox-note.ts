'use server'

import { z } from 'zod'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

export interface SaveInboxNoteState {
  success?: boolean
  error?: string
}

const saveInboxNoteSchema = z.object({
  itemId: z.string().uuid(),
  note: z.string().max(4000),
})

// No ALLOWED_ROLES gate — any authenticated tenant user can save notes (INBOX-05)

export async function saveInboxNoteAction(
  itemId: string,
  note: string,
): Promise<SaveInboxNoteState> {
  // 1. Zod validation
  const parsed = saveInboxNoteSchema.safeParse({ itemId, note })
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

  // 4. Service-role write — sync (no await on createServiceRoleClient)
  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('inbox_items')
    .update({
      internal_note: parsed.data.note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.itemId)
    .eq('tenant_id', tenantId) // Defense-in-depth: forged itemId from another tenant → zero rows (T-04-05)

  if (dbError) {
    console.error('[saveInboxNoteAction] DB error:', dbError)
    return { error: 'Notiz konnte nicht gespeichert werden.' }
  }

  return { success: true }
}
