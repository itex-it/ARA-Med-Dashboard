'use server'

import { z } from 'zod'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// EU AI Act Art. 50 — server-side constant, NEVER derived from client input
// ---------------------------------------------------------------------------
const EU_AI_ACT_DISCLOSURE = 'Sie sprechen mit einem KI-gestützten Telefonsystem.'

const ALLOWED_ROLES = ['operator', 'ordination_admin']

// ---------------------------------------------------------------------------
// Action state types
// ---------------------------------------------------------------------------
export interface GreetingTextActionState {
  success?: boolean
  error?: string
}

export interface FaqActionState {
  success?: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

// NOTE: eu_ai_act_disclosure is intentionally NOT in this schema.
// The server action sets it unconditionally to the server-side constant.
const saveGreetingTextSchema = z.object({
  mode: z.enum(['normal', 'vacation', 'deputy', 'own_service']),
  user_text: z.string(),
})

const addFaqSchema = z.object({
  mode: z.enum(['all', 'normal', 'vacation', 'deputy', 'own_service']),
  question: z.string().min(1, 'Dieses Feld ist erforderlich.'),
  answer: z.string().min(1, 'Dieses Feld ist erforderlich.'),
})

const deleteFaqSchema = z.object({
  id: z.string().uuid(),
})

// ---------------------------------------------------------------------------
// Auth helper — canonical pattern from update-inbox-status.ts
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
// saveGreetingTextAction — upsert greeting text for a mode
// eu_ai_act_disclosure is ALWAYS set server-side — client cannot influence it.
// ---------------------------------------------------------------------------
export async function saveGreetingTextAction(
  prevState: GreetingTextActionState,
  formData: FormData,
): Promise<GreetingTextActionState> {
  const raw = {
    mode: formData.get('mode')?.toString() ?? '',
    user_text: formData.get('user_text')?.toString() ?? '',
  }

  const parsed = saveGreetingTextSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  const authResult = await getAuthContext()
  if ('error' in authResult) {
    return { error: authResult.error }
  }
  const { tenantId } = authResult

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('greeting_texts')
    .upsert(
      {
        tenant_id: tenantId,
        mode: parsed.data.mode,
        language_code: 'de',
        eu_ai_act_disclosure: EU_AI_ACT_DISCLOSURE,
        eu_ai_act_disclosure_present: true,
        user_text: parsed.data.user_text,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,mode,language_code' },
    )

  if (dbError) {
    console.error('[saveGreetingTextAction] DB error:', dbError)
    return { error: 'Fehler beim Speichern. Bitte erneut versuchen.' }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// addFaqEntryAction — insert a new FAQ entry for a given mode
// ---------------------------------------------------------------------------
export async function addFaqEntryAction(data: {
  mode: string
  question: string
  answer: string
}): Promise<FaqActionState> {
  const parsed = addFaqSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  const authResult = await getAuthContext()
  if ('error' in authResult) {
    return { error: authResult.error }
  }
  const { tenantId } = authResult

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient.from('faq_entries').insert({
    tenant_id: tenantId,
    mode: parsed.data.mode,
    question: parsed.data.question,
    answer: parsed.data.answer,
    active: true,
    sort_order: 0,
  })

  if (dbError) {
    console.error('[addFaqEntryAction] DB error:', dbError)
    return { error: 'Fehler beim Hinzufügen. Bitte erneut versuchen.' }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// deleteFaqEntryAction — delete a FAQ entry, scoped to tenant (defense-in-depth)
// ---------------------------------------------------------------------------
export async function deleteFaqEntryAction(data: {
  id: string
}): Promise<FaqActionState> {
  const parsed = deleteFaqSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  const authResult = await getAuthContext()
  if ('error' in authResult) {
    return { error: authResult.error }
  }
  const { tenantId } = authResult

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('faq_entries')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId) // Defense-in-depth: forged id from another tenant → zero rows

  if (dbError) {
    console.error('[deleteFaqEntryAction] DB error:', dbError)
    return { error: 'Fehler beim Löschen. Bitte erneut versuchen.' }
  }

  return { success: true }
}
