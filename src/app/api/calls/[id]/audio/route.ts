// Never cache, never expose at page-load (STATE.md C7 — audio URLs are on-demand, 15-min expiry)
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
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
  const { data: call, error } = await serviceClient
    .from('call_log')
    .select('audio_url, tenant_id')
    .eq('id', id)
    .single()

  if (error || !call) {
    return new Response(null, { status: 404 })
  }

  // Defense-in-depth: service-role bypasses RLS — verify tenant manually
  if (call.tenant_id !== tenantId) {
    return new Response(null, { status: 403 })
  }

  if (!call.audio_url) {
    return new Response(null, { status: 404 })
  }

  // If audio_url is already a full https URL (external/legacy), use it directly
  if (call.audio_url.startsWith('https://') || call.audio_url.startsWith('http://')) {
    return NextResponse.json({ url: call.audio_url })
  }

  // Generate 15-minute (900s) presigned URL from Supabase Storage
  const { data: signed, error: signError } = await serviceClient.storage
    .from('call-recordings')
    .createSignedUrl(call.audio_url, 900)

  if (signError || !signed?.signedUrl) {
    return new Response(null, { status: 404 })
  }

  return NextResponse.json({ url: signed.signedUrl })
}
