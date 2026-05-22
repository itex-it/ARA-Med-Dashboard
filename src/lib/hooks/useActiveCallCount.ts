'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeChannel } from '@/lib/hooks/useRealtimeChannel'
import type { CallLogRow } from '@/lib/types'

export function useActiveCallCount(tenantId: string): { count: number; loading: boolean } {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId) return

    const supabase = createClient()

    supabase
      .from('call_log')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .then(({ count: initialCount }) => {
        setCount(initialCount ?? 0)
        setLoading(false)
      })
  }, [tenantId])

  useRealtimeChannel<CallLogRow & { [key: string]: unknown }>({
    table: 'call_log',
    tenantId,
    events: ['INSERT', 'UPDATE', 'DELETE'],
    onChange: (payload) => {
      setCount((prev) => {
        const oldStatus = (payload.old as Partial<CallLogRow>)?.status
        const newStatus = (payload.new as Partial<CallLogRow>)?.status

        if (payload.eventType === 'INSERT' && newStatus === 'active') return prev + 1
        if (payload.eventType === 'DELETE' && oldStatus === 'active') return Math.max(0, prev - 1)
        if (payload.eventType === 'UPDATE') {
          if (newStatus === 'active' && oldStatus !== 'active') return prev + 1
          if (newStatus !== 'active' && oldStatus === 'active') return Math.max(0, prev - 1)
        }
        return prev
      })
    },
  })

  return { count, loading }
}
