// scripts/create-admin.ts
// Cria o admin user 78787878one@gmail.com no Supabase Auth,
// promove a admin e vincula ao barbeiro 'imperial'.

import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const url = process.env.SUPABASE_URL!;
const svc = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ADMIN_EMAIL = '78787878one@gmail.com';
const ADMIN_PASS = 'Imperial2026!';
const BARBEIRO_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  console.log('--- Criando/atualizando admin ---');

  // 1. Verifica se já existe
  const { data: list } = await svc.auth.admin.listUsers();
  const existing = (list?.users ?? []).find((u: any) => u.email === ADMIN_EMAIL);

  let userId: string;

  if (existing) {
    userId = existing.id;
    console.log(`✓ Usuário já existe: ${userId}`);
    // Atualiza senha pra garantir
    await svc.auth.admin.updateUserById(userId, { password: ADMIN_PASS });
    console.log('✓ Senha atualizada');
  } else {
    const { data: created, error } = await svc.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASS,
      email_confirm: true,
      user_metadata: { nome: 'Carlos Silva', role: 'admin' }
    });
    if (error) throw error;
    userId = created.user.id;
    console.log(`✓ Usuário criado: ${userId}`);
  }

  // 2. Promove a admin no app_metadata
  const { error: updateErr } = await svc.auth.admin.updateUserById(userId, {
    app_metadata: { role: 'admin', barbeiro_id: BARBEIRO_ID }
  });
  if (updateErr) throw updateErr;
  console.log('✓ app_metadata = role:admin, barbeiro_id:' + BARBEIRO_ID);

  // 3. Vincula barbeiro → auth_user
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
  console.log(`Login:   ${ADMIN_EMAIL}`);
  console.log(`Senha:   ${ADMIN_PASS}`);
  console.log('Ou use "Entrar com o Google" se você tiver essa conta Google.');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
