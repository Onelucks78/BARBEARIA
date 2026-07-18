-- =====================================================================
-- 006_slots.sql — Função get_available_slots em PL/pgSQL
-- Substitui o cálculo JS em server/database.ts:593-796
-- Funciona em multi-tenant: filtra por slug do barbeiro.
-- =====================================================================

create or replace function public.get_available_slots(
  p_slug text,
  p_data date,
  p_servico_id uuid,
  p_all boolean default false
)
returns table(horario time, disponivel boolean, motivo text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_barbeiro_id uuid;
  v_duracao integer;
  v_dia_semana smallint;
  v_exp record;
  v_inicio_min integer;
  v_fim_min integer;
  v_int_start integer := -1;
  v_int_end integer := -1;
  v_step integer := 30;
  v_current integer;
  v_current_end integer;
  v_current_time time;
  v_bs integer;
  v_be integer;
  v_as integer;
  v_ae integer;
  v_blocked boolean;
  v_booked boolean;
begin
  -- 1. Resolve barbeiro pelo slug
  select id into v_barbeiro_id
  from public.barbeiros
  where slug = p_slug and ativo = true;

  if v_barbeiro_id is null then
    return;
  end if;

  -- 2. Resolve duração do serviço (suporta combo: s1,s2 no futuro, hoje só single)
  select duracao_minutos into v_duracao
  from public.servicos
  where id = p_servico_id and barbeiro_id = v_barbeiro_id and ativo = true;

  if v_duracao is null or v_duracao <= 0 then
    return;
  end if;

  -- 3. Dia da semana (0=domingo)
  v_dia_semana := extract(dow from p_data)::smallint;

  -- 4. Expediente do dia
  select * into v_exp
  from public.expedientes
  where barbeiro_id = v_barbeiro_id
    and dia_semana = v_dia_semana
    and ativo = true;

  if not found then
    return;
  end if;

  v_inicio_min := extract(hour from v_exp.hora_inicio)::int * 60
                + extract(minute from v_exp.hora_inicio)::int;
  v_fim_min    := extract(hour from v_exp.hora_fim)::int * 60
                + extract(minute from v_exp.hora_fim)::int;

  if v_exp.intervalo_inicio is not null and v_exp.intervalo_fim is not null then
    v_int_start := extract(hour from v_exp.intervalo_inicio)::int * 60
                 + extract(minute from v_exp.intervalo_inicio)::int;
    v_int_end   := extract(hour from v_exp.intervalo_fim)::int * 60
                 + extract(minute from v_exp.intervalo_fim)::int;
  end if;

  -- 5. Itera a cada 30min
  v_current := v_inicio_min;

  while v_current + v_duracao <= v_fim_min loop
    v_current_end := v_current + v_duracao;
    v_current_time := make_time(v_current / 60, v_current % 60, 0);

    -- Sobrepõe almoço? Pula silenciosamente.
    if v_int_start >= 0 and v_current < v_int_end and v_current_end > v_int_start then
      v_current := v_current + v_step;
      continue;
    end if;

    -- Sobrepõe bloqueio?
    v_blocked := false;
    for v_bs, v_be in
      select
        case when hora_inicio is null then 0
             else extract(hour from hora_inicio)::int * 60 + extract(minute from hora_inicio)::int end,
        case when hora_fim is null then 1440
             else extract(hour from hora_fim)::int * 60 + extract(minute from hora_fim)::int end
      from public.bloqueios
      where barbeiro_id = v_barbeiro_id and data = p_data
    loop
      if v_current < v_be and v_current_end > v_bs then
        v_blocked := true;
        exit;
      end if;
    end loop;

    if v_blocked then
      if p_all then
        horario := v_current_time;
        disponivel := false;
        motivo := 'bloqueado';
        return next;
      end if;
      v_current := v_current + v_step;
      continue;
    end if;

    -- Sobrepõe agendamento ativo?
    v_booked := false;
    for v_as, v_ae in
      select
        extract(hour from (inicio_em at time zone 'UTC'))::int * 60
          + extract(minute from (inicio_em at time zone 'UTC'))::int,
        extract(hour from (fim_em at time zone 'UTC'))::int * 60
          + extract(minute from (fim_em at time zone 'UTC'))::int
      from public.agendamentos
      where barbeiro_id = v_barbeiro_id
        and inicio_em >= p_data
        and inicio_em < p_data + interval '1 day'
        and status in ('agendado', 'confirmado', 'concluido')
    loop
      if v_current < v_ae and v_current_end > v_as then
        v_booked := true;
        exit;
      end if;
    end loop;

    if v_booked then
      if p_all then
        horario := v_current_time;
        disponivel := false;
        motivo := 'ocupado';
        return next;
      end if;
    else
      horario := v_current_time;
      disponivel := true;
      motivo := null;
      return next;
    end if;

    v_current := v_current + v_step;
  end loop;

  return;
end $$;

-- Permissão de leitura pra anon (visitante do site)
grant execute on function public.get_available_slots(text, date, uuid, boolean) to anon, authenticated;
