import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handlePaymentWebhook } from './webhook-core.js';

const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN') ?? '';
const webhookSecret = Deno.env.get('MERCADO_PAGO_WEBHOOK_SECRET') ?? '';
const tolerance = Number(Deno.env.get('MERCADO_PAGO_WEBHOOK_TOLERANCE_SECONDS') ?? '300');
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

type ApprovedPayment = {
  provider: string;
  paymentId: string;
  requestId: string;
  userId: string;
  courseId: string;
  paymentReference: string;
  paidAt: string;
};

Deno.serve(request => handlePaymentWebhook(request, {
  webhookSecret,
  toleranceSeconds: Number.isFinite(tolerance) ? Math.min(Math.max(tolerance, 60), 900) : 300,
  async lookupPayment(paymentId: string) {
    if (!accessToken) throw new Error('Payment provider is not configured');
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) throw new Error('Payment lookup failed');
    return response.json();
  },
  async processApprovedPayment(payment: ApprovedPayment) {
    const { data, error } = await admin.rpc('process_approved_payment', {
      p_provider: payment.provider,
      p_payment_id: payment.paymentId,
      p_request_id: payment.requestId,
      p_user_id: payment.userId,
      p_course_id: payment.courseId,
      p_payment_reference: payment.paymentReference,
      p_paid_at: payment.paidAt
    });
    if (error) throw error;
    return data === true;
  }
}));
