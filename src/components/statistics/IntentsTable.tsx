import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { IntentFrequency } from '@/lib/types'

interface IntentsTableProps {
  intents: IntentFrequency[]
  total: number
}

export default function IntentsTable({ intents, total }: IntentsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Top Intents</CardTitle>
      </CardHeader>
      <CardContent>
        {intents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Daten im gewählten Zeitraum.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">#</th>
                <th className="pb-2 font-medium">Intent</th>
                <th className="pb-2 text-right font-medium">Anzahl</th>
                <th className="pb-2 text-right font-medium">Anteil</th>
              </tr>
            </thead>
            <tbody>
              {intents.map((item, idx) => {
                const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0.0'
                const barWidth = total > 0 ? Math.round((item.count / total) * 100) : 0
                const displayName = item.intent || 'Kein Intent erkannt'
                return (
                  <tr key={item.intent} className="border-b last:border-0">
                    <td className="py-2 pr-2 text-muted-foreground">{idx + 1}</td>
                    <td className="py-2 pr-4">
                      <div>{displayName}</div>
                      <div className="mt-1 h-1 w-full rounded bg-gray-100">
                        <div
                          className="h-1 rounded bg-blue-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-2 text-right tabular-nums">{item.count}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{pct}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
