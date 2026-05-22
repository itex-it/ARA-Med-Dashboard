'use client'

import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Calendar,
  XCircle,
  RefreshCw,
  FileText,
  MessageSquare,
  PhoneForwarded,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { saveCallFeedbackAction } from '@/app/actions/call-feedback'
import { maskPhone } from '@/lib/utils/phone'
import { formatCallTime } from '@/lib/utils/format'
import type { CallLogRow, CallActionRow, FeedbackLabel, CallActionType, MedstarActionStatus } from '@/lib/types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface CallDetailSheetProps {
  call: CallLogRow | null
  open: boolean
  onOpenChange: (o: boolean) => void
  canSeeAudio: boolean
  canSeeTranscript: boolean
  canSeeDetail: boolean
}

// ── Action icon + label helpers ────────────────────────────────────────────────

const ACTION_ICONS: Record<CallActionType, React.ComponentType<{ className?: string }>> = {
  appointment_booked: Calendar,
  appointment_cancelled: XCircle,
  appointment_rescheduled: RefreshCw,
  prescription_ordered: FileText,
  message_created: MessageSquare,
  forwarding: PhoneForwarded,
  emergency_notice: AlertTriangle,
}

const ACTION_LABELS: Record<CallActionType, string> = {
  appointment_booked: 'Termin gebucht',
  appointment_cancelled: 'Termin storniert',
  appointment_rescheduled: 'Termin verschoben',
  prescription_ordered: 'Rezept bestellt',
  message_created: 'Nachricht erstellt',
  forwarding: 'Weiterleitung',
  emergency_notice: 'Notfallhinweis',
}

const STATUS_CLASSES: Record<MedstarActionStatus, string> = {
  success: 'text-green-700',
  error: 'text-destructive',
  pending: 'text-muted-foreground',
}

const STATUS_LABELS: Record<MedstarActionStatus, string> = {
  success: 'Erfolg',
  error: 'Fehler',
  pending: 'Ausstehend',
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CallDetailSheet({
  call,
  open,
  onOpenChange,
  canSeeAudio,
  canSeeTranscript,
  canSeeDetail,
}: CallDetailSheetProps) {
  // ── Local state ──────────────────────────────────────────────────────────────
  const [actions, setActions] = useState<CallActionRow[]>([])
  const [actionsLoading, setActionsLoading] = useState(false)

  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioLoading, setAudioLoading] = useState(false)

  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [decisionOpen, setDecisionOpen] = useState(false)

  const [noteValue, setNoteValue] = useState('')
  const [intentValue, setIntentValue] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)

  const [feedbackLabel, setFeedbackLabel] = useState<FeedbackLabel | null>(null)
  const [feedbackSaving, setFeedbackSaving] = useState(false)

  // ── Reset state when the selected call changes ───────────────────────────────
  useEffect(() => {
    setActions([])
    setAudioUrl(null)
    setTranscriptOpen(false)
    setDecisionOpen(false)
    setNoteValue(call?.internal_note ?? '')
    setIntentValue(call?.intent_corrected ?? '')
    setNoteError(null)
    setFeedbackLabel(call?.feedback_label ?? null)
  }, [call?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch call_actions when sheet opens ──────────────────────────────────────
  useEffect(() => {
    if (!open || !canSeeDetail || !call) return

    let cancelled = false
    setActionsLoading(true)

    fetch(`/api/calls/${call.id}/actions`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { actions: CallActionRow[] }) => {
        if (!cancelled) setActions(data.actions ?? [])
      })
      .catch(() => {
        if (!cancelled) setActions([])
      })
      .finally(() => {
        if (!cancelled) setActionsLoading(false)
      })

    return () => { cancelled = true }
  }, [open, canSeeDetail, call?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch audio URL when sheet opens ─────────────────────────────────────────
  useEffect(() => {
    if (!open || !canSeeAudio || !call?.audio_url) return

    let cancelled = false
    setAudioLoading(true)

    fetch(`/api/calls/${call.id}/audio`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { url: string }) => {
        if (!cancelled) setAudioUrl(data.url)
      })
      .catch(() => {
        if (!cancelled) setAudioUrl(null)
      })
      .finally(() => {
        if (!cancelled) setAudioLoading(false)
      })

    return () => { cancelled = true }
  }, [open, canSeeAudio, call?.id, call?.audio_url]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────────
  async function handleSaveNote() {
    if (!call) return
    setNoteSaving(true)
    setNoteError(null)
    const result = await saveCallFeedbackAction({
      callId: call.id,
      internalNote: noteValue,
      intentCorrected: intentValue || undefined,
    })
    setNoteSaving(false)
    if (!result.success) {
      setNoteError(result.error ?? 'Fehler beim Speichern.')
    }
  }

  async function handleFeedback(value: FeedbackLabel) {
    if (!call) return
    setFeedbackSaving(true)
    const result = await saveCallFeedbackAction({
      callId: call.id,
      feedbackLabel: value,
    })
    setFeedbackSaving(false)
    if (result.success) {
      setFeedbackLabel(value)
    }
  }

  // ── Render: null call guard ──────────────────────────────────────────────────
  if (!call) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" />
      </Sheet>
    )
  }

  // ── Render: full sheet ───────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[480px] sm:max-w-[480px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Gesprächsdetails</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {formatCallTime(call.created_at)} · {maskPhone(call.phone_hash)}
          </p>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-0">

          {/* Section 1 — Zusammenfassung (CALL-07) */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Zusammenfassung
            </p>
            {call.summary_short && (
              <p className="text-sm">{call.summary_short}</p>
            )}
            {call.summary_structured &&
              (() => {
                const s = call.summary_structured as Record<string, unknown>
                return (
                  <dl className="mt-2 space-y-1 text-sm">
                    {Boolean(s.intent_main) && (
                      <div>
                        <dt className="text-muted-foreground inline">Intent: </dt>
                        <dd className="inline">{String(s.intent_main)}</dd>
                      </div>
                    )}
                    {Boolean(s.actions_done) && (
                      <div>
                        <dt className="text-muted-foreground inline">Aktionen: </dt>
                        <dd className="inline">{String(s.actions_done)}</dd>
                      </div>
                    )}
                    {Boolean(s.open_items) && (
                      <div>
                        <dt className="text-muted-foreground inline">Offene Punkte: </dt>
                        <dd className="inline">{String(s.open_items)}</dd>
                      </div>
                    )}
                    {s.callback_needed !== undefined && (
                      <div>
                        <dt className="text-muted-foreground inline">Rückruf nötig: </dt>
                        <dd className="inline">{s.callback_needed ? 'Ja' : 'Nein'}</dd>
                      </div>
                    )}
                  </dl>
                )
              })()}
            {!call.summary_short && !call.summary_structured && (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>

          <Separator className="my-4" />

          {/* Section 2 — Kontaktdaten (CALL-03) */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Kontaktdaten
            </p>
            <p className="text-sm">{maskPhone(call.phone_hash)}</p>
            {canSeeDetail && (
              <div className="mt-2">
                {/* DSGVO: raw phone numbers are never stored (STATE.md architectural constraint) — phone_hash is the only available identifier */}
                <p className="text-xs text-muted-foreground">Rufnummer-Hash (DSGVO)</p>
                <p className="text-xs font-mono break-all">{call.phone_hash ?? '—'}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Die Rufnummer wird aus Datenschutzgründen nur als Hash gespeichert.
                </p>
              </div>
            )}
          </div>

          {/* Section 3 — Ausgeführte Aktionen (CALL-04, CALL-10, gated on canSeeDetail) */}
          {canSeeDetail && (
            <>
              <Separator className="my-4" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Ausgeführte Aktionen
                </p>
                {actionsLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-8 w-full bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : actions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Aktionen</p>
                ) : (
                  <ul className="space-y-2">
                    {actions.map((action) => {
                      const Icon = ACTION_ICONS[action.action_type]
                      const label = ACTION_LABELS[action.action_type]
                      const statusClass = action.medstar_status
                        ? STATUS_CLASSES[action.medstar_status]
                        : 'text-muted-foreground'
                      const statusLabel = action.medstar_status
                        ? STATUS_LABELS[action.medstar_status]
                        : '—'

                      return (
                        <li key={action.id} className="flex items-center gap-2 text-sm">
                          {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
                          <span className="flex-1">{label}</span>
                          <Badge
                            variant="outline"
                            className={`text-xs ${statusClass}`}
                          >
                            {statusLabel}
                          </Badge>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </>
          )}

          {/* Section 4 — Gesprächsaufzeichnung (CALL-05, gated on canSeeAudio && call.audio_url) */}
          {canSeeAudio && call.audio_url && (
            <>
              <Separator className="my-4" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Gesprächsaufzeichnung
                </p>
                {audioLoading ? (
                  <div className="h-10 w-full rounded bg-muted animate-pulse" />
                ) : audioUrl ? (
                  <audio controls src={audioUrl} className="w-full" />
                ) : (
                  <p className="text-sm text-muted-foreground">Aufzeichnung nicht verfügbar.</p>
                )}
              </div>
            </>
          )}

          {/* Section 5 — Transkript (CALL-06, gated on canSeeTranscript) */}
          {canSeeTranscript && (
            <>
              <Separator className="my-4" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Transkript
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTranscriptOpen((v) => !v)}
                >
                  {transcriptOpen ? 'Transkript ausblenden' : 'Transkript anzeigen'}
                </Button>
                {transcriptOpen && (
                  <pre className="mt-2 text-xs whitespace-pre-wrap font-mono bg-muted p-4 rounded-md">
                    {call.transcript_text ?? '(kein Transkript vorhanden)'}
                  </pre>
                )}
              </div>
            </>
          )}

          {/* Section 6 — KI-Entscheidungsweg (CALL-10, gated on canSeeDetail) */}
          {canSeeDetail && (
            <>
              <Separator className="my-4" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  KI-Entscheidungsweg
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDecisionOpen((v) => !v)}
                >
                  {decisionOpen ? 'KI-Entscheidungsweg ausblenden' : 'KI-Entscheidungsweg anzeigen'}
                </Button>
                {decisionOpen && (
                  <pre className="mt-2 text-xs font-mono bg-muted p-4 rounded-md overflow-x-auto">
                    {JSON.stringify(call.summary_structured, null, 2)}
                  </pre>
                )}
              </div>
            </>
          )}

          <Separator className="my-4" />

          {/* Section 7 — Interne Notiz (CALL-08) */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Interne Notiz
            </p>
            <Textarea
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              placeholder="Interne Notiz hinzufügen..."
              rows={3}
              className="text-sm"
            />
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">Intent-Korrektur (optional)</p>
              <Select value={intentValue} onValueChange={setIntentValue}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Intent auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Keine Korrektur</SelectItem>
                  <SelectItem value="appointment">Terminanfrage</SelectItem>
                  <SelectItem value="prescription">Rezeptanfrage</SelectItem>
                  <SelectItem value="information">Allgemeine Anfrage</SelectItem>
                  <SelectItem value="callback">Rückrufwunsch</SelectItem>
                  <SelectItem value="emergency">Notfall</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              className="mt-2"
              onClick={handleSaveNote}
              disabled={noteSaving}
            >
              {noteSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Notiz speichern
            </Button>
            {noteError && (
              <p className="text-xs text-destructive mt-1">{noteError}</p>
            )}
          </div>

          <Separator className="my-4" />

          {/* Section 8 — Feedback (CALL-09) */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Feedback
            </p>
            <div className="flex gap-2">
              {(
                [
                  { label: 'Korrekt', value: 'correct' },
                  { label: 'Falsch erkannt', value: 'incorrect' },
                  { label: 'Training nötig', value: 'needs_training' },
                ] as { label: string; value: FeedbackLabel }[]
              ).map(({ label, value }) => (
                <Button
                  key={value}
                  variant={feedbackLabel === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleFeedback(value)}
                  disabled={feedbackSaving}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  )
}
