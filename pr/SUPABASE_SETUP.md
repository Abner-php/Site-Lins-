# Como ativar o backend

1. Crie um projeto no Supabase usando o e-mail `jonas.guita.jazz@gmail.com`.
2. Aplique todos os arquivos de `supabase/migrations` em ordem cronológica. Com o Supabase CLI vinculado ao projeto, prefira `supabase db push`; pelo **SQL Editor**, execute cada migration ainda não aplicada.
3. Em **Authentication > Providers**, habilite Email e mantenha a confirmação de e-mail ativa. Em **URL Configuration**, cadastre a URL do site e permita `https://seu-dominio/curso.html**` como redirect.
4. Depois de Jonas criar a conta, execute o comando comentado no fim da migration para torná-lo professor.
5. Copie a **Project URL** e a **publishable key** em **Project Settings > API** para `course-config.js`; preencha também `whatsappNumber` apenas com números, incluindo DDI e DDD.
6. Instale e faça login no Supabase CLI; depois publique as funções:
   ```bash
   supabase functions deploy create-payment
   supabase functions deploy payment-webhook
   ```
7. Em **Edge Functions > Secrets**, cadastre `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET` e `SITE_URL`. A service role é disponibilizada pelo Supabase para a função; nunca a coloque no frontend.
8. No Mercado Pago, configure o Webhook para `/functions/v1/payment-webhook`, habilite o evento Pagamentos e copie a assinatura secreta para `MERCADO_PAGO_WEBHOOK_SECRET`.

O webhook aceita somente assinaturas HMAC válidas com `x-signature` e `x-request-id`. Por padrão, a assinatura expira em 5 minutos para bloquear replays antigos. A migration `20260924_webhook_idempotency.sql` registra cada pagamento de forma transacional: entregas repetidas retornam sucesso ao Mercado Pago, mas não repetem a matrícula nem os efeitos financeiros.

O bucket privado `course-videos` e as políticas de acesso são criados pelas migrations. Vídeos enviados pelo painel do professor recebem URLs assinadas de uma hora e só podem ser solicitados por professores ou alunos com matrícula ativa.

Os agendamentos são persistidos como `timestamptz` (instantes UTC). A migration `20260918_booking_consistency.sql` impede duas reservas ativas no mesmo horário, libera o horário após cancelamento e expõe somente os horários ocupados ao calendário público. A interface e o painel exibem os horários em `America/Sao_Paulo`.

O site precisa ser publicado (Vercel, Netlify ou outro host) para login por e-mail e retorno do pagamento funcionarem corretamente.
