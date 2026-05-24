import { redirect } from 'next/navigation'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { BenutzerTable } from '@/components/users/BenutzerTable'
import type { AraRole, ModulePermissions, TenantUserDisplay } from '@/lib/types'

export default async function BenutzerPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const tenantId = (user.app_metadata?.tenant_id as string) ?? ''
  const araRole = (user.app_metadata?.ara_role as AraRole | undefined) ?? 'viewer'

  if (!['operator', 'ordination_admin'].includes(araRole)) redirect('/dashboard')

  const serviceClient = createServiceRoleClient()

  const [rolesResult, authUsersResult] = await Promise.all([
    serviceClient
      .from('user_tenant_roles')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at'),
    serviceClient.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const emailMap = new Map(
    (authUsersResult.data?.users ?? []).map((u) => [
      u.id,
      { email: u.email ?? '', last_sign_in_at: u.last_sign_in_at ?? null },
    ]),
  )

  const tenantUsers: TenantUserDisplay[] = (rolesResult.data ?? []).map((utr) => ({
    id: utr.user_id,
    email: emailMap.get(utr.user_id)?.email ?? '(unbekannt)',
    role: utr.role as AraRole,
    permissions: (utr.permissions ?? {}) as Partial<ModulePermissions>,
    active: utr.active,
    created_at: utr.created_at,
    last_sign_in_at: emailMap.get(utr.user_id)?.last_sign_in_at ?? null,
  }))

  // Get caller's own permissions for delegation ceiling in UI
  const myRole = rolesResult.data?.find((r) => r.user_id === user.id)
  const myPermissions = (myRole?.permissions ?? {}) as Partial<ModulePermissions>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Benutzerverwaltung</h1>
        <span className="text-sm text-gray-500">{tenantUsers.length} Benutzer</span>
      </div>
      <BenutzerTable
        users={tenantUsers}
        currentUserRole={araRole}
        currentUserId={user.id}
        currentUserPermissions={myPermissions}
      />
    </div>
  )
}
