// scripts/inspect-schema.ts
// Inspeciona o estado real do banco antes de escrever migrations.
// Somente leitura.

import { Client } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const projectRef = process.env.SUPABASE_PROJECT_REF!;
const dbPassword = process.env.SUPABASE_DB_PASSWORD!;

const candidates = [
  `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`,
  `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`
];

async function connect(): Promise<Client> {
  for (const url of candidates) {
    const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try {
      await c.connect();
      console.log(`Conectado: ${url.replace(/:[^:@]+@/, ':***@')}\n`);
      return c;
    } catch { /* tenta o proximo */ }
  }
  throw new Error('Nao consegui conectar em nenhum host.');
}

async function main() {
  const c = await connect();

  const q = async (label: string, sql: string) => {
    const r = await c.query(sql);
    console.log(`===== ${label} =====`);
    console.table(r.rows);
    console.log();
  };

  await q('TABELAS', `
    select table_name from information_schema.tables
    where table_schema='public' order by table_name`);

  await q('CONSTRAINTS agendamentos/expedientes', `
    select conrelid::regclass::text as tabela, conname, contype,
           pg_get_constraintdef(oid) as definicao
    from pg_constraint
    where conrelid in ('public.agendamentos'::regclass, 'public.expedientes'::regclass)
    order by tabela, conname`);

  await q('MIGRATIONS APLICADAS', `
    select filename, applied_at from public._migrations_applied order by filename`);

  await q('CONTAGEM DE DADOS', `
    select 'barbeiros' as tabela, count(*) from public.barbeiros
    union all select 'agendamentos', count(*) from public.agendamentos
    union all select 'expedientes', count(*) from public.expedientes
    union all select 'bloqueios', count(*) from public.bloqueios
    union all select 'lancamentos_financeiros', count(*) from public.lancamentos_financeiros
    union all select 'servicos', count(*) from public.servicos
    union all select 'clientes', count(*) from public.clientes`);

  await q('BARBEIROS (contas)', `
    select id, slug, nome, nome_barbearia, ativo from public.barbeiros order by created_at`);

  await q('LANCAMENTOS: com agendamento vs sem', `
    select
      count(*) filter (where agendamento_id is not null) as com_agendamento,
      count(*) filter (where produto_id is not null) as com_produto,
      count(*) filter (where agendamento_id is null and produto_id is null) as avulsos
    from public.lancamentos_financeiros`);

  await q('FUNCOES get_available_slots', `
    select p.oid::regprocedure::text as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='get_available_slots'`);

  await c.end();
}

main().catch(err => { console.error(err); process.exit(1); });
