// CALL-04/CALL-10: Returns call_actions for a given call_log entry.
// Gated on canSeeDetail (caller checks permission before calling this route).
// Defense-in-depth: verifies call.tenant_id === JWT tenant_id even though service-role is used.
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response(null, { status: 401 })
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) {
    return new Response(null, { status: 401 })
  }

  const serviceClient = createServiceRoleClient()

  // Verify the call belongs to the authenticated tenant
  const { data: call, error: callError } = await serviceClient
    .from('call_log')
    .select('tenant_id')
    .eq('id', id)
    .single()

  if (callError || !call) {
    return new Response(null, { status: 404 })
  }

  if (call.tenant_id !== tenantId) {
    return new Response(null, { status: 403 })
  }

  // Fetch call_actions — exclude detail column (health-sensitive, DSGVO C6)
  const { data: actions, error: actionsError } = await serviceClient
    .from('call_actions')
    .select('id, tenant_id, call_log_id, action_type, medstar_status, created_at')
    .eq('call_log_id', id)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (actionsError) {
    return new Response(null, { status: 500 })
  }

  return NextResponse.json({ actions: actions ?? [] })
}
