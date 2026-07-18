import { Client } from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const c = new Client({
  connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${process.env.SUPABASE_PROJECT_REF}.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await c.connect();

  const tables = await c.query(`
    select table_name, (select count(*) from information_schema.columns c where c.table_name = t.table_name and c.table_schema = 'public') as cols
    from information_schema.tables t
    where table_schema = 'public'
    order by table_name
  `);
  console.log('Tabelas:', tables.rows.map(r => `${r.table_name}(${r.cols})`).join(', '));

  const barbeiros = await c.query('select slug, nome, nome_barbearia from public.barbeiros');
  console.log('\nBarbeiros:', barbeiros.rows);

  const servicos = await c.query('select count(*) as n from public.servicos');
  console.log('Serviços:', servicos.rows[0].n);

  const produtos = await c.query('select count(*) as n from public.produtos');
  console.log('Produtos:', produtos.rows[0].n);

  const clientes = await c.query('select count(*) as n from public.clientes');
  console.log('Clientes:', clientes.rows[0].n);

  const expedientes = await c.query('select dia_semana, hora_inicio, hora_fim, ativo from public.expedientes order by dia_semana');
  console.log('Expedientes:', expedientes.rows);

  const bloqueios = await c.query('select count(*) as n from public.bloqueios');
  console.log('Bloqueios:', bloqueios.rows[0].n);

  const categorias = await c.query('select count(*) as n from public.categorias_financeiras');
  console.log('Categorias:', categorias.rows[0].n);

  const seq = await c.query("select last_value from public.agendamentos_codigo_seq");
  console.log('Sequence último:', seq.rows[0]);

  const excludes = await c.query(`
    select conname from pg_constraint
    where conname = 'no_overlap_per_barbeiro'
  `);
  console.log('EXCLUDE constraint:', excludes.rows.length === 1 ? 'OK presente' : 'AUSENTE');

  const triggers = await c.query(`
    select trigger_name from information_schema.triggers
    where trigger_schema = 'public'
    order by trigger_name
  `);
  console.log('Triggers:', triggers.rows.map(r => r.trigger_name).join(', '));

  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
