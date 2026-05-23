# Phase 5: Configuration — Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 13 new/modified files
**Analogs found:** 13 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/2026XXXX_phase5_config_tables.sql` | migration | CRUD | `supabase/migrations/20260522000008_inbox_items.sql` + `20260522000010_inbox_items_rls_policies.sql` | exact |
| `src/lib/types/index.ts` (extend) | model | — | `src/lib/types/index.ts` (itself) | exact |
| `src/app/(dashboard)/konfiguration/page.tsx` | controller | request-response | `src/app/(dashboard)/inbox/page.tsx` | exact |
| `src/app/(dashboard)/layout.tsx` (add nav link) | config | — | `src/app/(dashboard)/layout.tsx` (itself) | exact |
| `src/app/actions/opening-hours.ts` | service | CRUD | `src/app/(dashboard)/settings/actions.ts` | exact |
| `src/app/actions/appointment-types.ts` | service | CRUD | `src/app/actions/update-inbox-status.ts` | exact |
| `src/app/actions/greeting-texts.ts` | service | CRUD | `src/app/actions/update-inbox-status.ts` | exact |
| `src/app/actions/deputy.ts` | service | CRUD | `src/app/actions/call-feedback.ts` | exact |
| `src/app/actions/medications.ts` | service | CRUD | `src/app/actions/update-inbox-status.ts` | exact |
| `src/components/config/OeffnungszeitenTab.tsx` | component | request-response | `src/app/(dashboard)/settings/SettingsForm.tsx` | role-match |
| `src/components/config/TerminartenTab.tsx` | component | CRUD | `src/components/inbox/InboxTable.tsx` + `src/components/status/StatusBar.tsx` | role-match |
| `src/components/config/BegruesungsTexteTab.tsx` | component | request-response | `src/app/(dashboard)/settings/SettingsForm.tsx` | role-match |
| `src/components/config/VertretungTab.tsx` | component | CRUD | `src/components/inbox/CaseDetailSheet.tsx` | role-match |
| `src/components/config/MedikamenteTab.tsx` | component | CRUD | `src/components/inbox/InboxTable.tsx` + `src/components/status/StatusBar.tsx` | role-match |

---

## Pattern Assignments

### `supabase/migrations/2026XXXX_phase5_config_tables.sql` (migration, CRUD)

**Analog:** `supabase/migrations/20260522000008_inbox_items.sql` (table body) + `supabase/migrations/20260522000010_inbox_items_rls_policies.sql` (RLS)

**Table + RLS enable pattern** (`20260522000008_inbox_items.sql` lines 15-38):
```sql
CREATE TABLE IF NOT EXISTS public.inbox_items (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- domain columns...
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;

-- D-15: No CONCURRENTLY — migrations run inside transactions
CREATE INDEX idx_inbox_items_tenant_created ON public.inbox_items (tenant_id, created_at DESC);
```

**4-policy RLS template** (`20260522000010_inbox_items_rls_policies.sql` lines 13-48):
```sql
CREATE POLICY inbox_items_tenant_isolation_select ON public.inbox_items
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY inbox_items_tenant_isolation_insert ON public.inbox_items
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id);

CREATE POLICY inbox_items_tenant_isolation_update ON public.inbox_items
  FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));

CREATE POLICY inbox_items_tenant_isolation_delete ON public.inbox_items
  FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id
    AND (SELECT auth.jwt()->'app_metadata'->>'ara_role') IN ('operator','ordination_admin'));
```

**Apply to all 6 new tables:** `opening_hours`, `special_days`, `deputy_periods`, `appointment_types`, `appointment_type_synonyms`, `greeting_texts`, `faq_entries`, `deputy_doctors`, `medications`. Each table gets 4 policies using the same `(SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid = tenant_id` pattern. Substitute `inbox_items` with the target table name in the policy names.

---

### `src/lib/types/index.ts` (model, extend existing)

**Analog:** `src/lib/types/index.ts` (existing file — lines 1-151)

**Existing type block structure** (lines 1-28 show the pattern to follow):
```typescript
/** Phase comment block marking which phase introduced the types */

/** Union type for text enum columns */
export type GreetingMode = 'normal' | 'vacation' | 'deputy' | 'own_service'
export type PidZeroBehavior = 'refuse' | 'waitlist' | 'book_normal' | 'forward'

/** Row interface — one per new table, named {TableName}Row */
export interface OpeningHoursRow {
  id: string
  tenant_id: string
  weekday: number          // 0=Mo, 6=So
  open_from: string | null // HH:MM
  open_until: string | null
  is_closed: boolean
  created_at: string
}

export interface MedicationRow {
  id: string
  tenant_id: string
  pzn: string              // 7-digit
  name: string
  phonetic: string | null
  active: boolean
  note: string | null
  created_at: string
  updated_at: string
}
// ... repeat for SpecialDayRow, DeputyPeriodRow, AppointmentTypeRow,
//     AppointmentTypeSynonymRow, GreetingTextRow, FaqEntryRow, DeputyDoctorRow
```

**Section header pattern** (line 115 shows how prior phases added sections):
```typescript
// ============================================================
// Phase 05: Configuration Types
// ============================================================
```

**Action state type pattern** (derive from existing `UpdateInboxStatusState` / `CallFeedbackState` pattern — each Server Action file defines its own `export interface {ActionName}State { success?: boolean; error?: string }`). These live in the action files, not `types/index.ts`.

---

### `src/app/(dashboard)/konfiguration/page.tsx` (controller, request-response)

**Analog:** `src/app/(dashboard)/inbox/page.tsx` (lines 1-40) for the searchParams + auth + prop-passing pattern. `src/app/(dashboard)/settings/page.tsx` (lines 18-91) for the service-role fetch + error boundary pattern.

**searchParams + auth + tenantId extraction** (`inbox/page.tsx` lines 1-40):
```typescript
import { createServerClient } from '@/lib/supabase/server'

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const params = await searchParams
  const initialFilter = params.filter ?? 'alle'

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = user?.app_metadata?.tenant_id ?? ''
  const araRole = (user?.app_metadata?.ara_role as string | undefined) ?? ''
  const hasEditRight = ['operator', 'ordination_admin'].includes(araRole)
  // ... pass as props to Client Component
}
```

**Multi-table server fetch + error state** (`settings/page.tsx` lines 41-70):
```typescript
const serviceClient = createServiceRoleClient()
const { data: tenant, error: dbError } = await serviceClient
  .from('tenants')
  .select('name, hostname, ...')
  .eq('id', tenantId)
  .single<Pick<TenantRow, 'name' | 'hostname' | ...>>()

if (dbError || !tenant) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      Tenant-Konfiguration konnte nicht geladen werden. ...
    </div>
  )
}
```

**For konfiguration/page.tsx:** Replace `filter` search param with `tab`, replace `'alle'` default with `'oeffnungszeiten'`. Fetch all config tables server-side and pass as typed props to a single `KonfigurationTabs` client component. Use `createServerClient()` (not service-role) for reads — RLS covers authenticated users.

---

### `src/app/(dashboard)/layout.tsx` (config, add nav link)

**Analog:** `src/app/(dashboard)/layout.tsx` itself (lines 30-55)

**Existing nav link pattern** (lines 36-54):
```tsx
<nav className="flex flex-col gap-1 text-sm">
  <a href="/dashboard" className="rounded px-2 py-1.5 text-gray-700 hover:bg-gray-100">
    Übersicht
  </a>
  <a href="/telefonate" className="rounded px-2 py-1.5 text-gray-700 hover:bg-gray-100">
    Telefonate
  </a>
  <a href="/inbox" className="rounded px-2 py-1.5 text-gray-700 hover:bg-gray-100">
    Inbox
  </a>
  <a href="/einstellungen" className="rounded px-2 py-1.5 text-gray-700 hover:bg-gray-100">
    Einstellungen
  </a>
</nav>
```

**Add after Einstellungen link:**
```tsx
<a href="/konfiguration" className="rounded px-2 py-1.5 text-gray-700 hover:bg-gray-100">
  Konfiguration
</a>
```

---

### `src/app/actions/opening-hours.ts` (service, CRUD — multi-row upsert)

**Analog:** `src/app/(dashboard)/settings/actions.ts` (all lines) for the `formData`-based action with `useActionState` + prevState signature. `src/app/actions/update-inbox-status.ts` (all lines) for the auth + role gate + service-role pattern.

**Action state interface** (`update-inbox-status.ts` lines 7-11):
```typescript
export interface UpdateInboxStatusState {
  success?: boolean
  error?: string
  newStatus?: InboxStatus
}
```

**Zod schema before auth** (`update-inbox-status.ts` lines 13-16):
```typescript
const updateInboxStatusSchema = z.object({
  itemId: z.string().uuid(),
  newStatus: z.enum(['open', 'in_progress', 'resolved', 'archived']),
})
```

**Auth + role gate + service-role pattern** (`update-inbox-status.ts` lines 20-70 — canonical, copy verbatim):
```typescript
const ALLOWED_ROLES = ['operator', 'ordination_admin']

export async function updateInboxStatusAction(
  itemId: string,
  newStatus: InboxStatus,
): Promise<UpdateInboxStatusState> {
  // 1. Zod validation — check before any auth call
  const parsed = updateInboxStatusSchema.safeParse({ itemId, newStatus })
  if (!parsed.success) return { error: 'Ungültige Eingabe.' }

  // 2. Auth — createServerClient must be awaited (STATE.md locked)
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Nicht authentifiziert.' }

  // 3. Tenant ID from JWT app_metadata
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) return { error: 'Kein Tenant zugewiesen.' }

  // 4. Role gate
  const araRole = user.app_metadata?.ara_role as string | undefined
  if (!araRole || !ALLOWED_ROLES.includes(araRole)) return { error: 'Unzureichende Berechtigung.' }

  // 5. Service-role write — sync (no await on createServiceRoleClient)
  const serviceClient = createServiceRoleClient()
  const { error: dbError } = await serviceClient
    .from('inbox_items')
    .update({ status: parsed.data.newStatus, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.itemId)
    .eq('tenant_id', tenantId) // Defense-in-depth

  if (dbError) {
    console.error('[updateInboxStatusAction] DB error:', dbError)
    return { error: 'Statusänderung fehlgeschlagen. Bitte erneut versuchen.' }
  }
  return { success: true, newStatus: parsed.data.newStatus }
}
```

**Multi-row upsert specific addition** (for opening-hours.ts — uses `useActionState` signature with `prevState`):
```typescript
// settings/actions.ts lines 42-46 show prevState signature:
export async function updateTenantAction(
  prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {

// For opening-hours.ts, the upsert replaces all 7 weekday rows:
const { error: dbError } = await serviceClient
  .from('opening_hours')
  .upsert(rows, { onConflict: 'tenant_id,weekday' })
```

**formData parse pattern** (`settings/actions.ts` lines 72-97):
```typescript
const rawData = {
  hostname: formData.get('hostname')?.toString().trim() || undefined,
  // ...
}
const parseResult = settingsSchema.safeParse(rawData)
if (!parseResult.success) {
  const fieldErrors: Record<string, string[]> = {}
  for (const [field, errors] of Object.entries(parseResult.error.flatten().fieldErrors)) {
    if (errors) fieldErrors[field] = errors
  }
  return { error: 'Ungültige Eingabedaten', fieldErrors }
}
```

---

### `src/app/actions/appointment-types.ts` (service, CRUD — per-row toggle + synonym replace)

**Analog:** `src/app/actions/update-inbox-status.ts` (all lines) for per-row update. `src/app/actions/save-inbox-note.ts` (all lines) for the note/text save variant without prevState.

**Per-row update (APPT-02 toggle flags):** Copy `update-inbox-status.ts` verbatim, swap table and columns:
```typescript
const { error: dbError } = await serviceClient
  .from('appointment_types')
  .update({ [parsed.data.field]: parsed.data.value, updated_at: new Date().toISOString() })
  .eq('id', parsed.data.id)
  .eq('tenant_id', tenantId) // Defense-in-depth: mandatory on service-role UPDATE
```

**Synonym replace (APPT-03) — delete-then-insert pattern:**
```typescript
// Step 1: Delete all synonyms for this appointment_type_code + tenant
const { error: deleteError } = await serviceClient
  .from('appointment_type_synonyms')
  .delete()
  .eq('tenant_id', tenantId)
  .eq('appointment_type_code', parsed.data.appointmentTypeCode)

if (deleteError) {
  console.error('[saveAppointmentSynonymsAction] delete error:', deleteError)
  return { error: 'Speichern fehlgeschlagen.' }
}

// Step 2: Insert new synonyms
const rows = parsed.data.synonyms.map(synonym => ({
  tenant_id: tenantId,
  appointment_type_code: parsed.data.appointmentTypeCode,
  synonym,
  language_code: 'de',
}))
const { error: insertError } = await serviceClient
  .from('appointment_type_synonyms')
  .insert(rows)
```

**APPT-04 default-one pattern (two sequential updates):**
```typescript
// Clear all is_default for this tenant
await serviceClient.from('appointment_types').update({ is_default: false }).eq('tenant_id', tenantId)
// Set the chosen one
await serviceClient.from('appointment_types')
  .update({ is_default: true })
  .eq('id', parsed.data.appointmentTypeId)
  .eq('tenant_id', tenantId)
```

---

### `src/app/actions/greeting-texts.ts` (service, CRUD — EU AI Act enforcement)

**Analog:** `src/app/actions/update-inbox-status.ts` (auth + role gate) + `src/app/(dashboard)/settings/actions.ts` (prevState + formData signature).

**EU AI Act enforcement — always overwrite both columns** (unique to this action):
```typescript
const EU_AI_ACT_DISCLOSURE = 'Sie sprechen mit einem KI-gestützten Telefonsystem.'

// After auth + role gate + Zod validation of user_text + mode:
const { error: dbError } = await serviceClient
  .from('greeting_texts')
  .upsert({
    tenant_id: tenantId,
    mode: parsed.data.mode,
    language_code: 'de',
    eu_ai_act_disclosure: EU_AI_ACT_DISCLOSURE,     // always overwritten — TEXT-02
    eu_ai_act_disclosure_present: true,              // invariant flag — always true
    user_text: parsed.data.user_text,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id,mode,language_code' })
```

**FAQ insert (TEXT-03):**
```typescript
// Copy insert pattern from save-inbox-note.ts structure; swap table
const { error } = await serviceClient
  .from('faq_entries')
  .insert({ tenant_id: tenantId, mode: parsed.data.mode, question: parsed.data.question, answer: parsed.data.answer, active: true, sort_order: 0 })
```

**FAQ delete (defense-in-depth):**
```typescript
const { error } = await serviceClient
  .from('faq_entries')
  .delete()
  .eq('id', parsed.data.id)
  .eq('tenant_id', tenantId) // mandatory — service-role bypasses RLS
```

---

### `src/app/actions/deputy.ts` (service, CRUD — rich multi-field form)

**Analog:** `src/app/actions/call-feedback.ts` (all lines) for the partial-update / selective-field pattern. `src/app/actions/update-inbox-status.ts` (all lines) for the role gate.

**Multi-field update object pattern** (`call-feedback.ts` lines 44-53):
```typescript
// Build update object — only include fields that were explicitly provided
const updateData: Record<string, unknown> = {}
if (internalNote !== undefined) updateData.internal_note = internalNote
if (intentCorrected !== undefined) updateData.intent_corrected = intentCorrected
if (feedbackLabel !== undefined) updateData.feedback_label = feedbackLabel

if (Object.keys(updateData).length === 0) return { success: true }

const serviceClient = createServiceRoleClient()
const { error: dbError } = await serviceClient
  .from('call_log')
  .update(updateData)
  .eq('id', callId)
  .eq('tenant_id', tenantId) // Defense-in-depth
```

**For deputy.ts:** Use insert for add (not update), delete for remove. All deletes must include `.eq('tenant_id', tenantId)`. Zod refinement for date range:
```typescript
const deputySchema = z.object({
  name: z.string().min(1),
  forwarding_number: z.string().min(1),
  greeting_text: z.string().optional(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  pid_zero_behavior: z.enum(['refuse', 'waitlist', 'book_normal', 'forward']),
}).refine(
  d => !d.end_date || !d.start_date || d.end_date >= d.start_date,
  { message: 'Das Enddatum muss nach dem Startdatum liegen.' }
)
```

---

### `src/app/actions/medications.ts` (service, CRUD — PZN validation)

**Analog:** `src/app/actions/update-inbox-status.ts` (all lines) — simplest complete action pattern.

**PZN-specific Zod schema:**
```typescript
const addMedicationSchema = z.object({
  pzn: z.string().regex(/^\d{7}$/, 'Bitte geben Sie eine gültige 7-stellige PZN ein.'),
  name: z.string().min(1, 'Dieses Feld ist erforderlich.'),
  phonetic: z.string().optional(),
  note: z.string().optional(),
  active: z.boolean().default(true),
})
```

**Insert pattern:**
```typescript
const { error: dbError } = await serviceClient
  .from('medications')
  .insert({ tenant_id: tenantId, ...parsed.data })
```

**Toggle active (CRUD update):** Same as `update-inbox-status.ts` pattern — single field update with `.eq('tenant_id', tenantId)`.

**Delete:**
```typescript
const { error: dbError } = await serviceClient
  .from('medications')
  .delete()
  .eq('id', parsed.data.id)
  .eq('tenant_id', tenantId) // mandatory defense-in-depth
```

---

### `src/components/config/OeffnungszeitenTab.tsx` (component, request-response)

**Analog:** `src/app/(dashboard)/settings/SettingsForm.tsx` (all lines) for `useActionState` + form structure + field layout pattern.

**`useActionState` hook + form action pattern** (`SettingsForm.tsx` lines 49-57):
```tsx
'use client'
import { useActionState } from 'react'

const initialState: SettingsActionState = {}

export function SettingsForm({ tenant, canEdit }: SettingsFormProps) {
  const [state, formAction, isPending] = useActionState(updateTenantAction, initialState)
  return (
    <form action={formAction} className="space-y-6">
```

**Success/error feedback block** (`SettingsForm.tsx` lines 59-68):
```tsx
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
```

**Section card + section header pattern** (`SettingsForm.tsx` lines 71-76):
```tsx
<div className="rounded-lg border bg-white p-6 shadow-sm">
  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
    Wöchentliche Öffnungszeiten
  </h2>
```

**Field error display** (`SettingsForm.tsx` lines 117-119):
```tsx
{state.fieldErrors?.['hostname'] && (
  <p className="mt-1 text-xs text-red-600">{state.fieldErrors['hostname'].join(', ')}</p>
)}
```

**Disabled save button with pending state** (`SettingsForm.tsx` lines 252-258):
```tsx
<button type="submit" disabled={isPending} className="...disabled:opacity-50">
  {isPending ? 'Wird gespeichert...' : 'Öffnungszeiten speichern'}
</button>
```

**Note for OeffnungszeitenTab:** Use shadcn `Switch` for "Geschlossen" toggle per weekday row, `Input` for time fields, shadcn `Checkbox` for weekday selection. The 7-row grid is submitted as a single form (not per-row). Use shadcn `Table` for special days (HOURS-02) and deputy periods (HOURS-03). Per UI-SPEC, add/delete rows for HOURS-02 and HOURS-03 use inline form + `Dialog` confirmation on delete.

---

### `src/components/config/TerminartenTab.tsx` (component, CRUD)

**Analog:** `src/components/inbox/InboxTable.tsx` (all lines) for the `Table` + empty state + loading skeleton pattern. `src/components/status/StatusBar.tsx` (all lines) for the `useOptimistic` + `useTransition` + `Switch` toggle pattern.

**`useOptimistic` + `useTransition` toggle pattern** (`StatusBar.tsx` lines 22-33):
```tsx
const [optimisticStatus, setOptimisticStatus] = useOptimistic(
  status?.ara_status ?? 'active'
)
const [isPending, startTransition] = useTransition()

function handleToggle() {
  const next: AraStatus = optimisticStatus === 'active' ? 'paused' : 'active'
  startTransition(async () => {
    setOptimisticStatus(next)
    await toggleAraMedAction(next)
  })
}
```

**For per-row appointment flag toggle** — one `useOptimistic` per boolean column per row, or manage as local state array. Per RESEARCH.md, use the same pattern:
```tsx
const [optimisticValue, setOptimistic] = useOptimistic(currentValue)
const [isPending, startTransition] = useTransition()

function handleToggle(newValue: boolean) {
  startTransition(async () => {
    setOptimistic(newValue)
    await updateAppointmentTypeFlagAction({ id, field: 'is_voice_bookable', value: newValue })
    // useOptimistic reverts automatically if transition errors
  })
}
```

**Switch with pending state** (`StatusBar.tsx` lines 130-141):
```tsx
{isPending ? (
  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
) : (
  <Switch
    checked={optimisticStatus === 'active'}
    onCheckedChange={handleToggle}
    disabled={isPending}
    aria-label="ARA-MED Voice AI umschalten"
  />
)}
```

**Table with sticky header + loading skeleton** (`InboxTable.tsx` lines 59-95):
```tsx
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
          <p className="text-base font-semibold text-foreground">Keine Terminarten verfügbar.</p>
          <p className="mt-1 text-sm text-muted-foreground">Prüfen Sie die MEDSTAR-Verbindung.</p>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
) : (
  <Table>
    <TableHeader className="sticky top-0 bg-background z-10">
      <TableRow>
        <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Terminart
        </TableHead>
        {/* ... */}
      </TableRow>
    </TableHeader>
    <TableBody>
      {/* ... rows */}
    </TableBody>
  </Table>
)
```

---

### `src/components/config/BegruesungsTexteTab.tsx` (component, request-response)

**Analog:** `src/app/(dashboard)/settings/SettingsForm.tsx` (all lines) for `useActionState` + textarea + section layout.

**Textarea field pattern** (`SettingsForm.tsx` lines 128-143 — adapt from url input):
```tsx
<label htmlFor="greeting_text" className="block text-sm font-medium text-gray-700">
  Begrüßungstext
</label>
<textarea
  id="greeting_text"
  name="user_text"
  defaultValue={greetingText?.user_text ?? ''}
  disabled={!canEdit}
  placeholder="Guten Tag, Sie haben die Ordination [Name] erreicht. Wie kann ich Ihnen helfen?"
  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 min-h-32 resize-y"
/>
```

**EU AI Act lock block** (no codebase analog — new pattern, but uses existing CSS token classes):
```tsx
<div
  className="bg-muted border border-muted-foreground/30 rounded-md p-4"
  role="region"
  aria-label="EU-KI-Gesetz Art. 50 Pflichthinweis"
>
  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
    <Lock className="h-3.5 w-3.5" />
    EU-KI-Gesetz Art. 50 — Pflichthinweis
  </p>
  <p className="text-sm text-muted-foreground italic mt-2">
    &quot;Sie sprechen mit einem KI-gestützten Telefonsystem.&quot;
  </p>
  <p className="text-xs text-muted-foreground mt-2">
    Dieser Hinweis ist gesetzlich vorgeschrieben und kann nicht entfernt werden.
  </p>
</div>
```

**Sub-tabs within a tab** — use shadcn `Tabs` the same way `InboxTable.tsx` uses them (lines 170-196):
```tsx
<Tabs defaultValue="normal">
  <TabsList>
    <TabsTrigger value="normal">Normal</TabsTrigger>
    <TabsTrigger value="vacation">Urlaub</TabsTrigger>
    <TabsTrigger value="deputy">Vertretung</TabsTrigger>
    <TabsTrigger value="own_service">Eigener Vertretungsdienst</TabsTrigger>
  </TabsList>
  <TabsContent value="normal">
    {/* EU AI Act lock block + greeting textarea + FAQ section */}
  </TabsContent>
  {/* ... */}
</Tabs>
```

**Note:** Sub-tab state can be managed with React `useState` (URL search param is for the top-level module tab; inner sub-tab is client state per RESEARCH.md discretion).

---

### `src/components/config/VertretungTab.tsx` (component, CRUD)

**Analog:** `src/components/inbox/CaseDetailSheet.tsx` (lines 1-80) for `useTransition` + multi-field form + action call pattern. `src/app/(dashboard)/settings/SettingsForm.tsx` for multi-field form layout.

**`useTransition` + direct action call** (`CaseDetailSheet.tsx` lines 44-75):
```tsx
const [isPending, startTransition] = useTransition()
const [statusError, setStatusError] = useState<string | null>(null)

function handleStatusTransition(newStatus: InboxStatus) {
  if (!item) return
  const prev = optimisticStatus ?? item.status
  setOptimisticStatus(newStatus)
  setStatusError(null)
  startTransition(async () => {
    const result = await updateInboxStatusAction(item.id, newStatus)
    if (result.error) {
      setOptimisticStatus(prev)  // manual revert
      setStatusError(result.error)
    }
  })
}
```

**Form field layout for add deputy** — copy from `SettingsForm.tsx` field pattern (lines 104-119). Each field: label + input + optional error paragraph.

**Conditional field reveal (pid_zero_behavior → forwarding number):**
```tsx
const [pidZeroBehavior, setPidZeroBehavior] = useState('refuse')
// ... in JSX:
{pidZeroBehavior === 'forward' && (
  <div>
    <label htmlFor="pid_zero_forward_number">Weiterleitungsnummer bei PID=0</label>
    <Input id="pid_zero_forward_number" name="pid_zero_forward_number" type="tel" />
  </div>
)}
```

**Delete confirmation dialog:** Use shadcn `Dialog` (new for Phase 5). No existing analog in codebase — follow shadcn Dialog API. Pattern from `CaseDetailSheet.tsx` line 19 import style:
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
// After `npx shadcn add dialog`
```

---

### `src/components/config/MedikamenteTab.tsx` (component, CRUD)

**Analog:** `src/components/inbox/InboxTable.tsx` (all lines) for `Table` + empty state pattern. `src/components/status/StatusBar.tsx` (lines 22-33) for `useOptimistic` + `useTransition` for the active/inactive toggle.

**Table with action column icons** (adapt from `InboxTable.tsx` lines 96-166):
```tsx
<TableHeader>
  <TableRow>
    <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">PZN</TableHead>
    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Medikament</TableHead>
    {/* ... */}
    <TableHead className="w-[80px]" /> {/* Aktionen */}
  </TableRow>
</TableHeader>
<TableBody>
  {medications.map((med) => (
    <TableRow key={med.id} className={med.active ? '' : 'opacity-60'}>
      <TableCell className="font-mono text-sm">{med.pzn}</TableCell>
      {/* ... */}
      <TableCell>
        <Button variant="ghost" size="icon" onClick={() => setEditId(med.id)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(med)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  ))}
</TableBody>
```

**Inline add form below table** (no Sheet — see `SettingsForm.tsx` field pattern):
```tsx
{showAddForm && (
  <div className="mt-4 rounded-lg border p-4 space-y-4">
    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      Neues Medikament
    </h3>
    <form action={addFormAction} className="space-y-3">
      <Input name="pzn" pattern="[0-9]{7}" placeholder="1234567" />
      {/* ... other fields */}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
        Medikament speichern
      </Button>
      {addState.error && <p className="text-xs text-destructive mt-1" role="alert">{addState.error}</p>}
    </form>
  </div>
)}
```

---

## Shared Patterns

### Authentication + Role Gate (applies to ALL 5 Server Action files)

**Source:** `src/app/actions/update-inbox-status.ts` lines 20-68 — canonical 5-step sequence

```typescript
// Step 1: Zod validate BEFORE auth
const parsed = schema.safeParse(input)
if (!parsed.success) return { error: 'Ungültige Eingabe.' }

// Step 2: Auth — MUST await createServerClient
const supabase = await createServerClient()
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError || !user) return { error: 'Nicht authentifiziert.' }

// Step 3: tenant_id from JWT ONLY — never from request body
const tenantId = user.app_metadata?.tenant_id as string | undefined
if (!tenantId) return { error: 'Kein Tenant zugewiesen.' }

// Step 4: Role gate for write actions
const araRole = user.app_metadata?.ara_role as string | undefined
if (!araRole || !ALLOWED_ROLES.includes(araRole)) return { error: 'Unzureichende Berechtigung.' }

// Step 5: createServiceRoleClient — sync, no await
const serviceClient = createServiceRoleClient()
```

### Defense-in-Depth on DELETE and UPDATE (applies to ALL Server Action deletes/updates)

**Source:** `src/app/actions/update-inbox-status.ts` line 62, `src/app/actions/save-inbox-note.ts` line 54

```typescript
// Every DELETE must include tenant_id filter — service-role bypasses RLS
.delete()
.eq('id', parsed.data.id)
.eq('tenant_id', tenantId) // mandatory — prevents cross-tenant delete via forged UUID
```

### Error Logging Convention (applies to ALL Server Action DB error handlers)

**Source:** `src/app/actions/update-inbox-status.ts` lines 65-67

```typescript
if (dbError) {
  console.error('[actionFunctionName] DB error:', dbError)
  return { error: 'Speichern fehlgeschlagen. Bitte erneut versuchen.' }
}
```

### `useActionState` Form Binding (applies to OeffnungszeitenTab, BegruesungsTexteTab)

**Source:** `src/app/(dashboard)/settings/SettingsForm.tsx` lines 49-57

```tsx
'use client'
import { useActionState } from 'react'
const initialState: ActionState = {}
// Inside component:
const [state, formAction, isPending] = useActionState(serverAction, initialState)
return <form action={formAction}>
```

### `useOptimistic` + `useTransition` Switch Toggle (applies to TerminartenTab, MedikamenteTab)

**Source:** `src/components/status/StatusBar.tsx` lines 22-33, 130-141

```tsx
import { useOptimistic, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

const [optimisticValue, setOptimistic] = useOptimistic(serverValue)
const [isPending, startTransition] = useTransition()

function handleToggle(newValue: boolean) {
  startTransition(async () => {
    setOptimistic(newValue)
    await serverAction({ id, value: newValue })
  })
}
// In JSX:
{isPending
  ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  : <Switch checked={optimisticValue} onCheckedChange={handleToggle} disabled={isPending} aria-label="..." />
}
```

### Section Header Typography (applies to all Client Components)

**Source:** `src/app/(dashboard)/settings/SettingsForm.tsx` lines 72-74

```tsx
<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
  Section Title
</h2>
```

Per UI-SPEC the shadcn equivalent using CSS tokens:
```tsx
<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
  Section Title
</p>
```

### Table Empty State (applies to TerminartenTab, MedikamenteTab, VertretungTab)

**Source:** `src/components/inbox/InboxTable.tsx` lines 71-94

```tsx
<Table>
  <TableBody>
    <TableRow>
      <TableCell colSpan={N} className="py-12 text-center">
        <p className="text-base font-semibold text-foreground">Keine Einträge</p>
        <p className="mt-1 text-sm text-muted-foreground">{emptyStateBody}</p>
      </TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Loading Skeleton (applies to TerminartenTab, MedikamenteTab, VertretungTab)

**Source:** `src/components/inbox/InboxTable.tsx` lines 59-69

```tsx
{Array.from({ length: 5 }).map((_, i) => (
  <TableRow key={i}>
    <TableCell colSpan={N}>
      <div className="h-11 w-full bg-muted animate-pulse rounded" />
    </TableCell>
  </TableRow>
))}
```

### RLS 4-Policy Template (applies to migration — all 9 new tables)

**Source:** `supabase/migrations/20260522000010_inbox_items_rls_policies.sql` lines 13-48

Always use `(SELECT auth.jwt()->'app_metadata'->>'tenant_id')::uuid` — never bare `auth.jwt()`. SELECT/INSERT policies: tenant isolation only. UPDATE/DELETE policies: tenant isolation + role gate (`'operator','ordination_admin'`).

---

## No Analog Found

All files have close analogs in the existing codebase. The following UI patterns are new constructs but built entirely from existing shadcn components and CSS tokens:

| Pattern | Role | Reason | Approach |
|---------|------|--------|----------|
| EU AI Act lock block | UI sub-component | No locked/read-only informational block exists yet | Use existing CSS tokens (`bg-muted`, `border-muted-foreground/30`) + `Lock` lucide icon + `role="region"` |
| shadcn `Dialog` confirmation | UI sub-component | No Dialog usage exists yet (new shadcn component) | Follow shadcn Dialog API after `npx shadcn add dialog`; import from `@/components/ui/dialog` |
| shadcn `Calendar` + `Popover` date picker | UI sub-component | No date picker exists yet | Follow shadcn Calendar API after `npx shadcn add calendar popover`; import from `@/components/ui/calendar` and `@/components/ui/popover` |
| shadcn `Checkbox` | UI sub-component | No Checkbox usage exists yet | Follow shadcn Checkbox API after `npx shadcn add checkbox`; import from `@/components/ui/checkbox` |
| Inline add form below Table | UI pattern | Existing forms are page-level; no inline-in-table forms yet | Adapt `SettingsForm.tsx` field layout pattern, rendered conditionally below `</Table>` |

---

## Metadata

**Analog search scope:** `src/app/actions/`, `src/app/(dashboard)/`, `src/components/`, `src/lib/types/`, `supabase/migrations/`
**Files scanned:** 24
**Pattern extraction date:** 2026-05-23
