import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}
