// scripts/run-migrations-via-api.ts
// Usa a Management API do Supabase (https://api.supabase.com/v1/projects/{ref}/database/query)
// pra rodar SQL sem precisar da senha do banco.
// A autenticação é via header Authorization: Bearer <token>.

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

config({ path: '.env.local' });

const projectRef = process.env.SUPABASE_PROJECT_REF || 'ghguwhclrlzdwaqhhnhq';
const token = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!token) {
  console.error('SUPABASE_SERVICE_ROLE_KEY não definida.');
  process.exit(1);
}

const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

async function runSql(sql: string): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    process.stdout.write(`Aplicando ${file}... `);
    try {
      await runSql(sql);
      console.log('OK');
    } catch (err: any) {
      console.log('ERRO');
      console.error(err.message);
      process.exit(1);
    }
  }

  console.log('\nTodas as migrations aplicadas.');
}

main().catch(err => { console.error(err); process.exit(1); });
