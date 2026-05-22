import { UpdatePasswordForm } from './UpdatePasswordForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function UpdatePasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">ARA-Med</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Neues Passwort festlegen</CardTitle>
            <CardDescription>
              Geben Sie Ihr neues Passwort ein. Mindestlänge: 8 Zeichen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UpdatePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
