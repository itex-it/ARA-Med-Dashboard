'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CallStatusBadge } from '@/components/calls/CallStatusBadge'
import { CallDetailSheet } from '@/components/calls/CallDetailSheet'
import { useCallLog } from '@/lib/hooks/useCallLog'
import { maskPhone } from '@/lib/utils/phone'
import { formatCallTime, formatDuration, formatLanguage } from '@/lib/utils/format'
import type { CallLogRow } from '@/lib/types'

interface CallLogTableProps {
  tenantId: string
  canSeeAudio?: boolean
  canSeeTranscript?: boolean
  canSeeDetail?: boolean
  onRowClick?: (id: string) => void
}

const PID_MAP: Record<string, { label: string; className: string }> = {
  identified: { label: 'Identifiziert', className: 'text-green-700 border-green-200' },
  not_found: { label: 'Nicht gefunden', className: 'text-destructive border-red-200' },
  multiple: { label: 'Mehrere', className: 'text-yellow-700 border-yellow-200' },
  no_pid: { label: 'Keine PID', className: 'text-muted-foreground' },
}

export function CallLogTable({
  tenantId,
  canSeeAudio = true,
  canSeeTranscript = true,
  canSeeDetail = true,
  onRowClick,
}: CallLogTableProps) {
  const { calls, loading } = useCallLog(tenantId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const selectedCall: CallLogRow | null = calls.find((c) => c.id === selectedId) ?? null

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-11 w-full bg-muted animate-pulse rounded" />
        ))}
      </div>
    )
  }

  if (calls.length === 0) {
    return (
      <Table>
        <TableBody>
          <TableRow>
            <TableCell colSpan={9} className="py-12 text-center">
              <p className="text-base font-semibold text-foreground">Noch keine Telefonate</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Gespräche erscheinen hier, sobald ARA-MED aktiv ist und Anrufe entgegennimmt.
              </p>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
  }

  return (
    <>
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">Zeit</TableHead>
            <TableHead className="w-[140px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nummer</TableHead>
            <TableHead className="w-[80px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dauer</TableHead>
            <TableHead className="w-[80px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient</TableHead>
            <TableHead className="w-[110px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">PID</TableHead>
            <TableHead className="w-[180px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">Intent</TableHead>
            <TableHead className="w-[60px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sprache</TableHead>
            <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
            <TableHead className="w-[40px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((row: CallLogRow) => (
            <TableRow
              key={row.id}
              className={`h-11 cursor-pointer hover:bg-muted/50 animate-in slide-in-from-top-2 duration-300 ${
                row.status === 'active' ? 'border-l-2 border-primary' : ''
              }`}
              onClick={() => { setSelectedId(row.id); setSheetOpen(true); onRowClick?.(row.id) }}
            >
              <TableCell className="text-xs font-mono text-muted-foreground">
                {formatCallTime(row.created_at)}
              </TableCell>
              <TableCell className="text-sm font-mono">
                {maskPhone(row.phone_hash)}
              </TableCell>
              <TableCell className="text-sm">
                {formatDuration(row.duration_seconds)}
              </TableCell>
              <TableCell>
                {row.patient_recognized ? (
                  <span className="flex items-center gap-1.5 text-sm text-green-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Ja
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                    Nein
                  </span>
                )}
              </TableCell>
              <TableCell>
                {row.pid_status ? (
                  <Badge variant="outline" className={`text-xs ${PID_MAP[row.pid_status]?.className ?? ''}`}>
                    {PID_MAP[row.pid_status]?.label ?? row.pid_status}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <div>
                  <span className="text-sm">
                    {row.intent_corrected ?? row.intent_main ?? '—'}
                  </span>
                  {row.intent_sub && (
                    <div className="text-xs text-muted-foreground">{row.intent_sub}</div>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatLanguage(row.language_code)}
              </TableCell>
              <TableCell>
                <CallStatusBadge status={row.status} />
              </TableCell>
              <TableCell>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <CallDetailSheet
        call={selectedCall}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        canSeeAudio={canSeeAudio}
        canSeeTranscript={canSeeTranscript}
        canSeeDetail={canSeeDetail}
      />
    </>
  )
}
