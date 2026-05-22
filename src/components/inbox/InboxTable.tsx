'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CaseTypeBadge } from '@/components/inbox/CaseTypeBadge'
import { InboxStatusBadge } from '@/components/inbox/InboxStatusBadge'
import { CaseDetailSheet } from '@/components/inbox/CaseDetailSheet'
import { useInboxItems } from '@/lib/hooks/useInboxItems'
import { formatCallTime } from '@/lib/utils/format'
import type { InboxItemRow } from '@/lib/types'

interface InboxTableProps {
  tenantId: string
  initialFilter?: string
  hasEditRight?: boolean
  hasManageRight?: boolean
  hasCallDetail?: boolean
  onRowClick?: (item: InboxItemRow) => void
}

export function InboxTable({
  tenantId,
  initialFilter,
  hasEditRight,
  hasManageRight,
  hasCallDetail,
  onRowClick,
}: InboxTableProps) {
  const { items, loading } = useInboxItems(tenantId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(initialFilter ?? 'alle')
  const router = useRouter()

  // Client-side tab filter — no re-fetch on tab switch
  const filteredItems =
    activeTab === 'alle' ? items : items.filter((i) => i.status === activeTab)

  // Tab counts derived from items array
  const openCount = items.filter((i) => i.status === 'open').length
  const inProgressCount = items.filter((i) => i.status === 'in_progress').length
  const resolvedCount = items.filter((i) => i.status === 'resolved').length

  function handleTabChange(tab: string) {
    setActiveTab(tab)
    router.push('?filter=' + tab, { scroll: false })
  }

  const tableContent = loading ? (
    <Table>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell colSpan={6}>
              <div className="h-11 w-full bg-muted animate-pulse rounded" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ) : filteredItems.length === 0 ? (
    <Table>
      <TableBody>
        <TableRow>
          <TableCell colSpan={6} className="py-12 text-center">
            {activeTab === 'alle' ? (
              <>
                <p className="text-base font-semibold text-foreground">Keine offenen Aufgaben</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fälle mit Handlungsbedarf erscheinen hier automatisch nach jedem Anruf.
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-foreground">Keine Einträge in dieser Ansicht</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Wechsle zur Ansicht &quot;Alle&quot;, um alle Fälle zu sehen.
                </p>
              </>
            )}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ) : (
    <Table>
      <TableHeader className="sticky top-0 bg-background z-10">
        <TableRow>
          <TableHead className="w-[160px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Typ
          </TableHead>
          <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Gespräch
          </TableHead>
          <TableHead className="w-[130px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </TableHead>
          <TableHead className="w-[110px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Eingang
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notiz
          </TableHead>
          <TableHead className="w-[40px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredItems.map((item: InboxItemRow) => (
          <TableRow
            key={item.id}
            className={`h-11 cursor-pointer hover:bg-muted/50 animate-in slide-in-from-top-2 duration-300 ${
              item.case_type === 'emergency'
                ? 'border-l-2 border-destructive'
                : selectedId === item.id
                  ? 'border-l-2 border-primary'
                  : ''
            }`}
            onClick={() => {
              setSelectedId(item.id)
              setSheetOpen(true)
              onRowClick?.(item)
            }}
          >
            <TableCell>
              <CaseTypeBadge caseType={item.case_type} showTooltip={true} />
            </TableCell>
            <TableCell>
              {item.call_log_id ? (
                <span className="text-xs font-mono text-muted-foreground">
                  {item.call_log_id.slice(0, 8)}&hellip;
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              <InboxStatusBadge status={item.status} />
            </TableCell>
            <TableCell>
              <span className="text-xs font-mono text-muted-foreground">
                {formatCallTime(item.created_at)}
              </span>
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                {item.internal_note ?? ''}
              </span>
            </TableCell>
            <TableCell>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  return (
    <>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="alle">
            Alle{' '}
            <span className="ml-1 text-xs text-muted-foreground">{items.length}</span>
          </TabsTrigger>
          <TabsTrigger value="open">
            Offen
            {openCount > 0 ? (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-destructive-foreground">
                {openCount}
              </span>
            ) : (
              <span className="ml-1 text-xs text-muted-foreground">{openCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="in_progress">
            In Bearbeitung{' '}
            <span className="ml-1 text-xs text-muted-foreground">{inProgressCount}</span>
          </TabsTrigger>
          <TabsTrigger value="resolved">
            Erledigt{' '}
            <span className="ml-1 text-xs text-muted-foreground">{resolvedCount}</span>
          </TabsTrigger>
          <TabsTrigger value="archived">Archiviert</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab}>{tableContent}</TabsContent>
      </Tabs>
      <CaseDetailSheet
        item={items.find((i) => i.id === selectedId) ?? null}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        hasEditRight={hasEditRight ?? true}
        hasManageRight={hasManageRight ?? true}
        hasCallDetail={hasCallDetail ?? true}
      />
    </>
  )
}
