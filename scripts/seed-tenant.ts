/**
 * ARA-Med Tenant Seed Script
 *
 * Erstellt einen neuen Mandanten (Tenant) mit Vault-Schlüsseln und Operator-Rollenzuweisung.
 *
 * VERWENDUNG:
 *   TENANT_NAME="Ordination Dr. Muster" \
 *   OPERATOR_USER_ID="<supabase-auth-user-uuid>" \
 *   MEDSTAR_KEY="<medstar-api-key>" \
 *   ELEVENLABS_KEY="<elevenlabs-api-key>" \
 *   NEXT_PUBLIC_SUPABASE_URL="https://<project>.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
 *   npx ts-node scripts/seed-tenant.ts
 *
 * VORAUSSETZUNGEN:
 *   - Supabase Projekt mit allen Migrationen (supabase db push)
 *   - pgsodium und supabase_vault Extensions aktiviert
 *   - Ein bestehender Supabase Auth User (OPERATOR_USER_ID)
 *
 * SICHERHEIT:
 *   - Dieses Skript ist NUR für die lokale Ausführung gedacht
 *   - Niemals in der Anwendung deployen
 *   - API-Schlüssel werden in Supabase Vault gespeichert, NICHT in der tenants Tabelle
 */

import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Konfiguration aus Umgebungsvariablen
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const TENANT_NAME = process.env['TENANT_NAME']
const OPERATOR_USER_ID = process.env['OPERATOR_USER_ID']
const MEDSTAR_KEY = process.env['MEDSTAR_KEY']
const ELEVENLABS_KEY = process.env['ELEVENLABS_KEY']

// ---------------------------------------------------------------------------
// Eingabe-Validierung
// ---------------------------------------------------------------------------

function assertEnv(name: string, value: string | undefined): string {
  if (!value) {
    console.error(`FEHLER: Umgebungsvariable ${name} fehlt.`)
    process.exit(1)
  }
  return value
}

const supabaseUrl = assertEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL)
const serviceRoleKey = assertEnv('SUPABASE_SERVICE_ROLE_KEY', SERVICE_ROLE_KEY)
const tenantName = assertEnv('TENANT_NAME', TENANT_NAME)
const operatorUserId = assertEnv('OPERATOR_USER_ID', OPERATOR_USER_ID)
const medstarKey = assertEnv('MEDSTAR_KEY', MEDSTAR_KEY)
const elevenlabsKey = assertEnv('ELEVENLABS_KEY', ELEVENLABS_KEY)

// ---------------------------------------------------------------------------
// Supabase Service Role Client (umgeht RLS vollständig)
// ---------------------------------------------------------------------------

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// ---------------------------------------------------------------------------
// Haupt-Logik
// ---------------------------------------------------------------------------

async function seedTenant(): Promise<void> {
  console.log(`\nARA-Med Tenant Seed`)
  console.log(`===================`)
  console.log(`Tenant Name:  ${tenantName}`)
  console.log(`Operator ID:  ${operatorUserId}`)
  console.log(``)

  // -------------------------------------------------------------------------
  // Schritt 1: Tenant-Zeile einfügen
  // -------------------------------------------------------------------------
  console.log(`[1/4] Erstelle Tenant-Eintrag...`)

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      name: tenantName,
      // Phase 1 Standard-Feature-Flags (dokumentiert in Migration 000006)
      active_features: {
        voice_ai: true,
        inbox: true,
        call_log: true,
        statistics: false,
        magic_link: false,
      },
    })
    .select('id')
    .single()

  if (tenantError) {
    console.error(`FEHLER beim Erstellen des Tenants:`, tenantError.message)
    process.exit(1)
  }

  const tenantId = tenant.id as string
  console.log(`     Tenant erstellt: ${tenantId}`)

  // -------------------------------------------------------------------------
  // Schritt 2: Operator-Rollenzuweisung
  // -------------------------------------------------------------------------
  console.log(`[2/4] Weise Operator-Rolle zu...`)

  const { error: roleError } = await supabase.from('user_tenant_roles').insert({
    user_id: operatorUserId,
    tenant_id: tenantId,
    role: 'operator',
    permissions: {},
    active: true,
  })

  if (roleError) {
    console.error(`FEHLER beim Zuweisen der Operator-Rolle:`, roleError.message)
    // Rollback: Tenant löschen
    await supabase.from('tenants').delete().eq('id', tenantId)
    process.exit(1)
  }

  console.log(`     Operator-Rolle zugewiesen`)

  // -------------------------------------------------------------------------
  // Schritt 3: MEDSTAR API-Schlüssel in Vault speichern
  // -------------------------------------------------------------------------
  console.log(`[3/4] Speichere MEDSTAR API-Schlüssel in Vault...`)

  const medstarVaultName = `medstar_key_${tenantId}`
  const { error: medstarVaultError } = await supabase.rpc('insert_vault_secret', {
    p_secret: medstarKey,
    p_name: medstarVaultName,
    p_description: `MEDSTAR API-Schlüssel für Tenant ${tenantId}`,
  }).then(
    // Falls die RPC-Funktion nicht existiert, direkt in vault.secrets einfügen
    (result) => result,
    async () => {
      // Fallback: Direktes INSERT in vault.secrets via SQL
      return await supabase.rpc('exec_sql', {
        sql: `INSERT INTO vault.secrets(secret, name, description) VALUES ($1, $2, $3)`,
        params: [medstarKey, medstarVaultName, `MEDSTAR API-Schlüssel für Tenant ${tenantId}`],
      })
    }
  )

  if (medstarVaultError) {
    // Direkter SQL-Fallback via vault.create_secret
    const { error: directError } = await supabase.schema('vault').from('secrets').insert({
      secret: medstarKey,
      name: medstarVaultName,
      description: `MEDSTAR API-Schlüssel für Tenant ${tenantId}`,
    })

    if (directError) {
      console.error(`FEHLER beim Speichern des MEDSTAR-Schlüssels in Vault:`, directError.message)
      console.error(``)
      console.error(`Hinweis: Stellen Sie sicher dass die supabase_vault Extension aktiviert ist.`)
      console.error(`Supabase Dashboard → Database → Extensions → supabase_vault`)
      process.exit(1)
    }
  }

  console.log(`     MEDSTAR-Schlüssel gespeichert als: ${medstarVaultName}`)

  // -------------------------------------------------------------------------
  // Schritt 4: ElevenLabs API-Schlüssel in Vault speichern
  // -------------------------------------------------------------------------
  console.log(`[4/4] Speichere ElevenLabs API-Schlüssel in Vault...`)

  const elevenlabsVaultName = `elevenlabs_key_${tenantId}`
  const { error: elevenlabsVaultError } = await supabase.schema('vault').from('secrets').insert({
    secret: elevenlabsKey,
    name: elevenlabsVaultName,
    description: `ElevenLabs (ARA-MED Voice) API-Schlüssel für Tenant ${tenantId}`,
  })

  if (elevenlabsVaultError) {
    console.error(
      `FEHLER beim Speichern des ElevenLabs-Schlüssels in Vault:`,
      elevenlabsVaultError.message
    )
    process.exit(1)
  }

  console.log(`     ElevenLabs-Schlüssel gespeichert als: ${elevenlabsVaultName}`)

  // -------------------------------------------------------------------------
  // Abschluss
  // -------------------------------------------------------------------------
  console.log(``)
  console.log(`=== Tenant erfolgreich erstellt ===`)
  console.log(``)
  console.log(`Tenant-ID:     ${tenantId}`)
  console.log(`Tenant-Name:   ${tenantName}`)
  console.log(`Operator:      ${operatorUserId}`)
  console.log(`Vault-Schlüssel:`)
  console.log(`  - ${medstarVaultName}`)
  console.log(`  - ${elevenlabsVaultName}`)
  console.log(``)
  console.log(`NÄCHSTE SCHRITTE:`)
  console.log(`1. Custom Access Token Hook in Supabase registrieren:`)
  console.log(`   Dashboard → Authentication → Hooks → Custom Access Token Hook`)
  console.log(`   Function: public.custom_access_token_hook`)
  console.log(`2. Als Operator einloggen und TOTP einrichten`)
  console.log(`3. /settings aufrufen und Tenant-Konfiguration vervollständigen`)
}

// ---------------------------------------------------------------------------
// Ausführung
// ---------------------------------------------------------------------------

seedTenant().catch((err: unknown) => {
  console.error(`Unerwarteter Fehler:`, err)
  process.exit(1)
})
