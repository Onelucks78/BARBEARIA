import { Client } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  const pw = process.env.SUPABASE_DB_PASSWORD;
  const ref = process.env.SUPABASE_PROJECT_REF || 'ghguwhclrlzdwaqhhnhq';

  const c = new Client({
    connectionString: `postgresql://postgres:${pw}@db.${ref}.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
  });

  await c.connect();
  const result = await c.query("DELETE FROM public._migrations_applied WHERE filename = '005_update_servicos_detalhe.sql'");
  console.log(`Removido tracking da migration 005 (${result.rowCount} linha(s) afetada(s))`);
  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
