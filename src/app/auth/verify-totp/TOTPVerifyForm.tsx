'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type VerifyPhase = 'loading' | 'ready' | 'submitting' | 'error'

interface VerifyState {
  phase: VerifyPhase
  factorId: string
  errorMessage: string
}

const initialState: VerifyState = {
  phase: 'loading',
  factorId: '',
  errorMessage: '',
}

export function TOTPVerifyForm() {
  const router = useRouter()
  const [state, setState] = useState<VerifyState>(initialState)
  const [code, setCode] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (error || !data || data.totp.length === 0) {
        setState((prev) => ({
          ...prev,
          phase: 'error',
          errorMessage:
            'Kein Zwei-Faktor-Faktor gefunden. Bitte richten Sie die Authentifizierung zuerst ein.',
        }))
        return
      }
      const factor = data.totp[0]
      if (!factor) {
        setState((prev) => ({
          ...prev,
          phase: 'error',
          errorMessage: 'Kein TOTP-Faktor konfiguriert.',
        }))
        return
      }
      setState((prev) => ({ ...prev, phase: 'ready', factorId: factor.id }))
    })
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (state.phase !== 'ready') return

    setSubmitError(null)
    setState((prev) => ({ ...prev, phase: 'submitting' }))

    const supabase = createClient()

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: state.factorId,
    })

    if (challengeError || !challengeData) {
      setState((prev) => ({ ...prev, phase: 'ready' }))
      setSubmitError('Fehler beim Starten der Verifizierung. Bitte versuchen Sie es erneut.')
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: state.factorId,
      challengeId: challengeData.id,
      code,
    })

    if (verifyError) {
      setState((prev) => ({ ...prev, phase: 'ready' }))
      setSubmitError('Ungültiger Code. Bitte versuchen Sie es erneut.')
      return
    }

    router.push('/dashboard')
  }

  if (state.phase === 'loading') {
    return <p className="text-sm text-gray-500">Wird geladen...</p>
  }

  if (state.phase === 'error') {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.errorMessage}
        </div>
        <p className="text-center text-sm">
          <a href="/auth/setup-totp" className="underline hover:text-gray-700">
            Zwei-Faktor-Authentifizierung einrichten
          </a>
        </p>
      </div>
    )
  }

  const isSubmitting = state.phase === 'submitting'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="totp-code">6-stelliger Code</Label>
        <Input
          id="totp-code"
          name="code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={isSubmitting}
          autoComplete="one-time-code"
          autoFocus
        />
      </div>

      {submitError && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting || code.length !== 6}>
        {isSubmitting ? 'Wird geprüft...' : 'Anmelden'}
      </Button>

      <p className="text-center text-sm text-gray-500">
        <a href="/auth/login" className="underline hover:text-gray-700">
          Zurück zur Anmeldung
        </a>
      </p>
    </form>
  )
}
