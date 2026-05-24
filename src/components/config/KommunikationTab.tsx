'use client'

import React, { useState, useTransition, useOptimistic, useActionState } from 'react'
import {
  Inbox,
  Mail,
  MessageSquare,
  MessageCircle,
  Plus,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  createCommRuleAction,
  updateCommRuleAction,
  deleteCommRuleAction,
  toggleCommRuleAction,
  type CommRuleActionState,
  type ToggleCommRuleState,
} from '@/lib/actions/communication'
import {
  createTemplateAction,
  updateTemplateAction,
  deleteTemplateAction,
} from '@/lib/actions/templates'
import type {
  CommRuleRow,
  CommDirection,
  CommChannel,
  CommPriority,
  MessageTemplateRow,
  SendLogRow,
} from '@/lib/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INTERNAL_EVENT_LABELS: Record<string, string> = {
  inbox_new_case: 'Neuer Inbox-Fall',
  escalation: 'Eskalation / Notfall',
  call_failed: 'Gespräch fehlgeschlagen',
  ara_deactivated: 'ARA-MED Voice deaktiviert',
  ara_error: 'ARA-MED Voice Störung',
  prescription_blocked: 'Rezeptanfrage blockiert',
  callback_needed: 'Rückruf erforderlich',
}

const PATIENT_EVENT_LABELS: Record<string, string> = {
  appointment_confirmed: 'Terminbestätigung',
  appointment_reminder: 'Terminerinnerung',
  appointment_cancelled: 'Terminabsage',
  prescription_received: 'Rezepteingang',
  callback_scheduled: 'Rückruf geplant',
}

const CHANNEL_LABELS: Record<CommChannel, string> = {
  inbox: 'Dashboard-Inbox',
  email: 'E-Mail',
  telegram: 'Telegram',
  sms: 'SMS',
}

const PRIORITY_LABELS: Record<CommPriority, string> = {
  high: 'Hoch',
  normal: 'Normal',
  low: 'Niedrig',
}

const CHANNEL_ICONS: Record<CommChannel, React.ReactNode> = {
  inbox: <Inbox className="h-3 w-3 mr-1" aria-hidden="true" />,
  email: <Mail className="h-3 w-3 mr-1" aria-hidden="true" />,
  telegram: <MessageSquare className="h-3 w-3 mr-1" aria-hidden="true" />,
  sms: <MessageCircle className="h-3 w-3 mr-1" aria-hidden="true" />,
}

// Template variables with example values for live preview
const EXAMPLE_VALUES: Record<string, string> = {
  '{{patient_name}}': 'Muster Maria',
  '{{appointment_date}}': 'Montag, 12. März um 9 Uhr',
  '{{appointment_type}}': 'Allgemeinuntersuchung',
  '{{practice_name}}': 'Ordination Beispiel',
  '{{callback_phone}}': '+43 1 234 567',
}

const TEMPLATE_VARIABLES = Object.keys(EXAMPLE_VALUES)

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface KommunikationTabProps {
  tenantId: string
  hasEditRight: boolean
  initialCommRules: CommRuleRow[]
  initialTemplates: MessageTemplateRow[]
  initialSendLog: SendLogRow[]
}

// ---------------------------------------------------------------------------
// CommRegelSheet — inline sub-component
// ---------------------------------------------------------------------------

const initialCommRuleState: CommRuleActionState = {}
const initialToggleState: ToggleCommRuleState = {}

interface CommRegelSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingRule: CommRuleRow | null
  currentDirection: CommDirection
  onSaved: (rule: CommRuleRow, isEdit: boolean) => void
}

function CommRegelSheet({
  open,
  onOpenChange,
  editingRule,
  currentDirection,
  onSaved,
}: CommRegelSheetProps) {
  const isEdit = editingRule !== null

  // Local form state
  const [eventType, setEventType] = useState(editingRule?.event_type ?? '')
  const [channel, setChannel] = useState<CommChannel>(editingRule?.channel ?? 'email')
  const [channelTarget, setChannelTarget] = useState(editingRule?.channel_target ?? '')
  const [fallbackChannel, setFallbackChannel] = useState<CommChannel | ''>(
    editingRule?.fallback_channel ?? '',
  )
  const [fallbackChannelTarget, setFallbackChannelTarget] = useState(
    editingRule?.fallback_channel_target ?? '',
  )
  const [priority, setPriority] = useState<CommPriority>(editingRule?.priority ?? 'normal')
  const [timeWindowFrom, setTimeWindowFrom] = useState(editingRule?.time_window_from ?? '')
  const [timeWindowUntil, setTimeWindowUntil] = useState(editingRule?.time_window_until ?? '')
  const [retryIntervalMinutes, setRetryIntervalMinutes] = useState(
    editingRule?.retry_interval_minutes != null
      ? String(editingRule.retry_interval_minutes)
      : '',
  )
  const [maxRetries, setMaxRetries] = useState(String(editingRule?.max_retries ?? 3))
  const [privacyClass, setPrivacyClass] = useState(editingRule?.privacy_class ?? 'standard')
  const [activeRule, setActiveRule] = useState(editingRule?.active ?? true)
  const [isDirty, setIsDirty] = useState(false)

  // Determine available channels based on direction
  const direction = editingRule?.direction ?? currentDirection
  const availableChannels: CommChannel[] =
    direction === 'patient' ? ['email', 'sms'] : ['inbox', 'email', 'telegram', 'sms']

  function markDirty() {
    setIsDirty(true)
  }

  function resetToRule(rule: CommRuleRow | null) {
    setEventType(rule?.event_type ?? '')
    setChannel(rule?.channel ?? 'email')
    setChannelTarget(rule?.channel_target ?? '')
    setFallbackChannel(rule?.fallback_channel ?? '')
    setFallbackChannelTarget(rule?.fallback_channel_target ?? '')
    setPriority(rule?.priority ?? 'normal')
    setTimeWindowFrom(rule?.time_window_from ?? '')
    setTimeWindowUntil(rule?.time_window_until ?? '')
    setRetryIntervalMinutes(
      rule?.retry_interval_minutes != null ? String(rule.retry_interval_minutes) : '',
    )
    setMaxRetries(String(rule?.max_retries ?? 3))
    setPrivacyClass(rule?.privacy_class ?? 'standard')
    setActiveRule(rule?.active ?? true)
    setIsDirty(false)
  }

  const action = isEdit ? updateCommRuleAction : createCommRuleAction
  const [state, formAction, isPending] = useActionState(action, initialCommRuleState)

  // On success: propagate up
  if (state.success && open) {
    const savedRule: CommRuleRow = {
      id: editingRule?.id ?? crypto.randomUUID(),
      tenant_id: editingRule?.tenant_id ?? '',
      direction,
      event_type: eventType,
      channel,
      channel_target: channelTarget || null,
      fallback_channel: (fallbackChannel as CommChannel) || null,
      fallback_channel_target: fallbackChannelTarget || null,
      template_id: editingRule?.template_id ?? null,
      priority,
      time_window_from: timeWindowFrom || null,
      time_window_until: timeWindowUntil || null,
      retry_interval_minutes: retryIntervalMinutes ? Number(retryIntervalMinutes) : null,
      max_retries: Number(maxRetries),
      privacy_class: privacyClass,
      active: activeRule,
      created_at: editingRule?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    onSaved(savedRule, isEdit)
    onOpenChange(false)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData()
    if (isEdit && editingRule) {
      fd.set('id', editingRule.id)
    }
    fd.set('direction', direction)
    fd.set('event_type', eventType)
    fd.set('channel', channel)
    fd.set('channel_target', channelTarget)
    fd.set('fallback_channel', fallbackChannel)
    fd.set('fallback_channel_target', fallbackChannelTarget)
    fd.set('priority', priority)
    fd.set('time_window_from', timeWindowFrom)
    fd.set('time_window_until', timeWindowUntil)
    fd.set('retry_interval_minutes', retryIntervalMinutes)
    fd.set('max_retries', maxRetries)
    fd.set('privacy_class', privacyClass)
    fd.set('active', String(activeRule))
    formAction(fd)
  }

  const eventLabels = direction === 'intern' ? INTERNAL_EVENT_LABELS : PATIENT_EVENT_LABELS

  const privacyClassOptions =
    direction === 'intern'
      ? [
          { value: 'standard', label: 'Standard' },
          { value: 'restricted', label: 'Eingeschränkt (kein Patientenname)' },
          { value: 'minimal', label: 'Minimal (nur Ereignistyp)' },
        ]
      : [
          { value: 'standard', label: 'Standard (Name + Termin)' },
          { value: 'restricted', label: 'Eingeschränkt (kein Patientenname)' },
          { value: 'minimal', label: 'Minimal (nur Terminzeit)' },
        ]

  const retryOptions = [
    { value: '', label: 'Keine Wiederholung' },
    { value: '1', label: '1 Minute' },
    { value: '5', label: '5 Minuten' },
    { value: '15', label: '15 Minuten' },
    { value: '30', label: '30 Minuten' },
  ]

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          resetToRule(editingRule)
        }
        onOpenChange(v)
      }}
    >
      <SheetContent
        className="w-[540px] sm:max-w-[540px] overflow-y-auto"
        side="right"
        onInteractOutside={(e) => {
          if (isDirty) e.preventDefault()
        }}
      >
        <SheetHeader>
          <SheetTitle>
            {isEdit
              ? 'Benachrichtigungsregel bearbeiten'
              : direction === 'intern'
                ? 'Interne Regel erstellen'
                : 'Patientenregel erstellen'}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 px-1">
          {/* Richtung (read-only) */}
          <div className="space-y-1">
            <span className="text-xs font-medium">Richtung</span>
            <div className="mt-1">
              <Badge variant="outline">
                {direction === 'intern' ? 'Intern' : 'Patient'}
              </Badge>
            </div>
          </div>

          {/* Ereignistyp */}
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="comm-event-type">
              Ereignistyp <span className="text-destructive">*</span>
            </label>
            <Select
              value={eventType}
              onValueChange={(v) => {
                setEventType(v)
                markDirty()
              }}
            >
              <SelectTrigger id="comm-event-type">
                <SelectValue placeholder="Ereignis auswählen" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(eventLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Kanal */}
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="comm-channel">
              Kanal <span className="text-destructive">*</span>
            </label>
            <Select
              value={channel}
              onValueChange={(v) => {
                setChannel(v as CommChannel)
                setChannelTarget('')
                markDirty()
              }}
            >
              <SelectTrigger id="comm-channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableChannels.map((ch) => (
                  <SelectItem key={ch} value={ch}>
                    {CHANNEL_LABELS[ch]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Channel sub-fields */}
          {channel === 'email' && (
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="comm-channel-target-email">
                E-Mail-Adresse
              </label>
              <Input
                id="comm-channel-target-email"
                type="email"
                placeholder="praxis@beispiel.at"
                value={channelTarget}
                onChange={(e) => {
                  setChannelTarget(e.target.value)
                  markDirty()
                }}
              />
            </div>
          )}

          {channel === 'telegram' && (
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="comm-channel-target-telegram">
                Chat-ID oder Bot-Token
              </label>
              <Input
                id="comm-channel-target-telegram"
                placeholder="Chat-ID oder Bot-Token"
                value={channelTarget}
                onChange={(e) => {
                  setChannelTarget(e.target.value)
                  markDirty()
                }}
              />
            </div>
          )}

          {channel === 'sms' && (
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="comm-channel-target-sms">
                Telefonnummer
              </label>
              <Input
                id="comm-channel-target-sms"
                type="tel"
                placeholder="+43 664 123 456"
                value={channelTarget}
                onChange={(e) => {
                  setChannelTarget(e.target.value)
                  markDirty()
                }}
              />
            </div>
          )}

          {/* Fallback-Kanal */}
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="comm-fallback-channel">
              Fallback-Kanal
            </label>
            <Select
              value={fallbackChannel}
              onValueChange={(v) => {
                setFallbackChannel(v as CommChannel | '')
                setFallbackChannelTarget('')
                markDirty()
              }}
            >
              <SelectTrigger id="comm-fallback-channel">
                <SelectValue placeholder="Kein Fallback" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Kein Fallback</SelectItem>
                {availableChannels.map((ch) => (
                  <SelectItem key={ch} value={ch}>
                    {CHANNEL_LABELS[ch]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fallback sub-fields */}
          {fallbackChannel === 'email' && (
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="comm-fallback-target-email">
                Fallback E-Mail-Adresse
              </label>
              <Input
                id="comm-fallback-target-email"
                type="email"
                placeholder="praxis@beispiel.at"
                value={fallbackChannelTarget}
                onChange={(e) => {
                  setFallbackChannelTarget(e.target.value)
                  markDirty()
                }}
              />
            </div>
          )}

          {fallbackChannel === 'telegram' && (
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="comm-fallback-target-telegram">
                Fallback Chat-ID oder Bot-Token
              </label>
              <Input
                id="comm-fallback-target-telegram"
                placeholder="Chat-ID oder Bot-Token"
                value={fallbackChannelTarget}
                onChange={(e) => {
                  setFallbackChannelTarget(e.target.value)
                  markDirty()
                }}
              />
            </div>
          )}

          {fallbackChannel === 'sms' && (
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="comm-fallback-target-sms">
                Fallback Telefonnummer
              </label>
              <Input
                id="comm-fallback-target-sms"
                type="tel"
                placeholder="+43 664 123 456"
                value={fallbackChannelTarget}
                onChange={(e) => {
                  setFallbackChannelTarget(e.target.value)
                  markDirty()
                }}
              />
            </div>
          )}

          {/* Priorität */}
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="comm-priority">
              Priorität
            </label>
            <Select
              value={priority}
              onValueChange={(v) => {
                setPriority(v as CommPriority)
                markDirty()
              }}
            >
              <SelectTrigger id="comm-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">Hoch</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Niedrig</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Zeitfenster */}
          <div className="space-y-1">
            <span className="text-xs font-medium">Zeitfenster</span>
            <div className="flex gap-3 items-center">
              <div className="space-y-1 flex-1">
                <label className="text-xs text-muted-foreground" htmlFor="comm-time-from">
                  Von
                </label>
                <Input
                  id="comm-time-from"
                  type="time"
                  placeholder="08:00"
                  value={timeWindowFrom}
                  onChange={(e) => {
                    setTimeWindowFrom(e.target.value)
                    markDirty()
                  }}
                />
              </div>
              <div className="space-y-1 flex-1">
                <label className="text-xs text-muted-foreground" htmlFor="comm-time-until">
                  Bis
                </label>
                <Input
                  id="comm-time-until"
                  type="time"
                  placeholder="18:00"
                  value={timeWindowUntil}
                  onChange={(e) => {
                    setTimeWindowUntil(e.target.value)
                    markDirty()
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Leer lassen für uneingeschränkte Zustellung.
            </p>
          </div>

          {/* Wiederholungslogik */}
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="comm-retry-interval">
              Wiederholungslogik
            </label>
            <Select
              value={retryIntervalMinutes}
              onValueChange={(v) => {
                setRetryIntervalMinutes(v)
                markDirty()
              }}
            >
              <SelectTrigger id="comm-retry-interval">
                <SelectValue placeholder="Keine Wiederholung" />
              </SelectTrigger>
              <SelectContent>
                {retryOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Max. Versuche */}
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="comm-max-retries">
              Max. Versuche
            </label>
            <Input
              id="comm-max-retries"
              type="number"
              min="1"
              max="10"
              placeholder="3"
              value={maxRetries}
              onChange={(e) => {
                setMaxRetries(e.target.value)
                markDirty()
              }}
            />
          </div>

          {/* Datenschutzklasse */}
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="comm-privacy-class">
              Datenschutzklasse
            </label>
            <Select
              value={privacyClass}
              onValueChange={(v) => {
                setPrivacyClass(v)
                markDirty()
              }}
            >
              <SelectTrigger id="comm-privacy-class">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {privacyClassOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Aktiv Switch */}
          <div className="flex items-center gap-3">
            <Switch
              id="comm-active"
              checked={activeRule}
              onCheckedChange={(v) => {
                setActiveRule(v)
                markDirty()
              }}
              aria-label="Regel aktiv"
            />
            <label className="text-sm" htmlFor="comm-active">
              Regel aktiv
            </label>
          </div>

          {state.error && (
            <p role="alert" className="text-xs text-destructive mt-1">
              {state.error}
            </p>
          )}

          <SheetFooter className="pt-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Regel speichern
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Rules Table — shared between intern and patient sub-tabs
// ---------------------------------------------------------------------------

interface CommRulesTableProps {
  rules: CommRuleRow[]
  eventLabels: Record<string, string>
  hasEditRight: boolean
  onEdit: (rule: CommRuleRow) => void
  onDelete: (rule: CommRuleRow) => void
  onToggle: (rule: CommRuleRow) => void
  emptyText: string
}

function CommRulesTable({
  rules,
  eventLabels,
  hasEditRight,
  onEdit,
  onDelete,
  onToggle,
  emptyText,
}: CommRulesTableProps) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ereignis</TableHead>
            <TableHead>Kanal</TableHead>
            <TableHead>Fallback-Kanal</TableHead>
            <TableHead>Priorität</TableHead>
            <TableHead className="w-16 text-center">Aktiv</TableHead>
            {hasEditRight && <TableHead className="w-20 text-right">Aktionen</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={hasEditRight ? 6 : 5}
                className="text-center text-sm text-muted-foreground py-8"
              >
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            rules.map((rule) => (
              <TableRow key={rule.id} className={!rule.active ? 'opacity-60' : undefined}>
                <TableCell>
                  <span className="text-sm font-medium">
                    {eventLabels[rule.event_type] ?? rule.event_type}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="flex items-center w-fit">
                    {CHANNEL_ICONS[rule.channel]}
                    {CHANNEL_LABELS[rule.channel]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {rule.fallback_channel ? (
                    <Badge variant="outline" className="flex items-center w-fit">
                      {CHANNEL_ICONS[rule.fallback_channel]}
                      {CHANNEL_LABELS[rule.fallback_channel]}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{PRIORITY_LABELS[rule.priority]}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  {hasEditRight ? (
                    <Switch
                      checked={rule.active}
                      onCheckedChange={() => onToggle(rule)}
                      aria-label={`Benachrichtigungsregel aktiv: ${eventLabels[rule.event_type] ?? rule.event_type}`}
                    />
                  ) : (
                    <span className="text-sm">{rule.active ? 'Ja' : 'Nein'}</span>
                  )}
                </TableCell>
                {hasEditRight && (
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEdit(rule)}
                        aria-label={`${eventLabels[rule.event_type] ?? rule.event_type} bearbeiten`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onDelete(rule)}
                        aria-label={`${eventLabels[rule.event_type] ?? rule.event_type} entfernen`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main KommunikationTab Component
// ---------------------------------------------------------------------------

export function KommunikationTab({
  tenantId,
  hasEditRight,
  initialCommRules,
  initialTemplates,
  initialSendLog,
}: KommunikationTabProps) {
  // Comm rules state
  const [internRules, setInternRules] = useState<CommRuleRow[]>(
    initialCommRules.filter((r) => r.direction === 'intern'),
  )
  const [patientRules, setPatientRules] = useState<CommRuleRow[]>(
    initialCommRules.filter((r) => r.direction === 'patient'),
  )

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<CommRuleRow | null>(null)
  const [currentDirection, setCurrentDirection] = useState<CommDirection>('intern')
  const [deleteTarget, setDeleteTarget] = useState<CommRuleRow | null>(null)

  // Optimistic toggle for intern rules
  const [optimisticInternRules, setOptimisticInternRule] = useOptimistic(
    internRules,
    (prev: CommRuleRow[], update: { id: string; active: boolean }) =>
      prev.map((r) => (r.id === update.id ? { ...r, active: update.active } : r)),
  )

  // Optimistic toggle for patient rules
  const [optimisticPatientRules, setOptimisticPatientRule] = useOptimistic(
    patientRules,
    (prev: CommRuleRow[], update: { id: string; active: boolean }) =>
      prev.map((r) => (r.id === update.id ? { ...r, active: update.active } : r)),
  )

  const [, startToggleTransition] = useTransition()
  const [isDeletePending, startDeleteTransition] = useTransition()

  // Template state
  const [templates, setTemplates] = useState<MessageTemplateRow[]>(initialTemplates)
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplateRow | null>(null)
  const [templateDeleteTarget, setTemplateDeleteTarget] = useState<MessageTemplateRow | null>(null)
  const templateBodyRef = React.useRef<HTMLTextAreaElement>(null)

  // Template form state
  const [tmplName, setTmplName] = useState('')
  const [tmplChannel, setTmplChannel] = useState<'email' | 'sms' | 'telegram'>('email')
  const [tmplLang, setTmplLang] = useState('de')
  const [tmplSubject, setTmplSubject] = useState('')
  const [tmplBody, setTmplBody] = useState('')
  const [templateIsDirty, setTemplateIsDirty] = useState(false)
  const [isTemplatePending, startTemplateTransition] = useTransition()
  const [templateError, setTemplateError] = useState<string | undefined>()

  // Template delete pending
  const [isTemplateDeletePending, startTemplateDeleteTransition] = useTransition()

  // Send log state
  const [sendLog] = useState<SendLogRow[]>(initialSendLog)
  const [slFilterEvent, setSlFilterEvent] = useState('all')
  const [slFilterChannel, setSlFilterChannel] = useState('all')
  const [slFilterStatus, setSlFilterStatus] = useState('all')
  const [slPage, setSlPage] = useState(1)

  // ---------------------------------------------------------------------------
  // Comm rule handlers
  // ---------------------------------------------------------------------------

  function handleToggle(rule: CommRuleRow) {
    const newActive = !rule.active
    startToggleTransition(async () => {
      if (rule.direction === 'intern') {
        setOptimisticInternRule({ id: rule.id, active: newActive })
      } else {
        setOptimisticPatientRule({ id: rule.id, active: newActive })
      }
      const fd = new FormData()
      fd.set('id', rule.id)
      fd.set('active', String(newActive))
      const result = await toggleCommRuleAction(initialToggleState, fd)
      if (result.success) {
        if (rule.direction === 'intern') {
          setInternRules((prev) =>
            prev.map((r) => (r.id === rule.id ? { ...r, active: newActive } : r)),
          )
        } else {
          setPatientRules((prev) =>
            prev.map((r) => (r.id === rule.id ? { ...r, active: newActive } : r)),
          )
        }
      }
    })
  }

  function handleEdit(rule: CommRuleRow) {
    setEditingRule(rule)
    setCurrentDirection(rule.direction)
    setSheetOpen(true)
  }

  function handleSaved(savedRule: CommRuleRow, isEdit: boolean) {
    if (savedRule.direction === 'intern') {
      if (isEdit) {
        setInternRules((prev) => prev.map((r) => (r.id === savedRule.id ? savedRule : r)))
      } else {
        setInternRules((prev) => [...prev, savedRule])
      }
    } else {
      if (isEdit) {
        setPatientRules((prev) => prev.map((r) => (r.id === savedRule.id ? savedRule : r)))
      } else {
        setPatientRules((prev) => [...prev, savedRule])
      }
    }
    setEditingRule(null)
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    startDeleteTransition(async () => {
      const fd = new FormData()
      fd.set('id', target.id)
      const result = await deleteCommRuleAction({}, fd)
      if (result.success) {
        if (target.direction === 'intern') {
          setInternRules((prev) => prev.filter((r) => r.id !== target.id))
        } else {
          setPatientRules((prev) => prev.filter((r) => r.id !== target.id))
        }
      }
    })
  }

  const deleteTargetLabel =
    deleteTarget
      ? (deleteTarget.direction === 'intern'
          ? INTERNAL_EVENT_LABELS[deleteTarget.event_type]
          : PATIENT_EVENT_LABELS[deleteTarget.event_type]) ?? deleteTarget.event_type
      : ''

  // ---------------------------------------------------------------------------
  // Template handlers
  // ---------------------------------------------------------------------------

  function openCreateTemplate() {
    setEditingTemplate(null)
    setTmplName('')
    setTmplChannel('email')
    setTmplLang('de')
    setTmplSubject('')
    setTmplBody('')
    setTemplateIsDirty(false)
    setTemplateError(undefined)
    setTemplateSheetOpen(true)
  }

  function openEditTemplate(tmpl: MessageTemplateRow) {
    setEditingTemplate(tmpl)
    setTmplName(tmpl.name)
    setTmplChannel(tmpl.channel as 'email' | 'sms' | 'telegram')
    setTmplLang(tmpl.language_code)
    setTmplSubject(tmpl.subject ?? '')
    setTmplBody(tmpl.body)
    setTemplateIsDirty(false)
    setTemplateError(undefined)
    setTemplateSheetOpen(true)
  }

  function insertVariableAtCursor(variable: string) {
    const textarea = templateBodyRef.current
    if (!textarea) {
      setTmplBody((prev) => prev + variable)
      setTemplateIsDirty(true)
      return
    }
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newValue = tmplBody.slice(0, start) + variable + tmplBody.slice(end)
    setTmplBody(newValue)
    setTemplateIsDirty(true)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + variable.length, start + variable.length)
    })
  }

  function handleTemplateSave() {
    const fd = new FormData()
    if (editingTemplate) fd.set('id', editingTemplate.id)
    fd.set('name', tmplName)
    fd.set('channel', tmplChannel)
    fd.set('language_code', tmplLang)
    fd.set('subject', tmplSubject)
    fd.set('body', tmplBody)
    startTemplateTransition(async () => {
      const action = editingTemplate ? updateTemplateAction : createTemplateAction
      const result = await action({ success: undefined }, fd)
      if (result.error) {
        setTemplateError(result.error)
      } else {
        const updated: MessageTemplateRow = {
          id: result.id ?? editingTemplate?.id ?? crypto.randomUUID(),
          tenant_id: tenantId,
          name: tmplName,
          channel: tmplChannel,
          language_code: tmplLang,
          subject: tmplSubject || null,
          body: tmplBody,
          version: editingTemplate ? (editingTemplate.version + 1) : 1,
          created_at: editingTemplate?.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setTemplates((prev) =>
          editingTemplate
            ? prev.map((t) => (t.id === editingTemplate.id ? updated : t))
            : [...prev, updated],
        )
        setTemplateSheetOpen(false)
        setTemplateIsDirty(false)
        setTemplateError(undefined)
      }
    })
  }

  // Live preview computation
  const templatePreview = Object.entries(EXAMPLE_VALUES).reduce(
    (text, [key, val]) => text.replaceAll(key, val),
    tmplBody,
  )

  // ---------------------------------------------------------------------------
  // Send log filtered view
  // ---------------------------------------------------------------------------

  const filteredSendLog = sendLog
    .filter((l) => slFilterEvent === 'all' || l.event_type === slFilterEvent)
    .filter((l) => slFilterChannel === 'all' || l.channel === slFilterChannel)
    .filter((l) => slFilterStatus === 'all' || l.status === slFilterStatus)

  const paginatedSendLog = filteredSendLog.slice(0, slPage * 25)

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      <Tabs defaultValue="intern">
        <TabsList className="mb-4">
          <TabsTrigger value="intern">Interne Benachrichtigungen</TabsTrigger>
          <TabsTrigger value="patient">Patientenbenachrichtigungen</TabsTrigger>
          <TabsTrigger value="vorlagen">Nachrichtenvorlagen</TabsTrigger>
          <TabsTrigger value="protokoll">Versandprotokoll</TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------------- */}
        {/* Sub-Tab: Interne Benachrichtigungen                               */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="intern">
          <div className="space-y-3">
            {hasEditRight && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCurrentDirection('intern')
                    setEditingRule(null)
                    setSheetOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Regel hinzufügen
                </Button>
              </div>
            )}
            <CommRulesTable
              rules={optimisticInternRules}
              eventLabels={INTERNAL_EVENT_LABELS}
              hasEditRight={hasEditRight}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
              onToggle={handleToggle}
              emptyText="Noch keine internen Benachrichtigungsregeln konfiguriert."
            />
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* Sub-Tab: Patientenbenachrichtigungen                              */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="patient">
          <div className="space-y-3">
            {hasEditRight && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCurrentDirection('patient')
                    setEditingRule(null)
                    setSheetOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Regel hinzufügen
                </Button>
              </div>
            )}
            <CommRulesTable
              rules={optimisticPatientRules}
              eventLabels={PATIENT_EVENT_LABELS}
              hasEditRight={hasEditRight}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
              onToggle={handleToggle}
              emptyText="Noch keine Patientenbenachrichtigungsregeln konfiguriert."
            />
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* Sub-Tab: Nachrichtenvorlagen (COMM-05)                            */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="vorlagen">
          <div className="space-y-4">
            {/* Header with Add Button */}
            {hasEditRight && (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={openCreateTemplate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Vorlage erstellen
                </Button>
              </div>
            )}

            {/* Templates Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kanal</TableHead>
                  <TableHead>Sprache</TableHead>
                  <TableHead>Vorschau</TableHead>
                  {hasEditRight && <TableHead className="w-24">Aktionen</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={hasEditRight ? 5 : 4}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      Noch keine Nachrichtenvorlagen erstellt. Erstellen Sie Ihre erste Vorlage.
                    </TableCell>
                  </TableRow>
                ) : (
                  templates.map((tmpl) => (
                    <TableRow key={tmpl.id}>
                      <TableCell className="text-sm font-medium">{tmpl.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          {tmpl.channel === 'email' && (
                            <Mail className="h-3 w-3" aria-hidden="true" />
                          )}
                          {tmpl.channel === 'sms' && (
                            <MessageCircle className="h-3 w-3" aria-hidden="true" />
                          )}
                          {tmpl.channel === 'telegram' && (
                            <MessageSquare className="h-3 w-3" aria-hidden="true" />
                          )}
                          {CHANNEL_LABELS[tmpl.channel as CommChannel] ?? tmpl.channel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{tmpl.language_code}</Badge>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm text-muted-foreground cursor-default">
                                {tmpl.body.length > 60
                                  ? tmpl.body.slice(0, 60) + '…'
                                  : tmpl.body}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs whitespace-pre-wrap">
                              {tmpl.body}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      {hasEditRight && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditTemplate(tmpl)}
                              aria-label={`${tmpl.name} bearbeiten`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setTemplateDeleteTarget(tmpl)}
                              aria-label={`${tmpl.name} entfernen`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Nachrichtenvorlage Sheet */}
          <Sheet
            open={templateSheetOpen}
            onOpenChange={(open) => {
              if (!open && templateIsDirty) return
              setTemplateSheetOpen(open)
            }}
          >
            <SheetContent
              className="w-[600px] sm:max-w-[600px] overflow-y-auto"
              side="right"
              onInteractOutside={(e) => {
                if (templateIsDirty) e.preventDefault()
              }}
            >
              <SheetHeader>
                <SheetTitle>
                  {editingTemplate ? 'Vorlage bearbeiten' : 'Vorlage erstellen'}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-4 px-1">
                {/* Vorlagenname */}
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor="tmpl-name">
                    Vorlagenname <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="tmpl-name"
                    placeholder="Terminbestätigung Deutsch"
                    value={tmplName}
                    onChange={(e) => {
                      setTmplName(e.target.value)
                      setTemplateIsDirty(true)
                    }}
                  />
                </div>

                {/* Kanal */}
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor="tmpl-channel">
                    Kanal <span className="text-destructive">*</span>
                  </label>
                  <Select
                    value={tmplChannel}
                    onValueChange={(v) => {
                      setTmplChannel(v as 'email' | 'sms' | 'telegram')
                      setTemplateIsDirty(true)
                    }}
                  >
                    <SelectTrigger id="tmpl-channel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">E-Mail</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="telegram">Telegram</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Betreff (nur bei E-Mail) */}
                {tmplChannel === 'email' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium" htmlFor="tmpl-subject">
                      Betreff <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="tmpl-subject"
                      placeholder="Ihre Terminbestätigung — {{practice_name}}"
                      value={tmplSubject}
                      onChange={(e) => {
                        setTmplSubject(e.target.value)
                        setTemplateIsDirty(true)
                      }}
                    />
                  </div>
                )}

                {/* Sprache */}
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor="tmpl-lang">
                    Sprache
                  </label>
                  <Select
                    value={tmplLang}
                    onValueChange={(v) => {
                      setTmplLang(v)
                      setTemplateIsDirty(true)
                    }}
                  >
                    <SelectTrigger id="tmpl-lang">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="de">Deutsch (de)</SelectItem>
                      <SelectItem value="en">Englisch (en)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Nachrichtentext */}
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor="tmpl-body">
                    Nachrichtentext <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    id="tmpl-body"
                    ref={templateBodyRef}
                    className="min-h-48 font-mono text-sm"
                    placeholder="Guten Tag {{patient_name}}, Ihr Termin am {{appointment_date}} wurde bestätigt."
                    value={tmplBody}
                    onChange={(e) => {
                      setTmplBody(e.target.value)
                      setTemplateIsDirty(true)
                    }}
                  />

                  {/* Variable insert buttons */}
                  <div className="bg-muted rounded-md p-3 mt-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      Verfügbare Variablen — Klicken zum Einfügen
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {TEMPLATE_VARIABLES.map((variable) => (
                        <Button
                          key={variable}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="font-mono text-xs h-7"
                          aria-label={`Variable ${variable} einfügen`}
                          onClick={() => insertVariableAtCursor(variable)}
                        >
                          {variable}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Live Preview */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Vorschau (mit Beispieldaten)
                  </p>
                  <div className="bg-muted/50 border rounded-md p-3 text-sm text-muted-foreground whitespace-pre-wrap min-h-12">
                    {templatePreview || (
                      <span className="italic">Vorschau erscheint hier…</span>
                    )}
                  </div>
                </div>

                {templateError && (
                  <p role="alert" className="text-xs text-destructive">
                    {templateError}
                  </p>
                )}

                <SheetFooter className="pt-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={isTemplatePending}
                    onClick={handleTemplateSave}
                  >
                    {isTemplatePending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Vorlage speichern
                  </Button>
                </SheetFooter>
              </div>
            </SheetContent>
          </Sheet>

          {/* Delete template dialog */}
          <Dialog
            open={templateDeleteTarget !== null}
            onOpenChange={(open) => {
              if (!open) setTemplateDeleteTarget(null)
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Vorlage entfernen</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Möchten Sie die Vorlage &apos;{templateDeleteTarget?.name}&apos; entfernen?
                Kommunikationsregeln, die diese Vorlage verwenden, werden deaktiviert.
              </p>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setTemplateDeleteTarget(null)}
                  disabled={isTemplateDeletePending}
                >
                  Abbrechen
                </Button>
                <Button
                  variant="destructive"
                  disabled={isTemplateDeletePending}
                  onClick={() => {
                    if (!templateDeleteTarget) return
                    const target = templateDeleteTarget
                    setTemplateDeleteTarget(null)
                    startTemplateDeleteTransition(async () => {
                      const fd = new FormData()
                      fd.set('id', target.id)
                      const result = await deleteTemplateAction({ success: undefined }, fd)
                      if (result.success) {
                        setTemplates((prev) => prev.filter((t) => t.id !== target.id))
                      }
                    })
                  }}
                >
                  {isTemplateDeletePending && (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  )}
                  Entfernen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* Sub-Tab: Versandprotokoll (COMM-04)                               */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="protokoll">
          <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex flex-wrap gap-2">
              <Select value={slFilterEvent} onValueChange={(v) => { setSlFilterEvent(v); setSlPage(1) }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Alle Ereignisse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Ereignisse</SelectItem>
                  {Object.entries({ ...INTERNAL_EVENT_LABELS, ...PATIENT_EVENT_LABELS }).map(
                    ([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>

              <Select value={slFilterChannel} onValueChange={(v) => { setSlFilterChannel(v); setSlPage(1) }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Alle Kanäle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Kanäle</SelectItem>
                  {(Object.entries(CHANNEL_LABELS) as [CommChannel, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={slFilterStatus} onValueChange={(v) => { setSlFilterStatus(v); setSlPage(1) }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Alle Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="delivered">Zugestellt</SelectItem>
                  <SelectItem value="pending">Ausstehend</SelectItem>
                  <SelectItem value="failed">Fehlgeschlagen</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Send log table */}
            <Table aria-label="Versandprotokoll">
              <TableHeader>
                <TableRow>
                  <TableHead>Zeitpunkt</TableHead>
                  <TableHead>Ereignis</TableHead>
                  <TableHead>Kanal</TableHead>
                  <TableHead>Empfänger</TableHead>
                  <TableHead>Vorlage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fehler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSendLog.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      Noch keine Versandversuche protokolliert.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSendLog.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Intl.DateTimeFormat('de-AT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(log.sent_at))}
                      </TableCell>
                      <TableCell className="text-sm">
                        {INTERNAL_EVENT_LABELS[log.event_type] ??
                          PATIENT_EVENT_LABELS[log.event_type] ??
                          log.event_type}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          {log.channel === 'email' && (
                            <Mail className="h-3 w-3" aria-hidden="true" />
                          )}
                          {log.channel === 'sms' && (
                            <MessageCircle className="h-3 w-3" aria-hidden="true" />
                          )}
                          {log.channel === 'telegram' && (
                            <MessageSquare className="h-3 w-3" aria-hidden="true" />
                          )}
                          {log.channel === 'inbox' && (
                            <Inbox className="h-3 w-3" aria-hidden="true" />
                          )}
                          {CHANNEL_LABELS[log.channel as CommChannel] ?? log.channel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className="font-mono text-sm text-muted-foreground"
                          aria-label="Maskierte Empfängeradresse"
                        >
                          {log.recipient_masked}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.template_name
                          ? `${log.template_name} v${log.template_version}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {log.status === 'delivered' && (
                          <Badge className="bg-green-100 text-green-600 border-0">
                            Zugestellt
                          </Badge>
                        )}
                        {log.status === 'pending' && (
                          <Badge className="bg-yellow-100 text-yellow-600 border-0">
                            Ausstehend
                          </Badge>
                        )}
                        {log.status === 'failed' && (
                          <Badge className="bg-red-100 text-red-600 border-0">
                            Fehlgeschlagen
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.error_reason ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Load more */}
            {filteredSendLog.length > paginatedSendLog.length && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSlPage((p) => p + 1)}
                >
                  Ältere laden
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------------------------ */}
      {/* CommRegelSheet                                                       */}
      {/* ------------------------------------------------------------------ */}
      <CommRegelSheet
        open={sheetOpen}
        onOpenChange={(v) => {
          setSheetOpen(v)
          if (!v) setEditingRule(null)
        }}
        editingRule={editingRule}
        currentDirection={currentDirection}
        onSaved={handleSaved}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Delete Comm Rule Dialog                                              */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benachrichtigungsregel entfernen</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Möchten Sie die Regel für{' '}
            <span className="font-medium text-foreground">&apos;{deleteTargetLabel}&apos;</span>{' '}
            entfernen? Zukünftige Ereignisse werden nicht mehr benachrichtigt.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeletePending}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeletePending}
            >
              {isDeletePending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Entfernen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
