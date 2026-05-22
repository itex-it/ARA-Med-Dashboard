'use client'

import Link from 'next/link'
import { useOpenTaskCount } from '@/lib/hooks/useOpenTaskCount'

interface OpenTaskCounterProps {
  tenantId: string
}

export function OpenTaskCounter({ tenantId }: OpenTaskCounterProps) {
  const { count, loading } = useOpenTaskCount(tenantId)

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Offene Aufgaben</span>
      <Link href="/inbox?filter=open" className="hover:opacity-80 transition-opacity">
        <span
          className={
            loading
              ? 'text-muted-foreground'
              : count > 0
                ? 'inline-flex items-center justify-center rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground'
                : 'inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground'
          }
        >
          {loading ? '—' : count}
        </span>
      </Link>
    </div>
  )
}
