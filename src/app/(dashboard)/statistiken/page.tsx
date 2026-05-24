import { redirect } from 'next/navigation'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { DailyCallVolume, IntentFrequency } from '@/lib/types'
import KpiCard from '@/components/statistics/KpiCard'
import DailyVolumeChart from '@/components/statistics/DailyVolumeChart'
import IntentsTable from '@/components/statistics/IntentsTable'
import SavedTimeCard from '@/components/statistics/SavedTimeCard'

export default async function StatistikenPage({
  searchParams,
}: {
  searchParams: Promise<{ tage?: string }>
}) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const tenantId = (user.app_metadata?.tenant_id as string | undefined) ?? ''
  const serviceClient = createServiceRoleClient()

  const params = await searchParams
  const days = Math.min(90, Math.max(7, parseInt(params.tage ?? '30', 10)))
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [callLogResult, apptCountResult, rxCountResult, openTasksResult, emergencyResult] =
    await Promise.all([
      serviceClient
        .from('call_log')
        .select('created_at, status, duration_seconds, intent_main')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate)
        .order('created_at', { ascending: true }),
      serviceClient
        .from('call_actions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('action_type', 'appointment_booked')
        .gte('created_at', startDate),
      serviceClient
        .from('call_actions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('action_type', 'prescription_ordered')
        .gte('created_at', startDate),
      serviceClient
        .from('inbox_items')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('status', ['open', 'in_progress']),
      serviceClient
        .from('inbox_items')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('case_type', 'emergency')
        .gte('created_at', thirtyDaysAgo),
    ])

  const callLog = callLogResult.data ?? []
  const totalCalls = callLog.length
  const resolvedCalls = callLog.filter((r) => r.status === 'completed')
  const forwardedCalls = callLog.filter((r) => r.status === 'forwarded')
  const completedWithDuration = resolvedCalls.filter((r) => r.duration_seconds !== null)
  const avgDurationSeconds =
    completedWithDuration.length > 0
      ? Math.round(
          completedWithDuration.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0) /
            completedWithDuration.length
        )
      : 0
  const resolutionRate =
    totalCalls > 0 ? Math.round((resolvedCalls.length / totalCalls) * 100) : 0
  const forwardingRate =
    totalCalls > 0 ? Math.round((forwardedCalls.length / totalCalls) * 100) : 0
  const estimatedSavedMinutes = resolvedCalls.length * 5

  // Daily volume
  const byDay: Record<string, { total: number; resolved: number; forwarded: number }> = {}
  for (const row of callLog) {
    const date = row.created_at.split('T')[0]
    if (!byDay[date]) byDay[date] = { total: 0, resolved: 0, forwarded: 0 }
    byDay[date].total++
    if (row.status === 'completed') byDay[date].resolved++
    if (row.status === 'forwarded') byDay[date].forwarded++
  }
  const dailyVolume: DailyCallVolume[] = Object.entries(byDay)
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Top intents
  const intentCounts: Record<string, number> = {}
  for (const row of callLog) {
    const intent = row.intent_main ?? ''
    intentCounts[intent] = (intentCounts[intent] ?? 0) + 1
  }
  const topIntents: IntentFrequency[] = Object.entries(intentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([intent, count]) => ({ intent: intent || 'Kein Intent erkannt', count }))

  const avgDurationLabel =
    avgDurationSeconds > 0
      ? `${Math.floor(avgDurationSeconds / 60)} Min. ${avgDurationSeconds % 60} Sek.`
      : '—'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Statistiken</h1>
        <div className="flex gap-2 text-sm">
          {[7, 30, 90].map((d) => (
            <a
              key={d}
              href={`/statistiken?tage=${d}`}
              className={`rounded px-3 py-1 ${
                days === d
                  ? 'bg-gray-900 text-white'
                  : 'border bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {d} Tage
            </a>
          ))}
        </div>
      </div>

      {/* KPI grid row 1 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Anrufe gesamt" value={totalCalls} sub={`${days} Tage`} />
        <KpiCard label="Ø Gesprächsdauer" value={avgDurationLabel} />
        <KpiCard
          label="Lösungsquote"
          value={`${resolutionRate}%`}
          sub={`${resolvedCalls.length} erledigt`}
        />
        <KpiCard
          label="Weiterleitungsquote"
          value={`${forwardingRate}%`}
          sub={`${forwardedCalls.length} weitergeleitet`}
        />
      </div>

      {/* KPI grid row 2 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Offene Aufgaben" value={openTasksResult.count ?? 0} />
        <KpiCard
          label="Gebuchte Termine"
          value={apptCountResult.count ?? 0}
          sub={`${days} Tage`}
        />
        <KpiCard
          label="Rezeptanfragen"
          value={rxCountResult.count ?? 0}
          sub={`${days} Tage`}
        />
        <KpiCard
          label="Notfallfälle"
          value={emergencyResult.count ?? 0}
          sub="letzte 30 Tage"
        />
      </div>

      {/* Daily volume chart */}
      <DailyVolumeChart
        data={dailyVolume}
        label={`Anrufvolumen — letzte ${days} Tage`}
      />

      {/* Bottom row: intents + saved time */}
      <div className="grid gap-4 lg:grid-cols-2">
        <IntentsTable intents={topIntents} total={totalCalls} />
        <SavedTimeCard
          estimatedSavedMinutes={estimatedSavedMinutes}
          resolvedCount={resolvedCalls.length}
        />
      </div>
    </div>
  )
}
