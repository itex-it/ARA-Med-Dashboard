'use server'

import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

const resetSchema = z.object({
  email: z.email(),
})

export type ResetPasswordState = {
  error: string | null
  success: boolean
}

export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const raw = { email: formData.get('email') }
  const parsed = resetSchema.safeParse(raw)

  if (!parsed.success) {
    return { error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.', success: false }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const supabase = await createServerClient()

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/auth/update-password`,
  })

  if (error) {
    return { error: 'Beim Zurücksetzen des Passworts ist ein Fehler aufgetreten.', success: false }
  }

  return { error: null, success: true }
}
