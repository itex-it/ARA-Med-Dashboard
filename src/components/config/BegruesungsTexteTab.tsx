'use client'

import { useActionState, useTransition, useState, useEffect } from 'react'
import { Lock, Plus, Trash2, Loader2 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  saveGreetingTextAction,
  addFaqEntryAction,
  deleteFaqEntryAction,
  type GreetingTextActionState,
} from '@/app/actions/greeting-texts'
import type { GreetingMode, GreetingTextRow, FaqEntryRow } from '@/lib/types'

// ---------------------------------------------------------------------------
// EU AI Act Art. 50 disclosure — client-side display constant (TEXT-02)
// The authoritative value is the server-side constant in greeting-texts.ts.
// This literal is only for display — it is NEVER sent to the server.
// ---------------------------------------------------------------------------
const EU_AI_ACT_DISPLAY_TEXT = 'Sie sprechen mit einem KI-gestützten Telefonsystem.'

// ---------------------------------------------------------------------------
// Sub-tab configuration
// ---------------------------------------------------------------------------
const SUB_TABS: { value: GreetingMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'vacation', label: 'Urlaub' },
  { value: 'deputy', label: 'Vertretung' },
  { value: 'own_service', label: 'Eigener Vertretungsdienst' },
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface BegruesungsTexteTabProps {
  tenantId: string
  hasEditRight: boolean
  initialGreetingTexts: GreetingTextRow[]
  initialFaqEntries: FaqEntryRow[]
}

// ---------------------------------------------------------------------------
// Single-mode greeting text form
// ---------------------------------------------------------------------------
const initialGreetingState: GreetingTextActionState = {}

interface GreetingTextFormProps {
  mode: GreetingMode
  initialUserText: string
  hasEditRight: boolean
}

function GreetingTextForm({ mode, initialUserText, hasEditRight }: GreetingTextFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveGreetingTextAction,
    initialGreetingState,
  )
  const [charCount, setCharCount] = useState(initialUserText.length)
  const [showSuccess, setShowSuccess] = useState(false)

  // Auto-hide success message after 3 seconds
  useEffect(() => {
    if (state.success) {
      setShowSuccess(true)
      const timer = setTimeout(() => setShowSuccess(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [state.success])

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="mode" value={mode} />

      {/* Language selector — locked to Deutsch */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Sprache</label>
        <Select defaultValue="de" disabled>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="de">Deutsch (Standard)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Greeting text textarea */}
      <div className="space-y-1">
        <label htmlFor={`user_text_${mode}`} className="text-sm font-medium text-foreground">
          Begrüßungstext
        </label>
        <p className="text-xs text-muted-foreground">
          Dieser Text wird von ARA-MED Voice nach dem Pflichthinweis gesprochen.
        </p>
        <Textarea
          id={`user_text_${mode}`}
          name="user_text"
          defaultValue={initialUserText}
          disabled={!hasEditRight || isPending}
          rows={4}
          className="resize-none"
          onChange={(e) => setCharCount(e.target.value.length)}
          placeholder="Begrüßungstext eingeben..."
        />
        <p className="text-xs text-muted-foreground text-right">{charCount} Zeichen</p>
      </div>

      {/* Feedback */}
      {showSuccess && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Begrüßungstext erfolgreich gespeichert.
        </div>
      )}
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {hasEditRight && (
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} size="sm">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird gespeichert...
              </>
            ) : (
              'Speichern'
            )}
          </Button>
        </div>
      )}
    </form>
  )
}

// ---------------------------------------------------------------------------
// FAQ section for a single mode
// ---------------------------------------------------------------------------
interface FaqSectionProps {
  mode: GreetingMode
  entries: FaqEntryRow[]
  hasEditRight: boolean
  onAdd: (entry: FaqEntryRow) => void
  onDelete: (id: string) => void
}

function FaqSection({ mode, entries, hasEditRight, onAdd, onDelete }: FaqSectionProps) {
  const [isPending, startTransition] = useTransition()
  const [addQuestion, setAddQuestion] = useState('')
  const [addAnswer, setAddAnswer] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function handleAdd() {
    setAddError(null)
    startTransition(async () => {
      const result = await addFaqEntryAction({ mode, question: addQuestion, answer: addAnswer })
      if (result.error) {
        setAddError(result.error)
      } else {
        // Optimistic-style: create a local row to display immediately
        const optimisticEntry: FaqEntryRow = {
          id: crypto.randomUUID(),
          tenant_id: '',
          mode,
          question: addQuestion,
          answer: addAnswer,
          active: true,
          sort_order: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        onAdd(optimisticEntry)
        setAddQuestion('')
        setAddAnswer('')
      }
    })
  }

  function handleDeleteConfirm() {
    if (!deleteId) return
    setDeleteError(null)
    const idToDelete = deleteId
    setDeleteId(null)
    startTransition(async () => {
      const result = await deleteFaqEntryAction({ id: idToDelete })
      if (result.error) {
        setDeleteError(result.error)
      } else {
        onDelete(idToDelete)
      }
    })
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Häufige Fragen (FAQ)
      </h3>

      {/* FAQ table */}
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Noch keine FAQ-Einträge für diesen Modus.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Frage
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Antwort
              </TableHead>
              <TableHead className="w-[60px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Aktionen
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-sm align-top">{entry.question}</TableCell>
                <TableCell className="text-sm align-top text-muted-foreground">
                  {entry.answer}
                </TableCell>
                <TableCell>
                  {hasEditRight && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteId(entry.id)}
                      aria-label="Frage entfernen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {deleteError && (
        <p className="text-sm text-red-600">{deleteError}</p>
      )}

      {/* Add form */}
      {hasEditRight && (
        <div className="rounded-md border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Neuer FAQ-Eintrag</p>
          <div className="space-y-2">
            <Input
              placeholder="Frage"
              value={addQuestion}
              onChange={(e) => setAddQuestion(e.target.value)}
              disabled={isPending}
            />
            <Textarea
              placeholder="Antwort"
              value={addAnswer}
              onChange={(e) => setAddAnswer(e.target.value)}
              disabled={isPending}
              rows={3}
              className="resize-none"
            />
          </div>
          {addError && <p className="text-sm text-red-600">{addError}</p>}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAdd}
            disabled={isPending || !addQuestion.trim() || !addAnswer.trim()}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Hinzufügen
          </Button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Frage entfernen</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Soll dieser FAQ-Eintrag wirklich gelöscht werden? Diese Aktion kann nicht rückgängig
            gemacht werden.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function BegruesungsTexteTab({
  hasEditRight,
  initialGreetingTexts,
  initialFaqEntries,
}: BegruesungsTexteTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<GreetingMode>('normal')

  // Build greeting texts map: mode → row
  const greetingTextsByMode = Object.fromEntries(
    initialGreetingTexts.map((row) => [row.mode, row]),
  ) as Partial<Record<GreetingMode, GreetingTextRow>>

  // Build FAQ map: mode → entries.
  // mode='all' entries are merged into all modes.
  const [faqByMode, setFaqByMode] = useState<Record<string, FaqEntryRow[]>>(() => {
    const allEntries = initialFaqEntries.filter((e) => e.mode === 'all')
    return {
      normal: [...allEntries, ...initialFaqEntries.filter((e) => e.mode === 'normal')],
      vacation: [...allEntries, ...initialFaqEntries.filter((e) => e.mode === 'vacation')],
      deputy: [...allEntries, ...initialFaqEntries.filter((e) => e.mode === 'deputy')],
      own_service: [...allEntries, ...initialFaqEntries.filter((e) => e.mode === 'own_service')],
    }
  })

  function handleFaqAdd(mode: GreetingMode, entry: FaqEntryRow) {
    setFaqByMode((prev) => ({
      ...prev,
      [mode]: [...(prev[mode] ?? []), entry],
    }))
  }

  function handleFaqDelete(mode: GreetingMode, id: string) {
    setFaqByMode((prev) => ({
      ...prev,
      [mode]: (prev[mode] ?? []).filter((e) => e.id !== id),
    }))
  }

  return (
    <Tabs
      value={activeSubTab}
      onValueChange={(v) => setActiveSubTab(v as GreetingMode)}
      className="space-y-4"
    >
      <TabsList>
        {SUB_TABS.map(({ value, label }) => (
          <TabsTrigger key={value} value={value}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      {SUB_TABS.map(({ value: mode }) => (
        <TabsContent key={mode} value={mode} className="space-y-6">
          {/* TEXT-02: EU AI Act Art. 50 lock block */}
          <div
            className="bg-muted border border-muted-foreground/30 rounded-md p-4 mb-4"
            role="region"
            aria-label="EU-KI-Gesetz Art. 50 Pflichthinweis"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Lock className="h-3.5 w-3.5" /> EU-KI-Gesetz Art. 50 — Pflichthinweis
            </p>
            <p className="text-sm text-muted-foreground italic mt-2">
              {EU_AI_ACT_DISPLAY_TEXT}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Dieser Hinweis ist gesetzlich vorgeschrieben und kann nicht entfernt werden.
            </p>
          </div>

          {/* TEXT-01: Greeting text form */}
          <div className="rounded-md border bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Begrüßungstext
            </h2>
            <GreetingTextForm
              mode={mode}
              initialUserText={greetingTextsByMode[mode]?.user_text ?? ''}
              hasEditRight={hasEditRight}
            />
          </div>

          {/* TEXT-03: FAQ section */}
          <div className="rounded-md border bg-white p-6 shadow-sm">
            <FaqSection
              mode={mode}
              entries={faqByMode[mode] ?? []}
              hasEditRight={hasEditRight}
              onAdd={(entry) => handleFaqAdd(mode, entry)}
              onDelete={(id) => handleFaqDelete(mode, id)}
            />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  )
}
