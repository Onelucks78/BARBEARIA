-- =====================================================================
-- 001_init.sql — Schema base do Detalhes Barbearia
-- Multi-tenant: cada barbeiro é dono dos seus dados.
-- Idempotente: pode rodar mais de uma vez sem quebrar.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- ENUMS ----------
do $$ begin
  create type agendamento_status as enum ('agendado', 'confirmado', 'concluido', 'cancelado', 'faltou');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lancamento_tipo as enum ('entrada', 'saida');
exception when duplicate_object then null; end $$;

do $$ begin
  create type forma_pagamento as enum ('dinheiro', 'pix', 'cartao', 'outro');
exception when duplicate_object then null; end $$;

-- ---------- BARBEIROS ----------
create table if not exists public.barbeiros (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  email text not null unique,
  telefone text not null default '',
  avatar_url text,
  nome_barbearia text not null,
  bio text default '',
  ativo boolean not null default true,
  ultimo_acesso_em timestamptz,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- SERVIÇOS ----------
create table if not exists public.servicos (
  id uuid primary key default gen_random_uuid(),
  barbeiro_id uuid not null references public.barbeiros(id) on delete cascade,
  nome text not null,
  descricao text default '',
  preco numeric(10,2) not null check (preco >= 0),
  duracao_minutos integer not null check (duracao_minutos > 0),
  imagem_url text,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_servicos_barbeiro on public.servicos(barbeiro_id);

-- ---------- PRODUTOS ----------
create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  barbeiro_id uuid not null references public.barbeiros(id) on delete cascade,
  nome text not null,
  descricao text default '',
  preco numeric(10,2) not null check (preco >= 0),
  imagem_url text,
  estoque integer not null default 0 check (estoque >= 0),
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_produtos_barbeiro on public.produtos(barbeiro_id);

-- ---------- CLIENTES ----------
-- telefone armazenado SEMPRE só com dígitos. Validação garante.
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  barbeiro_id uuid not null references public.barbeiros(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  nome text not null,
  telefone text not null,
  email text,
  data_nascimento date,
  observacoes text default '',
  foto_url text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- impede dois clientes com mesmo telefone na mesma barbearia
  unique (barbeiro_id, telefone)
);
create index if not exists idx_clientes_barbeiro on public.clientes(barbeiro_id);
create index if not exists idx_clientes_auth on public.clientes(auth_user_id);

-- ---------- AGENDAMENTOS ----------
create table if not exists public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique, -- #000001 visível pro cliente
  barbeiro_id uuid not null references public.barbeiros(id) on delete cascade,
  servico_id uuid not null references public.servicos(id) on delete restrict,
  cliente_id uuid references public.clientes(id) on delete set null,
  nome_cliente text not null,
  telefone_cliente text not null,
  inicio_em timestamptz not null,
  fim_em timestamptz not null,
  status agendamento_status not null default 'agendado',
  preco_cobrado numeric(10,2) not null check (preco_cobrado >= 0),
  observacao text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fim_em > inicio_em)
);
create index if not exists idx_agendamentos_barbeiro on public.agendamentos(barbeiro_id);
create index if not exists idx_agendamentos_data on public.agendamentos(barbeiro_id, inicio_em);

-- Sequence visível pro cliente (#000001, #000002, ...)
create sequence if not exists public.agendamentos_codigo_seq;

-- ---------- EXPEDIENTE (horário de funcionamento) ----------
create table if not exists public.expedientes (
  id uuid primary key default gen_random_uuid(),
  barbeiro_id uuid not null references public.barbeiros(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6), -- 0 = domingo
  hora_inicio time not null,
  hora_fim time not null,
  intervalo_inicio time,
  intervalo_fim time,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (barbeiro_id, dia_semana)
);

-- ---------- BLOQUEIOS (folgas, cursos, etc) ----------
create table if not exists public.bloqueios (
  id uuid primary key default gen_random_uuid(),
  barbeiro_id uuid not null references public.barbeiros(id) on delete cascade,
  data date not null,
  hora_inicio time, -- null = dia inteiro
  hora_fim time,
  motivo text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_bloqueios_barbeiro on public.bloqueios(barbeiro_id, data);

-- ---------- LANÇAMENTOS FINANCEIROS ----------
create table if not exists public.lancamentos_financeiros (
  id uuid primary key default gen_random_uuid(),
  barbeiro_id uuid not null references public.barbeiros(id) on delete cascade,
  tipo lancamento_tipo not null,
  descricao text not null,
  valor numeric(10,2) not null check (valor >= 0),
  categoria text not null default 'Geral',
  forma_pagamento forma_pagamento not null,
  agendamento_id uuid references public.agendamentos(id) on delete set null,
  produto_id uuid references public.produtos(id) on delete set null,
  data date not null,
  excluido boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_lanc_barbeiro_data on public.lancamentos_financeiros(barbeiro_id, data);

-- ---------- CATEGORIAS FINANCEIRAS ----------
create table if not exists public.categorias_financeiras (
  id uuid primary key default gen_random_uuid(),
  barbeiro_id uuid not null references public.barbeiros(id) on delete cascade,
  nome text not null,
  tipo lancamento_tipo not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (barbeiro_id, nome, tipo)
);

-- ---------- UPDATED_AT AUTOMÁTICO ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  for t in
    select unnest(array[
      'barbeiros','servicos','produtos','clientes',
      'agendamentos','expedientes','bloqueios',
      'lancamentos_financeiros','categorias_financeiras'
    ])
  loop
    execute format(
      'drop trigger if exists trg_%I_updated on public.%I;
       create trigger trg_%I_updated before update on public.%I
       for each row execute function public.set_updated_at();',
      t, t, t, t
    );
  end loop;
end $$;
