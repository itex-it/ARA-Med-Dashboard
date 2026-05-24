import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import type { AraRole } from '@/lib/types'

/**
 * Audit-Log page — stub for Phase 08 Plan 01.
 * Full implementation (date range filter, action filter, paginated table) is in Plan 08-03.
 *
 * Access: operator and ordination_admin only — server-side redirect for all other roles (T-08-02).
 */
export default async function AuditLogPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const araRole = (user.app_metadata?.ara_role as AraRole | undefined) ?? 'viewer'

  if (!['operator', 'ordination_admin'].includes(araRole)) redirect('/dashboard')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Audit-Log</h1>
      </div>
      <p className="text-sm text-gray-500">
        Die Audit-Log-Ansicht wird in Kürze verfügbar sein.
      </p>
    </div>
  )
}
