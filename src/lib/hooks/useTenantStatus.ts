'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TenantRow } from '@/lib/types'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type TenantStatus = Pick<TenantRow, 'ara_status' | 'practice_status' | 'active_mode'>

export function useTenantStatus(tenantId: string) {
  const [status, setStatus] = useState<TenantStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId) return

    const supabase = createClient()

    supabase
      .from('tenants')
      .select('ara_status, practice_status, active_mode')
      .eq('id', tenantId)
      .single()
      .then(({ data }) => {
        if (data) setStatus(data as TenantStatus)
        setLoading(false)
      })

    const channel = supabase
      .channel('tenants:' + tenantId)
      .on<TenantRow>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tenants', filter: 'id=eq.' + tenantId },
        (payload: RealtimePostgresChangesPayload<TenantRow>) => {
          if (payload.new && 'ara_status' in payload.new) {
            const { ara_status, practice_status, active_mode } = payload.new as TenantRow
            setStatus({ ara_status, practice_status, active_mode })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId])

  return { status, loading }
}
