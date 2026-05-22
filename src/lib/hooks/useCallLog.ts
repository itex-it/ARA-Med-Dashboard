'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeChannel } from '@/lib/hooks/useRealtimeChannel'
import type { CallLogRow } from '@/lib/types'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export function useCallLog(tenantId: string) {
  const [calls, setCalls] = useState<CallLogRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId) return
    const supabase = createClient()
    supabase
      .from('call_log')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) setCalls(data as CallLogRow[])
        setLoading(false)
      })
  }, [tenantId])

  useRealtimeChannel<CallLogRow & { [key: string]: unknown }>({
    table: 'call_log',
    tenantId,
    events: ['INSERT', 'UPDATE', 'DELETE'],
    onChange: (payload: RealtimePostgresChangesPayload<CallLogRow & { [key: string]: unknown }>) => {
      if (payload.eventType === 'INSERT') {
        const newRow = payload.new as CallLogRow
        setCalls(prev => {
          // C10: dedupe — if row id already exists, treat as UPDATE
          const exists = prev.some(r => r.id === newRow.id)
          if (exists) {
            return prev.map(r => r.id === newRow.id ? newRow : r)
          }
          return [newRow, ...prev]
        })
      } else if (payload.eventType === 'UPDATE') {
        const updated = payload.new as CallLogRow
        setCalls(prev => prev.map(r => r.id === updated.id ? updated : r))
      } else if (payload.eventType === 'DELETE') {
        const deleted = payload.old as { id: string }
        setCalls(prev => prev.filter(r => r.id !== deleted.id))
      }
    },
  })

  return { calls, loading }
}
