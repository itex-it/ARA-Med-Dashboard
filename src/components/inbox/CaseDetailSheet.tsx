'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Card } from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertTriangle } from 'lucide-react'
import { CaseTypeBadge } from '@/components/inbox/CaseTypeBadge'
import { InboxStatusBadge } from '@/components/inbox/InboxStatusBadge'
import { updateInboxStatusAction } from '@/app/actions/update-inbox-status'
import { saveInboxNoteAction } from '@/app/actions/save-inbox-note'
import { formatCallTime } from '@/lib/utils/format'
import type { InboxItemRow, InboxStatus } from '@/lib/types'

interface CaseDetailSheetProps {
  item: InboxItemRow | null
  open: boolean
  onOpenChange: (o: boolean) => void
  hasEditRight: boolean
  hasManageRight: boolean
  hasCallDetail: boolean
}

export function CaseDetailSheet({
  item,
  open,
  onOpenChange,
  hasEditRight,
  hasManageRight,
  hasCallDetail,
}: CaseDetailSheetProps) {
  const [optimisticStatus, setOptimisticStatus] = useState<InboxStatus | null>(
    item?.status ?? null
  )
  const [isPending, startTransition] = useTransition()
  const [noteValue, setNoteValue] = useState(item?.internal_note ?? '')
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  // Reset all state when the selected item changes
  useEffect(() => {
    setOptimisticStatus(item?.status ?? null)
    setNoteValue(item?.internal_note ?? '')
    setNoteError(null)
    setStatusError(null)
  }, [item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync note textarea when Realtime UPDATE arrives (Pitfall 5 prevention)
  useEffect(() => {
    setNoteValue(item?.internal_note ?? '')
  }, [item?.internal_note]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleStatusTransition(newStatus: InboxStatus) {
    if (!item) return
    const prev = optimisticStatus ?? item.status
    setOptimisticStatus(newStatus)
    setStatusError(null)
    startTransition(async () => {
      const result = await updateInboxStatusAction(item.id, newStatus)
      if (result.error) {
        setOptimisticStatus(prev)
        setStatusError(result.error)
      }
    })
  }

  async function handleSaveNote() {
    if (!item) return
    setNoteSaving(true)
    setNoteError(null)
    const result = await saveInboxNoteAction(item.id, noteValue)
    setNoteSaving(false)
    if (!result.success) {
      setNoteError(result.error ?? 'Notiz konnte nicht gespeichert werden.')
    }
  }

  // Null guard — render empty sheet
  if (!item) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" />
      </Sheet>
    )
  }

  const currentStatus = optimisticStatus ?? item.status

  const formattedDate = new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(item.created_at))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Falldetails</SheetTitle>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <CaseTypeBadge caseType={item.case_type} showTooltip={false} />
            &middot; {formatCallTime(item.created_at)}
          </p>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-0">

          {/* Section 1 — Notfall-Banner (emergency only) */}
          {item.case_type === 'emergency' && (
            <>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Notfall / Akutfall</AlertTitle>
                <AlertDescription>
                  Dieser Anruf enthält einen Notfall- oder Akutfall-Hinweis. Bitte sofort handeln.
                </AlertDescription>
              </Alert>
              <Separator className="my-4" />
            </>
          )}

          {/* Section 2 — Fallinformation */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Fallinformation
            </p>
            <div className="space-y-2">
              <div>
                <CaseTypeBadge caseType={item.case_type} showTooltip={false} />
              </div>
              {item.call_log_id && (
                <p className="text-sm text-muted-foreground">
                  Gespräch:{' '}
                  {hasCallDetail ? (
                    <Link
                      href={`/telefonate?call=${item.call_log_id}`}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {item.call_log_id.slice(0, 8)}&hellip;
                    </Link>
                  ) : (
                    <span className="font-mono text-xs">{item.call_log_id.slice(0, 8)}&hellip;</span>
                  )}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Eingegangen am {formattedDate} Uhr
              </p>
              <div>
                <InboxStatusBadge status={currentStatus} />
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Section 3 — Status (hasEditRight gate) */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Status
            </p>
            {hasEditRight ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {currentStatus === 'open' && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleStatusTransition('in_progress')}
                      >
                        {isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        Annehmen
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleStatusTransition('resolved')}
                      >
                        {isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        Erledigt markieren
                      </Button>
                    </>
                  )}
                  {currentStatus === 'in_progress' && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleStatusTransition('resolved')}
                      >
                        {isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        Erledigt markieren
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleStatusTransition('open')}
                      >
                        {isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        Wieder öffnen
                      </Button>
                    </>
                  )}
                  {currentStatus === 'resolved' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleStatusTransition('archived')}
                      >
                        {isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        Archivieren
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleStatusTransition('open')}
                      >
                        {isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        Wieder öffnen
                      </Button>
                    </>
                  )}
                  {currentStatus === 'archived' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleStatusTransition('open')}
                    >
                      {isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                      Wieder öffnen
                    </Button>
                  )}
                </div>
                {statusError && (
                  <p className="text-xs text-destructive mt-2">{statusError}</p>
                )}
              </>
            ) : (
              <InboxStatusBadge status={currentStatus} />
            )}
          </div>

          <Separator className="my-4" />

          {/* Section 4 — Interne Notiz */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Interne Notiz
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              Sichtbar für alle Benutzer dieser Ordination
            </p>
            {hasEditRight ? (
              <>
                <Textarea
                  value={noteValue}
                  onChange={(e) => setNoteValue(e.target.value)}
                  placeholder="Interne Notiz hinzufügen..."
                  className="text-sm min-h-20"
                  disabled={noteSaving}
                />
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={handleSaveNote}
                  disabled={noteSaving}
                >
                  {noteSaving ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Speichert&hellip;
                    </>
                  ) : (
                    'Notiz speichern'
                  )}
                </Button>
                {noteError && (
                  <p className="text-xs text-destructive mt-1">{noteError}</p>
                )}
              </>
            ) : (
              <p className="text-sm">{item.internal_note ?? '—'}</p>
            )}
          </div>

          {/* Section 5 — Verknüpftes Gespräch (only when call_log_id is set) */}
          {item.call_log_id && (
            <>
              <Separator className="my-4" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Verknüpftes Gespräch
                </p>
                <Card className="p-4">
                  <p className="text-xs font-mono text-muted-foreground">
                    {item.call_log_id}
                  </p>
                  {hasCallDetail && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      asChild
                    >
                      <Link href={`/telefonate?call=${item.call_log_id}`}>
                        Gesprächsdetails anzeigen
                      </Link>
                    </Button>
                  )}
                </Card>
              </div>
            </>
          )}

        </div>
      </SheetContent>
    </Sheet>
  )
}
