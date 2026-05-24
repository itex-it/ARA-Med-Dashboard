import { redirect } from 'next/navigation'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { AraRole, AuditLogRow } from '@/lib/types'
import AuditLogTable from '@/components/audit/AuditLogTable'
import AuditLogFilters from '@/components/audit/AuditLogFilters'

/**
 * Audit-Log page — full implementation (AUDIT-03).
 * Access: operator and ordination_admin only (T-08-07).
 * Filters: ?tage=7/30/90, ?action=<ACTION_CONSTANT>
 * Double isolation: JWT tenant_id + explicit .eq('tenant_id') + RLS (T-08-08).
 */
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ tage?: string; action?: string }>
}) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const araRole = (user.app_metadata?.ara_role as AraRole | undefined) ?? 'viewer'

  if (!['operator', 'ordination_admin'].includes(araRole)) redirect('/dashboard')

  const tenantId = (user.app_metadata?.tenant_id as string) ?? ''

  // Parse URL filter params
  const params = await searchParams
  const rawDays = parseInt(params.tage ?? '7', 10)
  const days = [7, 30, 90].includes(rawDays) ? rawDays : 7
  const actionFilter = params.action ?? ''

  const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const serviceClient = createServiceRoleClient()

  // Build base audit query
  let auditQuery = serviceClient
    .from('audit_log')
    .select('id, action, object_type, object_id, user_id, old_value, new_value, ip_address, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', dateFrom.toISOString())
    .order('created_at', { ascending: false })
    .limit(500)

  if (actionFilter) {
    auditQuery = auditQuery.eq('action', actionFilter)
  }

  // Parallel fetches: audit rows, auth users, distinct actions for dropdown
  const [auditResult, authUsersResult, actionsResult] = await Promise.all([
    auditQuery,
    serviceClient.auth.admin.listUsers({ perPage: 1000 }),
    serviceClient
      .from('audit_log')
      .select('action')
      .eq('tenant_id', tenantId)
      .order('action'),
  ])

  // Build email lookup map
  const userEmailMap = new Map<string, string>(
    (authUsersResult.data?.users ?? []).map((u) => [u.id, u.email ?? u.id]),
  )

  // Build deduplicated action list for dropdown
  const actionSet = new Set<string>()
  for (const row of actionsResult.data ?? []) {
    if (row.action) actionSet.add(row.action as string)
  }
  const availableActions = Array.from(actionSet).sort()

  const auditRows = (auditResult.data ?? []) as AuditLogRow[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit-Log</h1>
        <p className="mt-1 text-sm text-gray-500">
          Alle sicherheitsrelevanten Änderungen für Ihren Mandanten.
        </p>
      </div>

      <AuditLogFilters
        currentDays={days}
        currentAction={actionFilter}
        availableActions={availableActions}
      />

      <AuditLogTable rows={auditRows} userEmailMap={userEmailMap} />

      {auditRows.length === 500 && (
        <p className="text-center text-xs text-gray-500">
          Maximale Anzahl von 500 Einträgen angezeigt. Filtern Sie den Zeitraum für ältere Einträge.
        </p>
      )}
    </div>
  )
}
