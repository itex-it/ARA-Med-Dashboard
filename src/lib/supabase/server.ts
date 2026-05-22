import 'server-only'

import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Erstellt einen Supabase Server-Client mit dem Anon Key.
 * Geeignet für Server Components, API Routes und Server Actions.
 * Verwendet Cookie-Store für Session-Management.
 *
 * SICHERHEIT: Diese Funktion darf NICHT in Client Components verwendet werden.
 * Die 'server-only' Importwache verhindert versehentliche Browser-Nutzung.
 */
export async function createServerClient() {
  const cookieStore = await cookies()

  return createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll wird in Server Components aufgerufen wo Cookies nicht geschrieben werden können.
            // Wird ignoriert wenn proxy.ts die Session-Aktualisierung übernimmt.
          }
        },
      },
    }
  )
}

/**
 * Erstellt einen Supabase Service-Role-Client mit dem Service Role Key.
 * Umgeht RLS vollständig — NUR für API Routes und Server Actions verwenden.
 *
 * SICHERHEIT: Dieser Client hat vollen DB-Zugriff.
 * NIEMALS im Browser-Bundle verwenden.
 * NIEMALS den SUPABASE_SERVICE_ROLE_KEY mit NEXT_PUBLIC_ Prefix versehen.
 */
export function createServiceRoleClient() {
  return createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // Service Role Client benötigt kein Cookie-Management
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
