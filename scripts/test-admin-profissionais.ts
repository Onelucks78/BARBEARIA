// scripts/test-admin-profissionais.ts
// Testa as funções de storage do admin para múltiplos barbeiros.
// Cria dados de teste e LIMPA TUDO no final.

import { config } from 'dotenv';
config({ path: '.env.local' });

import { Client } from 'pg';
import * as storage from '../server/storage.ts';

let falhas = 0;
function check(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? 'PASSA' : 'FALHA'}  ${nome}${detalhe ? ' — ' + detalhe : ''}`);
  if (!ok) falhas++;
}

async function main() {
  const pg = new Client({
    connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${process.env.SUPABASE_PROJECT_REF}.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
  });
  await pg.connect();

  const shopId = (await pg.query(`select id from barbeiros where slug='imperial'`)).rows[0].id;
  let novoId: string | null = null;

  try {
    // ---------- 1. Lista inicial ----------
    const antes = await storage.listProfissionais(shopId);
    check('listProfissionais devolve a equipe', antes.length >= 1, `${antes.length} barbeiro(s)`);

    // Garante que o barbeiro padrão tem almoço, para o teste de cópia valer
    await pg.query(
      `update expedientes set intervalo_inicio='12:00', intervalo_fim='13:00'
       where profissional_id=$1 and dia_semana=3`, [antes[0].id]);

    // ---------- 2. Criar barbeiro copia o expediente COM almoço ----------
    const novo = await storage.createProfissional(shopId, {
      nome: 'ZZTESTE Admin Barbeiro',
      telefone: '11955554444',
      bio: 'Barbeiro de teste automatizado.'
    });
    novoId = novo.id;
    check('createProfissional cria o barbeiro', !!novo.id && novo.nome === 'ZZTESTE Admin Barbeiro');
    check('Barbeiro novo nasce ativo', novo.ativo === true);

    const expNovo = (await pg.query(
      `select dia_semana, hora_inicio, hora_fim, intervalo_inicio, intervalo_fim
       from expedientes where profissional_id=$1 order by dia_semana`, [novo.id])).rows;
    const expBase = (await pg.query(
      `select dia_semana, hora_inicio, hora_fim, intervalo_inicio, intervalo_fim
       from expedientes where profissional_id=$1 order by dia_semana`, [antes[0].id])).rows;

    check('Expediente foi copiado para o barbeiro novo',
      expNovo.length === expBase.length && expNovo.length > 0,
      `${expNovo.length} dias copiados de ${expBase.length}`);

    // O ponto que quase passou batido: o almoço tem que vir junto
    const comAlmoco = expNovo.filter(e => e.intervalo_inicio !== null).length;
    const baseAlmoco = expBase.filter(e => e.intervalo_inicio !== null).length;
    check('Intervalo de almoco veio na copia', comAlmoco === baseAlmoco && comAlmoco > 0,
      `novo: ${comAlmoco} dias com almoco, base: ${baseAlmoco}`);

    // ---------- 3. Slots funcionam para o barbeiro novo ----------
    const servico = (await pg.query(
      `select id from servicos where barbeiro_id=$1 and ativo limit 1`, [shopId])).rows[0];
    const slots = await storage.getAvailableSlots('imperial', '2031-04-09', servico.id, novo.id, false);
    check('Barbeiro novo ja tem horario livre', slots.length > 0,
      `${slots.length} slots — sem a copia de expediente seria 0`);

    // ---------- 4. Desativar esconde do site publico ----------
    await storage.updateProfissional(novo.id, shopId, { ativo: false });
    const publicos = await storage.listProfissionais('imperial', true);
    check('Desativado some da lista publica', !publicos.some(p => p.id === novo.id));
    const todos = await storage.listProfissionais(shopId);
    check('Desativado continua visivel no admin', todos.some(p => p.id === novo.id));
    await storage.updateProfissional(novo.id, shopId, { ativo: true });

    // ---------- 5. Lançamento atribuído ao barbeiro ----------
    const lancBarbeiro = await storage.createLancamento(shopId, {
      tipo: 'entrada', descricao: 'ZZTESTE corte avulso', valor: 50,
      categoria: 'Serviços', forma_pagamento: 'pix',
      data: '2031-04-09', profissional_id: novo.id
    });
    check('Lancamento guarda o barbeiro', lancBarbeiro?.profissional_id === novo.id);

    // ---------- 6. Produto ignora o barbeiro (é da casa) ----------
    const produto = (await pg.query(
      `select id from produtos where barbeiro_id=$1 limit 1`, [shopId])).rows[0];
    let lancProduto: any = null;
    if (produto) {
      lancProduto = await storage.createLancamento(shopId, {
        tipo: 'entrada', descricao: 'ZZTESTE venda produto', valor: 30,
        categoria: 'Produtos', forma_pagamento: 'dinheiro',
        data: '2031-04-09', produto_id: produto.id, profissional_id: novo.id
      });
      check('Venda de produto ignora o barbeiro (fica da casa)',
        lancProduto?.profissional_id === null,
        `profissional_id=${lancProduto?.profissional_id}`);
    }

    // ---------- 7. Filtro do financeiro ----------
    const doBarbeiro = await storage.listLancamentos(shopId, novo.id);
    check('Filtro por barbeiro traz so os dele',
      !!doBarbeiro && doBarbeiro.every(l => l.profissional_id === novo.id) && doBarbeiro.length >= 1,
      `${doBarbeiro?.length} lancamento(s)`);

    const daCasa = await storage.listLancamentos(shopId, null);
    check('Filtro "casa" traz so os sem barbeiro',
      !!daCasa && daCasa.every(l => l.profissional_id === null),
      `${daCasa?.length} lancamento(s) da casa`);

    // ---------- 8. Dashboard: quebra por barbeiro ----------
    const stats = await storage.getDashboardStats(shopId, '2031-04-01', '2031-04-30T23:59:59.999Z');
    const linha = stats?.porProfissional.find(p => p.profissional_id === novo.id);
    check('Dashboard quebra faturamento por barbeiro',
      !!linha && linha.receita === 50,
      linha ? `${linha.nome}: R$ ${linha.receita}` : 'linha do barbeiro nao encontrada');

    const casa = stats?.porProfissional.find(p => p.profissional_id === null);
    if (produto) {
      check('Produto aparece como receita da Barbearia',
        !!casa && casa.receita === 30, casa ? `Barbearia: R$ ${casa.receita}` : 'sem linha da casa');
    }

    // ---------- 9. Isolamento entre barbearias ----------
    const outro = await storage.updateProfissional(novo.id, '00000000-0000-0000-0000-0000000000ff', { nome: 'HACK' });
    check('Nao da para editar barbeiro de outra barbearia', outro === null);

  } finally {
    // ---------- LIMPEZA ----------
    await pg.query(`delete from lancamentos_financeiros where descricao like 'ZZTESTE%'`);
    if (novoId) {
      await pg.query(`delete from expedientes where profissional_id=$1`, [novoId]);
      await pg.query(`delete from profissionais where id=$1`, [novoId]);
    }
    const sobra = await pg.query(
      `select (select count(*) from profissionais where nome like 'ZZTESTE%') as p,
              (select count(*) from lancamentos_financeiros where descricao like 'ZZTESTE%') as l`);
    check('Limpeza completa',
      sobra.rows[0].p === '0' && sobra.rows[0].l === '0',
      `profissionais: ${sobra.rows[0].p}, lancamentos: ${sobra.rows[0].l}`);
    await pg.end();
  }

  console.log(falhas === 0 ? '\nTUDO PASSOU' : `\n${falhas} FALHA(S)`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
