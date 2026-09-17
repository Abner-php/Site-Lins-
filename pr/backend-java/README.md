# Backend Java — Jonas Lins

API em Java 21, Spring Boot 4.1.1 e PostgreSQL. Ela substitui a alternativa Supabase.

## Rodar localmente

1. Crie o banco `jonaslins` no PostgreSQL.
2. Defina `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD` e uma `JWT_SECRET` longa.
3. Execute `mvn spring-boot:run` dentro desta pasta.

O Flyway cria as tabelas automaticamente. A API inclui login JWT de 8 horas, senha BCrypt (custo 12), CORS restrito, headers anti-iframe e uma regra que torna somente `jonas.guita.jazz@gmail.com` administrador no primeiro cadastro. Não coloque senhas, token do Mercado Pago ou a senha do banco no código do site.
