// C9: tenant resolved exclusively from tenant_did_numbers by did_number — never from payload.
// C10: all DB writes use upsert with onConflict — idempotent against duplicate events.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { verifyHmacSignature, HMAC_HEADER } from '@/lib/webhooks/hmac'
import { webhookEventSchema } from '@/lib/webhooks/events'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Step 1: Raw body — MUST read before any other body consumption (HMAC verified on raw bytes)
  const rawBody = await request.text()

  const supabase = createServiceRoleClient()

  // Step 2: Load webhook secret from Vault
  const { data: secret, error: secretError } = await supabase.rpc('get_secret', {
    secret_name: 'n8n_webhook_secret',
  })
  if (secretError || !secret) {
    return NextResponse.json({ ok: false, error: 'Webhook-Konfigurationsfehler.' }, { status: 500 })
  }

  // Step 3: Verify HMAC signature
  if (!verifyHmacSignature(rawBody, request.headers.get(HMAC_HEADER), secret as string)) {
    return NextResponse.json({ ok: false, error: 'Ungültige Signatur.' }, { status: 401 })
  }

  // Step 4: Parse and validate body
  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false, error: 'Ungültiger JSON-Body.' }, { status: 400 })
  }

  const result = webhookEventSchema.safeParse(parsed)
  if (!result.success) {
    return NextResponse.json({ ok: false, error: 'Ungültige Ereignisdaten.' }, { status: 400 })
  }

  const event = result.data

  // Step 5: Resolve tenant by DID — C9 mitigation (never trust payload tenant_id)
  const { data: did } = await supabase
    .from('tenant_did_numbers')
    .select('tenant_id')
    .eq('did_number', event.did_number)
    .limit(1)
    .maybeSingle()

  if (!did) {
    return NextResponse.json({ ok: false, error: 'Unbekannte Rufnummer.' }, { status: 404 })
  }

  const tenantId = did.tenant_id

  // Step 6: Upsert call_log — C10: always upsert, never plain insert
  // Build as Record<string, unknown> to avoid the Supabase generic union constraint on
  // optional fields (TypeScript narrows `status?: string` from completed payload to
  // `string | undefined`, which conflicts with the `status: string` from the started branch).
  const callLogData: Record<string, unknown> =
    event.event_type === 'call.started'
      ? { tenant_id: tenantId, session_id: event.session_id, did_number: event.did_number, status: 'active' }
      : {
          tenant_id: tenantId,
          session_id: event.session_id,
          did_number: event.did_number,
          ...(event.status !== undefined && { status: event.status }),
          ...(event.duration_seconds !== undefined && { duration_seconds: event.duration_seconds }),
          ...(event.intent_main !== undefined && { intent_main: event.intent_main }),
          ...(event.intent_sub !== undefined && { intent_sub: event.intent_sub }),
          ...(event.phone_hash !== undefined && { phone_hash: event.phone_hash }),
          language_code: event.language_code ?? 'de',
          ...(event.summary_short !== undefined && { summary_short: event.summary_short }),
          ...(event.summary_structured !== undefined && { summary_structured: event.summary_structured }),
          ...(event.transcript_text !== undefined && { transcript_text: event.transcript_text }),
          ...(event.pid_status !== undefined && { pid_status: event.pid_status }),
          patient_recognized: event.patient_recognized ?? false,
          inbox_qualifying: event.inbox_qualifying ?? false,
          updated_at: new Date().toISOString(),
        }

  const { data: callLog, error: callLogError } = await supabase
    .from('call_log')
    .upsert(callLogData, { onConflict: 'session_id' })
    .select('id')
    .single()

  if (callLogError || !callLog) {
    console.error('[events] call_log upsert error:', callLogError?.message)
    return NextResponse.json({ ok: false, error: 'Speicherung fehlgeschlagen.' }, { status: 500 })
  }

  // Step 7: Inbox item — only on call.completed with inbox_qualifying
  if (event.event_type === 'call.completed' && event.inbox_qualifying === true) {
    const { error: inboxError } = await supabase.from('inbox_items').upsert(
      {
        tenant_id: tenantId,
        call_log_id: callLog.id,
        case_type: event.case_type ?? 'technical_error',
        status: 'open',
      },
      { onConflict: 'call_log_id' }
    )
    if (inboxError) {
      console.error('[events] inbox_items upsert error:', inboxError.message)
    }
  }

  // Step 8: Success
  return NextResponse.json({ ok: true, call_log_id: callLog.id })
}
