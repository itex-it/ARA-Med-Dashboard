import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export default async function StatistikenPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Statistiken</h1>
      </div>
      <div className="rounded-lg border bg-white p-6 text-sm text-muted-foreground">
        Statistiken werden geladen…
      </div>
    </div>
  )
}
