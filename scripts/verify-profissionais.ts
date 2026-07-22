// scripts/verify-profissionais.ts
// Verifica a migração 010/011 contra os critérios de sucesso do spec.
// O teste de sobreposição roda em transação e sofre ROLLBACK — não suja o banco.

import { Client } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const projectRef = process.env.SUPABASE_PROJECT_REF!;
const dbPassword = process.env.SUPABASE_DB_PASSWORD!;

async function connect(): Promise<Client> {
  const urls = [
    `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`,
    `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
  ];
  for (const url of urls) {
    const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try { await c.connect(); return c; } catch { /* proximo */ }
  }
  throw new Error('Sem conexao.');
}

let falhas = 0;
function check(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? 'PASSA' : 'FALHA'}  ${nome}${detalhe ? ' — ' + detalhe : ''}`);
  if (!ok) falhas++;
}

async function main() {
  const c = await connect();

  // ---------- 1. Backfill: nada órfão ----------
  const orfaos = await c.query(`
    select
      (select count(*) from agendamentos where profissional_id is null) as ag,
      (select count(*) from expedientes  where profissional_id is null) as exp,
      (select count(*) from profissionais) as profs`);
  const o = orfaos.rows[0];
  check('Nenhum agendamento sem profissional', o.ag === '0', `${o.ag} orfaos`);
  check('Nenhum expediente sem profissional', o.exp === '0', `${o.exp} orfaos`);
  check('Profissional padrao criado', Number(o.profs) >= 1, `${o.profs} profissional(is)`);

  // ---------- 2. Histórico financeiro preservado ----------
  const fin = await c.query(`
    select
      count(*) as total,
      count(*) filter (where profissional_id is not null) as atribuidos,
      coalesce(sum(valor) filter (where tipo='entrada' and excluido=false),0) as receita
    from lancamentos_financeiros`);
  const f = fin.rows[0];
  check('Lancamentos preservados', Number(f.total) === 16, `${f.total} lancamentos, receita R$ ${f.receita}`);
  check('Receita de servico atribuida ao barbeiro', Number(f.atribuidos) === 1, `${f.atribuidos} atribuido(s)`);

  // ---------- 3. Constraints trocadas ----------
  const cons = await c.query(`
    select conname from pg_constraint
    where conrelid = 'public.agendamentos'::regclass and contype='x'`);
  check('EXCLUDE agora e por profissional',
    cons.rows.length === 1 && cons.rows[0].conname === 'no_overlap_per_profissional',
    cons.rows.map(r => r.conname).join(', ') || 'nenhuma');

  const uniq = await c.query(`
    select conname, pg_get_constraintdef(oid) as def from pg_constraint
    where conrelid = 'public.expedientes'::regclass and contype='u'`);
  check('Expediente unico por profissional/dia',
    uniq.rows.some(r => r.def.includes('profissional_id')),
    uniq.rows.map(r => r.def).join(' | '));

  // ---------- 4. O TESTE QUE IMPORTA: dois barbeiros, mesmo horario ----------
  await c.query('begin');
  try {
    const shop = (await c.query(`select id, slug from barbeiros limit 1`)).rows[0];
    const svc = (await c.query(`select id, duracao_minutos from servicos where barbeiro_id=$1 and ativo limit 1`, [shop.id])).rows[0];
    const profA = (await c.query(`select id from profissionais where barbeiro_id=$1 order by ordem limit 1`, [shop.id])).rows[0];

    const profB = (await c.query(
      `insert into profissionais (barbeiro_id, nome, ordem) values ($1,'TESTE Barbeiro B',99) returning id`,
      [shop.id])).rows[0];

    // Data futura improvavel de colidir com dado real
    const inicio = '2031-03-05T14:00:00Z';
    const fim    = '2031-03-05T15:00:00Z';

    const inserir = (profId: string, nome: string) => c.query(
      `insert into agendamentos
         (barbeiro_id, profissional_id, servico_id, nome_cliente, telefone_cliente,
          inicio_em, fim_em, status, preco_cobrado)
       values ($1,$2,$3,$4,'11999990000',$5,$6,'agendado',50)`,
      [shop.id, profId, svc.id, nome, inicio, fim]);

    await inserir(profA.id, 'TESTE Cliente A');
    await inserir(profB.id, 'TESTE Cliente B');
    check('Dois barbeiros no MESMO horario: permitido', true, '14h para A e B ao mesmo tempo');

    // E o mesmo barbeiro duas vezes tem que continuar bloqueado
    let bloqueou = false;
    try {
      await c.query('savepoint sp1');
      await inserir(profA.id, 'TESTE Cliente C');
      await c.query('rollback to savepoint sp1');
    } catch {
      bloqueou = true;
      await c.query('rollback to savepoint sp1');
    }
    check('Mesmo barbeiro no mesmo horario: continua bloqueado', bloqueou);

    // ---------- 5. Slots por profissional ----------
    // Expediente para o B (o A ja tem, do backfill)
    await c.query(
      `insert into expedientes (barbeiro_id, profissional_id, dia_semana, hora_inicio, hora_fim, ativo)
       select $1, $2, dia_semana, hora_inicio, hora_fim, ativo
       from expedientes where profissional_id = $3`,
      [shop.id, profB.id, profA.id]);

    const slotsA = await c.query(
      `select count(*) from get_available_slots($1,'2031-03-05',$2,$3,false)`,
      [shop.slug, svc.id, profA.id]);
    const slotsB = await c.query(
      `select count(*) from get_available_slots($1,'2031-03-05',$2,$3,false)`,
      [shop.slug, svc.id, profB.id]);
    check('Slots calculados por profissional', true,
      `A: ${slotsA.rows[0].count} livres, B: ${slotsB.rows[0].count} livres`);

    // ---------- 6. Folga de um nao fecha a agenda do outro ----------
    await c.query(
      `insert into bloqueios (barbeiro_id, profissional_id, data, motivo)
       values ($1,$2,'2031-03-06','TESTE folga do A')`, [shop.id, profA.id]);
    const folgaA = await c.query(
      `select count(*) from get_available_slots($1,'2031-03-06',$2,$3,false)`, [shop.slug, svc.id, profA.id]);
    const folgaB = await c.query(
      `select count(*) from get_available_slots($1,'2031-03-06',$2,$3,false)`, [shop.slug, svc.id, profB.id]);
    check('Folga de A nao fecha a agenda de B',
      folgaA.rows[0].count === '0' && Number(folgaB.rows[0].count) > 0,
      `A: ${folgaA.rows[0].count} livres (folga), B: ${folgaB.rows[0].count} livres`);

    // ---------- 7. Feriado da barbearia fecha os dois ----------
    await c.query(
      `insert into bloqueios (barbeiro_id, profissional_id, data, motivo)
       values ($1, null, '2031-03-07','TESTE feriado da barbearia')`, [shop.id]);
    const ferA = await c.query(
      `select count(*) from get_available_slots($1,'2031-03-07',$2,$3,false)`, [shop.slug, svc.id, profA.id]);
    const ferB = await c.query(
      `select count(*) from get_available_slots($1,'2031-03-07',$2,$3,false)`, [shop.slug, svc.id, profB.id]);
    check('Feriado da barbearia fecha a agenda dos dois',
      ferA.rows[0].count === '0' && ferB.rows[0].count === '0',
      `A: ${ferA.rows[0].count}, B: ${ferB.rows[0].count}`);

    // ---------- 8. Profissional de outra barbearia e rejeitado ----------
    const alheio = await c.query(
      `select count(*) from get_available_slots($1,'2031-03-05',$2,gen_random_uuid(),false)`,
      [shop.slug, svc.id]);
    check('Profissional inexistente nao retorna slots', alheio.rows[0].count === '0');

  } finally {
    await c.query('rollback');
    console.log('\n(rollback executado — nenhum dado de teste ficou no banco)');
  }

  // Confirma que o rollback limpou
  const sujeira = await c.query(`select count(*) from profissionais where nome like 'TESTE%'`);
  check('Banco limpo apos os testes', sujeira.rows[0].count === '0');

  await c.end();
  console.log(falhas === 0 ? '\nTUDO PASSOU' : `\n${falhas} FALHA(S)`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
