'use client'

import { useActionState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resetPasswordAction, type ResetPasswordState } from './actions'

const resetSchema = z.object({
  email: z.email(),
})

type ResetFormValues = z.infer<typeof resetSchema>

const initialState: ResetPasswordState = { error: null, success: false }

export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, initialState)

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: '' },
  })

  if (state.success) {
    return (
      <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
        E-Mail gesendet. Bitte prüfen Sie Ihr Postfach und klicken Sie auf den Link zum Zurücksetzen des Passworts.
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-Mail-Adresse</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="name@praxis.at"
          disabled={isPending}
          {...form.register('email')}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
        )}
      </div>

      {state.error && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Wird gesendet...' : 'Passwort zurücksetzen'}
      </Button>

      <p className="text-center text-sm text-gray-500">
        <a href="/auth/login" className="underline hover:text-gray-700">
          Zurück zur Anmeldung
        </a>
      </p>
    </form>
  )
}
