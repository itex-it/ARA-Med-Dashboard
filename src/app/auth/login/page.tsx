import { LoginForm } from './LoginForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">ARA-Med</h1>
          <p className="mt-1 text-sm text-gray-500">Voice AI Plattform</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Anmelden</CardTitle>
            <CardDescription>Geben Sie Ihre E-Mail-Adresse und Ihr Passwort ein.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
        <p className="text-center text-sm text-gray-500">
          <a href="/auth/reset-password" className="underline hover:text-gray-700">
            Passwort vergessen?
          </a>
        </p>
      </div>
    </div>
  )
}
