'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeChannel } from '@/lib/hooks/useRealtimeChannel'
import type { InboxItemRow } from '@/lib/types'

export function useOpenTaskCount(tenantId: string): { count: number; loading: boolean } {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId) return

    const supabase = createClient()

    supabase
      .from('inbox_items')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'open')
      .then(({ count: initialCount }) => {
        setCount(initialCount ?? 0)
        setLoading(false)
      })
  }, [tenantId])

  useRealtimeChannel<InboxItemRow & { [key: string]: unknown }>({
    table: 'inbox_items',
    tenantId,
    events: ['INSERT', 'UPDATE', 'DELETE'],
    onChange: (payload) => {
      setCount((prev) => {
        const oldStatus = (payload.old as Partial<InboxItemRow>)?.status
        const newStatus = (payload.new as Partial<InboxItemRow>)?.status

        if (payload.eventType === 'INSERT' && newStatus === 'open') return prev + 1
        if (payload.eventType === 'DELETE' && oldStatus === 'open') return Math.max(0, prev - 1)
        if (payload.eventType === 'UPDATE') {
          if (oldStatus === 'open' && newStatus !== 'open') return Math.max(0, prev - 1)
          if (oldStatus !== 'open' && newStatus === 'open') return prev + 1
        }
        return prev
      })
    },
  })

  return { count, loading }
}
