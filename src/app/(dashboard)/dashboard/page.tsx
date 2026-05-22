import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const tenantId = user.app_metadata['tenant_id'] as string | undefined
  const araRole = user.app_metadata['ara_role'] as string | undefined

  // Tenant-Rolle aus DB lesen (beweist JWT → RLS → DB-Read-Loop)
  const { data: roleRow } = await supabase
    .from('user_tenant_roles')
    .select('role, tenant_id')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Willkommen</h1>
        <p className="mt-1 text-sm text-gray-500">ARA-Med Voice AI Plattform</p>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Sitzungsinformationen
        </h2>
        <dl className="space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="font-medium text-gray-700 w-32">E-Mail:</dt>
            <dd className="text-gray-900">{user.email ?? '—'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-gray-700 w-32">Mandant (JWT):</dt>
            <dd className="font-mono text-gray-900">{tenantId ?? 'kein Mandant'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-gray-700 w-32">Rolle (JWT):</dt>
            <dd className="text-gray-900">{araRole ?? '—'}</dd>
          </div>
          {roleRow && (
            <>
              <div className="flex gap-2">
                <dt className="font-medium text-gray-700 w-32">Rolle (DB):</dt>
                <dd className="text-gray-900">{roleRow.role}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-gray-700 w-32">Mandant (DB):</dt>
                <dd className="font-mono text-gray-900">{roleRow.tenant_id}</dd>
              </div>
            </>
          )}
        </dl>
      </div>
    </div>
  )
}
