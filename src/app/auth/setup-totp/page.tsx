import { TOTPSetupForm } from './TOTPSetupForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SetupTOTPPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">ARA-Med</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Zwei-Faktor-Authentifizierung einrichten</CardTitle>
            <CardDescription>
              Scannen Sie den QR-Code mit Ihrer Authenticator-App (z.B. Google Authenticator, Authy).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TOTPSetupForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
