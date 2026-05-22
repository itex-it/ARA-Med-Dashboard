'use client'

import { useOptimistic, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { useTenantStatus } from '@/lib/hooks/useTenantStatus'
import { useActiveCallCount } from '@/lib/hooks/useActiveCallCount'
import { OpenTaskCounter } from '@/components/status/OpenTaskCounter'
import { toggleAraMedAction } from '@/app/actions/toggle-ara-med'
import type { AraStatus } from '@/lib/types'

interface StatusBarProps {
  tenantId: string
  canToggle: boolean
}

export function StatusBar({ tenantId, canToggle }: StatusBarProps) {
  const { status, loading } = useTenantStatus(tenantId)
  const { count: activeCallCount, loading: countLoading } = useActiveCallCount(tenantId)

  const [optimisticStatus, setOptimisticStatus] = useOptimistic(
    status?.ara_status ?? 'active'
  )
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    const next: AraStatus = optimisticStatus === 'active' ? 'paused' : 'active'
    startTransition(async () => {
      setOptimisticStatus(next)
      await toggleAraMedAction(next)
    })
  }

  // Segment 1: ARA-MED Status
  function renderAraStatus() {
    if (loading) return <span className="text-sm text-muted-foreground">—</span>
    const ara = optimisticStatus
    const dotClass = ara === 'active'
      ? 'bg-green-500 animate-pulse'
      : ara === 'paused'
      ? 'bg-yellow-500'
      : 'bg-destructive'
    const textClass = ara === 'active'
      ? 'text-green-600'
      : ara === 'paused'
      ? 'text-yellow-600'
      : 'text-destructive'
    const label = ara === 'active'
      ? 'ARA-MED aktiv'
      : ara === 'paused'
      ? 'ARA-MED pausiert'
      : 'ARA-MED gestört'
    return (
      <span className={`flex items-center gap-1.5 text-sm font-medium ${textClass}`}>
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        {label}
      </span>
    )
  }

  // Segment 2: Praxis-Status
  function renderPraxisStatus() {
    if (loading || !status) return <span className="text-sm text-muted-foreground">—</span>
    const map: Record<string, string> = {
      open: 'text-green-600',
      closed: 'text-muted-foreground',
      special: 'text-yellow-600',
    }
    const labels: Record<string, string> = {
      open: 'Praxis geöffnet',
      closed: 'Praxis geschlossen',
      special: 'Sondermodus',
    }
    return (
      <span className={`text-sm ${map[status.practice_status] ?? 'text-muted-foreground'}`}>
        {labels[status.practice_status] ?? status.practice_status}
      </span>
    )
  }

  // Segment 3: Aktiver Modus
  function renderModus() {
    if (loading || !status) return <span className="text-xs text-muted-foreground">—</span>
    const labels: Record<string, string> = {
      normal: 'Normalbetrieb',
      vacation: 'Urlaubsmodus',
      deputy: 'Vertretungsmodus',
      overload: 'Überlastung',
    }
    return (
      <span className="text-xs text-muted-foreground">
        {labels[status.active_mode] ?? status.active_mode}
      </span>
    )
  }

  // Segment 4: Aktive Gespräche
  function renderActiveCallCount() {
    const badgeClass = activeCallCount > 0
      ? 'bg-primary text-primary-foreground'
      : 'bg-muted text-muted-foreground'
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Aktive Gespräche
        {!countLoading && (
          <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${badgeClass}`}>
            {activeCallCount}
          </span>
        )}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-3 w-full">
      {renderAraStatus()}
      <Separator orientation="vertical" className="h-4" />
      {renderPraxisStatus()}
      <Separator orientation="vertical" className="h-4" />
      {renderModus()}
      <Separator orientation="vertical" className="h-4" />
      {renderActiveCallCount()}
      <Separator orientation="vertical" className="h-4" />
      <OpenTaskCounter tenantId={tenantId} />
      {canToggle && (
        <>
          <Separator orientation="vertical" className="h-4" />
          <span className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">ARA-MED</span>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                checked={optimisticStatus === 'active'}
                onCheckedChange={handleToggle}
                disabled={isPending}
                aria-label="ARA-MED Voice AI umschalten"
              />
            )}
          </span>
        </>
      )}
    </div>
  )
}
