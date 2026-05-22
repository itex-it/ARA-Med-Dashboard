import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { AraRole } from '@/lib/types'

/**
 * ARA-MED Auth Proxy (Next.js 16 — proxy.ts ersetzt middleware.ts)
 *
 * Aufgaben:
 * 1. Auth-Token-Refresh: Session-Cookies von Request auf Response kopieren
 * 2. Unauthentifizierte Benutzer → /auth/login umleiten
 * 3. AAL2-Erzwingung: Operator und Ordinations-Admin ohne TOTP → /auth/verify-totp
 *
 * SICHERHEIT:
 * - Verwendet IMMER supabase.auth.getUser() — NIEMALS getSession()
 *   getUser() validiert das Token beim Auth-Server neu (erkennt widerrufene Sessions)
 *   getSession() liest nur das lokale Cookie ohne Server-Validierung
 * - AAL-Prüfung über mfa.getAuthenticatorAssuranceLevel() — nicht über JWT-Claims direkt
 */
export async function proxy(request: NextRequest) {
  // Response-Objekt erstellen, das wir mit aktualisierten Cookies versehen werden
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Supabase Server-Client für den Proxy-Kontext erstellen
  // Cookies werden zwischen Request und Response synchronisiert
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          // Cookies auf den Request setzen (für den Fall weiterer Verarbeitung)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Neue Response mit aktualisierten Cookies erstellen
          supabaseResponse = NextResponse.next({
            request,
          })
          // Cookies auf die Response setzen (für den Browser)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // WICHTIG: getUser() statt getSession() verwenden!
  // getUser() macht einen Server-Aufruf zur Validierung — erkennt widerrufene Sessions.
  // getSession() liest nur den lokalen JWT-Cache — unsicher für Auth-Entscheidungen.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Nicht-authentifizierte Benutzer zu /auth/login umleiten
  // Ausnahme: /auth/* Routen sind öffentlich zugänglich
  if (!user && !pathname.startsWith('/auth')) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/auth/login'
    return NextResponse.redirect(redirectUrl)
  }

  // AAL2-Erzwingung für privilegierte Rollen
  if (user) {
    // AAL-Level vom Auth-Server abrufen
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

    // Rolle aus app_metadata lesen (server-seitig geschrieben durch Custom Access Token Hook)
    // app_metadata kann vom Benutzer nicht manipuliert werden
    const araRole = user.app_metadata?.['ara_role'] as AraRole | undefined

    // Privilegierte Rollen erfordern AAL2 (TOTP bestätigt)
    const requiresAal2 =
      araRole === 'operator' || araRole === 'ordination_admin'

    // AAL2-Check: Falls Rolle AAL2 erfordert aber nur AAL1 vorhanden
    const isAal2Exempt =
      pathname.startsWith('/auth/setup-totp') ||
      pathname.startsWith('/auth/verify-totp')

    if (
      requiresAal2 &&
      aalData?.currentLevel !== 'aal2' &&
      !isAal2Exempt
    ) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/auth/verify-totp'
      return NextResponse.redirect(redirectUrl)
    }
  }

  // WICHTIG: Die supabaseResponse zurückgeben (enthält aktualisierte Session-Cookies)
  // Niemals eine neue NextResponse erstellen ohne die Supabase-Cookies zu übernehmen
  return supabaseResponse
}

/**
 * Konfiguration: Welche Routen der Proxy verarbeitet
 *
 * Ausgeschlossen:
 * - _next/static: Statische Assets (JS, CSS Bundles)
 * - _next/image: Next.js Image Optimization
 * - favicon.ico: Browser-Tab Icon
 * - Bilddateien: SVG, PNG, JPG, etc.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
