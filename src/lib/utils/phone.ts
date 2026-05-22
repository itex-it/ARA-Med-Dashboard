// Raw phone numbers are never stored — call_log holds only phone_hash (SHA-256) per DSGVO design.
// maskPhone produces a stable display token for the dashboard without revealing the MSISDN.
export function maskPhone(phoneHash: string | null): string {
  if (!phoneHash) return 'Unbekannt'
  return '+** *** *** ' + phoneHash.slice(-4)
}
