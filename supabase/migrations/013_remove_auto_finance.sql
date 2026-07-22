-- Migration: 013_remove_auto_finance.sql
-- Description: Desativa o lançamento automático de caixa ao concluir agendamento (todas as receitas são lançadas manualmente).

-- Remove a trigger de sincronização automática de agendamentos para o financeiro
drop trigger if exists trg_agendamentos_financeiro on public.agendamentos;

-- Sobrescreve a função por um procedimento nulo (no-op)
create or replace function public.sync_financeiro_from_agendamento()
returns trigger language plpgsql as $$
begin
  return new;
end $$;
