import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import KonfigurationTabs from '@/components/config/KonfigurationTabs'
import type {
  OpeningHoursRow,
  SpecialDayRow,
  DeputyPeriodRow,
  AppointmentTypeRow,
  AppointmentTypeSynonymRow,
  GreetingTextRow,
  FaqEntryRow,
  DeputyDoctorRow,
  MedicationRow,
  RoutingRuleRow,
  VipNumberRow,
  CommRuleRow,
  MessageTemplateRow,
  SendLogRow,
} from '@/lib/types'

export default async function KonfigurationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const activeTab = params.tab ?? 'oeffnungszeiten'

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const tenantId = (user.app_metadata?.tenant_id as string | undefined) ?? ''
  const araRole = (user.app_metadata?.ara_role as string | undefined) ?? ''
  const hasEditRight = ['operator', 'ordination_admin'].includes(araRole)

  // Fetch all 14 config tables in parallel (9 Phase 5 + 3 Phase 6 routing/comm + 2 Phase 6 templates/log)
  const [
    { data: openingHoursRaw },
    { data: specialDaysRaw },
    { data: deputyPeriodsRaw },
    { data: appointmentTypesRaw },
    { data: synonymsRaw },
    { data: greetingTextsRaw },
    { data: faqEntriesRaw },
    { data: deputyDoctorsRaw },
    { data: medicationsRaw },
    { data: routingRulesRaw },
    { data: vipNumbersRaw },
    { data: commRulesRaw },
    { data: messageTemplatesRaw },
    { data: sendLogRaw },
  ] = await Promise.all([
    supabase.from('opening_hours').select('*').eq('tenant_id', tenantId).order('weekday'),
    supabase.from('special_days').select('*').eq('tenant_id', tenantId).order('date'),
    supabase.from('deputy_periods').select('*').eq('tenant_id', tenantId).order('start_date'),
    supabase
      .from('appointment_types')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('display_name'),
    supabase.from('appointment_type_synonyms').select('*').eq('tenant_id', tenantId),
    supabase.from('greeting_texts').select('*').eq('tenant_id', tenantId),
    supabase.from('faq_entries').select('*').eq('tenant_id', tenantId).order('sort_order'),
    supabase
      .from('deputy_doctors')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    supabase.from('medications').select('*').eq('tenant_id', tenantId).order('name'),
    supabase.from('routing_rules').select('*').eq('tenant_id', tenantId).order('priority'),
    supabase.from('vip_numbers').select('*').eq('tenant_id', tenantId).order('created_at'),
    supabase
      .from('comm_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    supabase.from('message_templates').select('*').eq('tenant_id', tenantId).order('name'),
    supabase
      .from('send_log')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Konfiguration</h1>
      <KonfigurationTabs
        initialTab={activeTab}
        tenantId={tenantId}
        hasEditRight={hasEditRight}
        openingHours={(openingHoursRaw as OpeningHoursRow[] | null) ?? []}
        specialDays={(specialDaysRaw as SpecialDayRow[] | null) ?? []}
        deputyPeriods={(deputyPeriodsRaw as DeputyPeriodRow[] | null) ?? []}
        appointmentTypes={(appointmentTypesRaw as AppointmentTypeRow[] | null) ?? []}
        synonyms={(synonymsRaw as AppointmentTypeSynonymRow[] | null) ?? []}
        greetingTexts={(greetingTextsRaw as GreetingTextRow[] | null) ?? []}
        faqEntries={(faqEntriesRaw as FaqEntryRow[] | null) ?? []}
        deputyDoctors={(deputyDoctorsRaw as DeputyDoctorRow[] | null) ?? []}
        medications={(medicationsRaw as MedicationRow[] | null) ?? []}
        routingRules={(routingRulesRaw as RoutingRuleRow[] | null) ?? []}
        vipNumbers={(vipNumbersRaw as VipNumberRow[] | null) ?? []}
        commRules={(commRulesRaw as CommRuleRow[] | null) ?? []}
        messageTemplates={(messageTemplatesRaw as MessageTemplateRow[] | null) ?? []}
        sendLog={(sendLogRaw as SendLogRow[] | null) ?? []}
      />
    </div>
  )
}
