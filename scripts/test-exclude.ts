import { Client } from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const c = new Client({
  connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${process.env.SUPABASE_PROJECT_REF}.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await c.connect();

  // Limpa qualquer teste anterior
  await c.query(`delete from public.agendamentos where nome_cliente like 'Teste %'`);

  const barbeiroId = (await c.query(`select id from public.barbeiros where slug = 'imperial'`)).rows[0].id;
  const servicoId = (await c.query(`select id from public.servicos where nome = 'Corte Premium' limit 1`)).rows[0].id;

  // 1) Insere primeira agenda
  await c.query(
    `insert into public.agendamentos
      (barbeiro_id, servico_id, nome_cliente, telefone_cliente, inicio_em, fim_em, status, preco_cobrado)
     values ($1, $2, 'Teste A', '11999990000',
             '2026-06-16'::date + interval '9 hours 30 minutes',
             '2026-06-16'::date + interval '10 hours 10 minutes',
             'agendado', 60)`,
    [barbeiroId, servicoId]
  );
  console.log('✅ Primeira agenda inserida (09:30-10:10)');

  // 2) Tenta inserir agenda conflitante (10:00-10:40) — deve falhar
  try {
    await c.query(
      `insert into public.agendamentos
        (barbeiro_id, servico_id, nome_cliente, telefone_cliente, inicio_em, fim_em, status, preco_cobrado)
       values ($1, $2, 'Teste B (conflito)', '11999990001',
               '2026-06-16'::date + interval '10 hours',
               '2026-06-16'::date + interval '10 hours 40 minutes',
               'agendado', 60)`,
      [barbeiroId, servicoId]
    );
    console.log('⚠️  Conflito NÃO detectado — EXCLUDE quebrado');
  } catch (err: any) {
    console.log('✅ EXCLUDE bloqueou conflito (10:00-10:40 vs 09:30-10:10):', err.message.split('\n')[0]);
  }

  // 3) Insere agenda NÃO-conflitante (10:30-11:10) — deve passar
  await c.query(
    `insert into public.agendamentos
      (barbeiro_id, servico_id, nome_cliente, telefone_cliente, inicio_em, fim_em, status, preco_cobrado)
     values ($1, $2, 'Teste C (sem conflito)', '11999990002',
             '2026-06-16'::date + interval '10 hours 30 minutes',
             '2026-06-16'::date + interval '11 hours 10 minutes',
             'agendado', 60)`,
    [barbeiroId, servicoId]
  );
  console.log('✅ Agenda sem conflito (10:30-11:10) inserida');

  // 4) Slots livres agora — não deve mostrar 09:00, 09:30, 10:00 nem 10:30
  const livres = await c.query(
    `select horario from public.get_available_slots('imperial', '2026-06-16'::date, $1::uuid, false)`,
    [servicoId]
  );
  console.log('\nSlots livres após testes:', livres.rows.map(r => r.horario).join(', '));

  // Limpa
  await c.query(`delete from public.agendamentos where nome_cliente like 'Teste %'`);
  console.log('\n🧹 Dados de teste removidos.');

  await c.end();
})();
