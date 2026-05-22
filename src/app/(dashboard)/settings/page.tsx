import { redirect } from 'next/navigation'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { TenantRow, AraRole } from '@/lib/types'
import { SettingsForm } from './SettingsForm'

/**
 * Einstellungsseite — Server Component
 *
 * Authentifizierung und Datenbankabfrage erfolgen server-seitig.
 * Das Formular ist in SettingsForm.tsx (Client Component) ausgelagert,
 * damit useActionState (React 19) für Server Action Feedback genutzt werden kann.
 *
 * Sicherheit:
 * - tenant_id aus JWT app_metadata (niemals aus URL oder Request Body)
 * - createServiceRoleClient() für DB-Abfrage (tenants hat kein RLS)
 * - Keine API-Schlüssel oder Vault-Secrets werden gerendert
 */
export default async function SettingsPage() {
  // Authentifizierung: getUser() — niemals getSession()
  const authClient = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) {
    redirect('/auth/login')
  }

  // tenant_id aus JWT app_metadata — niemals aus URL oder Request (T-04-01)
  const tenantId = user.app_metadata['tenant_id'] as string | undefined
  const araRole = user.app_metadata['ara_role'] as AraRole | undefined

  if (!tenantId) {
    redirect('/auth/login')
  }

  // Rollenprüfung für Bearbeitbarkeit des Formulars
  const canEdit: boolean = araRole === 'operator' || araRole === 'ordination_admin'

  // Service Role Client: tenants hat kein RLS
  // Der Anon-Key createServerClient() gibt 0 Zeilen zurück — Service Role ist Pflicht
  const serviceClient = createServiceRoleClient()
  const { data: tenant, error: dbError } = await serviceClient
    .from('tenants')
    .select(
      'name, hostname, medstar_server_url, fallback_phone, forwarding_phone, active_features'
    )
    .eq('id', tenantId)
    .single<Pick<
      TenantRow,
      | 'name'
      | 'hostname'
      | 'medstar_server_url'
      | 'fallback_phone'
      | 'forwarding_phone'
      | 'active_features'
    >>()

  if (dbError || !tenant) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Tenant-Konfiguration konnte nicht geladen werden. Bitte wenden Sie sich an den
          Administrator.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Seitenheader */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>
        <p className="mt-1 text-sm text-gray-500">
          Konfigurieren Sie Ihre Praxiseinstellungen und aktivierte Funktionen.
        </p>
      </div>

      {/* Datenschutz-Hinweis (T-04-02: Vault-Secrets niemals sichtbar) */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
        API-Schlüssel werden sicher im Vault gespeichert und sind hier nicht sichtbar.
      </div>

      {/* Formular als Client Component (useActionState für Server Action Feedback) */}
      <SettingsForm tenant={tenant} canEdit={canEdit} />
    </div>
  )
}
