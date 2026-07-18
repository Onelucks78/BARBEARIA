// scripts/audit.ts — varredura completa do banco + front em busca de dados mocado.
import { Client } from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const c = new Client({
  connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${process.env.SUPABASE_PROJECT_REF}.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await c.connect();

  console.log('\n========== BARBEIROS ==========');
  const b = await c.query(`select id, slug, nome, email, auth_user_id, ativo from public.barbeiros`);
  console.table(b.rows);

  console.log('\n========== SERVIÇOS (10 ativos) ==========');
  const s = await c.query(`select id, nome, preco, duracao_minutos, ativo, ordem from public.servicos order by ordem`);
  console.table(s.rows);

  console.log('\n========== PRODUTOS (3 ativos) ==========');
  const p = await c.query(`select id, nome, preco, estoque, ativo from public.produtos order by ordem`);
  console.table(p.rows);

  console.log('\n========== CLIENTES ==========');
  const cli = await c.query(`select id, nome, email, telefone, ativo from public.clientes order by created_at desc`);
  console.table(cli.rows);

  console.log('\n========== AGENDAMENTOS (TODOS) ==========');
  const ag = await c.query(`
    select codigo, nome_cliente, telefone_cliente, inicio_em, fim_em, status, preco_cobrado
    from public.agendamentos
    order by inicio_em desc
    limit 30
  `);
  console.table(ag.rows);

  console.log('\n========== LANÇAMENTOS FINANCEIROS ==========');
  const lf = await c.query(`
    select tipo, descricao, valor, categoria, data, excluido
    from public.lancamentos_financeiros
    order by data desc
    limit 20
  `);
  console.table(lf.rows);

  console.log('\n========== EXPEDIENTES ==========');
  const ex = await c.query(`select dia_semana, hora_inicio, hora_fim, ativo from public.expedientes order by dia_semana`);
  console.table(ex.rows);

  console.log('\n========== BLOQUEIOS ==========');
  const bl = await c.query(`select data, hora_inicio, hora_fim, motivo from public.bloqueios order by data`);
  console.table(bl.rows);

  console.log('\n========== CATEGORIAS FINANCEIRAS ==========');
  const cat = await c.query(`select nome, tipo from public.categorias_financeiras order by tipo, nome`);
  console.table(cat.rows);

  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
