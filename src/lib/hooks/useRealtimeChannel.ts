// C3: Every channel is scoped to tenant — channel name + postgres_changes filter carry tenantId.
// C4: useEffect return calls removeChannel() — without cleanup, subscriptions leak and duplicate events accumulate.
'use client'

import { useEffect, useRef } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE'

interface UseRealtimeChannelOptions<T extends { [key: string]: unknown }> {
  table: string
  tenantId: string
  events: ChangeEvent[]
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void
}

export function useRealtimeChannel<T extends { [key: string]: unknown }>({
  table,
  tenantId,
  onChange,
}: UseRealtimeChannelOptions<T>): void {
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!tenantId) return

    const supabase = createClient()
    const channel = supabase.channel(`${table}:${tenantId}`)

    channel.on<T>(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: `tenant_id=eq.${tenantId}`,
      },
      (payload: RealtimePostgresChangesPayload<T>) => {
        onChangeRef.current(payload)
      }
    )

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, tenantId]) // eslint-disable-line react-hooks/exhaustive-deps
}
