// scripts/run-migrations.ts
// Aplica migrations com tracking (pula as já aplicadas).
// Cada migration tem que ser idempotente de qualquer jeito.

import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

config({ path: '.env.local' });

const projectRef = process.env.SUPABASE_PROJECT_REF || 'ghguwhclrlzdwaqhhnhq';
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!dbPassword) {
  console.error('SUPABASE_DB_PASSWORD não definida em .env.local');
  process.exit(1);
}

const candidates = [
  `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`,
  `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`
];

async function tryConnect(url: string): Promise<Client | null> {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await c.connect();
    return c;
  } catch {
    return null;
  }
}

async function main() {
  let client: Client | null = null;
  for (const url of candidates) {
    process.stdout.write(`Tentando ${url.replace(/:[^:@]+@/, ':***@')}... `);
    client = await tryConnect(url);
    if (client) { console.log('OK'); break; }
    console.log('falhou');
  }
  if (!client) {
    console.error('\nNão consegui conectar.');
    process.exit(1);
  }

  // Tabela de tracking
  await client.query(`
    create table if not exists public._migrations_applied (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const applied = new Set<string>(
    (await client.query('select filename from public._migrations_applied')).rows.map(r => r.filename)
  );

  const dir = path.join(process.cwd(), 'supabase', 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Pulado  ${file} (já aplicada)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    process.stdout.write(`Aplicando ${file}... `);
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into public._migrations_applied (filename) values ($1)', [file]);
      await client.query('commit');
      console.log('OK');
    } catch (err: any) {
      await client.query('rollback');
      console.log('ERRO');
      console.error(err.message);
      process.exit(1);
    }
  }

  await client.end();
  console.log('\nTodas as migrations aplicadas.');
}

main().catch(err => { console.error(err); process.exit(1); });
