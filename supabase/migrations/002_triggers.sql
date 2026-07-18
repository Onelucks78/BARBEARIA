-- =====================================================================
-- 002_triggers.sql — Regras de negócio no banco
-- Substitui a lógica que estava no server.ts linhas 573-603 (auto-financeiro)
-- e cria EXCLUDE constraint que substitui parte de calculateAvailableSlots.
-- =====================================================================

-- ---------- CÓDIGO SEQUENCIAL DO AGENDAMENTO ----------
create or replace function public.next_agendamento_codigo()
returns trigger language plpgsql as $$
begin
  if new.codigo is null or new.codigo = '' then
    new.codigo := '#' || lpad(nextval('public.agendamentos_codigo_seq')::text, 6, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_agendamentos_codigo on public.agendamentos;
create trigger trg_agendamentos_codigo
  before insert on public.agendamentos
  for each row execute function public.next_agendamento_codigo();

-- ---------- AUTO-LANÇAMENTO FINANCEIRO AO CONCLUIR ----------
-- Reproduz server.ts:573-603
--   se status mudou pra 'concluido'  → cria lançamento se não existir
--   se status SAIU de 'concluido'    → remove lançamento gerado
create or replace function public.sync_financeiro_from_agendamento()
returns trigger language plpgsql as $$
declare
  v_servico_nome text;
  v_data date;
begin
  v_data := (new.inicio_em at time zone 'UTC')::date;

  -- Entrou em 'concluido' vindo de outro status
  if new.status = 'concluido' and (old.status is null or old.status <> 'concluido') then
    if not exists (
      select 1 from public.lancamentos_financeiros l
      where l.agendamento_id = new.id and l.excluido = false
    ) then
      select nome into v_servico_nome from public.servicos where id = new.servico_id;
      insert into public.lancamentos_financeiros (
        barbeiro_id, tipo, descricao, valor, categoria,
        forma_pagamento, agendamento_id, produto_id, data
      ) values (
        new.barbeiro_id,
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

  -- Saiu de 'concluido'
  if old.status = 'concluido' and new.status <> 'concluido' then
    update public.lancamentos_financeiros
       set excluido = true, updated_at = now()
     where agendamento_id = new.id;
  end if;

  return new;
end $$;

drop trigger if exists trg_agendamentos_financeiro on public.agendamentos;
create trigger trg_agendamentos_financeiro
  after update of status on public.agendamentos
  for each row execute function public.sync_financeiro_from_agendamento();

-- ---------- ANTI-SOBREPOSIÇÃO (EXCLUDE constraint) ----------
-- Impede dois agendamentos ativos do mesmo barbeiro ocupando o mesmo horário.
-- Substitui a checagem manual em server.ts:241-244 e a varredura em
-- database.ts:666-688 (último filtro).
create extension if not exists btree_gist;

alter table public.agendamentos drop constraint if exists no_overlap_per_barbeiro;
alter table public.agendamentos
  add constraint no_overlap_per_barbeiro
  exclude using gist (
    barbeiro_id with =,
    tstzrange(inicio_em, fim_em, '[)') with &&
  )
  where (status in ('agendado','confirmado','concluido'));
