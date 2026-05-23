'use client'

import { useActionState, useTransition, useState, useEffect } from 'react'
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  addMedicationAction,
  toggleMedicationActiveAction,
  deleteMedicationAction,
  type MedicationActionState,
} from '@/app/actions/medications'
import type { MedicationRow } from '@/lib/types'

// Suppress unused import warning — Pencil kept for potential future edit UI
void Pencil

interface MedikamenteTabProps {
  tenantId: string
  hasEditRight: boolean
  initialMedications: MedicationRow[]
}

const initialAddState: MedicationActionState = {}

export function MedikamenteTab({
  hasEditRight,
  initialMedications,
}: MedikamenteTabProps) {
  const router = useRouter()
  const [medications, setMedications] = useState<MedicationRow[]>(initialMedications)
  const [showAddForm, setShowAddForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MedicationRow | null>(null)
  const [isPending, startTransition] = useTransition()
  const [addState, addFormAction, isAddPending] = useActionState(
    addMedicationAction,
    initialAddState,
  )

  // When add succeeds: hide form and refresh server data
  useEffect(() => {
    if (addState.success) {
      setShowAddForm(false)
      router.refresh()
    }
  }, [addState.success, router])

  // Sync local list when initialMedications prop changes (after router.refresh)
  useEffect(() => {
    setMedications(initialMedications)
  }, [initialMedications])

  function handleToggleActive(med: MedicationRow, newActive: boolean) {
    // Optimistic update
    setMedications((prev) =>
      prev.map((m) => (m.id === med.id ? { ...m, active: newActive } : m)),
    )
    startTransition(async () => {
      const result = await toggleMedicationActiveAction({ id: med.id, active: newActive })
      if (!result.success) {
        // Revert on failure
        setMedications((prev) =>
          prev.map((m) => (m.id === med.id ? { ...m, active: med.active } : m)),
        )
      }
    })
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    startTransition(async () => {
      const result = await deleteMedicationAction({ id: target.id })
      if (result.success) {
        setMedications((prev) => prev.filter((m) => m.id !== target.id))
      }
    })
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium">Medikamentenliste</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Medikamente für die Rezept-Anfrage per Telefon
            </p>
          </div>
          {hasEditRight && !showAddForm && (
            <Button size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Medikament hinzufügen
            </Button>
          )}
        </div>

        {/* Add form */}
        {showAddForm && hasEditRight && (
          <form
            action={addFormAction}
            className="rounded-lg border bg-muted/30 p-4 space-y-3"
          >
            <h3 className="text-sm font-medium">Neues Medikament</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="pzn">
                  PZN <span className="text-destructive">*</span>
                </label>
                <Input
                  id="pzn"
                  name="pzn"
                  placeholder="1234567"
                  pattern="[0-9]{7}"
                  maxLength={7}
                  required
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="name">
                  Medikament <span className="text-destructive">*</span>
                </label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Metformin 500 mg"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="phonetic">
                  Aussprache (optional)
                </label>
                <Input
                  id="phonetic"
                  name="phonetic"
                  placeholder="Met-for-min"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="note">
                  Notiz (optional)
                </label>
                <Textarea
                  id="note"
                  name="note"
                  placeholder="Interne Notiz für das Personal..."
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>
            {addState.error && (
              <p role="alert" className="text-xs text-destructive">
                {addState.error}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isAddPending}>
                {isAddPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Medikament speichern
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowAddForm(false)}
                disabled={isAddPending}
              >
                Abbrechen
              </Button>
            </div>
          </form>
        )}

        {/* Table */}
        {medications.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Noch keine Medikamente in der Liste. Fügen Sie das erste Medikament hinzu.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">PZN</TableHead>
                  <TableHead>Medikament</TableHead>
                  <TableHead className="w-40">Aussprache</TableHead>
                  <TableHead className="w-20 text-center">Aktiv</TableHead>
                  <TableHead>Notiz</TableHead>
                  {hasEditRight && (
                    <TableHead className="w-16 text-right">Aktionen</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {medications.map((med) => (
                  <TableRow
                    key={med.id}
                    className={!med.active ? 'opacity-60' : undefined}
                  >
                    <TableCell>
                      <span className="font-mono text-sm">{med.pzn}</span>
                    </TableCell>
                    <TableCell className="font-medium">{med.name}</TableCell>
                    <TableCell>
                      {med.phonetic ? (
                        <span className="text-sm italic text-muted-foreground">
                          {med.phonetic}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {hasEditRight ? (
                        <Switch
                          checked={med.active}
                          disabled={isPending}
                          onCheckedChange={(checked) =>
                            handleToggleActive(med, checked)
                          }
                          aria-label={`${med.name} ${med.active ? 'deaktivieren' : 'aktivieren'}`}
                        />
                      ) : (
                        <span className="text-sm">
                          {med.active ? 'Ja' : 'Nein'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {med.note ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm text-muted-foreground truncate max-w-[200px] block cursor-default">
                              {med.note}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs whitespace-pre-wrap">{med.note}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    {hasEditRight && (
                      <TableCell className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              disabled={isPending}
                              onClick={() => setDeleteTarget(med)}
                              aria-label={`${med.name} entfernen`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Medikament entfernen</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Delete confirmation dialog */}
        <Dialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Medikament entfernen</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Möchten Sie{' '}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>{' '}
              (PZN {deleteTarget?.pzn}) unwiderruflich aus der Liste entfernen?
            </p>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={isPending}
              >
                Abbrechen
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={isPending}
              >
                {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Entfernen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
