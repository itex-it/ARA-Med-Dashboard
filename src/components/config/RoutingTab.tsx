'use client'

import { useState, useTransition, useOptimistic, useActionState } from 'react'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import {
  createRoutingRuleAction,
  updateRoutingRuleAction,
  deleteRoutingRuleAction,
  toggleRoutingRuleAction,
  upsertVipNumberAction,
  deleteVipNumberAction,
  type RoutingRuleActionState,
  type VipNumberActionState,
  type ToggleRoutingRuleState,
} from '@/lib/actions/routing'
import type { RoutingRuleRow, VipNumberRow, RoutingConditionType, RoutingActionType } from '@/lib/types'

// ---------------------------------------------------------------------------
// Label Maps
// ---------------------------------------------------------------------------

const AKTION_LABELS: Record<RoutingActionType, string> = {
  direct_connect: 'Direkt verbinden',
  custom_prompt: 'Eigener Prompt',
  create_ticket: 'Ticket erstellen',
  offer_bypass_slot: 'Bypass-Slot anbieten',
  forward_to_number: 'An Nummer weiterleiten',
  record_message: 'Nachricht aufnehmen',
}

const BEDINGUNG_LABELS: Record<RoutingConditionType, string> = {
  phone: 'Telefonnummer',
  intent: 'Intent',
  time_period: 'Zeitraum',
  mode: 'Modus',
}

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const MODE_OPTIONS = ['Normal', 'Urlaub', 'Vertretung', 'Eigener Vertretungsdienst', 'Überlastung']

// ---------------------------------------------------------------------------
// Condition summary helper
// ---------------------------------------------------------------------------

function getConditionSummary(rule: RoutingRuleRow): string {
  const cv = rule.condition_value
  switch (rule.condition_type) {
    case 'phone':
      return `Telefonnummer: ${String(cv.phones ?? '')}`
    case 'intent':
      return `Intent: ${String(cv.intent ?? '')}`
    case 'time_period': {
      const weekdays = Array.isArray(cv.weekdays)
        ? (cv.weekdays as number[]).map((i) => WEEKDAY_LABELS[i] ?? '').join(', ')
        : ''
      return `Zeitraum: ${weekdays}${cv.from ? ' ' + String(cv.from) : ''}${cv.until ? '–' + String(cv.until) : ''}`
    }
    case 'mode':
      return `Modus: ${String(cv.mode ?? '')}`
    default:
      return ''
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RoutingTabProps {
  tenantId: string
  hasEditRight: boolean
  initialRoutingRules: RoutingRuleRow[]
  initialVipNumbers: VipNumberRow[]
}

// ---------------------------------------------------------------------------
// RoutingRegelSheet — inline sub-component
// ---------------------------------------------------------------------------

const initialRuleState: RoutingRuleActionState = {}

interface RoutingRegelSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingRule: RoutingRuleRow | null
  onSaved: (rule: RoutingRuleRow) => void
}

function RoutingRegelSheet({ open, onOpenChange, editingRule, onSaved }: RoutingRegelSheetProps) {
  const isEdit = editingRule !== null

  // Local form state
  const [name, setName] = useState(editingRule?.name ?? '')
  const [conditionType, setConditionType] = useState<RoutingConditionType>(
    editingRule?.condition_type ?? 'phone',
  )
  const [phoneInput, setPhoneInput] = useState(
    String(editingRule?.condition_value?.phones ?? ''),
  )
  const [intentInput, setIntentInput] = useState(
    String(editingRule?.condition_value?.intent ?? ''),
  )
  const [weekdays, setWeekdays] = useState<number[]>(
    Array.isArray(editingRule?.condition_value?.weekdays)
      ? (editingRule.condition_value.weekdays as number[])
      : [],
  )
  const [timeFrom, setTimeFrom] = useState(String(editingRule?.condition_value?.from ?? ''))
  const [timeUntil, setTimeUntil] = useState(String(editingRule?.condition_value?.until ?? ''))
  const [modeValue, setModeValue] = useState(String(editingRule?.condition_value?.mode ?? 'Normal'))
  const [actionType, setActionType] = useState<RoutingActionType>(
    editingRule?.action_type ?? 'direct_connect',
  )
  const [promptText, setPromptText] = useState(String(editingRule?.action_value?.prompt ?? ''))
  const [forwardNumber, setForwardNumber] = useState(
    String(editingRule?.action_value?.number ?? ''),
  )
  const [priority, setPriority] = useState(editingRule?.priority ?? 1)
  const [activeRule, setActiveRule] = useState(editingRule?.active ?? true)
  const [isDirty, setIsDirty] = useState(false)

  // Sync when editingRule changes (sheet reopened for a different rule)
  function resetToRule(rule: RoutingRuleRow | null) {
    setName(rule?.name ?? '')
    setConditionType(rule?.condition_type ?? 'phone')
    setPhoneInput(String(rule?.condition_value?.phones ?? ''))
    setIntentInput(String(rule?.condition_value?.intent ?? ''))
    setWeekdays(
      Array.isArray(rule?.condition_value?.weekdays)
        ? (rule.condition_value.weekdays as number[])
        : [],
    )
    setTimeFrom(String(rule?.condition_value?.from ?? ''))
    setTimeUntil(String(rule?.condition_value?.until ?? ''))
    setModeValue(String(rule?.condition_value?.mode ?? 'Normal'))
    setActionType(rule?.action_type ?? 'direct_connect')
    setPromptText(String(rule?.action_value?.prompt ?? ''))
    setForwardNumber(String(rule?.action_value?.number ?? ''))
    setPriority(rule?.priority ?? 1)
    setActiveRule(rule?.active ?? true)
    setIsDirty(false)
  }

  function markDirty() {
    setIsDirty(true)
  }

  function buildConditionValue(): Record<string, unknown> {
    switch (conditionType) {
      case 'phone':
        return { phones: phoneInput }
      case 'intent':
        return { intent: intentInput }
      case 'time_period':
        return { weekdays, from: timeFrom, until: timeUntil }
      case 'mode':
        return { mode: modeValue }
    }
  }

  function buildActionValue(): Record<string, unknown> {
    switch (actionType) {
      case 'custom_prompt':
        return { prompt: promptText }
      case 'forward_to_number':
        return { number: forwardNumber }
      default:
        return {}
    }
  }

  const action = isEdit ? updateRoutingRuleAction : createRoutingRuleAction
  const [state, formAction, isPending] = useActionState(action, initialRuleState)

  // On success: propagate up
  if (state.success && open) {
    const conditionValue = buildConditionValue()
    const actionValue = buildActionValue()
    const savedRule: RoutingRuleRow = {
      id: editingRule?.id ?? crypto.randomUUID(),
      tenant_id: editingRule?.tenant_id ?? '',
      name,
      condition_type: conditionType,
      condition_value: conditionValue,
      action_type: actionType,
      action_value: actionValue,
      priority,
      active: activeRule,
      created_at: editingRule?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    onSaved(savedRule)
    onOpenChange(false)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData()
    if (isEdit && editingRule) {
      fd.set('id', editingRule.id)
    }
    fd.set('name', name)
    fd.set('condition_type', conditionType)
    fd.set('condition_value', JSON.stringify(buildConditionValue()))
    fd.set('action_type', actionType)
    fd.set('action_value', JSON.stringify(buildActionValue()))
    fd.set('priority', String(priority))
    fd.set('active', String(activeRule))
    formAction(fd)
  }

  function toggleWeekday(idx: number) {
    markDirty()
    setWeekdays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx],
    )
  }

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
            {isEdit ? 'Routing-Regel bearbeiten' : 'Routing-Regel erstellen'}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 px-1">
          {/* Bezeichnung */}
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="rule-name">
              Bezeichnung <span className="text-destructive">*</span>
            </label>
            <Input
              id="rule-name"
              placeholder="z. B. VIP-Anrufer Direktverbindung"
              value={name}
              onChange={(e) => { setName(e.target.value); markDirty() }}
              required
            />
          </div>

          {/* Bedingungstyp */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Bedingungstyp</label>
            <Select
              value={conditionType}
              onValueChange={(v) => {
                setConditionType(v as RoutingConditionType)
                markDirty()
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(BEDINGUNG_LABELS) as RoutingConditionType[]).map((ct) => (
                  <SelectItem key={ct} value={ct}>
                    {BEDINGUNG_LABELS[ct]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conditional condition fields */}
          {conditionType === 'phone' && (
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="cond-phone">
                Telefonnummer(n)
              </label>
              <Input
                id="cond-phone"
                type="tel"
                placeholder="+43 1 234 567"
                value={phoneInput}
                onChange={(e) => { setPhoneInput(e.target.value); markDirty() }}
              />
              <p className="text-xs text-muted-foreground">Mehrere Nummern mit Komma trennen</p>
            </div>
          )}

          {conditionType === 'intent' && (
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="cond-intent">
                Intent
              </label>
              <Input
                id="cond-intent"
                placeholder="Intent auswählen"
                value={intentInput}
                onChange={(e) => { setIntentInput(e.target.value); markDirty() }}
              />
            </div>
          )}

          {conditionType === 'time_period' && (
            <div className="space-y-2">
              <label className="text-xs font-medium">Wochentage</label>
              <div className="flex gap-1 flex-wrap">
                {WEEKDAY_LABELS.map((label, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleWeekday(idx)}
                    className={`min-h-[44px] min-w-[44px] rounded-md border text-sm font-medium transition-colors ${
                      weekdays.includes(idx)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-input hover:bg-accent'
                    }`}
                    aria-pressed={weekdays.includes(idx)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 items-center">
                <div className="space-y-1 flex-1">
                  <label className="text-xs font-medium" htmlFor="time-from">Von</label>
                  <Input
                    id="time-from"
                    placeholder="HH:MM"
                    value={timeFrom}
                    onChange={(e) => { setTimeFrom(e.target.value); markDirty() }}
                  />
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-xs font-medium" htmlFor="time-until">Bis</label>
                  <Input
                    id="time-until"
                    placeholder="HH:MM"
                    value={timeUntil}
                    onChange={(e) => { setTimeUntil(e.target.value); markDirty() }}
                  />
                </div>
              </div>
            </div>
          )}

          {conditionType === 'mode' && (
            <div className="space-y-1">
              <label className="text-xs font-medium">Modus</label>
              <Select
                value={modeValue}
                onValueChange={(v) => { setModeValue(v); markDirty() }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Aktion */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Aktion</label>
            <Select
              value={actionType}
              onValueChange={(v) => { setActionType(v as RoutingActionType); markDirty() }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(AKTION_LABELS) as RoutingActionType[]).map((at) => (
                  <SelectItem key={at} value={at}>
                    {AKTION_LABELS[at]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conditional action sub-fields */}
          {actionType === 'custom_prompt' && (
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="action-prompt">
                Eigener Prompt
              </label>
              <Textarea
                id="action-prompt"
                className="min-h-24 resize-none"
                placeholder="Guten Tag, Sie werden bevorzugt weitergeleitet…"
                value={promptText}
                onChange={(e) => { setPromptText(e.target.value); markDirty() }}
              />
            </div>
          )}

          {actionType === 'forward_to_number' && (
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="action-fwd-number">
                Weiterleitungsnummer <span className="text-destructive">*</span>
              </label>
              <Input
                id="action-fwd-number"
                type="tel"
                placeholder="+43 1 234 567"
                value={forwardNumber}
                onChange={(e) => { setForwardNumber(e.target.value); markDirty() }}
                required
              />
            </div>
          )}

          {/* Priorität */}
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="rule-priority">
              Priorität
            </label>
            <Input
              id="rule-priority"
              type="number"
              min="1"
              placeholder="1"
              value={priority}
              onChange={(e) => { setPriority(Number(e.target.value)); markDirty() }}
            />
            <p className="text-xs text-muted-foreground">1 = höchste Priorität</p>
          </div>

          {/* Aktiv Switch */}
          <div className="flex items-center gap-3">
            <Switch
              id="rule-active"
              checked={activeRule}
              onCheckedChange={(v) => { setActiveRule(v); markDirty() }}
              aria-label="Regel aktiv"
            />
            <label className="text-sm" htmlFor="rule-active">Regel aktiv</label>
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
// Main RoutingTab Component
// ---------------------------------------------------------------------------

const initialVipState: VipNumberActionState = {}
const initialToggleState: ToggleRoutingRuleState = {}

export function RoutingTab({
  hasEditRight,
  initialRoutingRules,
  initialVipNumbers,
}: RoutingTabProps) {
  const [rules, setRules] = useState<RoutingRuleRow[]>(initialRoutingRules)
  const [vipNumbers, setVipNumbers] = useState<VipNumberRow[]>(initialVipNumbers)

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<RoutingRuleRow | null>(null)

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<RoutingRuleRow | null>(null)
  const [vipDeleteTarget, setVipDeleteTarget] = useState<VipNumberRow | null>(null)

  // VIP inline add form
  const [vipPhoneInput, setVipPhoneInput] = useState('')
  const [vipLabelInput, setVipLabelInput] = useState('')
  const [isVipPending, startVipTransition] = useTransition()

  // Delete transitions
  const [isDeletePending, startDeleteTransition] = useTransition()
  const [isVipDeletePending, startVipDeleteTransition] = useTransition()

  // Optimistic toggle state (per-rule)
  const [optimisticRules, setOptimisticRule] = useOptimistic(
    rules,
    (prev: RoutingRuleRow[], update: { id: string; active: boolean }) =>
      prev.map((r) => (r.id === update.id ? { ...r, active: update.active } : r)),
  )

  // Toggle transition for Switch
  const [, startToggleTransition] = useTransition()

  function handleToggle(rule: RoutingRuleRow) {
    const newActive = !rule.active
    startToggleTransition(async () => {
      setOptimisticRule({ id: rule.id, active: newActive })
      const fd = new FormData()
      fd.set('id', rule.id)
      fd.set('active', String(newActive))
      const result = await toggleRoutingRuleAction(initialToggleState, fd)
      if (result.success) {
        setRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, active: newActive } : r)),
        )
      }
    })
  }

  function handleAddRule() {
    setEditingRule(null)
    setSheetOpen(true)
  }

  function handleEditRule(rule: RoutingRuleRow) {
    setEditingRule(rule)
    setSheetOpen(true)
  }

  function handleRuleSaved(savedRule: RoutingRuleRow) {
    if (editingRule) {
      setRules((prev) => prev.map((r) => (r.id === savedRule.id ? savedRule : r)))
    } else {
      setRules((prev) => [...prev, savedRule])
    }
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    startDeleteTransition(async () => {
      const fd = new FormData()
      fd.set('id', target.id)
      const result = await deleteRoutingRuleAction({}, fd)
      if (result.success) {
        setRules((prev) => prev.filter((r) => r.id !== target.id))
      }
    })
  }

  function handleVipAdd() {
    if (!vipPhoneInput.trim()) return
    startVipTransition(async () => {
      const fd = new FormData()
      fd.set('phone_number', vipPhoneInput.trim())
      fd.set('label', vipLabelInput.trim())
      const result = await upsertVipNumberAction(initialVipState, fd)
      if (result.success) {
        const newEntry: VipNumberRow = {
          id: crypto.randomUUID(),
          tenant_id: '',
          phone_number: vipPhoneInput.trim(),
          label: vipLabelInput.trim(),
          created_at: new Date().toISOString(),
        }
        setVipNumbers((prev) => {
          const exists = prev.find((v) => v.phone_number === newEntry.phone_number)
          if (exists) {
            return prev.map((v) =>
              v.phone_number === newEntry.phone_number ? { ...v, label: newEntry.label } : v,
            )
          }
          return [...prev, newEntry]
        })
        setVipPhoneInput('')
        setVipLabelInput('')
      }
    })
  }

  function handleVipDeleteConfirm() {
    if (!vipDeleteTarget) return
    const target = vipDeleteTarget
    setVipDeleteTarget(null)
    startVipDeleteTransition(async () => {
      const fd = new FormData()
      fd.set('id', target.id)
      const result = await deleteVipNumberAction(initialVipState, fd)
      if (result.success) {
        setVipNumbers((prev) => prev.filter((v) => v.id !== target.id))
      }
    })
  }

  return (
    <div className="space-y-6">

      {/* ------------------------------------------------------------------ */}
      {/* Section 1 — Routing-Regeln                                         */}
      {/* ------------------------------------------------------------------ */}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Routing-Regeln
          </p>
          {hasEditRight && (
            <Button variant="outline" size="sm" onClick={handleAddRule}>
              <Plus className="h-4 w-4 mr-1" />
              Regel hinzufügen
            </Button>
          )}
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Priorität</TableHead>
                <TableHead>Bezeichnung</TableHead>
                <TableHead>Bedingung</TableHead>
                <TableHead>Aktion</TableHead>
                <TableHead className="w-16 text-center">Aktiv</TableHead>
                {hasEditRight && (
                  <TableHead className="w-20 text-right">Aktionen</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {optimisticRules.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={hasEditRight ? 6 : 5}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Noch keine Routing-Regeln konfiguriert. Erstellen Sie Ihre erste Regel.
                  </TableCell>
                </TableRow>
              ) : (
                optimisticRules.map((rule) => (
                  <TableRow
                    key={rule.id}
                    className={!rule.active ? 'opacity-60' : undefined}
                  >
                    <TableCell>
                      <span className="text-sm font-mono">{rule.priority}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{rule.name}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {getConditionSummary(rule)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{AKTION_LABELS[rule.action_type]}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {hasEditRight ? (
                        <Switch
                          checked={rule.active}
                          onCheckedChange={() => handleToggle(rule)}
                          aria-label={`Routing-Regel aktiv: ${rule.name}`}
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
                            onClick={() => handleEditRule(rule)}
                            aria-label={`${rule.name} bearbeiten`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(rule)}
                            aria-label={`${rule.name} entfernen`}
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
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* RoutingRegelSheet                                                    */}
      {/* ------------------------------------------------------------------ */}

      <RoutingRegelSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editingRule={editingRule}
        onSaved={handleRuleSaved}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Delete Routing Rule Dialog                                           */}
      {/* ------------------------------------------------------------------ */}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Routing-Regel entfernen</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Möchten Sie die Regel{' '}
            <span className="font-medium text-foreground">
              &apos;{deleteTarget?.name}&apos;
            </span>{' '}
            entfernen? Eingehende Anrufe werden diese Regel nicht mehr verwenden.
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

      {/* ------------------------------------------------------------------ */}
      {/* Section 2 — VIP/WIP-Nummern                                        */}
      {/* ------------------------------------------------------------------ */}

      <Separator />

      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            VIP/WIP-Nummern
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Anrufe von diesen Nummern werden immer direkt durchgestellt, unabhängig von Routing-Regeln.
          </p>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Telefonnummer</TableHead>
                <TableHead>Bezeichnung</TableHead>
                <TableHead className="w-16">Status</TableHead>
                {hasEditRight && (
                  <TableHead className="w-16 text-right">Aktionen</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {vipNumbers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={hasEditRight ? 4 : 3}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Noch keine VIP-Nummern konfiguriert.
                  </TableCell>
                </TableRow>
              ) : (
                vipNumbers.map((vip) => (
                  <TableRow key={vip.id}>
                    <TableCell>
                      <span className="font-mono text-sm">{vip.phone_number}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{vip.label}</span>
                    </TableCell>
                    <TableCell>
                      <span className="bg-blue-100 text-blue-700 border border-blue-200 text-xs rounded-full px-2 py-0.5">
                        VIP
                      </span>
                    </TableCell>
                    {hasEditRight && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setVipDeleteTarget(vip)}
                          aria-label={`${vip.phone_number} aus VIP-Liste entfernen`}
                          disabled={isVipDeletePending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Inline add form */}
        {hasEditRight && (
          <div className="flex gap-2 items-center">
            <Input
              type="tel"
              placeholder="+43 1 234 567"
              className="w-40"
              value={vipPhoneInput}
              onChange={(e) => setVipPhoneInput(e.target.value)}
              aria-label="VIP-Telefonnummer"
            />
            <Input
              placeholder="Bezeichnung (z. B. Dr. Müller Privat)"
              className="flex-1"
              value={vipLabelInput}
              onChange={(e) => setVipLabelInput(e.target.value)}
              aria-label="VIP-Bezeichnung"
            />
            <Button
              variant="default"
              size="sm"
              onClick={handleVipAdd}
              disabled={isVipPending || !vipPhoneInput.trim()}
            >
              {isVipPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Hinzufügen
            </Button>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Delete VIP Dialog                                                    */}
      {/* ------------------------------------------------------------------ */}

      <Dialog
        open={!!vipDeleteTarget}
        onOpenChange={(open) => { if (!open) setVipDeleteTarget(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>VIP-Nummer entfernen</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Möchten Sie die Nummer{' '}
            <span className="font-mono font-medium text-foreground">
              {vipDeleteTarget?.phone_number}
            </span>
            {vipDeleteTarget?.label && (
              <> ({vipDeleteTarget.label})</>
            )}{' '}
            aus der VIP-Liste entfernen?
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVipDeleteTarget(null)}
              disabled={isVipDeletePending}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleVipDeleteConfirm}
              disabled={isVipDeletePending}
            >
              {isVipDeletePending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Entfernen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
