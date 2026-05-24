'use client'

import { useState, useTransition } from 'react'
import { UserPlus, Pencil, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { InviteUserSheet } from '@/components/users/InviteUserSheet'
import { EditUserSheet } from '@/components/users/EditUserSheet'
import { deactivateUserAction } from '@/lib/actions/users'
import { ROLE_LABELS, canGrantRole } from '@/lib/permissions'
import type { AraRole, ModulePermissions, TenantUserDisplay } from '@/lib/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BenutzerTableProps {
  users: TenantUserDisplay[]
  currentUserRole: AraRole
  currentUserId: string
  currentUserPermissions: Partial<ModulePermissions>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLastSignIn(lastSignIn: string | null): string {
  if (!lastSignIn) return '—'
  const date = new Date(lastSignIn)
  return date.toLocaleString('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BenutzerTable({
  users,
  currentUserRole,
  currentUserId,
  currentUserPermissions,
}: BenutzerTableProps) {
  const [isPending, startTransition] = useTransition()

  // Sheet / dialog state
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TenantUserDisplay | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<TenantUserDisplay | null>(null)
  const [deactivateError, setDeactivateError] = useState<string | null>(null)

  function handleDeactivateConfirm() {
    if (!deactivateTarget) return
    setDeactivateError(null)

    const formData = new FormData()
    formData.set('targetUserId', deactivateTarget.id)

    startTransition(async () => {
      const result = await deactivateUserAction(formData)
      if ('error' in result) {
        setDeactivateError(result.error)
      } else {
        setDeactivateTarget(null)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Header bar: invite button */}
      <div className="flex justify-end">
        <Button
          onClick={() => setInviteOpen(true)}
          className="gap-2"
          size="sm"
        >
          <UserPlus className="h-4 w-4" />
          Benutzer einladen
        </Button>
      </div>

      {/* Users table */}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-Mail</TableHead>
              <TableHead>Rolle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Letzte Anmeldung</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-gray-500">
                  Keine Benutzer gefunden.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => {
                // Whether current user can manage this user
                const canManage =
                  canGrantRole(currentUserRole, u.role) && u.id !== currentUserId

                return (
                  <TableRow key={u.id}>
                    {/* E-Mail */}
                    <TableCell className="font-medium text-gray-900">{u.email}</TableCell>

                    {/* Rolle */}
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {ROLE_LABELS[u.role]}
                      </Badge>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      {u.active ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs border-0">
                          Aktiv
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs text-gray-500">
                          Inaktiv
                        </Badge>
                      )}
                    </TableCell>

                    {/* Letzte Anmeldung */}
                    <TableCell className="text-sm text-gray-500">
                      {formatLastSignIn(u.last_sign_in_at)}
                    </TableCell>

                    {/* Aktionen */}
                    <TableCell className="text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs"
                            onClick={() => setEditTarget(u)}
                          >
                            <Pencil className="h-3 w-3" />
                            Bearbeiten
                          </Button>
                          {u.active && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-xs text-red-600 hover:text-red-700 hover:border-red-300"
                              onClick={() => {
                                setDeactivateError(null)
                                setDeactivateTarget(u)
                              }}
                            >
                              <UserX className="h-3 w-3" />
                              Deaktivieren
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Invite Sheet */}
      <InviteUserSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        currentUserRole={currentUserRole}
        currentUserPermissions={currentUserPermissions}
      />

      {/* Edit Sheet */}
      {editTarget && (
        <EditUserSheet
          open={editTarget !== null}
          onOpenChange={(v) => { if (!v) setEditTarget(null) }}
          user={editTarget}
          currentUserRole={currentUserRole}
          currentUserPermissions={currentUserPermissions}
        />
      )}

      {/* Deactivation confirm Dialog */}
      <Dialog
        open={deactivateTarget !== null}
        onOpenChange={(v) => { if (!v) setDeactivateTarget(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benutzer deaktivieren</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-gray-700">
            Benutzer{' '}
            <span className="font-semibold">{deactivateTarget?.email}</span>{' '}
            wirklich deaktivieren? Die Session wird sofort beendet.
          </div>
          {deactivateError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {deactivateError}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeactivateTarget(null)}
              disabled={isPending}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivateConfirm}
              disabled={isPending}
            >
              {isPending ? 'Wird deaktiviert…' : 'Deaktivieren'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
