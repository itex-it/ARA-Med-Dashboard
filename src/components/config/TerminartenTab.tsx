'use client'

import { useState, useTransition } from 'react'
import { Loader2, Pencil, RefreshCw } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  updateAppointmentTypeFlagsAction,
  saveAppointmentSynonymsAction,
  setDefaultAppointmentTypeAction,
} from '@/app/actions/appointment-types'
import type { AppointmentTypeRow, AppointmentTypeSynonymRow } from '@/lib/types'

interface TerminartenTabProps {
  tenantId: string
  hasEditRight: boolean
  initialAppointmentTypes: AppointmentTypeRow[]
  initialSynonyms: AppointmentTypeSynonymRow[]
}

export function TerminartenTab({
  hasEditRight,
  initialAppointmentTypes,
  initialSynonyms,
}: TerminartenTabProps) {
  const [types, setTypes] = useState<AppointmentTypeRow[]>(initialAppointmentTypes)
  const [synonymsMap, setSynonymsMap] = useState<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {}
    for (const s of initialSynonyms) {
      if (!map[s.appointment_type_code]) map[s.appointment_type_code] = []
      ;(map[s.appointment_type_code] as string[]).push(s.synonym)
    }
    return map
  })
  const [openEditorCode, setOpenEditorCode] = useState<string | null>(null)
  const [synonymDraft, setSynonymDraft] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [defaultValue, setDefaultValue] = useState<string>(() => {
    return initialAppointmentTypes.find(t => t.is_default)?.id ?? ''
  })

  const [isPending, startTransition] = useTransition()

  function showError(msg: string) {
    setErrorMsg(msg)
    setSuccessMsg(null)
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg)
    setErrorMsg(null)
  }

  function handleFlagChange(
    row: AppointmentTypeRow,
    field: 'is_visible' | 'is_voice_bookable' | 'is_internal_only' | 'pid_zero_allowed',
    value: boolean,
  ) {
    if (!hasEditRight) return

    // Compute new flags with mutual exclusivity
    let newVoiceBookable = row.is_voice_bookable
    let newInternalOnly = row.is_internal_only

    if (field === 'is_voice_bookable' && value) {
      newVoiceBookable = true
      newInternalOnly = false
    } else if (field === 'is_internal_only' && value) {
      newInternalOnly = true
      newVoiceBookable = false
    } else if (field === 'is_voice_bookable') {
      newVoiceBookable = value
    } else if (field === 'is_internal_only') {
      newInternalOnly = value
    }

    const newVisible = field === 'is_visible' ? value : row.is_visible
    const newPidZero = field === 'pid_zero_allowed' ? value : row.pid_zero_allowed

    // Optimistic update
    setTypes(prev =>
      prev.map(t =>
        t.id === row.id
          ? {
              ...t,
              is_visible: newVisible,
              is_voice_bookable: newVoiceBookable,
              is_internal_only: newInternalOnly,
              pid_zero_allowed: newPidZero,
            }
          : t,
      ),
    )

    startTransition(async () => {
      const result = await updateAppointmentTypeFlagsAction({
        id: row.id,
        visible: newVisible,
        is_voice_bookable: newVoiceBookable,
        is_internal_only: newInternalOnly,
        pid_zero_allowed: newPidZero,
      })
      if (result.error) {
        showError(result.error)
        // Revert optimistic update
        setTypes(prev =>
          prev.map(t =>
            t.id === row.id ? row : t,
          ),
        )
      } else {
        showSuccess('Gespeichert.')
      }
    })
  }

  function handleOpenEditor(code: string) {
    setOpenEditorCode(prev => {
      if (prev === code) return null
      setSynonymDraft((synonymsMap[code] ?? []).join(', '))
      return code
    })
  }

  function handleSaveSynonyms(code: string) {
    const synonyms = synonymDraft
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)

    startTransition(async () => {
      const result = await saveAppointmentSynonymsAction({
        appointmentTypeCode: code,
        synonyms,
      })
      if (result.error) {
        showError(result.error)
      } else {
        setSynonymsMap(prev => ({ ...prev, [code]: synonyms }))
        setOpenEditorCode(null)
        showSuccess('Synonyme gespeichert.')
      }
    })
  }

  function handleSetDefault(id: string) {
    if (!hasEditRight) return
    setDefaultValue(id)
    startTransition(async () => {
      const result = await setDefaultAppointmentTypeAction({ id })
      if (result.error) {
        showError(result.error)
        setDefaultValue(types.find(t => t.is_default)?.id ?? '')
      } else {
        setTypes(prev => prev.map(t => ({ ...t, is_default: t.id === id })))
        showSuccess('Standard gesetzt.')
      }
    })
  }

  if (types.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Keine Terminarten verfügbar. Prüfen Sie die MEDSTAR-Verbindung.
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Feedback messages */}
        {errorMsg && (
          <div className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">
            {successMsg}
          </div>
        )}

        {/* Refresh button (placeholder) */}
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Neu laden
          </Button>
        </div>

        {/* Main table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Terminart</TableHead>
              <TableHead className="text-center">Sichtbar</TableHead>
              <TableHead className="text-center">KI-buchbar</TableHead>
              <TableHead className="text-center">Nur intern</TableHead>
              <TableHead>Synonyme</TableHead>
              <TableHead className="text-center">Standard</TableHead>
              <TableHead className="text-center">PID=0</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.map(row => {
              const synonymList = synonymsMap[row.appointment_type_code] ?? []
              const isEditorOpen = openEditorCode === row.appointment_type_code

              return (
                <>
                  <TableRow
                    key={row.id}
                    className={!row.is_visible ? 'opacity-60' : undefined}
                  >
                    {/* Terminart */}
                    <TableCell className="font-medium">
                      {row.display_name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({row.appointment_type_code})
                      </span>
                    </TableCell>

                    {/* Sichtbar */}
                    <TableCell className="text-center">
                      <Switch
                        checked={row.is_visible}
                        onCheckedChange={v => handleFlagChange(row, 'is_visible', v)}
                        disabled={!hasEditRight || isPending}
                        aria-label={`${row.display_name} sichtbar`}
                      />
                    </TableCell>

                    {/* KI-buchbar — disabled when is_internal_only */}
                    <TableCell className="text-center">
                      <Switch
                        checked={row.is_voice_bookable}
                        onCheckedChange={v => handleFlagChange(row, 'is_voice_bookable', v)}
                        disabled={!hasEditRight || isPending || row.is_internal_only}
                        aria-label={`${row.display_name} KI-buchbar`}
                      />
                    </TableCell>

                    {/* Nur intern — disabled when is_voice_bookable */}
                    <TableCell className="text-center">
                      <Switch
                        checked={row.is_internal_only}
                        onCheckedChange={v => handleFlagChange(row, 'is_internal_only', v)}
                        disabled={!hasEditRight || isPending || row.is_voice_bookable}
                        aria-label={`${row.display_name} nur intern`}
                      />
                    </TableCell>

                    {/* Synonyme */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-wrap gap-1">
                          {synonymList.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            synonymList.slice(0, 3).map(syn => (
                              <Badge key={syn} variant="secondary" className="text-xs">
                                {syn}
                              </Badge>
                            ))
                          )}
                          {synonymList.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{synonymList.length - 3}
                            </Badge>
                          )}
                        </div>
                        {hasEditRight && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => handleOpenEditor(row.appointment_type_code)}
                            aria-label={`Synonyme bearbeiten für ${row.display_name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>

                    {/* Standard */}
                    <TableCell className="text-center">
                      {row.is_default && (
                        <Badge variant="default" className="text-xs">
                          Standard
                        </Badge>
                      )}
                    </TableCell>

                    {/* PID=0 — with tooltip */}
                    <TableCell className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Switch
                              checked={row.pid_zero_allowed}
                              onCheckedChange={v => handleFlagChange(row, 'pid_zero_allowed', v)}
                              disabled={!hasEditRight || isPending}
                              aria-label={`${row.display_name} PID=0 erlaubt`}
                            />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Für Führerscheinuntersuchungen kann PID=0 genutzt werden.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>

                  {/* Inline synonym editor sub-row */}
                  {isEditorOpen && (
                    <TableRow key={`${row.id}-editor`}>
                      <TableCell colSpan={7} className="bg-muted/40 py-3">
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Synonyme für <strong>{row.display_name}</strong> — kommagetrennt eingeben
                          </p>
                          <Textarea
                            value={synonymDraft}
                            onChange={e => setSynonymDraft(e.target.value)}
                            rows={2}
                            className="text-sm"
                            placeholder="z.B. Bauchweh, Magenschmerzen, Verdauungsprobleme"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveSynonyms(row.appointment_type_code)}
                              disabled={isPending}
                            >
                              {isPending && (
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                              )}
                              Synonyme speichern
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setOpenEditorCode(null)}
                              disabled={isPending}
                            >
                              Abbrechen
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )
            })}
          </TableBody>
        </Table>

        {/* Default type selector */}
        <div className="flex items-center gap-4 border-t pt-4">
          <label className="text-sm font-medium">Standard-Terminart:</label>
          <Select
            value={defaultValue}
            onValueChange={handleSetDefault}
            disabled={!hasEditRight || isPending}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Standard auswählen..." />
            </SelectTrigger>
            <SelectContent>
              {types.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  {t.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>
    </TooltipProvider>
  )
}
