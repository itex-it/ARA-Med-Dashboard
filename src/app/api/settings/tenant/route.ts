import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { AraRole } from '@/lib/types'

// ---------------------------------------------------------------------------
// Zod v4 Validierungsschema für PATCH
// Erlaubte Felder: hostname, medstar_server_url, fallback_phone, forwarding_phone, active_features
// NICHT erlaubt: id, name, require_mfa_level, created_at, api_key — niemals vom Client
// ---------------------------------------------------------------------------

const patchSchema = z.object({
  hostname: z.string().optional(),
  medstar_server_url: z.url().optional(),
  fallback_phone: z.string().optional(),
  forwarding_phone: z.string().optional(),
  active_features: z.record(z.string(), z.boolean()).optional(),
})

// ---------------------------------------------------------------------------
// GET /api/settings/tenant
// Gibt Tenant-Konfiguration zurück (ohne Vault-Secrets)
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  // Authentifizierung: getUser() — niemals getSession()
  const authClient = await createServerClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  // tenant_id aus JWT app_metadata — niemals aus dem Request Body (T-04-01)
  const tenantId = user.app_metadata['tenant_id'] as string | undefined

  if (!tenantId) {
    return NextResponse.json(
      { error: 'Kein Tenant zugewiesen. Bitte wenden Sie sich an den Administrator.' },
      { status: 403 }
    )
  }

  // Service Role Client: tenants hat kein RLS — der Anon-Key Client gibt 0 Zeilen zurück
  const serviceClient = createServiceRoleClient()
  const { data: tenant, error: dbError } = await serviceClient
    .from('tenants')
    .select('name, hostname, medstar_server_url, fallback_phone, forwarding_phone, active_features')
    .eq('id', tenantId)
    .single()

  if (dbError || !tenant) {
    console.error('[GET /api/settings/tenant] DB-Fehler:', dbError?.message)
    return NextResponse.json({ error: 'Tenant nicht gefunden' }, { status: 404 })
  }

  // Vault-Secrets werden NICHT zurückgegeben (T-04-02)
  return NextResponse.json(tenant)
}

// ---------------------------------------------------------------------------
// PATCH /api/settings/tenant
// Aktualisiert Tenant-Konfiguration — nur für operator und ordination_admin
// ---------------------------------------------------------------------------

export async function PATCH(request: Request): Promise<NextResponse> {
  // Authentifizierung: getUser() — niemals getSession()
  const authClient = await createServerClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  // tenant_id und ara_role aus JWT app_metadata — niemals aus dem Request Body (T-04-01, T-04-03)
  const tenantId = user.app_metadata['tenant_id'] as string | undefined
  const araRole = user.app_metadata['ara_role'] as AraRole | undefined

  if (!tenantId) {
    return NextResponse.json(
      { error: 'Kein Tenant zugewiesen. Bitte wenden Sie sich an den Administrator.' },
      { status: 403 }
    )
  }

  // Rollenprüfung: nur operator und ordination_admin dürfen Tenant-Einstellungen ändern (T-04-03)
  const allowedRoles: AraRole[] = ['operator', 'ordination_admin']
  if (!araRole || !allowedRoles.includes(araRole)) {
    return NextResponse.json(
      { error: 'Unzureichende Berechtigung. Nur Operatoren und Adminatoren dürfen Einstellungen ändern.' },
      { status: 403 }
    )
  }

  // Request Body parsen und validieren
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiges JSON im Request Body' }, { status: 400 })
  }

  const parseResult = patchSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Ungültige Eingabedaten', details: parseResult.error.flatten() },
      { status: 422 }
    )
  }

  const updateData = parseResult.data

  // Sicherstellen dass mindestens ein Feld aktualisiert wird
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Keine Felder zum Aktualisieren angegeben' }, { status: 400 })
  }

  // Service Role Client: tenants hat kein RLS (Anon-Key Client kann keine Zeilen schreiben)
  const serviceClient = createServiceRoleClient()
  const { data: updatedTenant, error: dbError } = await serviceClient
    .from('tenants')
    .update(updateData)
    .eq('id', tenantId)
    .select('name, hostname, medstar_server_url, fallback_phone, forwarding_phone, active_features')
    .single()

  if (dbError) {
    console.error('[PATCH /api/settings/tenant] DB-Fehler:', dbError.message)
    return NextResponse.json({ error: 'Fehler beim Aktualisieren der Einstellungen' }, { status: 500 })
  }

  return NextResponse.json(updatedTenant)
}
