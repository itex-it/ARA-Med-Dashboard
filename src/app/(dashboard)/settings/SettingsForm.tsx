'use client'

import { useActionState } from 'react'
import { updateTenantAction, type SettingsActionState } from './actions'
import type { TenantRow } from '@/lib/types'

// Phase 1 Feature-Flags (dokumentiert in Migration 000006)
const KNOWN_FEATURE_FLAGS: { key: string; label: string; description: string }[] = [
  {
    key: 'voice_ai',
    label: 'ARA-MED Voice AI',
    description: 'Sprachassistenz für Telefonanrufe aktivieren',
  },
  {
    key: 'inbox',
    label: 'Aufgaben-Inbox',
    description: 'Inbox für offene Aufgaben aus Anrufen aktivieren',
  },
  {
    key: 'call_log',
    label: 'Anrufprotokoll',
    description: 'Echtzeit-Anrufprotokoll im Dashboard aktivieren',
  },
  {
    key: 'statistics',
    label: 'Statistiken',
    description: 'Auswertungen und Berichte aktivieren (Phase 7)',
  },
  {
    key: 'magic_link',
    label: 'Magic Link Anmeldung',
    description: 'Passwortlose Anmeldung per E-Mail-Link aktivieren',
  },
]

interface SettingsFormProps {
  tenant: Pick<
    TenantRow,
    | 'name'
    | 'hostname'
    | 'medstar_server_url'
    | 'fallback_phone'
    | 'forwarding_phone'
    | 'active_features'
  >
  canEdit: boolean
}

const initialState: SettingsActionState = {}

export function SettingsForm({ tenant, canEdit }: SettingsFormProps) {
  const [state, formAction, isPending] = useActionState(updateTenantAction, initialState)

  const activeFeatures: Record<string, boolean> = tenant.active_features ?? {}

  return (
    <form action={formAction} className="space-y-6">
      {/* Status-Meldungen */}
      {state.success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Einstellungen erfolgreich gespeichert.
        </div>
      )}
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* Praxisname (nur Anzeige) */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Praxisinformationen
        </h2>
        <div>
          <label
            htmlFor="tenant_name_display"
            className="block text-sm font-medium text-gray-700"
          >
            Praxisname
          </label>
          <input
            id="tenant_name_display"
            type="text"
            value={tenant.name}
            disabled
            readOnly
            className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
            aria-describedby="tenant_name_hint"
          />
          <p id="tenant_name_hint" className="mt-1 text-xs text-gray-400">
            Der Praxisname wird beim Anlegen des Mandanten festgelegt und kann hier nicht geändert
            werden.
          </p>
        </div>
      </div>

      {/* Netzwerk-Konfiguration */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Netzwerk & MEDSTAR
        </h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="hostname" className="block text-sm font-medium text-gray-700">
              Hostname
            </label>
            <input
              id="hostname"
              name="hostname"
              type="text"
              defaultValue={tenant.hostname ?? ''}
              disabled={!canEdit}
              placeholder="z.B. ordination-muster.ara-med.at"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
            {state.fieldErrors?.['hostname'] && (
              <p className="mt-1 text-xs text-red-600">{state.fieldErrors['hostname'].join(', ')}</p>
            )}
          </div>

          <div>
            <label htmlFor="medstar_server_url" className="block text-sm font-medium text-gray-700">
              MEDSTAR-Server-URL
            </label>
            <input
              id="medstar_server_url"
              name="medstar_server_url"
              type="url"
              defaultValue={tenant.medstar_server_url ?? ''}
              disabled={!canEdit}
              placeholder="https://medstar.example.at/api"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Basis-URL des MEDSTAR-Praxisverwaltungssystems Ihrer Ordination.
            </p>
            {state.fieldErrors?.['medstar_server_url'] && (
              <p className="mt-1 text-xs text-red-600">
                {state.fieldErrors['medstar_server_url'].join(', ')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Telefonie-Konfiguration */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Telefonie
        </h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="fallback_phone" className="block text-sm font-medium text-gray-700">
              Fallback-Telefonnummer
            </label>
            <input
              id="fallback_phone"
              name="fallback_phone"
              type="tel"
              defaultValue={tenant.fallback_phone ?? ''}
              disabled={!canEdit}
              placeholder="+43 1 234 5678"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Nummer, an die Anrufe weitergeleitet werden wenn der Voice AI nicht verfügbar ist.
            </p>
            {state.fieldErrors?.['fallback_phone'] && (
              <p className="mt-1 text-xs text-red-600">
                {state.fieldErrors['fallback_phone'].join(', ')}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="forwarding_phone" className="block text-sm font-medium text-gray-700">
              Weiterleitungsnummer
            </label>
            <input
              id="forwarding_phone"
              name="forwarding_phone"
              type="tel"
              defaultValue={tenant.forwarding_phone ?? ''}
              disabled={!canEdit}
              placeholder="+43 1 234 5679"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Nummer für Notfälle und direkte Weiterleitungsanfragen durch den Voice AI.
            </p>
            {state.fieldErrors?.['forwarding_phone'] && (
              <p className="mt-1 text-xs text-red-600">
                {state.fieldErrors['forwarding_phone'].join(', ')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Feature-Toggles */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Aktivierte Funktionen
        </h2>
        <div className="space-y-3">
          {KNOWN_FEATURE_FLAGS.map(({ key, label, description }) => {
            const isActive = activeFeatures[key] === true
            return (
              <div key={key} className="flex items-start gap-4 py-2">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{label}</div>
                  <div className="text-xs text-gray-500">{description}</div>
                </div>
                <div className="flex items-center">
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      name={`feature_${key}`}
                      value="true"
                      defaultChecked={isActive}
                      disabled={!canEdit}
                      className="sr-only"
                    />
                    <div
                      className={`h-6 w-11 rounded-full transition-colors ${
                        isActive ? 'bg-blue-600' : 'bg-gray-200'
                      } ${!canEdit ? 'opacity-50' : ''}`}
                    >
                      <div
                        className={`h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
                          isActive ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </div>
                  </label>
                </div>
              </div>
            )
          })}
        </div>
        {!canEdit && (
          <p className="mt-4 text-xs text-gray-400">
            Nur Operatoren und Administratoren können Funktionen aktivieren oder deaktivieren.
          </p>
        )}
      </div>

      {/* Speichern-Button */}
      {canEdit && (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isPending ? 'Wird gespeichert...' : 'Einstellungen speichern'}
          </button>
        </div>
      )}
    </form>
  )
}
