-- =====================================================================
-- 010_profissionais.sql — Múltiplos barbeiros por barbearia
--
-- CONCEITO:
--   barbeiros    = a CONTA / a barbearia (tenant). Não muda.
--   profissionais = QUEM CORTA O CABELO. Tabela nova.
--
-- Estratégia: aditiva. Cria a tabela, adiciona colunas nulas,
-- faz o backfill do histórico, e só então aplica NOT NULL e
-- troca as constraints. Idempotente: pode rodar mais de uma vez.
-- =====================================================================

-- ---------- TABELA PROFISSIONAIS ----------
create table if not exists public.profissionais (
  id uuid primary key default gen_random_uuid(),
  barbeiro_id uuid not null references public.barbeiros(id) on delete cascade,
  nome text not null,
  avatar_url text,
  telefone text not null default '',
  bio text default '',
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_profissionais_barbeiro on public.profissionais(barbeiro_id);

drop trigger if exists trg_profissionais_updated on public.profissionais;
create trigger trg_profissionais_updated
  before update on public.profissionais
  for each row execute function public.set_updated_at();

-- ---------- SEED: um profissional por barbearia, a partir do dono ----------
-- Idempotente: só cria se a barbearia ainda não tem nenhum profissional.
insert into public.profissionais (barbeiro_id, nome, avatar_url, telefone, bio, ordem)
select b.id, b.nome, b.avatar_url, coalesce(b.telefone, ''), coalesce(b.bio, ''), 0
from public.barbeiros b
where not exists (
  select 1 from public.profissionais p where p.barbeiro_id = b.id
);

-- ---------- COLUNAS NOVAS (nulas por enquanto) ----------
alter table public.agendamentos
  add column if not exists profissional_id uuid references public.profissionais(id) on delete restrict;

alter table public.expedientes
  add column if not exists profissional_id uuid references public.profissionais(id) on delete cascade;

-- bloqueios.profissional_id NULL = fecha a barbearia toda (feriado)
alter table public.bloqueios
  add column if not exists profissional_id uuid references public.profissionais(id) on delete cascade;

-- lancamentos.profissional_id NULL = receita/despesa da casa (produto, aluguel, luz)
alter table public.lancamentos_financeiros
  add column if not exists profissional_id uuid references public.profissionais(id) on delete set null;

-- ---------- BACKFILL DO HISTÓRICO ----------
-- Profissional padrão de cada barbearia = o de menor ordem/created_at.
-- Usa CTE em vez de view para não deixar objeto sem RLS no schema público.

-- Agendamentos antigos → profissional padrão
with padrao as (
  select distinct on (barbeiro_id) barbeiro_id, id as profissional_id
  from public.profissionais
  order by barbeiro_id, ordem, created_at
)
update public.agendamentos a
   set profissional_id = p.profissional_id
  from padrao p
 where p.barbeiro_id = a.barbeiro_id
   and a.profissional_id is null;

-- Expedientes antigos → profissional padrão
with padrao as (
  select distinct on (barbeiro_id) barbeiro_id, id as profissional_id
  from public.profissionais
  order by barbeiro_id, ordem, created_at
)
update public.expedientes e
   set profissional_id = p.profissional_id
  from padrao p
 where p.barbeiro_id = e.barbeiro_id
   and e.profissional_id is null;

-- Lançamentos vindos de agendamento → herdam o profissional do agendamento.
-- Os demais (avulsos, produtos, despesas) ficam NULL = da casa. Intencional.
update public.lancamentos_financeiros l
   set profissional_id = a.profissional_id
  from public.agendamentos a
 where a.id = l.agendamento_id
   and l.agendamento_id is not null
   and l.profissional_id is null;

-- bloqueios: ficam NULL de propósito. Os bloqueios que já existiam foram
-- criados quando havia um barbeiro só, então significavam "barbearia fechada".
-- NULL preserva exatamente esse comportamento.

-- ---------- APERTA AS REGRAS (só depois do backfill) ----------
alter table public.agendamentos alter column profissional_id set not null;
alter table public.expedientes  alter column profissional_id set not null;

-- Anti-sobreposição passa a ser POR PROFISSIONAL.
-- Sem isso, o barbeiro B não consegue agendar 10h se o A já tem 10h.
alter table public.agendamentos drop constraint if exists no_overlap_per_barbeiro;
alter table public.agendamentos drop constraint if exists no_overlap_per_profissional;
alter table public.agendamentos
  add constraint no_overlap_per_profissional
  exclude using gist (
    profissional_id with =,
    tstzrange(inicio_em, fim_em, '[)') with &&
  )
  where (status in ('agendado','confirmado','concluido'));

-- Expediente passa a ser por profissional.
alter table public.expedientes drop constraint if exists expedientes_barbeiro_id_dia_semana_key;
alter table public.expedientes drop constraint if exists expedientes_profissional_dia_key;
alter table public.expedientes
  add constraint expedientes_profissional_dia_key unique (profissional_id, dia_semana);

create index if not exists idx_agendamentos_profissional
  on public.agendamentos(profissional_id, inicio_em);
create index if not exists idx_lanc_profissional
  on public.lancamentos_financeiros(profissional_id, data);
create index if not exists idx_bloqueios_profissional
  on public.bloqueios(profissional_id, data);

-- ---------- TRIGGER FINANCEIRO: propaga o profissional ----------
-- Substitui a versão de 002_triggers.sql, que não conhecia profissional.
create or replace function public.sync_financeiro_from_agendamento()
returns trigger language plpgsql as $$
declare
  v_servico_nome text;
  v_data date;
begin
  v_data := (new.inicio_em at time zone 'UTC')::date;

  if new.status = 'concluido' and (old.status is null or old.status <> 'concluido') then
    if not exists (
      select 1 from public.lancamentos_financeiros l
      where l.agendamento_id = new.id and l.excluido = false
    ) then
      select nome into v_servico_nome from public.servicos where id = new.servico_id;
      insert into public.lancamentos_financeiros (
        barbeiro_id, profissional_id, tipo, descricao, valor, categoria,
        forma_pagamento, agendamento_id, produto_id, data
      ) values (
        new.barbeiro_id,
        new.profissional_id,
        'entrada',
        coalesce(v_servico_nome, 'Serviço de Corte') || ' - Cliente: ' || new.nome_cliente,
        new.preco_cobrado,
        'Serviço de Corte',
        'pix',
        new.id,
        null,
        v_data
      );
    end if;
  end if;

  if old.status = 'concluido' and new.status <> 'concluido' then
    update public.lancamentos_financeiros
       set excluido = true, updated_at = now()
     where agendamento_id = new.id;
  end if;

  return new;
end $$;

-- ---------- RLS ----------
alter table public.profissionais enable row level security;

drop policy if exists profissionais_admin_all on public.profissionais;
create policy profissionais_admin_all on public.profissionais
  for all using (barbeiro_id = public.current_barbeiro_id() or public.is_admin())
  with check (barbeiro_id = public.current_barbeiro_id() or public.is_admin());

-- Leitura pública: o wizard de agendamento lista os barbeiros antes do login.
drop policy if exists profissionais_public_active on public.profissionais;
create policy profissionais_public_active on public.profissionais
  for select to anon using (ativo = true);

grant select on public.profissionais to anon, authenticated;
