'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OeffnungszeitenTab } from '@/components/config/OeffnungszeitenTab'
import { TerminartenTab } from '@/components/config/TerminartenTab'
import { BegruesungsTexteTab } from '@/components/config/BegruesungsTexteTab'
import { VertretungTab } from '@/components/config/VertretungTab'
import { MedikamenteTab } from '@/components/config/MedikamenteTab'
import { RoutingTab } from '@/components/config/RoutingTab'
import { KommunikationTab } from '@/components/config/KommunikationTab'
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

interface KonfigurationTabsProps {
  initialTab: string
  tenantId: string
  hasEditRight: boolean
  openingHours: OpeningHoursRow[]
  specialDays: SpecialDayRow[]
  deputyPeriods: DeputyPeriodRow[]
  appointmentTypes: AppointmentTypeRow[]
  synonyms: AppointmentTypeSynonymRow[]
  greetingTexts: GreetingTextRow[]
  faqEntries: FaqEntryRow[]
  deputyDoctors: DeputyDoctorRow[]
  medications: MedicationRow[]
  routingRules: RoutingRuleRow[]
  vipNumbers: VipNumberRow[]
  commRules: CommRuleRow[]
  messageTemplates: MessageTemplateRow[]
  sendLog: SendLogRow[]
}

export default function KonfigurationTabs({
  initialTab,
  tenantId,
  hasEditRight,
  openingHours,
  specialDays,
  deputyPeriods,
  appointmentTypes,
  synonyms,
  greetingTexts,
  faqEntries,
  deputyDoctors,
  medications,
  routingRules,
  vipNumbers,
  commRules,
  messageTemplates,
  sendLog,
}: KonfigurationTabsProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState(initialTab)

  function handleTabChange(value: string) {
    setActiveTab(value)
    router.replace('/konfiguration?tab=' + value)
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="mb-6">
        <TabsTrigger value="oeffnungszeiten">Öffnungszeiten</TabsTrigger>
        <TabsTrigger value="terminarten">Terminarten</TabsTrigger>
        <TabsTrigger value="begruessung">Begrüßungstexte</TabsTrigger>
        <TabsTrigger value="vertretung">Vertretung</TabsTrigger>
        <TabsTrigger value="medikamente">Medikamente</TabsTrigger>
        <TabsTrigger value="routing">Routing</TabsTrigger>
        <TabsTrigger value="kommunikation">Kommunikation</TabsTrigger>
      </TabsList>

      <TabsContent value="oeffnungszeiten">
        <OeffnungszeitenTab
          tenantId={tenantId}
          hasEditRight={hasEditRight}
          initialOpeningHours={openingHours}
          initialSpecialDays={specialDays}
          initialDeputyPeriods={deputyPeriods}
        />
      </TabsContent>

      <TabsContent value="terminarten">
        <TerminartenTab
          tenantId={tenantId}
          hasEditRight={hasEditRight}
          initialAppointmentTypes={appointmentTypes}
          initialSynonyms={synonyms}
        />
      </TabsContent>

      <TabsContent value="begruessung">
        <BegruesungsTexteTab
          tenantId={tenantId}
          hasEditRight={hasEditRight}
          initialGreetingTexts={greetingTexts}
          initialFaqEntries={faqEntries}
        />
      </TabsContent>

      <TabsContent value="vertretung">
        <VertretungTab
          tenantId={tenantId}
          hasEditRight={hasEditRight}
          initialDeputyDoctors={deputyDoctors}
        />
      </TabsContent>

      <TabsContent value="medikamente">
        <MedikamenteTab
          tenantId={tenantId}
          hasEditRight={hasEditRight}
          initialMedications={medications}
        />
      </TabsContent>

      <TabsContent value="routing">
        <RoutingTab
          tenantId={tenantId}
          hasEditRight={hasEditRight}
          initialRoutingRules={routingRules}
          initialVipNumbers={vipNumbers}
        />
      </TabsContent>

      <TabsContent value="kommunikation">
        <KommunikationTab
          tenantId={tenantId}
          hasEditRight={hasEditRight}
          initialCommRules={commRules}
          initialTemplates={messageTemplates}
          initialSendLog={sendLog}
        />
      </TabsContent>
    </Tabs>
  )
}
