import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { StatusBar } from '@/components/status/StatusBar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const tenantId = (user.app_metadata?.tenant_id as string | undefined) ?? ''
  const araRole = (user.app_metadata?.ara_role as string | undefined) ?? ''
  const canToggle = ['operator', 'ordination_admin'].includes(araRole)

  return (
    <div className="flex min-h-screen">
      {/* Linke Navigationsleiste */}
      <aside className="flex w-32 flex-col border-r bg-white px-3 py-6">
        <div className="mb-6">
          <span className="text-sm font-bold text-gray-900">ARA-Med</span>
        </div>
        <nav className="flex flex-col gap-1 text-sm">
          <a
            href="/dashboard"
            className="rounded px-2 py-1.5 text-gray-700 hover:bg-gray-100"
          >
            Übersicht
          </a>
          <a
            href="/telefonate"
            className="rounded px-2 py-1.5 text-gray-700 hover:bg-gray-100"
          >
            Telefonate
          </a>
          <a
            href="/inbox"
            className="rounded px-2 py-1.5 text-gray-700 hover:bg-gray-100"
          >
            Inbox
          </a>
          <a
            href="/statistiken"
            className="rounded px-2 py-1.5 text-gray-700 hover:bg-gray-100"
          >
            Statistiken
          </a>
          <a
            href="/konfiguration"
            className="rounded px-2 py-1.5 text-gray-700 hover:bg-gray-100"
          >
            Konfiguration
          </a>
          {['operator', 'ordination_admin'].includes(araRole) && (
            <a
              href="/benutzer"
              className="rounded px-2 py-1.5 text-gray-700 hover:bg-gray-100"
            >
              Benutzer
            </a>
          )}
          {['operator', 'ordination_admin'].includes(araRole) && (
            <a
              href="/audit-log"
              className="rounded px-2 py-1.5 text-gray-700 hover:bg-gray-100"
            >
              Audit-Log
            </a>
          )}
          <a
            href="/settings"
            className="rounded px-2 py-1.5 text-gray-700 hover:bg-gray-100"
          >
            Einstellungen
          </a>
        </nav>
        <div className="mt-auto">
          <a
            href="/auth/logout"
            className="block rounded px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
          >
            Abmelden
          </a>
        </div>
      </aside>

      {/* Hauptbereich */}
      <main className="flex flex-1 flex-col bg-gray-50">
        <div className="flex items-center border-b px-6 py-2">
          <StatusBar tenantId={tenantId} canToggle={canToggle} />
        </div>
        <div className="flex-1 p-6">{children}</div>
      </main>
    </div>
  )
}
