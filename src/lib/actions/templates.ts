'use server'

import 'server-only'

import { z } from 'zod'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Role Gate
// ---------------------------------------------------------------------------

const ALLOWED_ROLES = ['operator', 'ordination_admin'] as const

// ---------------------------------------------------------------------------
// Action State Interface
// ---------------------------------------------------------------------------

export type TemplateActionState = {
  success?: boolean
  error?: string
  id?: string
  deactivated_rules?: number
}

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const templateBaseSchema = z
  .object({
    name: z.string().min(1, 'Dieses Feld ist erforderlich.'),
    channel: z.enum(['email', 'sms', 'telegram']),
    language_code: z.enum(['de', 'en']).default('de'),
    subject: z.string().optional().nullable(),
    body: z.string().min(1, 'Dieses Feld ist erforderlich.'),
  })
  .refine((d) => d.channel !== 'email' || (d.subject && d.subject.length > 0), {
    message: 'Betreff ist für E-Mail-Vorlagen erforderlich.',
    path: ['subject'],
  })

const createTemplateSchema = templateBaseSchema

const updateTemplateSchema = templateBaseSchema.extend({
  id: z.string().uuid(),
})

const deleteTemplateSchema = z.object({
  id: z.string().uuid(),
})

// ---------------------------------------------------------------------------
// Auth helper — shared sequence per update-inbox-status.ts locked pattern
// ---------------------------------------------------------------------------

async function getAuthedTenantId(): Promise<
  { tenantId: string; error?: undefined } | { tenantId?: undefined; error: string }
> {
  // Step 1: Auth — createServerClient must be awaited
  const authClient = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) {
    return { error: 'Nicht authentifiziert.' }
  }

  // Step 2: Tenant ID from JWT app_metadata — never from request body
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) {
    return { error: 'Kein Tenant zugewiesen.' }
  }

  // Step 3: Role gate
  const araRole = user.app_metadata?.ara_role as string | undefined
  if (!araRole || !(ALLOWED_ROLES as readonly string[]).includes(araRole)) {
    return { error: 'Unzureichende Berechtigung.' }
  }

  return { tenantId }
}

// ---------------------------------------------------------------------------
// 1. createTemplateAction
// ---------------------------------------------------------------------------

export async function createTemplateAction(
  prevState: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  // Zod parse
  const raw = {
    name: formData.get('name')?.toString().trim() ?? '',
    channel: formData.get('channel')?.toString() ?? '',
    language_code: formData.get('language_code')?.toString() ?? 'de',
    subject: formData.get('subject')?.toString() || null,
    body: formData.get('body')?.toString().trim() ?? '',
  }

  const parsed = createTemplateSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  const auth = await getAuthedTenantId()
  if (auth.error) return { error: auth.error }
  const { tenantId } = auth

  // Step 4: Service-role write — sync (no await on createServiceRoleClient)
  const serviceClient = createServiceRoleClient()
  const { data, error: dbError } = await serviceClient
    .from('message_templates')
    .insert({
      ...parsed.data,
      tenant_id: tenantId,
      version: 1,
    })
    .select('id')
    .single()

  if (dbError) {
    console.error('[createTemplateAction] DB error:', dbError)
    return { error: 'Vorlage konnte nicht gespeichert werden. Bitte erneut versuchen.' }
  }

  return { success: true, id: data.id }
}

// ---------------------------------------------------------------------------
// 2. updateTemplateAction
// ---------------------------------------------------------------------------

export async function updateTemplateAction(
  prevState: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  // Zod parse
  const raw = {
    id: formData.get('id')?.toString() ?? '',
    name: formData.get('name')?.toString().trim() ?? '',
    channel: formData.get('channel')?.toString() ?? '',
    language_code: formData.get('language_code')?.toString() ?? 'de',
    subject: formData.get('subject')?.toString() || null,
    body: formData.get('body')?.toString().trim() ?? '',
  }

  const parsed = updateTemplateSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  }

  const auth = await getAuthedTenantId()
  if (auth.error) return { error: auth.error }
  const { tenantId } = auth

  const { id, ...updateData } = parsed.data

  // Fetch current version — Defense-in-depth: both eq filters
  const serviceClient = createServiceRoleClient()
  const { data: curr } = await serviceClient
    .from('message_templates')
    .select('version')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  const { error: dbError } = await serviceClient
    .from('message_templates')
    .update({
      ...updateData,
      tenant_id: tenantId,
      version: (curr?.version ?? 1) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId) // Defense-in-depth: forged id from another tenant → zero rows

  if (dbError) {
    console.error('[updateTemplateAction] DB error:', dbError)
    return { error: 'Vorlage konnte nicht aktualisiert werden. Bitte erneut versuchen.' }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// 3. deleteTemplateAction
// ---------------------------------------------------------------------------

export async function deleteTemplateAction(
  prevState: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  // Zod parse
  const raw = { id: formData.get('id')?.toString() ?? '' }

  const parsed = deleteTemplateSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: 'Ungültige ID.' }
  }

  const auth = await getAuthedTenantId()
  if (auth.error) return { error: auth.error }
  const { tenantId } = auth

  const { id } = parsed.data
  const serviceClient = createServiceRoleClient()

  // Step 1: Deactivate active comm_rules referencing this template
  const { data: deactivated } = await serviceClient
    .from('comm_rules')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('template_id', id)
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .select('id')

  const deactivatedCount = deactivated?.length ?? 0

  // Step 2: Delete the template — both eq filters mandatory
  const { error: dbError } = await serviceClient
    .from('message_templates')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId) // Defense-in-depth: forged id from another tenant → zero rows

  if (dbError) {
    console.error('[deleteTemplateAction] DB error:', dbError)
    return { error: 'Vorlage konnte nicht entfernt werden. Bitte erneut versuchen.' }
  }

  return { success: true, deactivated_rules: deactivatedCount }
}
