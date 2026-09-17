import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Configure no Mercado Pago o Webhook para esta função e valide a assinatura antes de produção.
Deno.serve(async (request) => {
  try {
    const body = await request.json();
    if (body.type !== 'payment') return Response.json({ received: true });
    const token = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')!;
    const payment = await fetch(`https://api.mercadopago.com/v1/payments/${body.data.id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
    if (payment.status !== 'approved' || !payment.external_reference) return Response.json({ received: true });
    const [userId, courseId] = payment.external_reference.split(':');
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await admin.from('enrollments').upsert({ user_id: userId, course_id: courseId, status: 'active', payment_provider: 'mercado_pago', payment_reference: String(payment.preference_id ?? payment.id), paid_at: new Date().toISOString() }, { onConflict: 'user_id,course_id' });
    return Response.json({ received: true });
  } catch { return Response.json({ received: true }); }
});
