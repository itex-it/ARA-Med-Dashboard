import { Card } from '@/components/ui/card'
import type { AuditLogRow } from '@/lib/types'

interface AuditLogTableProps {
  rows: AuditLogRow[]
  userEmailMap: Map<string, string>
}

function getActionBadgeClass(action: string): string {
  if (action.startsWith('USER_')) {
    return 'bg-blue-100 text-blue-800'
  }
  if (action.startsWith('SETTINGS_')) {
    return 'bg-purple-100 text-purple-800'
  }
  if (action.startsWith('ARA_MED_')) {
    return 'bg-green-100 text-green-800'
  }
  if (action.startsWith('OPENING_HOURS_') || action.startsWith('DEPUTY_')) {
    return 'bg-amber-100 text-amber-800'
  }
  if (
    action.startsWith('ROUTING_') ||
    action.startsWith('COMM_') ||
    action.startsWith('TEMPLATE_')
  ) {
    return 'bg-indigo-100 text-indigo-800'
  }
  if (
    action.startsWith('APPOINTMENT_TYPE_') ||
    action.startsWith('MEDICATION_') ||
    action.startsWith('GREETING_')
  ) {
    return 'bg-teal-100 text-teal-800'
  }
  return 'bg-gray-100 text-gray-700'
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('de-AT', {
    timeZone: 'Europe/Vienna',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max) + '…'
}

function getDetailsPreview(row: AuditLogRow): string {
  const value = row.new_value ?? row.old_value
  if (!value) return '—'
  try {
    const json = JSON.stringify(value)
    return truncate(json, 80)
  } catch {
    return '—'
  }
}

export default function AuditLogTable({ rows, userEmailMap }: AuditLogTableProps) {
  if (rows.length === 0) {
    return (
      <Card className="overflow-hidden">
        <div className="px-6 py-12 text-center text-sm text-gray-500">
          Keine Audit-Einträge für diesen Zeitraum.
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Zeitpunkt</th>
              <th className="px-4 py-3 text-left font-medium">Benutzer</th>
              <th className="px-4 py-3 text-left font-medium">Aktion</th>
              <th className="px-4 py-3 text-left font-medium">Objekt</th>
              <th className="px-4 py-3 text-left font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, idx) => {
              const email = userEmailMap.get(row.user_id) ?? row.user_id
              const displayUser = truncate(email, 30)
              const objectDisplay = `${row.object_type}: ${truncate(row.object_id, 20)}`
              const details = getDetailsPreview(row)
              const badgeClass = getActionBadgeClass(row.action)

              return (
                <tr key={row.id} className={idx % 2 === 1 ? 'bg-gray-50/50' : ''}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                    {formatTimestamp(row.created_at)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700" title={email}>
                    {displayUser}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                    >
                      {row.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{objectDisplay}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-gray-500">{details}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
