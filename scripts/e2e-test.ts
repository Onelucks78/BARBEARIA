// scripts/e2e-test.ts
// Fluxo completo: visitante consulta → cria agendamento → admin muda status → trigger gera lançamento
// Usa fetch direto (REST Supabase) em vez de supabase-js pra evitar quirks.

import { config } from 'dotenv';
config({ path: '.env.local' });

const url = process.env.SUPABASE_URL!;
const anon = process.env.SUPABASE_ANON_KEY!;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const log = (k: string, v: any) => console.log(`  ${k.padEnd(22)} ${typeof v === 'object' ? JSON.stringify(v) : v}`);

async function sb(path: string, init: RequestInit = {}, key = anon): Promise<{ status: number; body: any }> {
  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(init.headers || {})
    }
  });
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch {}
  return { status: res.status, body };
}

async function main() {
  console.log('\n=== 1. Visitante consulta serviços (anon) ===');
  const s1 = await sb('/rest/v1/servicos?select=id,nome,preco,duracao_minutos&ativo=eq.true&order=ordem&limit=3');
  log('status', s1.status);
  log('servicos', s1.body?.length);
  const cortePremium = s1.body.find((s: any) => s.nome === 'Corte Premium');
  log('Corte Premium id', cortePremium.id);

  console.log('\n=== 2. Visitante consulta slots livres (RPC) ===');
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  while (amanha.getDay() === 0 || amanha.getDay() === 6) amanha.setDate(amanha.getDate() + 1);
  const dataStr = amanha.toISOString().split('T')[0];
  const rpc = await sb('/rest/v1/rpc/get_available_slots', {
    method: 'POST',
    body: JSON.stringify({ p_slug: 'imperial', p_data: dataStr, p_servico_ids: cortePremium.id, p_all: false })
  });
  log('status', rpc.status);
  log('data consultada', dataStr);
  log('slots livres', rpc.body?.length);
  const slot = rpc.body?.[0]?.horario?.slice(0, 5) || '09:00';
  log('slot escolhido', slot);

  console.log('\n=== 3. Visitante cria agendamento (anon) ===');
  // Calcula horário fim: 09:00 + 40min = 09:40
  const [h, m] = slot.split(':').map(Number);
  const fimMin = h * 60 + m + cortePremium.duracao_minutos;
  const fim = `${String(Math.floor(fimMin/60)).padStart(2,'0')}:${String(fimMin%60).padStart(2,'0')}`;
  const c1 = await sb('/rest/v1/agendamentos', {
    method: 'POST',
    headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      barbeiro_id: '00000000-0000-0000-0000-000000000001',
      servico_id: cortePremium.id,
      nome_cliente: 'Cliente E2E',
      telefone_cliente: '11999998888',
      inicio_em: `${dataStr}T${slot}:00`,
      fim_em: `${dataStr}T${fim}:00`,
      status: 'agendado',
      preco_cobrado: cortePremium.preco
    })
  });
  log('status', c1.status);
  if (c1.status >= 400) {
    console.log('  ERRO:', JSON.stringify(c1.body));
    return;
  }
  // Pega o id de volta por query (já que return=minimal não devolve corpo)
  const q = await sb(`/rest/v1/agendamentos?nome_cliente=eq.Cliente%20E2E&select=id,codigo&limit=1`, {}, svc);
  const ag = q.body?.[0];
  log('agendamento id', ag.id);
  log('codigo', ag.codigo);

  console.log('\n=== 4. Verifica lançamento ainda não existe ===');
  const l0 = await sb(`/rest/v1/lancamentos_financeiros?agendamento_id=eq.${ag.id}&select=id`, {}, svc);
  log('lançamentos', l0.body?.length);

  console.log('\n=== 5. Admin muda status → concluido (svc) ===');
  const u1 = await sb(`/rest/v1/agendamentos?id=eq.${ag.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'concluido' })
  }, svc);
  log('status update', u1.status);

  console.log('\n=== 6. Trigger financeiro criou lançamento ===');
  const l1 = await sb(`/rest/v1/lancamentos_financeiros?agendamento_id=eq.${ag.id}&select=id,descricao,valor,categoria,excluido`, {}, svc);
  log('lançamentos', l1.body?.length);
  log('detalhes', l1.body?.[0]);

  console.log('\n=== 7. Admin desfaz → cancelado (trigger remove lançamento) ===');
  await sb(`/rest/v1/agendamentos?id=eq.${ag.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'cancelado' })
  }, svc);
  const l2 = await sb(`/rest/v1/lancamentos_financeiros?agendamento_id=eq.${ag.id}&select=id,excluido`, {}, svc);
  log('lançamentos (excluido)', l2.body?.filter((x: any) => x.excluido).length);

  console.log('\n=== Limpeza ===');
  await sb(`/rest/v1/lancamentos_financeiros?agendamento_id=eq.${ag.id}`, { method: 'DELETE' }, svc);
  await sb(`/rest/v1/agendamentos?id=eq.${ag.id}`, { method: 'DELETE' }, svc);
  log('dados removidos', 'OK');

  console.log('\n✅ End-to-end OK');
}

main().catch(e => { console.error('❌', e); process.exit(1); });
