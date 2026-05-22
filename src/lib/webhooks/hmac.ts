import { createHmac, timingSafeEqual } from 'crypto'

export const HMAC_HEADER = 'x-aramed-signature'

export function verifyHmacSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  if (signatureHeader.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(signatureHeader, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}
