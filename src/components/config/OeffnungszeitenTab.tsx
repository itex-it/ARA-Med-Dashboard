'use client'

import { useActionState, useTransition, useState } from 'react'
import { Loader2, Plus, Trash2, CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
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
  saveOpeningHoursAction,
  addSpecialDayAction,
  deleteSpecialDayAction,
  addDeputyPeriodAction,
  deleteDeputyPeriodAction,
} from '@/app/actions/opening-hours'
import type { OpeningHoursRow, SpecialDayRow, DeputyPeriodRow } from '@/lib/types'

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const DEFAULT_HOURS: OpeningHoursRow[] = Array.from({ length: 7 }, (_, i) => ({
  id: '',
  tenant_id: '',
  weekday: i,
  open_from: '08:00',
  open_until: '17:00',
  is_closed: i >= 5,
  created_at: '',
}))

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr))
}

interface OeffnungszeitenTabProps {
  tenantId: string
  hasEditRight: boolean
  initialOpeningHours: OpeningHoursRow[]
  initialSpecialDays: SpecialDayRow[]
  initialDeputyPeriods: DeputyPeriodRow[]
}

export function OeffnungszeitenTab({
  hasEditRight,
  initialOpeningHours,
  initialSpecialDays,
  initialDeputyPeriods,
}: OeffnungszeitenTabProps) {
  const hours = initialOpeningHours.length === 7 ? initialOpeningHours : DEFAULT_HOURS
  const [closedDays, setClosedDays] = useState<boolean[]>(hours.map((h) => h.is_closed))

  // Section A — weekly hours
  const [hoursState, hoursAction, hoursIsPending] = useActionState(saveOpeningHoursAction, {})

  // Section B — special days
  const [specialDays, setSpecialDays] = useState<SpecialDayRow[]>(initialSpecialDays)
  const [showAddSpecial, setShowAddSpecial] = useState(false)
  const [deleteSpecialTarget, setDeleteSpecialTarget] = useState<SpecialDayRow | null>(null)
  const [specialDate, setSpecialDate] = useState<Date | undefined>()
  const [specialLabel, setSpecialLabel] = useState('')
  const [specialType, setSpecialType] = useState<'closure' | 'special_hours'>('closure')
  const [specialError, setSpecialError] = useState('')
  const [isPendingSpecial, startSpecialTransition] = useTransition()

  // Section C — deputy periods
  const [deputyPeriods, setDeputyPeriods] = useState<DeputyPeriodRow[]>(initialDeputyPeriods)
  const [showAddDeputy, setShowAddDeputy] = useState(false)
  const [deleteDeputyTarget, setDeleteDeputyTarget] = useState<DeputyPeriodRow | null>(null)
  const [deputyStart, setDeputyStart] = useState<Date | undefined>()
  const [deputyEnd, setDeputyEnd] = useState<Date | undefined>()
  const [deputyLabel, setDeputyLabel] = useState('')
  const [deputyError, setDeputyError] = useState('')
  const [isPendingDeputy, startDeputyTransition] = useTransition()

  function handleAddSpecialDay() {
    if (!specialDate || !specialLabel) {
      setSpecialError('Datum und Bezeichnung sind erforderlich.')
      return
    }
    setSpecialError('')
    startSpecialTransition(async () => {
      const result = await addSpecialDayAction({
        date: format(specialDate, 'yyyy-MM-dd'),
        label: specialLabel,
        type: specialType,
      })
      if (result.error) {
        setSpecialError(result.error)
      } else {
        setSpecialDays((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            tenant_id: '',
            date: format(specialDate, 'yyyy-MM-dd'),
            label: specialLabel,
            type: specialType,
            open_from: null,
            open_until: null,
            is_closed: specialType === 'closure',
            created_at: new Date().toISOString(),
          },
        ])
        setShowAddSpecial(false)
        setSpecialDate(undefined)
        setSpecialLabel('')
        setSpecialType('closure')
      }
    })
  }

  function handleDeleteSpecialDay() {
    if (!deleteSpecialTarget) return
    startSpecialTransition(async () => {
      const result = await deleteSpecialDayAction({ id: deleteSpecialTarget.id })
      if (!result.error) {
        setSpecialDays((prev) => prev.filter((d) => d.id !== deleteSpecialTarget.id))
      }
      setDeleteSpecialTarget(null)
    })
  }

  function handleAddDeputyPeriod() {
    if (!deputyStart || !deputyEnd) {
      setDeputyError('Start- und Enddatum sind erforderlich.')
      return
    }
    if (format(deputyEnd, 'yyyy-MM-dd') < format(deputyStart, 'yyyy-MM-dd')) {
      setDeputyError('Das Enddatum muss nach dem Startdatum liegen.')
      return
    }
    setDeputyError('')
    startDeputyTransition(async () => {
      const result = await addDeputyPeriodAction({
        start_date: format(deputyStart, 'yyyy-MM-dd'),
        end_date: format(deputyEnd, 'yyyy-MM-dd'),
        label: deputyLabel || undefined,
      })
      if (result.error) {
        setDeputyError(result.error)
      } else {
        setDeputyPeriods((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            tenant_id: '',
            start_date: format(deputyStart, 'yyyy-MM-dd'),
            end_date: format(deputyEnd, 'yyyy-MM-dd'),
            label: deputyLabel || null,
            active: true,
            created_at: new Date().toISOString(),
          },
        ])
        setShowAddDeputy(false)
        setDeputyStart(undefined)
        setDeputyEnd(undefined)
        setDeputyLabel('')
      }
    })
  }

  function handleDeleteDeputyPeriod() {
    if (!deleteDeputyTarget) return
    startDeputyTransition(async () => {
      const result = await deleteDeputyPeriodAction({ id: deleteDeputyTarget.id })
      if (!result.error) {
        setDeputyPeriods((prev) => prev.filter((p) => p.id !== deleteDeputyTarget.id))
      }
      setDeleteDeputyTarget(null)
    })
  }

  return (
    <div className="space-y-8">

      {/* SECTION A — Wöchentliche Öffnungszeiten */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900">Wöchentliche Öffnungszeiten</h3>
        <form action={hoursAction}>
          <div className="space-y-2">
            {hours.map((hour, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded px-2 py-1.5 ${closedDays[i] ? 'bg-muted' : ''}`}
              >
                <input type="hidden" name={`hours[${i}][weekday]`} value={i} />
                <Checkbox
                  checked={closedDays[i]}
                  onCheckedChange={(checked) => {
                    setClosedDays((prev) => {
                      const next = [...prev]
                      next[i] = Boolean(checked)
                      return next
                    })
                  }}
                  aria-label={`${DAY_LABELS[i]} als Schließtag markieren`}
                  disabled={!hasEditRight}
                />
                <span className="w-8 text-sm font-medium text-gray-700">{DAY_LABELS[i]}</span>
                <Input
                  type="time"
                  name={`hours[${i}][open_from]`}
                  defaultValue={hour.open_from ?? '08:00'}
                  disabled={closedDays[i] || !hasEditRight}
                  className="w-28"
                  aria-label={`${DAY_LABELS[i]} Öffnungszeit von`}
                />
                <span className="text-sm text-gray-500">–</span>
                <Input
                  type="time"
                  name={`hours[${i}][open_until]`}
                  defaultValue={hour.open_until ?? '17:00'}
                  disabled={closedDays[i] || !hasEditRight}
                  className="w-28"
                  aria-label={`${DAY_LABELS[i]} Öffnungszeit bis`}
                />
                <Switch
                  name={`hours[${i}][is_closed]`}
                  checked={closedDays[i]}
                  onCheckedChange={(checked) => {
                    setClosedDays((prev) => {
                      const next = [...prev]
                      next[i] = checked
                      return next
                    })
                  }}
                  disabled={!hasEditRight}
                  aria-label={`Geschlossen: ${DAY_LABELS[i]}`}
                />
                <span className="text-xs text-gray-500">{closedDays[i] ? 'Geschlossen' : 'Geöffnet'}</span>
              </div>
            ))}
          </div>
          {hasEditRight && (
            <div className="mt-4 flex items-center gap-3">
              <Button type="submit" size="sm" disabled={hoursIsPending}>
                {hoursIsPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Öffnungszeiten speichern
              </Button>
              {hoursState.error && (
                <p role="alert" className="text-xs text-destructive">{hoursState.error}</p>
              )}
              {hoursState.success && (
                <p className="text-xs text-green-600">Öffnungszeiten gespeichert.</p>
              )}
            </div>
          )}
        </form>
      </div>

      {/* SECTION B — Sondertage */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Sondertage und Ausnahmen</h3>
          {hasEditRight && (
            <Button size="sm" variant="outline" onClick={() => setShowAddSpecial(!showAddSpecial)}>
              <Plus className="mr-1 h-4 w-4" />
              Sondertag hinzufügen
            </Button>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Bezeichnung</TableHead>
              <TableHead>Typ</TableHead>
              {hasEditRight && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {specialDays.length === 0 ? (
              <TableRow>
                <TableCell colSpan={hasEditRight ? 4 : 3} className="text-center text-sm text-muted-foreground py-6">
                  Noch keine Sondertage angelegt. Fügen Sie Schließungen oder Sonderzeiten hinzu.
                </TableCell>
              </TableRow>
            ) : (
              specialDays.map((day) => (
                <TableRow key={day.id}>
                  <TableCell className="text-sm">{formatDate(day.date)}</TableCell>
                  <TableCell className="text-sm">{day.label}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {day.type === 'closure' ? 'Schließung' : 'Sonderzeit'}
                    </Badge>
                  </TableCell>
                  {hasEditRight && (
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteSpecialTarget(day)}
                        aria-label="Sondertag löschen"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {showAddSpecial && hasEditRight && (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Datum</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-36 justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {specialDate ? format(specialDate, 'dd.MM.yyyy') : 'Datum wählen'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={specialDate} onSelect={setSpecialDate} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Bezeichnung</span>
              <Input
                value={specialLabel}
                onChange={(e) => setSpecialLabel(e.target.value)}
                placeholder="z.B. Nationalfeiertag"
                className="w-48"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Typ</span>
              <Select value={specialType} onValueChange={(v) => setSpecialType(v as 'closure' | 'special_hours')}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="closure">Schließung</SelectItem>
                  <SelectItem value="special_hours">Sonderzeit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={handleAddSpecialDay} disabled={isPendingSpecial}>
              {isPendingSpecial && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Hinzufügen
            </Button>
            {specialError && (
              <p role="alert" className="w-full text-xs text-destructive">{specialError}</p>
            )}
          </div>
        )}
      </div>

      {/* Delete special day dialog */}
      <Dialog open={!!deleteSpecialTarget} onOpenChange={(open) => !open && setDeleteSpecialTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sondertag entfernen</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Möchten Sie diesen Sondertag entfernen?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSpecialTarget(null)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleDeleteSpecialDay} disabled={isPendingSpecial}>
              {isPendingSpecial && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entfernen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SECTION C — Vertretungszeiträume */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Vertretungszeiträume</h3>
          {hasEditRight && (
            <Button size="sm" variant="outline" onClick={() => setShowAddDeputy(!showAddDeputy)}>
              <Plus className="mr-1 h-4 w-4" />
              Zeitraum hinzufügen
            </Button>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Von</TableHead>
              <TableHead>Bis</TableHead>
              <TableHead>Bezeichnung</TableHead>
              {hasEditRight && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {deputyPeriods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={hasEditRight ? 4 : 3} className="text-center text-sm text-muted-foreground py-6">
                  Noch keine Vertretungszeiträume konfiguriert.
                </TableCell>
              </TableRow>
            ) : (
              deputyPeriods.map((period) => (
                <TableRow key={period.id}>
                  <TableCell className="text-sm">{formatDate(period.start_date)}</TableCell>
                  <TableCell className="text-sm">{formatDate(period.end_date)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{period.label ?? '—'}</TableCell>
                  {hasEditRight && (
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteDeputyTarget(period)}
                        aria-label="Zeitraum löschen"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {showAddDeputy && hasEditRight && (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Von</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-36 justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deputyStart ? format(deputyStart, 'dd.MM.yyyy') : 'Startdatum'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={deputyStart} onSelect={setDeputyStart} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Bis</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-36 justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deputyEnd ? format(deputyEnd, 'dd.MM.yyyy') : 'Enddatum'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={deputyEnd} onSelect={setDeputyEnd} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Bezeichnung (optional)</span>
              <Input
                value={deputyLabel}
                onChange={(e) => setDeputyLabel(e.target.value)}
                placeholder="z.B. Urlaub Dr. Müller"
                className="w-48"
              />
            </div>
            <Button size="sm" onClick={handleAddDeputyPeriod} disabled={isPendingDeputy}>
              {isPendingDeputy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Hinzufügen
            </Button>
            {deputyError && (
              <p role="alert" className="w-full text-xs text-destructive">{deputyError}</p>
            )}
          </div>
        )}
      </div>

      {/* Delete deputy period dialog */}
      <Dialog open={!!deleteDeputyTarget} onOpenChange={(open) => !open && setDeleteDeputyTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zeitraum entfernen</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Möchten Sie diesen Vertretungszeitraum entfernen?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDeputyTarget(null)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleDeleteDeputyPeriod} disabled={isPendingDeputy}>
              {isPendingDeputy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entfernen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
