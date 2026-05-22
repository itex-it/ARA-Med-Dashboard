import { createServerClient } from '@/lib/supabase/server'
import { CallLogTable } from '@/components/calls/CallLogTable'

export default async function TelefonatePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = user?.app_metadata?.tenant_id ?? ''

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Telefonate</h1>
        <span className="text-xs text-muted-foreground">Echtzeit</span>
      </div>
      {/* Phase 7 RBAC will compute per-user permission values server-side from user_tenant_roles.permissions */}
      <CallLogTable
        tenantId={tenantId}
        canSeeAudio={true}
        canSeeTranscript={true}
        canSeeDetail={true}
      />
    </div>
  )
}
