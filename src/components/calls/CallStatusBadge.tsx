'use client'

import { Badge } from '@/components/ui/badge'
import type { CallStatus } from '@/lib/types'

interface CallStatusBadgeProps {
  status: CallStatus
}

const STATUS_MAP: Record<CallStatus, { label: string; className: string }> = {
  completed: { label: 'Gelöst', className: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-50' },
  active: { label: 'Aktiv', className: 'bg-primary text-primary-foreground hover:bg-primary' },
  forwarded: { label: 'Weitergeleitet', className: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50' },
  failed: { label: 'Fehlgeschlagen', className: 'bg-red-50 text-destructive border-red-200 hover:bg-red-50' },
  abandoned: { label: 'Abgebrochen', className: 'bg-muted text-muted-foreground hover:bg-muted' },
}

export function CallStatusBadge({ status }: CallStatusBadgeProps) {
  const config = STATUS_MAP[status] ?? STATUS_MAP.abandoned
  return (
    <Badge variant="outline" className={config.className}>
      {status === 'active' && (
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      )}
      {config.label}
    </Badge>
  )
}
