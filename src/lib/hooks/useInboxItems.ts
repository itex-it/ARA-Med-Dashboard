'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeChannel } from '@/lib/hooks/useRealtimeChannel'
import type { InboxItemRow } from '@/lib/types'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

// Cast: InboxItemRow & { [key: string]: unknown } required for useRealtimeChannel generic constraint
// (STATE.md locked: "useRealtimeChannel<T> uses T extends { [key: string]: unknown }")

export function useInboxItems(tenantId: string) {
  const [items, setItems] = useState<InboxItemRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId) return
    const supabase = createClient()
    supabase
      .from('inbox_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (data) setItems(data as InboxItemRow[])
        setLoading(false)
      })
  }, [tenantId])

  useRealtimeChannel<InboxItemRow & { [key: string]: unknown }>({
    table: 'inbox_items',
    tenantId,
    events: ['INSERT', 'UPDATE', 'DELETE'],
    onChange: (payload: RealtimePostgresChangesPayload<InboxItemRow & { [key: string]: unknown }>) => {
      if (payload.eventType === 'INSERT') {
        const newRow = payload.new as InboxItemRow
        setItems(prev => {
          // Dedup — if row id already exists, treat as UPDATE
          const exists = prev.some(r => r.id === newRow.id)
          if (exists) {
            return prev.map(r => r.id === newRow.id ? newRow : r)
          }
          return [newRow, ...prev]
        })
      } else if (payload.eventType === 'UPDATE') {
        const updated = payload.new as InboxItemRow
        setItems(prev => prev.map(r => r.id === updated.id ? updated : r))
      } else if (payload.eventType === 'DELETE') {
        const deleted = payload.old as { id: string }
        setItems(prev => prev.filter(r => r.id !== deleted.id))
      }
    },
  })

  return { items, loading }
}
