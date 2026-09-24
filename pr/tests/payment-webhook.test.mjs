import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignatureHeader } from '../supabase/functions/payment-webhook/webhook-security.js';
import { handlePaymentWebhook } from '../supabase/functions/payment-webhook/webhook-core.js';

const secret = 'test-secret-with-enough-random-characters';
const nowMs = Date.parse('2026-09-24T20:00:00.000Z');
const timestamp = Math.floor(nowMs / 1000);
const paymentId = '99887766';
const userId = 'cc8ed729-c01b-4d1c-92f0-7a903c447bd9';
const courseId = '4b39feb9-0a46-41a7-90f7-cb14d5bb91a1';

async function signedRequest({ requestId = 'request-1', ts = timestamp, signatureRequestId = requestId } = {}) {
  const signature = await createSignatureHeader({ secret, dataId: paymentId, requestId: signatureRequestId, timestamp: ts });
  return new Request(`https://example.test/payment-webhook?data.id=${paymentId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-request-id': requestId, 'x-signature': signature },
    body: JSON.stringify({ type: 'payment', data: { id: paymentId } })
  });
}

function dependencies(overrides = {}) {
  return {
    webhookSecret: secret,
    toleranceSeconds: 300,
    nowMs: () => nowMs,
    lookupPayment: async () => ({ id: paymentId, status: 'approved', external_reference: `${userId}:${courseId}`, date_approved: '2026-09-24T19:59:00.000Z' }),
    processApprovedPayment: async () => true,
    ...overrides
  };
}

test('accepts a valid x-signature and x-request-id', async () => {
  let effects = 0;
  const response = await handlePaymentWebhook(await signedRequest(), dependencies({
    processApprovedPayment: async () => { effects += 1; return true; }
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: true, duplicate: false });
  assert.equal(effects, 1);
});

test('rejects a forged signature with 401 before looking up the payment', async () => {
  let lookups = 0;
  const request = await signedRequest();
  const forged = new Request(request.url, {
    method: 'POST',
    headers: { ...Object.fromEntries(request.headers), 'x-signature': `ts=${timestamp},v1=${'0'.repeat(64)}` },
    body: await request.text()
  });
  const response = await handlePaymentWebhook(forged, dependencies({ lookupPayment: async () => { lookups += 1; } }));
  assert.equal(response.status, 401);
  assert.equal(lookups, 0);
});

test('rejects a signature made for a different x-request-id', async () => {
  const response = await handlePaymentWebhook(
    await signedRequest({ requestId: 'request-tampered', signatureRequestId: 'request-original' }),
    dependencies()
  );
  assert.equal(response.status, 401);
});

test('rejects an expired signed notification as a replay', async () => {
  const oldTimestamp = timestamp - 301;
  const response = await handlePaymentWebhook(await signedRequest({ ts: oldTimestamp }), dependencies());
  assert.equal(response.status, 401);
});

test('repeated notifications do not duplicate enrollment or financial effects', async () => {
  const processedPayments = new Set();
  let enrollmentEffects = 0;
  let financialEffects = 0;
  const deps = dependencies({
    processApprovedPayment: async payment => {
      if (processedPayments.has(payment.paymentId)) return false;
      processedPayments.add(payment.paymentId);
      enrollmentEffects += 1;
      financialEffects += 1;
      return true;
    }
  });

  const first = await handlePaymentWebhook(await signedRequest({ requestId: 'delivery-1' }), deps);
  const repeated = await handlePaymentWebhook(await signedRequest({ requestId: 'delivery-2' }), deps);

  assert.equal(first.status, 200);
  assert.equal(repeated.status, 200);
  assert.equal((await first.json()).duplicate, false);
  assert.equal((await repeated.json()).duplicate, true);
  assert.equal(enrollmentEffects, 1);
  assert.equal(financialEffects, 1);
});
