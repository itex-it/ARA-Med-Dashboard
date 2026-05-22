'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { InboxCaseType } from '@/lib/types'

export const CASE_TYPE_LABELS: Record<InboxCaseType, string> = {
  emergency: 'Notfall',
  callback_needed: 'Rückruf nötig',
  unidentified_patient: 'Patient nicht erkannt',
  invalid_pid: 'Ungültige PID',
  multiple_pid: 'Mehrere PID-Treffer',
  prescription_blocked: 'Rezept nicht möglich',
  unclear_intent: 'Unklares Anliegen',
  technical_error: 'Technischer Fehler',
}

export const CASE_TYPE_TOOLTIPS: Record<InboxCaseType, string> = {
  emergency: 'Dieser Anruf enthält einen Notfall- oder Akutfall-Hinweis.',
  callback_needed: 'Der Anrufer bat um einen Rückruf.',
  unidentified_patient: 'Der Patient konnte anhand der Telefonnummer nicht identifiziert werden.',
  invalid_pid: 'Die gefundene PID ist ungültig oder inaktiv in MEDSTAR.',
  multiple_pid: 'Die Telefonnummer ist mehreren Patienten zugeordnet.',
  prescription_blocked: 'Eine Rezeptbestellung war nicht möglich.',
  unclear_intent: 'Das Anliegen des Anrufers konnte nicht eindeutig erkannt werden.',
  technical_error: 'Bei der Verarbeitung ist ein technischer Fehler aufgetreten.',
}

export const CASE_TYPE_STYLES: Record<InboxCaseType, string> = {
  emergency: 'bg-destructive/10 text-destructive border-destructive/20',
  callback_needed: 'bg-orange-50 text-orange-700 border-orange-200',
  unidentified_patient: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  invalid_pid: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  multiple_pid: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  prescription_blocked: 'bg-orange-50 text-orange-700 border-orange-200',
  unclear_intent: 'bg-muted text-muted-foreground border-border',
  technical_error: 'bg-red-50 text-red-700 border-red-200',
}

interface CaseTypeBadgeProps {
  caseType: InboxCaseType
  showTooltip?: boolean
}

export function CaseTypeBadge({ caseType, showTooltip = true }: CaseTypeBadgeProps) {
  const label = CASE_TYPE_LABELS[caseType]
  const tooltip = CASE_TYPE_TOOLTIPS[caseType]
  const style = CASE_TYPE_STYLES[caseType]

  const chip = (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${style}`}
    >
      {label}
    </span>
  )

  if (!showTooltip) {
    return chip
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {chip}
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
