'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { Loader2, Pencil, Trash2, UserPlus, CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  addDeputyDoctorAction,
  updateDeputyDoctorAction,
  deleteDeputyDoctorAction,
} from '@/app/actions/deputy'
import type { DeputyDoctorRow, PidZeroBehavior } from '@/lib/types'

interface VertretungTabProps {
  tenantId: string
  hasEditRight: boolean
  initialDeputyDoctors: DeputyDoctorRow[]
}

const PID_ZERO_LABELS: Record<PidZeroBehavior, string> = {
  refuse: 'Ablehnen',
  waitlist: 'Warteliste',
  book_normal: 'Normal buchen',
  forward: 'Weiterleiten',
}

const isActiveDeputy = (doc: DeputyDoctorRow) => {
  const today = new Date().toISOString().slice(0, 10)
  return (
    doc.start_date != null &&
    doc.end_date != null &&
    doc.start_date <= today &&
    doc.end_date >= today
  )
}

// ---------------------------------------------------------------------------
// Form state helpers
// ---------------------------------------------------------------------------

interface FormState {
  name: string
  forwarding_number: string
  greeting_text: string
  start_date: Date | undefined
  end_date: Date | undefined
  pid_zero_behavior: PidZeroBehavior
  pid_zero_forward_number: string
  own_service_active: boolean
  own_service_prompt: string
  own_service_pid_zero_behavior: PidZeroBehavior | ''
}

function emptyForm(): FormState {
  return {
    name: '',
    forwarding_number: '',
    greeting_text: '',
    start_date: undefined,
    end_date: undefined,
    pid_zero_behavior: 'refuse',
    pid_zero_forward_number: '',
    own_service_active: false,
    own_service_prompt: '',
    own_service_pid_zero_behavior: '',
  }
}

function formFromRow(row: DeputyDoctorRow): FormState {
  return {
    name: row.name,
    forwarding_number: row.forwarding_number,
    greeting_text: row.greeting_text ?? '',
    start_date: row.start_date ? new Date(row.start_date) : undefined,
    end_date: row.end_date ? new Date(row.end_date) : undefined,
    pid_zero_behavior: row.pid_zero_behavior,
    pid_zero_forward_number: row.pid_zero_forward_number ?? '',
    own_service_active: row.own_service_active,
    own_service_prompt: row.own_service_prompt ?? '',
    own_service_pid_zero_behavior: row.own_service_pid_zero_behavior ?? '',
  }
}

function formToActionData(form: FormState) {
  return {
    name: form.name,
    forwarding_number: form.forwarding_number,
    greeting_text: form.greeting_text || undefined,
    start_date: form.start_date ? format(form.start_date, 'yyyy-MM-dd') : null,
    end_date: form.end_date ? format(form.end_date, 'yyyy-MM-dd') : null,
    pid_zero_behavior: form.pid_zero_behavior,
    pid_zero_forward_number: form.pid_zero_forward_number || null,
    own_service_active: form.own_service_active,
    own_service_prompt: form.own_service_prompt || undefined,
    own_service_pid_zero_behavior:
      form.own_service_active && form.own_service_pid_zero_behavior
        ? (form.own_service_pid_zero_behavior as PidZeroBehavior)
        : null,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VertretungTab({
  hasEditRight,
  initialDeputyDoctors,
}: VertretungTabProps) {
  const [deputyDoctors, setDeputyDoctors] = useState<DeputyDoctorRow[]>(initialDeputyDoctors)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editTarget, setEditTarget] = useState<DeputyDoctorRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeputyDoctorRow | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Form fields
  const [form, setForm] = useState<FormState>(emptyForm())

  function openAdd() {
    setForm(emptyForm())
    setEditTarget(null)
    setActionError(null)
    setShowAddForm(true)
  }

  function openEdit(doc: DeputyDoctorRow) {
    setForm(formFromRow(doc))
    setEditTarget(doc)
    setActionError(null)
    setShowAddForm(false)
  }

  function closeForm() {
    setShowAddForm(false)
    setEditTarget(null)
    setActionError(null)
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit() {
    setActionError(null)
    const data = formToActionData(form)

    startTransition(async () => {
      if (editTarget) {
        const result = await updateDeputyDoctorAction({ id: editTarget.id, ...data })
        if (result.error) {
          setActionError(result.error)
          return
        }
        setDeputyDoctors((prev) =>
          prev.map((d) =>
            d.id === editTarget.id
              ? {
                  ...d,
                  ...data,
                  start_date: data.start_date ?? null,
                  end_date: data.end_date ?? null,
                  greeting_text: data.greeting_text ?? null,
                  own_service_prompt: data.own_service_prompt ?? null,
                  updated_at: new Date().toISOString(),
                }
              : d,
          ),
        )
        closeForm()
      } else {
        const result = await addDeputyDoctorAction(data)
        if (result.error) {
          setActionError(result.error)
          return
        }
        // Optimistic: add with placeholder id; real list reloads on next navigation
        setDeputyDoctors((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            tenant_id: '',
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...data,
            start_date: data.start_date ?? null,
            end_date: data.end_date ?? null,
            greeting_text: data.greeting_text ?? null,
            own_service_prompt: data.own_service_prompt ?? null,
          } satisfies DeputyDoctorRow,
        ])
        closeForm()
      }
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteDeputyDoctorAction({ id: deleteTarget.id })
      if (!result.error) {
        setDeputyDoctors((prev) => prev.filter((d) => d.id !== deleteTarget.id))
      }
      setDeleteTarget(null)
    })
  }

  const formVisible = showAddForm || editTarget !== null

  return (
    <div className="space-y-6">

      {/* SECTION 1 — Deputy list */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Vertretungsärzte</h3>
          {hasEditRight && (
            <Button size="sm" variant="outline" onClick={openAdd}>
              <UserPlus className="mr-1 h-4 w-4" />
              Vertretungsarzt hinzufügen
            </Button>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Weiterleitungsnummer</TableHead>
              <TableHead>Zeitraum</TableHead>
              <TableHead>PID=0-Verhalten</TableHead>
              {hasEditRight && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {deputyDoctors.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={hasEditRight ? 5 : 4}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  Noch keine Vertretungsärzte angelegt. Fügen Sie einen Vertretungsarzt hinzu.
                </TableCell>
              </TableRow>
            ) : (
              deputyDoctors.map((doc) => {
                const active = isActiveDeputy(doc)
                return (
                  <TableRow key={doc.id} className={active ? 'bg-green-50' : ''}>
                    <TableCell className="text-sm font-medium">
                      <span className="flex items-center gap-2">
                        {doc.name}
                        {active && (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            Aktiv
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{doc.forwarding_number}</TableCell>
                    <TableCell className="text-sm">
                      {doc.start_date && doc.end_date
                        ? `${doc.start_date} – ${doc.end_date}`
                        : '–'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {PID_ZERO_LABELS[doc.pid_zero_behavior]}
                    </TableCell>
                    {hasEditRight && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(doc)}
                            aria-label="Vertretungsarzt bearbeiten"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteTarget(doc)}
                            aria-label="Vertretungsarzt entfernen"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* SECTION 2 — Add / Edit form */}
      {formVisible && hasEditRight && (
        <div className="mt-4 rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            {editTarget ? 'Vertretungsarzt bearbeiten' : 'Vertretungsarzt hinzufügen'}
          </h3>

          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Dr. Muster"
              />
            </div>

            {/* Weiterleitungsnummer */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Weiterleitungsnummer</label>
              <Input
                type="tel"
                value={form.forwarding_number}
                onChange={(e) => setField('forwarding_number', e.target.value)}
                placeholder="+43 1 234 5678"
              />
            </div>

            {/* Begrüßungstext */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Begrüßungstext</label>
              <Textarea
                value={form.greeting_text}
                onChange={(e) => setField('greeting_text', e.target.value)}
                placeholder="Optionaler Begrüßungstext für den Vertretungsmodus…"
                className="min-h-20"
              />
            </div>

            {/* Zeitraum */}
            <div className="flex flex-wrap gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Zeitraum Von</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-40 justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.start_date ? format(form.start_date, 'dd.MM.yyyy') : 'Datum wählen'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={form.start_date}
                      onSelect={(d) => setField('start_date', d)}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Zeitraum Bis</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-40 justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.end_date ? format(form.end_date, 'dd.MM.yyyy') : 'Datum wählen'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={form.end_date}
                      onSelect={(d) => setField('end_date', d)}
                      disabled={(d) =>
                        form.start_date != null && d < form.start_date
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* PID=0 Verhalten */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">PID=0-Verhalten</label>
              <Select
                value={form.pid_zero_behavior}
                onValueChange={(v) => setField('pid_zero_behavior', v as PidZeroBehavior)}
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="refuse">Ablehnen</SelectItem>
                  <SelectItem value="waitlist">Warteliste</SelectItem>
                  <SelectItem value="book_normal">Normal buchen</SelectItem>
                  <SelectItem value="forward">Weiterleiten</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Weiterleitungsnummer bei PID=0 (conditional) */}
            {form.pid_zero_behavior === 'forward' && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Weiterleitungsnummer bei PID=0
                </label>
                <Input
                  type="tel"
                  value={form.pid_zero_forward_number}
                  onChange={(e) => setField('pid_zero_forward_number', e.target.value)}
                  placeholder="+43 1 234 5678"
                />
              </div>
            )}

            {/* Eigener Vertretungsdienst — DEPUTY-04 */}
            <div className="rounded-md border p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Switch
                  id="own-service-active"
                  checked={form.own_service_active}
                  onCheckedChange={(v) => setField('own_service_active', v)}
                />
                <label
                  htmlFor="own-service-active"
                  className="text-sm font-medium text-gray-700 cursor-pointer"
                >
                  Eigener Vertretungsdienst aktiv
                </label>
              </div>

              {form.own_service_active && (
                <>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">
                      Spezieller Prompt für Vertretungsdienst
                    </label>
                    <Textarea
                      value={form.own_service_prompt}
                      onChange={(e) => setField('own_service_prompt', e.target.value)}
                      placeholder="Systemanweisungen für den Vertretungsdienst der KI…"
                      className="min-h-24"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">
                      PID=0-Verhalten (Eigener Vertretungsdienst)
                    </label>
                    <Select
                      value={form.own_service_pid_zero_behavior}
                      onValueChange={(v) =>
                        setField('own_service_pid_zero_behavior', v as PidZeroBehavior)
                      }
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Bitte wählen…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="refuse">Ablehnen</SelectItem>
                        <SelectItem value="waitlist">Warteliste</SelectItem>
                        <SelectItem value="book_normal">Normal buchen</SelectItem>
                        <SelectItem value="forward">Weiterleiten</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>

            {/* Error */}
            {actionError && (
              <p role="alert" className="text-xs text-destructive">
                {actionError}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button onClick={handleSubmit} disabled={isPending} size="sm">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editTarget ? 'Speichern' : 'Hinzufügen'}
              </Button>
              <Button variant="outline" size="sm" onClick={closeForm} disabled={isPending}>
                Abbrechen
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vertretungsarzt entfernen</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sind Sie sicher, dass Sie{' '}
            <span className="font-medium text-foreground">{deleteTarget?.name}</span> als
            Vertretungsarzt entfernen möchten? Dieser Schritt kann nicht rückgängig gemacht werden.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isPending}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entfernen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
