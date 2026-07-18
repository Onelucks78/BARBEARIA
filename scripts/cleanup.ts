import { Client } from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const c = new Client({
  connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${process.env.SUPABASE_PROJECT_REF}.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await c.connect();
  const r = await c.query(`
    delete from public.lancamentos_financeiros where descricao like '%E2E%' or descricao like '%Teste%' or descricao like '%Anon%';
    delete from public.agendamentos where nome_cliente in ('Cliente E2E', 'Teste Anon', 'Teste RLS');
    select 'limpo' as status;
  `);
  console.log(r.rows);
  await c.end();
})();
