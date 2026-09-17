# Como ativar o backend

1. Crie um projeto no Supabase usando o e-mail `jonas.guita.jazz@gmail.com`.
2. Em **SQL Editor**, execute o arquivo `supabase/migrations/20260826_initial_schema.sql`.
3. Em **Authentication > Providers**, habilite Email; configure a URL do site em **URL Configuration**.
4. Depois de Jonas criar a conta, execute o comando comentado no fim da migration para torná-lo professor.
5. Copie a **Project URL** e a **anon key** em **Project Settings > API** para `course-config.js`.
6. Instale e faça login no Supabase CLI; depois publique as funções:
   ```bash
   supabase functions deploy create-payment
   supabase functions deploy payment-webhook
   ```
7. Em **Edge Functions > Secrets**, cadastre `MERCADO_PAGO_ACCESS_TOKEN` e `SITE_URL`. A service role é disponibilizada pelo Supabase para a função; nunca a coloque no frontend.
8. No Mercado Pago, configure o Webhook para `/functions/v1/payment-webhook`.

O site precisa ser publicado (Vercel, Netlify ou outro host) para login por e-mail e retorno do pagamento funcionarem corretamente.
