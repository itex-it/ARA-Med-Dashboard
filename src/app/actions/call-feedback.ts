'use server'

import { z } from 'zod'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { FeedbackLabel } from '@/lib/types'

export interface CallFeedbackState {
  success?: boolean
  error?: string
}

const feedbackSchema = z.object({
  callId: z.string().uuid(),
  internalNote: z.string().max(4000).optional(),
  intentCorrected: z.string().max(200).optional(),
  feedbackLabel: z.enum(['correct', 'incorrect', 'needs_training']).nullable().optional(),
})

export async function saveCallFeedbackAction(input: {
  callId: string
  internalNote?: string
  intentCorrected?: string
  feedbackLabel?: FeedbackLabel | null
}): Promise<CallFeedbackState> {
  const parsed = feedbackSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Ungültige Eingabe.' }
  }

  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Nicht authentifiziert.' }
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) {
    return { error: 'Kein Tenant zugewiesen.' }
  }

  const { callId, internalNote, intentCorrected, feedbackLabel } = parsed.data

  // Build update object — only include fields that were explicitly provided
  const updateData: Record<string, unknown> = {}
  if (internalNote !== undefined) updateData.internal_note = internalNote
  if (intentCorrected !== undefined) updateData.intent_corrected = intentCorrected
  if (feedbackLabel !== undefined) updateData.feedback_label = feedbackLabel

  if (Object.keys(updateData).length === 0) {
    return { success: true }
  }

  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('call_log')
    .update(updateData)
    .eq('id', callId)
    .eq('tenant_id', tenantId) // Defense-in-depth: forged callId from another tenant matches zero rows

  if (dbError) {
    console.error('[saveCallFeedbackAction] DB error:', dbError)
    return { error: 'Notiz konnte nicht gespeichert werden.' }
  }

  return { success: true }
}
