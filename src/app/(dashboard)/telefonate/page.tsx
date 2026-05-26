import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { CallLogTable } from '@/components/calls/CallLogTable'
import { DEFAULT_PERMISSIONS, PERMISSION_LEVEL_ORDER } from '@/lib/permissions'
import type { AraRole, ModulePermissions } from '@/lib/types'

export default async function TelefonatePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const tenantId = (user.app_metadata?.tenant_id as string) ?? ''
  const araRole = (user.app_metadata?.ara_role as AraRole | undefined) ?? 'viewer'

  const { data: roleRow } = await supabase
    .from('user_tenant_roles')
    .select('permissions')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .single()

  const permissions: ModulePermissions =
    roleRow?.permissions && typeof roleRow.permissions === 'object'
      ? (roleRow.permissions as ModulePermissions)
      : DEFAULT_PERMISSIONS[araRole]

  const canView = (module: keyof ModulePermissions) =>
    PERMISSION_LEVEL_ORDER[permissions[module] ?? 'none'] >= PERMISSION_LEVEL_ORDER['view']

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Telefonate</h1>
        <span className="text-xs text-muted-foreground">Echtzeit</span>
      </div>
      <CallLogTable
        tenantId={tenantId}
        canSeeAudio={canView('audio')}
        canSeeTranscript={canView('transkripte')}
        canSeeDetail={canView('telefonate')}
      />
    </div>
  )
}
