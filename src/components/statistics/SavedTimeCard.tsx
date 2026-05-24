import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SavedTimeCardProps {
  estimatedSavedMinutes: number
  resolvedCount: number
}

export default function SavedTimeCard({ estimatedSavedMinutes, resolvedCount }: SavedTimeCardProps) {
  const hours = Math.floor(estimatedSavedMinutes / 60)
  const mins = estimatedSavedMinutes % 60

  const formatted =
    hours > 0 ? `ca. ${hours} Std. ${mins} Min.` : `ca. ${mins} Min.`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Geschätzte Zeitersparnis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-green-600">{formatted}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {resolvedCount} erledigte Gespräche &times; 5 Min. Zeitersparnis
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Konservative Schätzung: jedes vollständig erledigte Gespräch spart dem Praxisteam
          durchschnittlich 5 Minuten manuelle Bearbeitung.
        </p>
      </CardContent>
    </Card>
  )
}
