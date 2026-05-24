'use client'

import { useRouter } from 'next/navigation'

interface AuditLogFiltersProps {
  currentDays: number
  currentAction: string
  availableActions: string[]
}

export default function AuditLogFilters({
  currentDays,
  currentAction,
  availableActions,
}: AuditLogFiltersProps) {
  const router = useRouter()

  function handleActionChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    const params = new URLSearchParams()
    if (currentDays !== 7) params.set('tage', String(currentDays))
    if (value) params.set('action', value)
    const qs = params.toString()
    router.push(`/audit-log${qs ? `?${qs}` : ''}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-4 mb-4">
      {/* Date range buttons */}
      <div className="flex gap-2 text-sm">
        {[7, 30, 90].map((d) => {
          const params = new URLSearchParams()
          params.set('tage', String(d))
          if (currentAction) params.set('action', currentAction)
          return (
            <a
              key={d}
              href={`/audit-log?${params.toString()}`}
              className={`rounded px-3 py-1 ${
                currentDays === d
                  ? 'bg-blue-600 text-white'
                  : 'border bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {d} Tage
            </a>
          )
        })}
      </div>

      {/* Action filter dropdown */}
      <select
        value={currentAction}
        onChange={handleActionChange}
        className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Alle Aktionen</option>
        {availableActions.map((action) => (
          <option key={action} value={action}>
            {action}
          </option>
        ))}
      </select>
    </div>
  )
}
