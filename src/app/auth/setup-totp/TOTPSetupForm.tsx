'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type SetupPhase = 'loading' | 'qr' | 'verifying' | 'error'

interface SetupData {
  phase: SetupPhase
  qrCode: string
  factorId: string
  errorMessage: string
}

const initialData: SetupData = {
  phase: 'loading',
  qrCode: '',
  factorId: '',
  errorMessage: '',
}

export function TOTPSetupForm() {
  const router = useRouter()
  const [data, setData] = useState<SetupData>(initialData)
  const [code, setCode] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.mfa
      .enroll({ factorType: 'totp', issuer: 'ARA-Med', friendlyName: 'ARA-Med Authenticator' })
      .then(({ data: enrollData, error }) => {
        if (error || !enrollData) {
          setData((prev) => ({
            ...prev,
            phase: 'error',
            errorMessage: 'Fehler beim Einrichten der Zwei-Faktor-Authentifizierung.',
          }))
          return
        }
        setData((prev) => ({
          ...prev,
          phase: 'qr',
          qrCode: enrollData.totp.qr_code,
          factorId: enrollData.id,
        }))
      })
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (data.phase !== 'qr' && data.phase !== 'verifying') return

    setSubmitError(null)
    setData((prev) => ({ ...prev, phase: 'verifying' }))

    const supabase = createClient()

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: data.factorId,
    })

    if (challengeError || !challengeData) {
      setData((prev) => ({ ...prev, phase: 'qr' }))
      setSubmitError('Fehler beim Starten der Verifizierung. Bitte versuchen Sie es erneut.')
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: data.factorId,
      challengeId: challengeData.id,
      code,
    })

    if (verifyError) {
      setData((prev) => ({ ...prev, phase: 'qr' }))
      setSubmitError('Ungültiger Code. Bitte versuchen Sie es erneut.')
      return
    }

    router.push('/dashboard')
  }

  if (data.phase === 'loading') {
    return <p className="text-sm text-gray-500">QR-Code wird geladen...</p>
  }

  if (data.phase === 'error') {
    return (
      <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        {data.errorMessage}
      </div>
    )
  }

  const isVerifying = data.phase === 'verifying'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {data.qrCode && (
        <div className="flex flex-col items-center space-y-2">
          <p className="text-sm text-gray-600">QR-Code mit Authenticator-App scannen:</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.qrCode} alt="TOTP QR-Code" className="h-48 w-48" />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="totp-code">6-stelligen Code eingeben</Label>
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
          disabled={isVerifying}
          autoComplete="one-time-code"
        />
      </div>

      {submitError && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isVerifying || code.length !== 6}>
        {isVerifying ? 'Wird verifiziert...' : 'Bestätigen'}
      </Button>
    </form>
  )
}
