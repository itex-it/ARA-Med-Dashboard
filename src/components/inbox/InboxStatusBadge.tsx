'use client'

import { Badge } from '@/components/ui/badge'
import type { InboxStatus } from '@/lib/types'

export const INBOX_STATUS_LABELS: Record<InboxStatus, string> = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  resolved: 'Erledigt',
  archived: 'Archiviert',
}

export const INBOX_STATUS_STYLES: Record<InboxStatus, string> = {
  open: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-50',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50',
  resolved: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-50',
  archived: 'bg-muted text-muted-foreground border-border hover:bg-muted',
}

interface InboxStatusBadgeProps {
  status: InboxStatus
}

export function InboxStatusBadge({ status }: InboxStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={INBOX_STATUS_STYLES[status] ?? INBOX_STATUS_STYLES.archived}
    >
      {INBOX_STATUS_LABELS[status]}
    </Badge>
  )
}
