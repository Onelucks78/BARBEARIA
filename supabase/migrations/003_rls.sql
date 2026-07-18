-- =====================================================================
-- 003_rls.sql — Row Level Security multi-tenant
-- Estratégia:
--   * Todo barbeiro vê apenas seus dados (barbeiro_id = auth.barbeiro_id()).
--   * Cliente autenticado vê apenas os próprios agendamentos.
--   * Público (anon) só lê dados de barbeiros com ativo = true
--     E apenas os campos públicos (precisaremos de VIEWs pra isso).
-- =====================================================================

-- Helper: retorna o barbeiro_id do usuário logado (extraído do JWT).
-- O JWT do admin do Supabase tem 'barbeiro_id' em app_metadata ou vem
-- de uma claim custom. Mantemos flexível.
create or replace function public.current_barbeiro_id()
returns uuid language sql stable as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'barbeiro_id')::uuid,
    (select id from public.barbeiros where auth_user_id = auth.uid() limit 1)
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- Habilita RLS em todas as tabelas
alter table public.barbeiros                enable row level security;
alter table public.servicos                 enable row level security;
alter table public.produtos                 enable row level security;
alter table public.clientes                 enable row level security;
alter table public.agendamentos             enable row level security;
alter table public.expedientes              enable row level security;
alter table public.bloqueios                enable row level security;
alter table public.lancamentos_financeiros   enable row level security;
alter table public.categorias_financeiras   enable row level security;

-- Remove policies antigas (idempotência)
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ====================================================================
-- BARBEIROS
-- ====================================================================
-- Dono lê/atualiza o próprio registro
create policy barbeiro_self_select on public.barbeiros
  for select using (auth_user_id = auth.uid() or is_admin());
create policy barbeiro_self_update on public.barbeiros
  for update using (auth_user_id = auth.uid() or is_admin());
-- Público vê apenas barbeiros ativos (necessário pra página /b/[slug])
create policy barbeiros_public_active on public.barbeiros
  for select to anon using (ativo = true);

-- ====================================================================
-- RECURSOS DO BARBEIRO (servicos, produtos, expedientes, bloqueios, etc)
-- ====================================================================
-- Admin do barbeiro tem acesso total
create policy servicos_admin_all on public.servicos
  for all using (barbeiro_id = current_barbeiro_id() or is_admin())
  with check (barbeiro_id = current_barbeiro_id() or is_admin());
create policy produtos_admin_all on public.produtos
  for all using (barbeiro_id = current_barbeiro_id() or is_admin())
  with check (barbeiro_id = current_barbeiro_id() or is_admin());
create policy clientes_admin_all on public.clientes
  for all using (barbeiro_id = current_barbeiro_id() or is_admin())
  with check (barbeiro_id = current_barbeiro_id() or is_admin());
create policy agendamentos_admin_all on public.agendamentos
  for all using (barbeiro_id = current_barbeiro_id() or is_admin())
  with check (barbeiro_id = current_barbeiro_id() or is_admin());
create policy expedientes_admin_all on public.expedientes
  for all using (barbeiro_id = current_barbeiro_id() or is_admin())
  with check (barbeiro_id = current_barbeiro_id() or is_admin());
create policy bloqueios_admin_all on public.bloqueios
  for all using (barbeiro_id = current_barbeiro_id() or is_admin())
  with check (barbeiro_id = current_barbeiro_id() or is_admin());
create policy financeiro_admin_all on public.lancamentos_financeiros
  for all using (barbeiro_id = current_barbeiro_id() or is_admin())
  with check (barbeiro_id = current_barbeiro_id() or is_admin());
create policy categorias_admin_all on public.categorias_financeiras
  for all using (barbeiro_id = current_barbeiro_id() or is_admin())
  with check (barbeiro_id = current_barbeiro_id() or is_admin());

-- Público vê serviços e produtos ativos (pra página de agendamento)
create policy servicos_public_active on public.servicos
  for select to anon using (
    ativo = true
    and exists (select 1 from public.barbeiros b where b.id = servicos.barbeiro_id and b.ativo = true)
  );
create policy produtos_public_active on public.produtos
  for select to anon using (
    ativo = true and estoque > 0
    and exists (select 1 from public.barbeiros b where b.id = produtos.barbeiro_id and b.ativo = true)
  );
-- Público vê expediente (pra calcular slots disponíveis)
create policy expedientes_public_active on public.expedientes
  for select to anon using (
    ativo = true
    and exists (select 1 from public.barbeiros b where b.id = expedientes.barbeiro_id and b.ativo = true)
  );
-- Público NÃO vê bloqueios (privacidade do barbeiro)

-- ====================================================================
-- AGENDAMENTOS — cliente autenticado vê só os dele
-- ====================================================================
create policy agendamentos_cliente_select on public.agendamentos
  for select to authenticated using (
    cliente_id in (
      select id from public.clientes where auth_user_id = auth.uid()
    )
  );
-- Anon pode criar agendamento (visitante sem cadastro)
create policy agendamentos_anon_insert on public.agendamentos
  for insert to anon with check (true);
-- Cliente logado também pode criar
create policy agendamentos_cliente_insert on public.agendamentos
  for insert to authenticated with check (
    cliente_id in (
      select id from public.clientes where auth_user_id = auth.uid()
    )
  );

-- ====================================================================
-- CLIENTES — auto-gerencia do próprio perfil
-- ====================================================================
create policy clientes_self_select on public.clientes
  for select to authenticated using (auth_user_id = auth.uid());
create policy clientes_self_update on public.clientes
  for update to authenticated using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());
-- Anon pode criar cliente (no ato do agendamento)
create policy clientes_anon_insert on public.clientes
  for insert to anon with check (true);
