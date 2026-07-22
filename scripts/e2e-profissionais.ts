// scripts/e2e-profissionais.ts
// Testa o fluxo público de agendamento com múltiplos barbeiros, batendo na API HTTP real.
// Cria um barbeiro de teste, agenda nos dois, e LIMPA TUDO no final.
//
// Uso: PORT=3999 npx tsx scripts/e2e-profissionais.ts

import { Client } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const BASE = `http://localhost:${process.env.TEST_PORT || 3999}`;
const SLUG = 'imperial';
const DATA_TESTE = '2031-04-09'; // quarta-feira, bem longe de dado real

const projectRef = process.env.SUPABASE_PROJECT_REF!;
const dbPassword = process.env.SUPABASE_DB_PASSWORD!;

let falhas = 0;
function check(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? 'PASSA' : 'FALHA'}  ${nome}${detalhe ? ' — ' + detalhe : ''}`);
  if (!ok) falhas++;
}

async function api(path: string, init?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, init);
  const txt = await r.text();
  let body: any = null;
  try { body = JSON.parse(txt); } catch { body = txt.slice(0, 120); }
  return { status: r.status, body };
}

async function main() {
  const pg = new Client({
    connectionString: `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
  });
  await pg.connect();

  const shop = (await pg.query(`select id from barbeiros where slug=$1`, [SLUG])).rows[0];
  const profA = (await pg.query(
    `select id, nome from profissionais where barbeiro_id=$1 order by ordem limit 1`, [shop.id])).rows[0];

  // Barbeiro B de teste + expediente COM intervalo copiado do A
  const profB = (await pg.query(
    `insert into profissionais (barbeiro_id, nome, ordem) values ($1,'ZZTESTE Barbeiro B',900) returning id`,
    [shop.id])).rows[0];
  await pg.query(
    `insert into expedientes (barbeiro_id, profissional_id, dia_semana, hora_inicio, hora_fim, intervalo_inicio, intervalo_fim, ativo)
     select barbeiro_id, $1, dia_semana, hora_inicio, hora_fim, intervalo_inicio, intervalo_fim, ativo
     from expedientes where profissional_id = $2`,
    [profB.id, profA.id]);

  const criados: string[] = [];

  try {
    // ---------- 1. Lista pública mostra os dois ----------
    const lista = await api(`/api/profissionais?slug=${SLUG}`);
    check('API lista os dois barbeiros', Array.isArray(lista.body) && lista.body.length === 2,
      (lista.body ?? []).map((p: any) => p.nome).join(', '));

    const servico = (await api(`/api/servicos?slug=${SLUG}`)).body[0];

    // ---------- 2. Slots exigem barbeiro ----------
    const semProf = await api(`/api/horarios-livres?slug=${SLUG}&data=${DATA_TESTE}&servico_id=${servico.id}`);
    check('Slots sem barbeiro sao rejeitados (400)', semProf.status === 400, `HTTP ${semProf.status}`);

    // ---------- 3. Slots por barbeiro ----------
    const slotsA = await api(`/api/horarios-livres?slug=${SLUG}&data=${DATA_TESTE}&servico_id=${servico.id}&profissional_id=${profA.id}`);
    const slotsB = await api(`/api/horarios-livres?slug=${SLUG}&data=${DATA_TESTE}&servico_id=${servico.id}&profissional_id=${profB.id}`);
    const livresA: string[] = (slotsA.body ?? []).map((s: any) => s.horario);
    const livresB: string[] = (slotsB.body ?? []).map((s: any) => s.horario);
    check('Ambos tem horario livre', livresA.length > 0 && livresB.length > 0,
      `A: ${livresA.length}, B: ${livresB.length}`);
    check('Expediente copiado bate (mesmo almoco)', livresA.length === livresB.length,
      `A: ${livresA.length} vs B: ${livresB.length}`);

    const horario = livresA[0];

    // ---------- 4. O TESTE PRINCIPAL: mesmo horario, barbeiros diferentes ----------
    const reservar = (profId: string, nome: string) => api('/api/agendamentos?slug=' + SLUG, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        servico_id: servico.id,
        profissional_id: profId,
        data: DATA_TESTE,
        horario,
        nome_cliente: nome,
        telefone_cliente: '11988887777'
      })
    });

    const r1 = await reservar(profA.id, 'ZZTESTE Cliente 1');
    if (r1.status === 201) criados.push(r1.body.id);
    check('Agendamento com barbeiro A criado', r1.status === 201, `HTTP ${r1.status} ${JSON.stringify(r1.body).slice(0,90)}`);

    const r2 = await reservar(profB.id, 'ZZTESTE Cliente 2');
    if (r2.status === 201) criados.push(r2.body.id);
    check('MESMO horario com barbeiro B tambem criado', r2.status === 201,
      `${horario} para os dois — HTTP ${r2.status}`);

    // ---------- 5. Mesmo barbeiro no mesmo horario continua barrado ----------
    const r3 = await reservar(profA.id, 'ZZTESTE Cliente 3');
    if (r3.status === 201) criados.push(r3.body.id);
    check('Repetir o barbeiro A no mesmo horario e bloqueado', r3.status === 400,
      `HTTP ${r3.status}: ${r3.body?.error ?? ''}`);

    // ---------- 6. O horario sumiu da lista do A, mas nao afeta o B ----------
    const depoisA = await api(`/api/horarios-livres?slug=${SLUG}&data=${DATA_TESTE}&servico_id=${servico.id}&profissional_id=${profA.id}`);
    const restamA: string[] = (depoisA.body ?? []).map((s: any) => s.horario);
    check('Horario reservado sumiu da agenda do A', !restamA.includes(horario), `${horario} ainda listado?`);

    // ---------- 7. Barbeiro de outra barbearia e recusado ----------
    const intruso = await reservar('00000000-0000-0000-0000-0000000000ff', 'ZZTESTE Intruso');
    check('Barbeiro inexistente e recusado', intruso.status === 404, `HTTP ${intruso.status}`);

    // ---------- 8. Atribuicao financeira ao concluir ----------
    if (criados.length > 0) {
      const cod = criados[0];
      const ag = (await pg.query(`select id, profissional_id from agendamentos where codigo=$1`, [cod])).rows[0];
      await pg.query(`update agendamentos set status='concluido' where id=$1`, [ag.id]);
      const lanc = (await pg.query(
        `select profissional_id, valor from lancamentos_financeiros where agendamento_id=$1`, [ag.id])).rows[0];
      check('Lancamento herda o barbeiro do agendamento',
        !!lanc && lanc.profissional_id === ag.profissional_id,
        lanc ? `profissional_id=${lanc.profissional_id?.slice(0,8)}` : 'nenhum lancamento criado');
    }

  } finally {
    // ---------- LIMPEZA ----------
    for (const cod of criados) {
      const ag = (await pg.query(`select id from agendamentos where codigo=$1`, [cod])).rows[0];
      if (ag) {
        await pg.query(`delete from lancamentos_financeiros where agendamento_id=$1`, [ag.id]);
        await pg.query(`delete from agendamentos where id=$1`, [ag.id]);
      }
    }
    await pg.query(`delete from expedientes where profissional_id=$1`, [profB.id]);
    await pg.query(`delete from agendamentos where profissional_id=$1`, [profB.id]);
    await pg.query(`delete from profissionais where id=$1`, [profB.id]);
    await pg.query(`delete from clientes where nome like 'ZZTESTE%'`);

    const sobra = await pg.query(
      `select (select count(*) from profissionais where nome like 'ZZTESTE%') as p,
              (select count(*) from agendamentos where nome_cliente like 'ZZTESTE%') as a`);
    check('Limpeza completa', sobra.rows[0].p === '0' && sobra.rows[0].a === '0',
      `profissionais: ${sobra.rows[0].p}, agendamentos: ${sobra.rows[0].a}`);
    await pg.end();
  }

  console.log(falhas === 0 ? '\nTUDO PASSOU' : `\n${falhas} FALHA(S)`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
