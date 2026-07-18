import { Client } from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const c = new Client({
  connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${process.env.SUPABASE_PROJECT_REF}.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await c.connect();
  const r = await c.query(`select conname, pg_get_constraintdef(oid) as def from pg_constraint where conname='no_overlap_per_barbeiro'`);
  console.log('Constraint:', r.rows);

  const ag = await c.query(`select id, inicio_em, fim_em, status, tstzrange(inicio_em, fim_em, '[)') as range from public.agendamentos where inicio_em::date='2026-06-16' order by inicio_em`);
  console.log('Agendamentos 16/06:');
  for (const row of ag.rows) console.log(' ', row);

  await c.end();
})();
