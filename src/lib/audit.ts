import 'server-only'

import { headers } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Logs an audit event to the audit_log table using the service role client.
 * The try/catch ensures audit failure never breaks the primary action.
 *
 * SECURITY: Uses service role client (bypasses RLS) — no user-facing INSERT policy exists.
 * All inserts are made server-side only. Never expose this function to the browser.
 */
export async function logAuditEvent(event: {
  tenantId: string
  userId: string
  action: string
  objectType: string
  objectId?: string
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
}): Promise<void> {
  try {
    const headersList = await headers()
    const ip =
      headersList.get('x-forwarded-for') ??
      headersList.get('x-real-ip') ??
      'unknown'
    const userAgent = headersList.get('user-agent') ?? 'unknown'
    const serviceClient = createServiceRoleClient()
    await serviceClient.from('audit_log').insert({
      tenant_id: event.tenantId,
      user_id: event.userId,
      action: event.action,
      object_type: event.objectType,
      object_id: event.objectId ?? '',
      old_value: event.oldValue ?? null,
      new_value: event.newValue ?? null,
      ip_address: ip,
      user_agent: userAgent,
    })
  } catch {
    // Audit failure must never break the primary action — swallow silently
  }
}
