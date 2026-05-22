import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/server'

const revokeSchema = z.object({
  userId: z.uuid(),
})

/**
 * POST /api/admin/revoke-session
 *
 * Sitzungswiderruf für einen Benutzer (D-11, AUTH-06).
 * Ruft supabase.auth.admin.signOut(userId, { scope: 'global' }) auf,
 * um alle aktiven Sitzungen des Benutzers sofort zu invalidieren.
 *
 * Sicherheit: Nur mit Bearer-Token gleich SUPABASE_SERVICE_ROLE_KEY aufrufbar.
 * Dieser Endpunkt ist ausschließlich für server-seitige Aufrufe vorgesehen
 * (z.B. aus Phase-7-RBAC-UI oder n8n-Workflows).
 */
export async function POST(request: NextRequest) {
  // Autorisierung prüfen: Bearer-Token muss dem Service-Role-Key entsprechen
  const authHeader = request.headers.get('Authorization')
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: 'Serverkonfigurationsfehler.' },
      { status: 500 }
    )
  }

  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    return NextResponse.json(
      { ok: false, error: 'Nicht autorisiert.' },
      { status: 401 }
    )
  }

  // Request-Body parsen und validieren
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Ungültiger JSON-Body.' },
      { status: 400 }
    )
  }

  const parsed = revokeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Ungültige userId. UUID erforderlich.' },
      { status: 400 }
    )
  }

  const { userId } = parsed.data

  // Alle Sitzungen des Benutzers widerrufen
  const supabase = createServiceRoleClient()
  const { error } = await supabase.auth.admin.signOut(userId, 'global')

  if (error) {
    return NextResponse.json(
      { ok: false, error: 'Sitzungswiderruf fehlgeschlagen.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
