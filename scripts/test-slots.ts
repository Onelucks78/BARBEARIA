import { Client } from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const c = new Client({
  connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${process.env.SUPABASE_PROJECT_REF}.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await c.connect();
  const servicoId = (await c.query(`select id from public.servicos where nome = 'Corte Premium' limit 1`)).rows[0].id;
  console.log('Serviço ID:', servicoId);

  // Slots livres pra amanhã (terça 16/06/2026)
  const livres = await c.query(
    `select horario from public.get_available_slots('imperial', '2026-06-16'::date, $1::uuid, false)`,
    [servicoId]
  );
  console.log('Slots livres terça 16/06:', livres.rows.map(r => r.horario).join(', '));

  // Slots com TODOS os estados (p_all = true) — inclui ocupados/bloqueados
  const todos = await c.query(
    `select horario::text, disponivel, motivo from public.get_available_slots('imperial', '2026-06-16'::date, $1::uuid, true)`,
    [servicoId]
  );
  console.log('\nTodos slots terça 16/06:');
  for (const r of todos.rows) {
    console.log(`  ${r.horario} - ${r.disponivel ? 'LIVRE' : (r.motivo || 'OCUPADO')}`);
  }

  // Tenta inserir agendamento conflitante (deve falhar pelo EXCLUDE)
  const barbeiroId = (await c.query(`select id from public.barbeiros where slug = 'imperial'`)).rows[0].id;
  try {
    await c.query(
      `insert into public.agendamentos
        (barbeiro_id, servico_id, nome_cliente, telefone_cliente, inicio_em, fim_em, status, preco_cobrado)
       values ($1, $2, 'Teste Conflito', '11999990000', '2026-06-16'::date + interval '9 hours 30 minutes',
               '2026-06-16'::date + interval '10 hours 10 minutes', 'agendado', 60)`,
      [barbeiroId, servicoId]
    );
    console.log('\n⚠️  Conflito NÃO foi detectado — EXCLUDE não funcionou');
  } catch (err: any) {
    console.log('\n✅ EXCLUDE funcionou — conflito rejeitado:', err.message.split('\n')[0]);
  }

  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
