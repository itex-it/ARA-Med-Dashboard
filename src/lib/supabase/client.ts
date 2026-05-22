import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'

/**
 * Erstellt einen Supabase Browser-Client.
 * NUR für Client Components ('use client') verwenden.
 *
 * Kein Singleton auf Modul-Ebene — Komponenten rufen createClient() auf
 * und halten die Instanz im lokalen State oder Ref.
 *
 * SICHERHEIT: Dieser Client verwendet nur den Anon Key (NEXT_PUBLIC_).
 * Der Service Role Key ist in dieser Datei niemals erlaubt.
 */
export function createClient() {
  return createSSRBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
