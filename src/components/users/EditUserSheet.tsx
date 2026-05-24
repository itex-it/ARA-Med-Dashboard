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
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateUserAction } from '@/lib/actions/users'
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
import type {
  AraRole,
  ModuleCategory,
  ModulePermissions,
  PermissionLevel,
  TenantUserDisplay,
} from '@/lib/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EditUserSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: TenantUserDisplay
  currentUserRole: AraRole
  currentUserPermissions: Partial<ModulePermissions>
}

// All grantable roles in hierarchy order
const ALL_ROLES: AraRole[] = ['operator', 'ordination_admin', 'assistant', 'viewer']

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditUserSheet({
  open,
  onOpenChange,
  user,
  currentUserRole,
  currentUserPermissions,
}: EditUserSheetProps) {
  const [isPending, startTransition] = useTransition()
  const [selectedRole, setSelectedRole] = useState<AraRole>(user.role)
  const [permissions, setPermissions] = useState<ModulePermissions>(
    // Initialize from user's existing permissions, filling missing categories from role defaults
    (() => {
      const defaults = getDefaultPermissions(user.role)
      const merged: ModulePermissions = { ...defaults }
      for (const cat of MODULE_CATEGORIES) {
        if (user.permissions[cat]) {
          merged[cat] = user.permissions[cat] as PermissionLevel
        }
      }
      return merged
    })(),
  )
  const [isActive, setIsActive] = useState<boolean>(user.active)
  const [error, setError] = useState<string | null>(null)

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
    onOpenChange(false)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData()
    formData.set('targetUserId', user.id)
    formData.set('role', selectedRole)
    formData.set('permissions', JSON.stringify(permissions))
    formData.set('active', String(isActive))

    startTransition(async () => {
      const result = await updateUserAction(formData)
      if ('error' in result) {
        setError(result.error)
      } else {
        handleClose()
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Benutzer bearbeiten</SheetTitle>
          <p className="text-sm text-gray-500">{user.email}</p>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Hidden targetUserId */}
          <input type="hidden" name="targetUserId" value={user.id} />

          {/* Role selector */}
          <div className="space-y-2">
            <Label htmlFor="edit-role">Rolle</Label>
            <Select
              name="role"
              value={selectedRole}
              onValueChange={(v) => handleRoleChange(v as AraRole)}
              disabled={isPending}
            >
              <SelectTrigger id="edit-role">
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

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <Switch
              id="edit-active"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={isPending}
            />
            <Label htmlFor="edit-active" className="cursor-pointer">
              {isActive ? 'Aktiv' : 'Inaktiv'}
            </Label>
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
              {isPending ? 'Wird gespeichert…' : 'Änderungen speichern'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
