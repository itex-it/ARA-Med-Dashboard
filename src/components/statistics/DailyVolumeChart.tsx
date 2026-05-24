import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DailyCallVolume } from '@/lib/types'

interface DailyVolumeChartProps {
  data: DailyCallVolume[]
  label: string
}

export default function DailyVolumeChart({ data, label }: DailyVolumeChartProps) {
  const displayed = data.slice(-14)
  const maxTotal = Math.max(...displayed.map((d) => d.total), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {displayed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Daten im gewählten Zeitraum.</p>
        ) : (
          <div className="flex items-end gap-1" style={{ height: '120px' }}>
            {displayed.map((day) => {
              const totalPct = Math.round((day.total / maxTotal) * 100)
              const resolvedPct = day.total > 0
                ? Math.round((day.resolved / day.total) * 100)
                : 0
              const [, month, dayNum] = day.date.split('-')
              const dateLabel = `${dayNum}.${month}.`

              return (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="relative w-full rounded-t"
                    style={{ height: `${totalPct}%`, minHeight: '2px', backgroundColor: '#e5e7eb' }}
                  >
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-t"
                      style={{ height: `${resolvedPct}%`, backgroundColor: '#22c55e' }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground leading-none">{dateLabel}</span>
                </div>
              )
            })}
          </div>
        )}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm bg-green-500" />
            Erledigt
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm bg-gray-200" />
            Gesamt
          </span>
          <span className="ml-auto">Max: {maxTotal}</span>
        </div>
      </CardContent>
    </Card>
  )
}
