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
    select polname, polcmd, polroles::regrole[]::text[], pg_get_expr(polqual, polrelid) as using_expr, pg_get_expr(polwithcheck, polrelid) as check_expr
    from pg_policy
    where polrelid = 'public.agendamentos'::regclass
    order by polname
  `);
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
})();
