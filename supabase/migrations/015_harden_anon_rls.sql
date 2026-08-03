-- =====================================================================
-- 015_harden_anon_rls.sql — Endurecimento das políticas de INSERT anônimo
-- =====================================================================
-- Contexto (MORPH-005):
--   * A anon key do Supabase é PÚBLICA (embutida no bundle do front,
--     src/lib/supabase.ts) — qualquer pessoa pode chamar o PostgREST direto.
--   * As policies antigas (003_rls.sql) usavam `with check (true)` para
--     `agendamentos` e `clientes`: era possível inserir agendamentos com
--     status 'concluido' e preco_cobrado alto (inflando o financeiro do
--     dashboard) ou lotar a agenda com horários falsos.
--   * Toda criação legítima passa pelo servidor Express (service_role), que
--     valida barbeiro/profissional/serviço/slot e calcula o preço. O acesso
--     anônimo direto é superfície de ataque, não funcionalidade.
-- =====================================================================

-- Agendamentos (anon): só agendamento futuro, sem preço (quem cobra é o
-- servidor), para barbeiro ativo e profissional ativo DESTE barbeiro.
drop policy if exists agendamentos_anon_insert on public.agendamentos;
create policy agendamentos_anon_insert on public.agendamentos
  for insert to anon with check (
    status = 'agendado'
    and preco_cobrado = 0
    and inicio_em > now()
    and exists (
      select 1 from public.barbeiros b
      where b.id = agendamentos.barbeiro_id and b.ativo = true
    )
    and exists (
      select 1 from public.profissionais p
      where p.id = agendamentos.profissional_id
        and p.barbeiro_id = agendamentos.barbeiro_id
        and p.ativo = true
    )
  );

-- Agendamentos (cliente autenticado): mesmo endurecimento, preso aos próprios
-- clientes (auth_user_id = auth.uid()).
drop policy if exists agendamentos_cliente_insert on public.agendamentos;
create policy agendamentos_cliente_insert on public.agendamentos
  for insert to authenticated with check (
    status = 'agendado'
    and preco_cobrado = 0
    and inicio_em > now()
    and cliente_id in (
      select id from public.clientes where auth_user_id = auth.uid()
    )
  );

-- Clientes (anon): sem auth_user_id e em barbearia ativa existente. Impede
-- criar ficha vinculada a um usuário ou poluir com e-mails arbitrários.
drop policy if exists clientes_anon_insert on public.clientes;
create policy clientes_anon_insert on public.clientes
  for insert to anon with check (
    auth_user_id is null
    and exists (
      select 1 from public.barbeiros b
      where b.id = clientes.barbeiro_id and b.ativo = true
    )
  );
