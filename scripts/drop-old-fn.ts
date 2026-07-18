import { Client } from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const c = new Client({
  connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${process.env.SUPABASE_PROJECT_REF}.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await c.connect();
  await c.query(`drop function if exists public.get_available_slots(text, date, uuid, boolean);`);
  console.log('Função antiga dropada.');
  const r = await c.query(`
    select pg_get_function_arguments(oid) as args
    from pg_proc
    where proname = 'get_available_slots'
    and pronamespace = 'public'::regnamespace
  `);
  console.log('Restou:', r.rows);
  await c.end();
})();
