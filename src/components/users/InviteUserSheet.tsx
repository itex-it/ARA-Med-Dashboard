'use client'

import { useState, useTransition } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createUserAction } from '@/lib/actions/users'
import {
  MODULE_CATEGORIES,
  MODULE_CATEGORY_LABELS,
  PERMISSION_LEVELS,
  PERMISSION_LEVEL_LABELS,
  PERMISSION_LEVEL_ORDER,
  ROLE_LABELS,
  canGrantRole,
  getDefaultPermissions,
} from '@/lib/permissions'
import type { AraRole, ModuleCategory, ModulePermissions, PermissionLevel } from '@/lib/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InviteUserSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserRole: AraRole
  currentUserPermissions: Partial<ModulePermissions>
}

// All grantable roles in hierarchy order (operator first)
const ALL_ROLES: AraRole[] = ['operator', 'ordination_admin', 'assistant', 'viewer']

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InviteUserSheet({
  open,
  onOpenChange,
  currentUserRole,
  currentUserPermissions,
}: InviteUserSheetProps) {
  const [isPending, startTransition] = useTransition()
  const [selectedRole, setSelectedRole] = useState<AraRole>('assistant')
  const [permissions, setPermissions] = useState<ModulePermissions>(
    getDefaultPermissions('assistant'),
  )
  const [error, setError] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)

  // Roles the current user can grant
  const grantableRoles = ALL_ROLES.filter((r) => canGrantRole(currentUserRole, r))

  function handleRoleChange(role: AraRole) {
    setSelectedRole(role)
    setPermissions(getDefaultPermissions(role))
  }

  function handlePermissionChange(category: ModuleCategory, level: PermissionLevel) {
    setPermissions((prev) => ({ ...prev, [category]: level }))
  }

  function handleClose() {
    // Reset state
    setSelectedRole('assistant')
    setPermissions(getDefaultPermissions('assistant'))
    setError(null)
    setTempPassword(null)
    onOpenChange(false)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('permissions', JSON.stringify(permissions))

    startTransition(async () => {
      const result = await createUserAction(formData)
      if ('error' in result) {
        setError(result.error)
      } else {
        setTempPassword(result.tempPassword)
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Benutzer einladen</SheetTitle>
        </SheetHeader>

        {tempPassword ? (
          // Success view: show one-time password
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-semibold text-green-800">Benutzer erfolgreich erstellt!</p>
              <p className="mt-2 text-sm text-green-700">
                Temporäres Passwort:{' '}
                <span className="font-mono font-bold">{tempPassword}</span>
              </p>
              <p className="mt-1 text-xs text-green-600">
                Bitte dieses Passwort sicher an den Benutzer übertragen. Es wird nicht erneut angezeigt.
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">
              Schließen
            </Button>
          </div>
        ) : (
          // Invite form
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="invite-email">E-Mail-Adresse</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                placeholder="name@praxis.at"
                required
                disabled={isPending}
              />
            </div>

            {/* Role selector */}
            <div className="space-y-2">
              <Label htmlFor="invite-role">Rolle</Label>
              <Select
                name="role"
                value={selectedRole}
                onValueChange={(v) => handleRoleChange(v as AraRole)}
                disabled={isPending}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {grantableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Permission matrix */}
            <div className="space-y-2">
              <Label>Berechtigungen (Modul-Matrix)</Label>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="py-2 px-3 text-left font-medium text-gray-700">Modul</th>
                      {PERMISSION_LEVELS.map((level) => (
                        <th key={level} className="py-2 px-2 text-center font-medium text-gray-700">
                          {PERMISSION_LEVEL_LABELS[level]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MODULE_CATEGORIES.map((cat) => {
                      const callerLevel = currentUserPermissions[cat] ?? 'none'
                      const callerOrder = PERMISSION_LEVEL_ORDER[callerLevel]
                      return (
                        <tr key={cat} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-1.5 px-3 text-gray-700">
                            {MODULE_CATEGORY_LABELS[cat]}
                          </td>
                          {PERMISSION_LEVELS.map((level) => {
                            const levelOrder = PERMISSION_LEVEL_ORDER[level]
                            const isDisabled = isPending || levelOrder > callerOrder
                            return (
                              <td key={level} className="py-1.5 px-2 text-center">
                                <input
                                  type="radio"
                                  name={`perm-${cat}`}
                                  value={level}
                                  checked={permissions[cat] === level}
                                  disabled={isDisabled}
                                  onChange={() => handlePermissionChange(cat, level)}
                                  className="cursor-pointer disabled:cursor-not-allowed"
                                  aria-label={`${MODULE_CATEGORY_LABELS[cat]}: ${PERMISSION_LEVEL_LABELS[level]}`}
                                />
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500">
                Grau markierte Felder überschreiten Ihre eigenen Berechtigungen und können nicht vergeben werden.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <SheetFooter className="gap-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Wird erstellt…' : 'Benutzer einladen'}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
