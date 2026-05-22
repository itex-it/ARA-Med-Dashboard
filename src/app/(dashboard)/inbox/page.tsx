import { createServerClient } from '@/lib/supabase/server'
import { InboxTable } from '@/components/inbox/InboxTable'

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const params = await searchParams
  const initialFilter = params.filter ?? 'alle'

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const tenantId = user?.app_metadata?.tenant_id ?? ''
  const araRole = (user?.app_metadata?.ara_role as string | undefined) ?? ''

  // Phase 7 RBAC will compute per-user permission values from user_tenant_roles.permissions
  // For Phase 4: use ara_role as permission proxy
  const hasEditRight = ['operator', 'ordination_admin'].includes(araRole)
  const hasManageRight = ['operator', 'ordination_admin'].includes(araRole)
  const hasCallDetail = true // all authenticated users for MVP

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Inbox</h1>
        <span className="text-xs text-muted-foreground">Echtzeit</span>
      </div>
      <InboxTable
        tenantId={tenantId}
        initialFilter={initialFilter}
        hasEditRight={hasEditRight}
        hasManageRight={hasManageRight}
        hasCallDetail={hasCallDetail}
      />
    </div>
  )
}
