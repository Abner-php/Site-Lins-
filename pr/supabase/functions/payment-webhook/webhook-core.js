import { verifyWebhookSignature } from './webhook-security.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body, status = 200) {
  return Response.json(body, { status });
}

export async function handlePaymentWebhook(request, dependencies) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid notification' }, 400);
  }

  const url = new URL(request.url);
  const paymentId = String(url.searchParams.get('data.id') ?? body.data?.id ?? '');
  const requestId = request.headers.get('x-request-id') ?? '';
  const signature = request.headers.get('x-signature') ?? '';
  const valid = await verifyWebhookSignature({
    signature,
    requestId,
    dataId: paymentId,
    secret: dependencies.webhookSecret,
    nowMs: dependencies.nowMs?.() ?? Date.now(),
    toleranceSeconds: dependencies.toleranceSeconds ?? 300
  });
  if (!valid) return json({ error: 'Invalid signature' }, 401);
  if (body.type !== 'payment') return json({ received: true });

  let payment;
  try {
    payment = await dependencies.lookupPayment(paymentId);
  } catch {
    return json({ error: 'Payment lookup failed' }, 502);
  }
  if (payment.status !== 'approved' || !payment.external_reference) return json({ received: true });

  const [userId, courseId, ...extra] = String(payment.external_reference).split(':');
  if (extra.length || !uuid.test(userId) || !uuid.test(courseId)) {
    return json({ error: 'Invalid payment reference' }, 400);
  }

  try {
    const processed = await dependencies.processApprovedPayment({
      provider: 'mercado_pago',
      paymentId: String(payment.id ?? paymentId),
      requestId,
      userId,
      courseId,
      paymentReference: String(payment.id ?? paymentId),
      paidAt: payment.date_approved ?? new Date(dependencies.nowMs?.() ?? Date.now()).toISOString()
    });
    return json({ received: true, duplicate: !processed });
  } catch {
    return json({ error: 'Enrollment update failed' }, 500);
  }
}
