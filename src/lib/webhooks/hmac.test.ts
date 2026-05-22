import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { verifyHmacSignature, HMAC_HEADER } from './hmac'

const SECRET = 'test-secret'
const BODY = '{"event_type":"call.started"}'

function makeSignature(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

test('valid signature returns true', () => {
  const sig = makeSignature(BODY, SECRET)
  assert.equal(verifyHmacSignature(BODY, sig, SECRET), true)
})

test('wrong secret returns false', () => {
  const sig = makeSignature(BODY, 'wrong-secret')
  assert.equal(verifyHmacSignature(BODY, sig, SECRET), false)
})

test('null header returns false', () => {
  assert.equal(verifyHmacSignature(BODY, null, SECRET), false)
})

test('empty header returns false', () => {
  assert.equal(verifyHmacSignature(BODY, '', SECRET), false)
})

test('malformed hex returns false without throwing', () => {
  assert.equal(verifyHmacSignature(BODY, 'not-hex!!!', SECRET), false)
})

test('HMAC_HEADER constant is correct', () => {
  assert.equal(HMAC_HEADER, 'x-aramed-signature')
})
