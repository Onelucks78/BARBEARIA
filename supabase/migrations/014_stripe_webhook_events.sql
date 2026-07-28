-- =====================================================================
-- 014_stripe_webhook_events.sql — Tabela de idempotência para webhooks da Stripe
-- =====================================================================
-- Armazena um registro por evento Stripe processado, para evitar duplicação
-- quando a Stripe reentrega um evento (retry após timeout/5xx).
-- Escrita exclusiva: backend com service_role (bypassa RLS).
-- Leitura: nenhuma (tabela interna de controle).

create table if not exists public.stripe_webhook_events (
  id text primary key,
  -- ^ event.id da Stripe (ex: evt_1Abc123XYZ...), não uuid gerado
  type text not null,
  -- ^ event.type (ex: 'checkout.session.completed', 'invoice.paid', ...)
  processed_at timestamptz not null default now()
  -- ^ quando o evento foi processado (ajuda a debugar e limpezas futuras)
);

-- Habilita RLS para segurança (nenhuma policy = inacessível, exceto service_role)
alter table public.stripe_webhook_events enable row level security;
