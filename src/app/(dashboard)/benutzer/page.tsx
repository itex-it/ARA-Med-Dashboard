import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export default async function BenutzerPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const araRole = (user.app_metadata?.ara_role as string | undefined) ?? ''

  if (!['operator', 'ordination_admin'].includes(araRole)) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Benutzerverwaltung</h1>
      </div>
      <div className="rounded-lg border bg-white p-6 text-sm text-muted-foreground">
        Benutzer werden geladen…
      </div>
    </div>
  )
}
