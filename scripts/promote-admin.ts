import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const url = process.env.SUPABASE_URL!;
const svc = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ADMIN_EMAIL = 'lucasm7academy@gmail.com';
const BARBEIRO_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  console.log(`--- Promovendo ${ADMIN_EMAIL} a admin ---`);

  const { data: list } = await svc.auth.admin.listUsers();
  const existing = (list?.users ?? []).find((u: any) => u.email === ADMIN_EMAIL);

  if (!existing) {
    console.log(`❌ Usuário "${ADMIN_EMAIL}" não encontrado no Supabase Auth.`);
    console.log('   Primeiro faça login com Google no app para criar o usuário.');
    process.exit(1);
  }

  const userId = existing.id;
  console.log(`✓ Usuário encontrado: ${userId}`);

  const { error: updateErr } = await svc.auth.admin.updateUserById(userId, {
    app_metadata: { role: 'admin', barbeiro_id: BARBEIRO_ID }
  });
  if (updateErr) throw updateErr;
  console.log('✓ app_metadata = { role: "admin", barbeiro_id: "' + BARBEIRO_ID + '" }');

  const pg = new Client({
    connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${process.env.SUPABASE_PROJECT_REF}.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
  });
  await pg.connect();
  await pg.query(
    `update public.barbeiros set auth_user_id = $1 where id = $2`,
    [userId, BARBEIRO_ID]
  );
  await pg.end();
  console.log('✓ barbeiros.auth_user_id vinculado');

  console.log('\n--- Pronto! ---');
  console.log(`${ADMIN_EMAIL} agora é admin.`);
  console.log('Faça logout e login novamente para o app_metadata ser recarregado.');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
