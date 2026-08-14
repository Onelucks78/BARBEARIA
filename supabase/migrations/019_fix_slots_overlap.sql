-- =====================================================================
-- 019_fix_slots_overlap.sql — Corrige sobreposição na get_available_slots
-- A 018 usava (v_current + v_step) no lugar de (v_current + v_duracao)
-- no check de conflito com bloqueios e agendamentos. Com step=15min e
-- serviço de 30/40/70min, um slot que começava dentro da janela do
-- serviço (ex.: 15:15 com agendamento das 15:30) não era coberto pelos
-- minutos somados e aparecia como disponível.
-- =====================================================================

create or replace function public.get_available_slots(
  p_slug text,
  p_data date,
  p_servico_ids text,          -- aceita UUID único OU "uuid,uuid" (combo)
  p_profissional_id uuid,
  p_all boolean default false
)
returns table(horario time, disponivel boolean, motivo text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_barbeiro_id uuid;
  v_duracao integer := 0;
  v_dia_semana smallint;
  v_exp record;
  v_inicio_min integer;
  v_fim_min integer;
  v_int_start integer := -1;
  v_int_end integer := -1;
  v_step integer := 15;
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
  -- 1. Resolve a barbearia pelo slug
  select id into v_barbeiro_id
  from public.barbeiros
  where slug = p_slug and ativo = true;
  if v_barbeiro_id is null then return; end if;

  -- 2. O profissional precisa existir, estar ativo e ser DESTA barbearia
  if not exists (
    select 1 from public.profissionais
    where id = p_profissional_id
      and barbeiro_id = v_barbeiro_id
      and ativo = true
  ) then
    return;
  end if;

  -- 3. Soma a duração de todos os serviços do CSV (ignora inativos/inexistentes)
  select coalesce(sum(duracao_minutos), 0) into v_duracao
  from public.servicos
  where barbeiro_id = v_barbeiro_id
    and ativo = true
    and id::text = any(string_to_array(p_servico_ids, ','));
  if v_duracao is null or v_duracao <= 0 then v_duracao := 30; end if;

  -- 4. Dia da semana (0 = domingo)
  v_dia_semana := extract(dow from p_data)::smallint;

  -- 5. Expediente DO PROFISSIONAL naquele dia
  select * into v_exp
  from public.expedientes
  where profissional_id = p_profissional_id
    and dia_semana = v_dia_semana
    and ativo = true;
  if not found then return; end if;

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

  -- 6. Itera a cada 15min até o fechamento
  v_current := v_inicio_min;
  while v_current < v_fim_min loop
    v_current_end := v_current + v_duracao;
    v_current_time := make_time(v_current / 60, v_current % 60, 0);

    -- almoço: pula se o horário de início cair dentro da janela de almoço
    if v_int_start >= 0 and v_current >= v_int_start and v_current < v_int_end then
      v_current := v_current + v_step;
      continue;
    end if;

    -- bloqueios: do profissional OU da barbearia inteira (profissional_id null)
    v_blocked := false;
    for v_bs, v_be in
      select
        case when hora_inicio is null then 0
             else extract(hour from hora_inicio)::int * 60 + extract(minute from hora_inicio)::int end,
        case when hora_fim is null then 1440
             else extract(hour from hora_fim)::int * 60 + extract(minute from hora_fim)::int end
      from public.bloqueios
      where barbeiro_id = v_barbeiro_id
        and data = p_data
        and (profissional_id = p_profissional_id or profissional_id is null)
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

    -- agendamentos ativos DO PROFISSIONAL
    v_booked := false;
    for v_as, v_ae in
      select
        extract(hour from (inicio_em at time zone 'UTC'))::int * 60
          + extract(minute from (inicio_em at time zone 'UTC'))::int,
        extract(hour from (fim_em at time zone 'UTC'))::int * 60
          + extract(minute from (fim_em at time zone 'UTC'))::int
      from public.agendamentos
      where profissional_id = p_profissional_id
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

grant execute on function public.get_available_slots(text, date, text, uuid, boolean) to anon, authenticated;
