// server/storage.ts
// Camada única de acesso a dados. Cada função checa se Supabase tá
// configurado e usa Postgres; caso contrário usa db.json (dev/preview).
//
// Toda escrita em Supabase é via service role (após o middleware auth
// ter validado o JWT). Toda leitura pública usa anon key (deixa RLS valer).

import { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, anonClient, serviceClient } from './supabase.ts';
import { loadDB, saveDB, calculateAvailableSlots, calculateAllSlotsWithAvailability } from './database.ts';
import {
  Barbeiro, Profissional, Servico, Produto, Cliente, Agendamento,
  DashboardStats, LancamentoFinanceiro, Expediente, Bloqueio, CategoriaFinanceira
} from '../src/types.ts';

// ---------- HELPERS ----------
function sb(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return serviceClient() ?? anonClient();
}

export function getTodayLocalDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function purgeOldAgendamentos(barbeiroId?: string): Promise<void> {
  const todayStr = getTodayLocalDateString();
  const cutoff = `${todayStr}T00:00:00`;
  const client = sb();
  if (client) {
    try {
      let q = client.from('agendamentos').delete().lt('inicio_em', cutoff);
      if (barbeiroId) q = q.eq('barbeiro_id', barbeiroId);
      await q;
    } catch (err) {
      console.error('[purgeOldAgendamentos] Erro ao excluir agendamentos antigos:', err);
    }
  } else {
    try {
      const db = loadDB();
      const beforeCount = db.agendamentos.length;
      db.agendamentos = db.agendamentos.filter(a => a.inicio_em >= cutoff);
      if (db.agendamentos.length !== beforeCount) {
        saveDB(db);
      }
    } catch (err) {
      console.error('[purgeOldAgendamentos db.json]', err);
    }
  }
}

function formatNameFromEmail(email: string): string {
  if (!email) return 'Cliente';
  const rawPart = email.split('@')[0] || '';
  const cleaned = rawPart.replace(/[0-9]+/g, ' ').replace(/[\._\-]+/g, ' ');
  const words = cleaned.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'Cliente';
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function cleanClientName(name: string | undefined, email: string): string {
  if (!name || name.includes('@') || name.includes('.com') || name.includes('.') || name.includes('_') || name.includes('-')) {
    const raw = (name && !name.includes('@')) ? name : email;
    return formatNameFromEmail(raw);
  }
  return name;
}

// Converte linha do Supabase pra shape que o front já espera.
// O schema usa snake_case no banco; o front espera camelCase.
// Quando a shape bater, retorna como está; quando difere, faz tradução mínima.
function rowToBarbeiro(r: any): Barbeiro {
  return {
    id: r.id,
    nome: r.nome,
    email: r.email,
    telefone: r.telefone,
    avatar_url: r.avatar_url ?? '',
    nome_barbearia: r.nome_barbearia,
    bio: r.bio ?? '',
    slug: r.slug,
    ativo: r.ativo,
    ultimo_acesso_em: r.ultimo_acesso_em,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

function rowToServico(r: any): Servico {
  return {
    id: r.id,
    barbeiro_id: r.barbeiro_id,
    nome: r.nome,
    descricao: r.descricao ?? '',
    preco: Number(r.preco),
    duracao_minutos: r.duracao_minutos,
    imagem_url: r.imagem_url ?? '',
    ativo: r.ativo,
    ordem: r.ordem,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

function rowToProduto(r: any): Produto {
  return {
    id: r.id,
    barbeiro_id: r.barbeiro_id,
    nome: r.nome,
    descricao: r.descricao ?? '',
    preco: Number(r.preco),
    imagem_url: r.imagem_url ?? '',
    estoque: r.estoque,
    ativo: r.ativo,
    ordem: r.ordem,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

function rowToAgendamento(r: any): Agendamento {
  return {
    id: r.codigo ?? r.id, // devolve o #000001 visível quando existir
    barbeiro_id: r.barbeiro_id,
    profissional_id: r.profissional_id,
    servico_id: r.servico_id,
    cliente_id: r.cliente_id,
    nome_cliente: r.nome_cliente,
    telefone_cliente: r.telefone_cliente,
    inicio_em: typeof r.inicio_em === 'string' ? r.inicio_em : new Date(r.inicio_em).toISOString().slice(0, 19),
    fim_em: typeof r.fim_em === 'string' ? r.fim_em : new Date(r.fim_em).toISOString().slice(0, 19),
    status: r.status,
    preco_cobrado: Number(r.preco_cobrado),
    observacao: r.observacao ?? '',
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

// ---------- PÚBLICO: SERVIÇOS / PRODUTOS ----------
async function resolveBarbeiroId(barbeiroIdOrSlug?: string): Promise<string | undefined> {
  if (!barbeiroIdOrSlug) return undefined;
  // já é UUID?
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(barbeiroIdOrSlug)) {
    return barbeiroIdOrSlug;
  }
  const client = sb();
  if (!client) {
    const db = loadDB();
    const b = db.barbeiros.find(x => x.slug === barbeiroIdOrSlug);
    return b?.id;
  }
  const { data } = await client.from('barbeiros').select('id').eq('slug', barbeiroIdOrSlug).maybeSingle();
  return data?.id;
}

export async function listActiveServicos(barbeiroIdOrSlug?: string): Promise<Servico[]> {
  const client = sb();
  if (!client) {
    const db = loadDB();
    const barbeiroId = await resolveBarbeiroId(barbeiroIdOrSlug);
    return db.servicos
      .filter(s => s.ativo && (!barbeiroId || s.barbeiro_id === barbeiroId))
      .sort((a, b) => a.ordem - b.ordem);
  }
  const barbeiroId = await resolveBarbeiroId(barbeiroIdOrSlug);
  let q = client.from('servicos').select('*').eq('ativo', true);
  if (barbeiroId) q = q.eq('barbeiro_id', barbeiroId);
  const { data, error } = await q.order('ordem', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToServico);
}

export async function listActiveProdutos(barbeiroIdOrSlug?: string): Promise<Produto[]> {
  const client = sb();
  if (!client) {
    const db = loadDB();
    const barbeiroId = await resolveBarbeiroId(barbeiroIdOrSlug);
    return db.produtos
      .filter(p => p.ativo && (!barbeiroId || p.barbeiro_id === barbeiroId))
      .sort((a, b) => a.ordem - b.ordem);
  }
  const barbeiroId = await resolveBarbeiroId(barbeiroIdOrSlug);
  let q = client.from('produtos').select('*').eq('ativo', true);
  if (barbeiroId) q = q.eq('barbeiro_id', barbeiroId);
  const { data, error } = await q.order('ordem', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToProduto);
}

export async function getBarbeiroBySlug(slug: string): Promise<Barbeiro | null> {
  const client = sb();
  if (!client) {
    const db = loadDB();
    return db.barbeiros.find(b => b.slug === slug) ?? null;
  }
  const { data, error } = await client.from('barbeiros').select('*').eq('slug', slug).eq('ativo', true).single();
  if (error || !data) return null;
  return rowToBarbeiro(data);
}

// ---------- HORÁRIOS LIVRES ----------
export async function getAvailableSlots(
  slug: string,
  data: string,
  servicoId: string,
  profissionalId: string,
  all: boolean = false
): Promise<{ horario: string; disponivel: boolean; motivo?: string }[]> {
  const client = sb();
  if (!client) {
    // Caminho dev/db.json: não tem múltiplos profissionais, ignora o filtro.
    const slots = all
      ? calculateAllSlotsWithAvailability(data, servicoId)
      : calculateAvailableSlots(data, servicoId);
    return slots.map(s => ({
      horario: s.horario,
      disponivel: s.disponivel,
      motivo: s.motivo
    }));
  }
  const { data: rows, error } = await client.rpc('get_available_slots', {
    p_slug: slug,
    p_data: data,
    p_servico_ids: servicoId, // string CSV, ou UUID único
    p_profissional_id: profissionalId,
    p_all: all
  });
  if (error) throw error;
  return (rows ?? []).map((r: any) => ({
    horario: typeof r.horario === 'string' ? r.horario.slice(0, 5) : r.horario,
    disponivel: r.disponivel,
    motivo: r.motivo ?? undefined
  }));
}

// ---------- HELPER DE ASSINATURA / PLANOS ----------
export function isClientVip(observacoes?: string): boolean {
  if (observacoes) {
    try {
      if (observacoes.trim().startsWith('{')) {
        const parsed = JSON.parse(observacoes);
        return parsed.subscription?.status === 'ativo';
      }
    } catch {}
  }
  return false;
}

// Extrai o plano (essential | premium | exclusive) empacotado nas observações do cliente
export function getClientPlan(observacoes?: string): string {
  if (observacoes) {
    try {
      if (observacoes.trim().startsWith('{')) {
        const parsed = JSON.parse(observacoes);
        return (parsed.subscription?.plan || '').toLowerCase();
      }
    } catch {}
  }
  return '';
}

// Categorias inclusas em cada tier — cada tier é um superset estrito do anterior
export function getPlanCategorias(plan: string): string[] {
  const p = (plan || '').toLowerCase();
  if (p === 'exclusive') return ['corte', 'barba', 'sobrancelha', 'penteado'];
  if (p === 'premium') return ['corte', 'barba'];
  if (p === 'essential') return ['corte'];
  return [];
}

// Categorias que um serviço toca (pode tocar mais de uma, ex: combo "Cabelo + Barba + Sobrancelha").
// Serviços químicos/especiais nunca se qualificam para nenhum plano.
export function getServiceCategorias(nome: string): string[] {
  const n = nome.toLowerCase();
  const isSpecial = n.includes('pintura') || n.includes('selagem') || n.includes('progressiva') || n.includes('quimica') || n.includes('luzes') || n.includes('colora');
  if (isSpecial) return [];
  const categorias: string[] = [];
  if (n.includes('corte') || n.includes('cabelo')) categorias.push('corte');
  if (n.includes('barba')) categorias.push('barba');
  if (n.includes('sobrancelha')) categorias.push('sobrancelha');
  if (n.includes('penteado')) categorias.push('penteado');
  return categorias;
}

// Um serviço só é gratuito no plano se TODAS as categorias que ele toca estiverem inclusas no tier
export function isServiceEligibleForPlan(nome: string, plan: string): boolean {
  const categoriasServico = getServiceCategorias(nome);
  if (categoriasServico.length === 0) return false;
  const categoriasPlano = getPlanCategorias(plan);
  return categoriasServico.every(c => categoriasPlano.includes(c));
}

// ---------- CRIAÇÃO DE AGENDAMENTO ----------
export interface CreateBookingInput {
  servico_id: string;
  profissional_id: string;
  data: string;
  horario: string;
  nome_cliente: string;
  telefone_cliente: string;
  observacao?: string;
  cliente_id?: string;
  cliente_email?: string;
}

export async function createBooking(slug: string, input: CreateBookingInput): Promise<Agendamento> {
  const client = sb();
  if (!client) {
    throw new Error('createBooking em modo dev ainda roda via server.ts (legado).');
  }

  const barbeiro = await getBarbeiroBySlug(slug);
  if (!barbeiro) throw Object.assign(new Error('Barbearia não encontrada.'), { status: 404 });

  // O barbeiro escolhido tem que ser DESTA barbearia e estar ativo.
  // Sem essa checagem dá para agendar com profissional de outra barbearia.
  const { data: prof, error: profErr } = await client
    .from('profissionais').select('id')
    .eq('id', input.profissional_id)
    .eq('barbeiro_id', barbeiro.id)
    .eq('ativo', true)
    .maybeSingle();
  if (profErr) throw profErr;
  if (!prof) throw Object.assign(new Error('Barbeiro não encontrado ou indisponível.'), { status: 404 });

  // Resolve/cria cliente para obter o ID
  let resolvedClienteId: string | null = input.cliente_id ?? null;
  let clientRecord: any = null;

  if (input.cliente_email) {
    const { data: existing } = await client
      .from('clientes').select('*')
      .eq('barbeiro_id', barbeiro.id)
      .eq('email', input.cliente_email)
      .maybeSingle();
    if (existing) {
      resolvedClienteId = existing.id;
      clientRecord = existing;
      if (!existing.telefone && input.telefone_cliente) {
        await client.from('clientes').update({ telefone: input.telefone_cliente }).eq('id', existing.id);
      }
    } else {
      const { data: novo } = await client.from('clientes').insert({
        barbeiro_id: barbeiro.id,
        nome: input.nome_cliente,
        telefone: input.telefone_cliente,
        email: input.cliente_email,
        observacoes: 'Auto-cadastrado via agendamento online'
      }).select('*').single();
      if (novo) {
        resolvedClienteId = novo.id;
        clientRecord = novo;
      }
    }
  } else if (resolvedClienteId) {
    const { data } = await client.from('clientes').select('*').eq('id', resolvedClienteId).maybeSingle();
    clientRecord = data;
  }

  const isVip = clientRecord ? isClientVip(clientRecord.observacoes) : false;
  const clientPlan = clientRecord ? getClientPlan(clientRecord.observacoes) : '';

  // Suporta combo: "uuid,uuid"
  const ids = input.servico_id.includes(',') ? input.servico_id.split(',') : [input.servico_id];
  const { data: servicos, error: srvErr } = await client
    .from('servicos').select('id, nome, preco, duracao_minutos, ativo')
    .in('id', ids)
    .eq('barbeiro_id', barbeiro.id);
  if (srvErr) throw srvErr;
  if (!servicos || servicos.length === 0) {
    throw Object.assign(new Error('Nenhum serviço ativo encontrado.'), { status: 404 });
  }

  const totalPreco = servicos.reduce((s, x) => {
    if (isVip && isServiceEligibleForPlan(x.nome, clientPlan)) {
      return s + 0;
    }
    return s + Number(x.preco);
  }, 0);
  const totalDuracao = servicos.reduce((s, x) => s + x.duracao_minutos, 0);

  // Calcula fim
  const [h, m] = input.horario.split(':').map(Number);
  const fimMin = h * 60 + m + totalDuracao;
  const fimH = Math.floor(fimMin / 60);
  const fimM = fimMin % 60;
  const inicioIso = `${input.data}T${input.horario}:00`;
  const fimIso = `${input.data}T${String(fimH).padStart(2,'0')}:${String(fimM).padStart(2,'0')}:00`;

  // Insere — EXCLUDE constraint vai rejeitar conflito se houver
  const { data: ag, error: agErr } = await client.from('agendamentos').insert({
    barbeiro_id: barbeiro.id,
    profissional_id: input.profissional_id,
    servico_id: input.servico_id,
    cliente_id: resolvedClienteId,
    nome_cliente: input.nome_cliente,
    telefone_cliente: input.telefone_cliente,
    inicio_em: inicioIso,
    fim_em: fimIso,
    status: 'agendado',
    preco_cobrado: totalPreco,
    observacao: input.observacao ?? ''
  }).select('*').single();

  if (agErr) {
    // 23P01 = EXCLUDE violado: aquele BARBEIRO já tem horário sobreposto.
    // Outro barbeiro no mesmo horário é permitido e não cai aqui.
    if (agErr.code === '23P01') {
      throw Object.assign(new Error('Desculpe, este horário acabou de ser reservado com este barbeiro. Escolha outro.'), { status: 400 });
    }
    throw agErr;
  }

  return rowToAgendamento(ag);
}

// ---------- UPDATE DE STATUS (gera lançamento via trigger) ----------
export async function updateBookingStatus(
  uuid: string,
  patch: { status?: string; observacao?: string; cliente_id?: string | null }
): Promise<Agendamento | null> {
  const client = sb();
  if (!client) {
    throw new Error('updateBookingStatus em modo dev ainda roda via server.ts (legado).');
  }
  const { data, error } = await client
    .from('agendamentos').update(patch).eq('id', uuid)
    .select('*').single();
  if (error || !data) return null;
  return rowToAgendamento(data);
}

// ---------- AGENDAMENTOS DO CLIENTE (Meus Agendamentos) ----------
export async function listClientBookings(email?: string, telefone?: string): Promise<Agendamento[]> {
  await purgeOldAgendamentos();
  const client = sb();
  if (!client) {
    // Fallback db.json (dev/preview)
    const db = loadDB();
    const matchingClients = db.clientes.filter(c =>
      (email && c.email && c.email.toLowerCase() === email.toLowerCase()) ||
      (telefone && c.telefone && c.telefone.replace(/\D/g, '') === telefone.replace(/\D/g, ''))
    );
    const clientIds = matchingClients.map(c => c.id);
    const matched = db.agendamentos.filter(a => {
      if (a.cliente_id && clientIds.includes(a.cliente_id)) return true;
      if (telefone && a.telefone_cliente) {
        const t1 = a.telefone_cliente.replace(/\D/g, '');
        const t2 = telefone.replace(/\D/g, '');
        if (t1 && t2 && t1 === t2) return true;
      }
      return false;
    });
    return matched.sort((a, b) => b.inicio_em.localeCompare(a.inicio_em));
  }

  // Supabase: busca clientes que correspondem (email OU telefone)
  let clienteQuery = client.from('clientes').select('id');
  if (email) clienteQuery = clienteQuery.eq('email', email);
  const { data: clientesMatched } = await clienteQuery;
  const ids = (clientesMatched ?? []).map((c: any) => c.id);

  // Busca agendamentos por cliente_id OU telefone
  let query = client.from('agendamentos').select('*').order('inicio_em', { ascending: false });
  if (ids.length > 0 && telefone) {
    // OR combinando: cliente_id IN (...) OR telefone_cliente = telefone
    query = query.or(`cliente_id.in.(${ids.join(',')}),telefone_cliente.eq.${telefone}`);
  } else if (ids.length > 0) {
    query = query.in('cliente_id', ids);
  } else if (telefone) {
    query = query.eq('telefone_cliente', telefone);
  } else {
    return [];
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToAgendamento);
}

// ---------- PERFIL DO CLIENTE ----------
export interface ClientProfile {
  id?: string;
  nome?: string;
  email?: string;
  telefone?: string;
  foto_url?: string;
  observacoes?: string;
  barbeiro_id?: string;
}

export async function getClientProfile(email: string): Promise<ClientProfile | null> {
  const client = sb();
  if (!client) {
    const db = loadDB();
    return db.clientes.find(c => c.email && c.email.toLowerCase() === email.toLowerCase()) ?? null;
  }
  const { data, error } = await client
    .from('clientes').select('*').eq('email', email).maybeSingle();
  if (error || !data) return null;
  return data as ClientProfile;
}

export async function upsertClientProfile(input: {
  email: string;
  nome?: string;
  telefone?: string;
  foto_url?: string;
  observacoes?: string;
}): Promise<ClientProfile> {
  const client = sb();
  if (!client) {
    // Fallback db.json
    const db = loadDB();
    let c = db.clientes.find(x => x.email && x.email.toLowerCase() === input.email.toLowerCase());
    if (c) {
      if (input.nome !== undefined) c.nome = input.nome;
      if (input.telefone !== undefined) c.telefone = input.telefone;
      if (input.foto_url !== undefined) c.foto_url = input.foto_url;
      if (input.observacoes !== undefined) c.observacoes = input.observacoes;
      c.updated_at = new Date().toISOString();
    } else {
      c = {
        id: `c-auto-${Date.now()}`,
        barbeiro_id: 'b-1',
        nome: cleanClientName(input.nome, input.email),
        telefone: input.telefone || '',
        email: input.email,
        data_nascimento: null,
        observacoes: input.observacoes || 'Cliente cadastrado via login',
        ativo: true,
        foto_url: input.foto_url || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.clientes.push(c);
    }
    saveDB(db);
    return c;
  }

  // Supabase
  const existing = await getClientProfile(input.email);
  if (existing?.id) {
    const update: any = {};
    if (input.nome !== undefined) update.nome = input.nome;
    if (input.telefone !== undefined) update.telefone = input.telefone;
    if (input.foto_url !== undefined) update.foto_url = input.foto_url;
    if (input.observacoes !== undefined) update.observacoes = input.observacoes;
    const { data, error } = await client
      .from('clientes').update(update).eq('id', existing.id)
      .select('*').single();
    if (error) throw error;
    return data as ClientProfile;
  } else {
    // Precisa de um barbeiro_id pra criar (multi-tenant)
    const { data: bar } = await client
      .from('barbeiros').select('id').eq('ativo', true).limit(1).single();
    if (!bar) throw new Error('Nenhum barbeiro ativo encontrado.');
    const { data, error } = await client.from('clientes').insert({
      barbeiro_id: bar.id,
      email: input.email,
      nome: cleanClientName(input.nome, input.email),
      telefone: input.telefone || '',
      foto_url: input.foto_url || '',
      observacoes: input.observacoes || 'Cliente auto-cadastrado'
    }).select('*').single();
    if (error) throw error;
    return data as ClientProfile;
  }
}

// ---------- FINANCEIRO (Fluxo de Caixa) ----------
// profissionalId: undefined = sem filtro; null = só os da casa; uuid = daquele barbeiro
export async function listLancamentos(
  barbeiroId: string,
  profissionalId?: string | null
): Promise<LancamentoFinanceiro[] | null> {
  const client = sb();
  if (!client) return null;
  let q = client.from('lancamentos_financeiros').select('*')
    .eq('barbeiro_id', barbeiroId).eq('excluido', false);
  if (profissionalId === null) q = q.is('profissional_id', null);
  else if (profissionalId) q = q.eq('profissional_id', profissionalId);
  const { data, error } = await q.order('data', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LancamentoFinanceiro[];
}

export async function createLancamento(barbeiroId: string, input: {
  tipo: 'entrada' | 'saida';
  descricao?: string;
  valor: number;
  categoria?: string;
  forma_pagamento: 'dinheiro' | 'pix' | 'cartao' | 'outro';
  data: string;
  produto_id?: string | null;
  profissional_id?: string | null;
}): Promise<LancamentoFinanceiro | null> {
  const client = sb();
  if (!client) return null;

  const descricao = input.descricao?.trim() || (input.tipo === 'entrada' ? 'entrada' : 'saída');

  // Venda de produto é receita da casa, nunca atribuída a um barbeiro.
  const profissionalId = input.produto_id ? null : (input.profissional_id ?? null);

  const { data, error } = await client.from('lancamentos_financeiros').insert({
    barbeiro_id: barbeiroId,
    profissional_id: profissionalId,
    tipo: input.tipo,
    descricao,
    valor: input.valor,
    categoria: input.categoria || 'Serviços',
    forma_pagamento: input.forma_pagamento,
    agendamento_id: null,
    produto_id: input.produto_id || null,
    data: input.data
  }).select('*').single();
  if (error) throw error;

  // Venda manual de produto: baixa 1 unidade do estoque
  if (input.tipo === 'entrada' && input.produto_id) {
    const { data: prod } = await client.from('produtos').select('estoque').eq('id', input.produto_id).maybeSingle();
    if (prod && prod.estoque > 0) {
      await client.from('produtos').update({ estoque: prod.estoque - 1 }).eq('id', input.produto_id);
    }
  }

  return data as LancamentoFinanceiro;
}

export async function excluirLancamento(barbeiroId: string, id: string): Promise<LancamentoFinanceiro | null> {
  const client = sb();
  if (!client) return null;
  const { data, error } = await client.from('lancamentos_financeiros')
    .update({ excluido: true, updated_at: new Date().toISOString() })
    .eq('id', id).eq('barbeiro_id', barbeiroId)
    .select('*').single();
  if (error || !data) return null;
  return data as LancamentoFinanceiro;
}

export async function patchLancamento(barbeiroId: string, id: string, patch: {
  tipo?: 'entrada' | 'saida';
  descricao?: string;
  valor?: number;
  categoria?: string;
  forma_pagamento?: 'dinheiro' | 'pix' | 'cartao' | 'outro';
  data?: string;
  profissional_id?: string | null;
}): Promise<LancamentoFinanceiro | null> {
  const client = sb();
  if (!client) return null;

  const { data: existing, error: findErr } = await client.from('lancamentos_financeiros')
    .select('*').eq('id', id).eq('barbeiro_id', barbeiroId).maybeSingle();
  if (findErr) throw findErr;
  if (!existing) return null;

  const updatePayload: any = { updated_at: new Date().toISOString() };
  if (patch.tipo !== undefined) updatePayload.tipo = patch.tipo;
  if (patch.descricao !== undefined) {
    const tipo = patch.tipo ?? existing.tipo;
    updatePayload.descricao = patch.descricao.trim() || (tipo === 'entrada' ? 'entrada' : 'saída');
  }
  if (patch.valor !== undefined) updatePayload.valor = patch.valor;
  if (patch.categoria !== undefined) updatePayload.categoria = patch.categoria;
  if (patch.forma_pagamento !== undefined) updatePayload.forma_pagamento = patch.forma_pagamento;
  if (patch.data !== undefined) updatePayload.data = patch.data;
  // Produto continua sendo da casa mesmo se mandarem um barbeiro no patch.
  if (patch.profissional_id !== undefined) {
    updatePayload.profissional_id = existing.produto_id ? null : patch.profissional_id;
  }

  const { data, error } = await client.from('lancamentos_financeiros')
    .update(updatePayload).eq('id', id)
    .select('*').single();
  if (error || !data) return null;
  return data as LancamentoFinanceiro;
}

// ---------- DASHBOARD ----------
export async function getDashboardStats(
  barbeiroId: string,
  startDate?: string,
  endDate?: string,
  isToday?: boolean,
  profissionalId?: string
): Promise<DashboardStats | null> {
  const client = sb();
  if (!client) return null;

  // Busca agendamentos concluídos no intervalo
  let agQ = client.from('agendamentos').select('id, codigo, servico_id, profissional_id, inicio_em, status, preco_cobrado')
    .eq('barbeiro_id', barbeiroId).eq('status', 'concluido');
  if (startDate) agQ = agQ.gte('inicio_em', startDate);
  if (endDate) agQ = agQ.lte('inicio_em', endDate); // endDate já vem com hora do frontend (ex: 2026-07-19T23:59:59.999Z)
  if (profissionalId) agQ = agQ.eq('profissional_id', profissionalId);
  const { data: concluidos, error: agErr } = await agQ;
  if (agErr) throw agErr;

  // Lançamentos no intervalo (coluna 'data' é YYYY-MM-DD, comparar só com a parte da data)
  const endDateOnly = endDate ? endDate.split('T')[0] : undefined;
  let lfQ = client.from('lancamentos_financeiros').select('*')
    .eq('barbeiro_id', barbeiroId).eq('excluido', false);
  if (startDate) lfQ = lfQ.gte('data', startDate.split('T')[0]);
  if (endDateOnly) lfQ = lfQ.lte('data', endDateOnly);
  if (profissionalId) lfQ = lfQ.eq('profissional_id', profissionalId);
  const { data: lancamentos, error: lfErr } = await lfQ;
  if (lfErr) throw lfErr;

  const lista = (lancamentos ?? []) as any[];
  const completed = (concluidos ?? []) as any[];

  const cutsFromBookings = completed.reduce((s, a) => s + Number(a.preco_cobrado), 0);
  let manualCuts = 0;
  let produtos = 0;
  let despesas = 0;
  let outrasEntradas = 0;

  for (const l of lista) {
    if (l.tipo === 'saida') despesas += Number(l.valor);
    else if (l.tipo === 'entrada' && l.agendamento_id === null) {
      const isProduct = l.produto_id !== null ||
                       (l.categoria ?? '').toLowerCase().includes('produto') ||
                       (l.descricao ?? '').toLowerCase().includes('produto');
      if (isProduct) produtos += Number(l.valor);
      else if ((l.categoria ?? '') === 'Plano') outrasEntradas += Number(l.valor);
      else manualCuts += Number(l.valor);
    }
  }

  const faturamento = cutsFromBookings + manualCuts;
  const lucro = (faturamento + produtos + outrasEntradas) - despesas;

  // Counts
  let agendadosQ = client.from('agendamentos')
    .select('id', { count: 'exact', head: true })
    .eq('barbeiro_id', barbeiroId)
    .in('status', ['agendado', 'confirmado']);
  if (profissionalId) agendadosQ = agendadosQ.eq('profissional_id', profissionalId);
  const { count: agendadosCount } = await agendadosQ;

  let concluidosQ = client.from('agendamentos')
    .select('id', { count: 'exact', head: true })
    .eq('barbeiro_id', barbeiroId)
    .eq('status', 'concluido');
  if (profissionalId) concluidosQ = concluidosQ.eq('profissional_id', profissionalId);
  const { count: concluidosCount } = await concluidosQ;

  // --- Build dailyChartData (same logic as db.json path in server.ts) ---
  const hourlyKeys = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
  const dailyDetails: Record<string, { cortes: number; produtos: number; outras: number; despesas: number }> = {};

  if (isToday) {
    hourlyKeys.forEach(h => { dailyDetails[h] = { cortes: 0, produtos: 0, outras: 0, despesas: 0 }; });
  }

  const getHourKey = (iso: string) => {
    if (!iso) return '12:00';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '12:00';
      // Converte para o fuso horário local (Brasil UTC-3)
      const localHour = new Date(d.getTime() - d.getTimezoneOffset() * 60000).getUTCHours();
      return `${String(localHour).padStart(2, '0')}:00`;
    } catch {
      return '12:00';
    }
  };

  for (const a of completed) {
    const dateKey = isToday ? getHourKey(a.inicio_em) : (a.inicio_em ?? '').split('T')[0];
    if (!dateKey) continue;
    if (!dailyDetails[dateKey]) dailyDetails[dateKey] = { cortes: 0, produtos: 0, outras: 0, despesas: 0 };
    dailyDetails[dateKey].cortes += Number(a.preco_cobrado);
  }

  for (const l of lista) {
    const dateKey = isToday
      ? (l.created_at ? getHourKey(l.created_at) : '12:00')
      : (l.data ?? '').split('T')[0];
    if (!dateKey) continue;
    if (!dailyDetails[dateKey]) dailyDetails[dateKey] = { cortes: 0, produtos: 0, outras: 0, despesas: 0 };
    if (l.tipo === 'saida') {
      dailyDetails[dateKey].despesas += Number(l.valor);
    } else if (l.tipo === 'entrada' && l.agendamento_id === null) {
      const isProduct = l.produto_id !== null ||
        (l.categoria ?? '').toLowerCase().includes('produto') ||
        (l.descricao ?? '').toLowerCase().includes('produto');
      if (isProduct) dailyDetails[dateKey].produtos += Number(l.valor);
      else dailyDetails[dateKey].cortes += Number(l.valor);
    }
  }

  const dailyChartData = Object.keys(dailyDetails)
    .sort()
    .slice(isToday ? -100 : -20)
    .map(date => {
      const d = dailyDetails[date];
      const totalReceitas = d.cortes + d.produtos;
      const totalLucro = totalReceitas - d.despesas;
      return {
        data: date,
        total: Number(totalLucro.toFixed(2)),
        receitas: Number(totalReceitas.toFixed(2)),
        despesas: Number(d.despesas.toFixed(2)),
        lucro: Number(totalLucro.toFixed(2))
      };
    });

  // --- Quebra de faturamento por barbeiro no período ---
  // Receita de serviço vem dos agendamentos concluídos; entradas manuais
  // atribuídas somam junto. Produto e despesa da casa caem em "Barbearia".
  const { data: profs } = await client.from('profissionais')
    .select('id, nome').eq('barbeiro_id', barbeiroId).order('ordem');
  const nomePorId = new Map<string, string>((profs ?? []).map((p: any) => [p.id, p.nome]));

  const acc = new Map<string, { receita: number; atendimentos: number }>();
  const bump = (key: string, receita: number, atendeu: boolean) => {
    const cur = acc.get(key) ?? { receita: 0, atendimentos: 0 };
    cur.receita += receita;
    if (atendeu) cur.atendimentos += 1;
    acc.set(key, cur);
  };

  for (const a of completed) {
    bump(a.profissional_id ?? '__casa__', Number(a.preco_cobrado), true);
  }
  for (const l of lista) {
    if (l.tipo !== 'entrada' || l.agendamento_id !== null) continue;
    bump(l.profissional_id ?? '__casa__', Number(l.valor), false);
  }

  const porProfissional = [...acc.entries()]
    .map(([key, v]) => ({
      profissional_id: key === '__casa__' ? null : key,
      nome: key === '__casa__' ? 'Barbearia' : (nomePorId.get(key) ?? 'Barbeiro removido'),
      receita: Number(v.receita.toFixed(2)),
      atendimentos: v.atendimentos
    }))
    .sort((a, b) => b.receita - a.receita);

  return {
    faturamento,
    outrasEntradas,
    produtosVendidos: produtos,
    despesas,
    lucro,
    agendadosCount: agendadosCount ?? 0,
    concluidosCount: concluidosCount ?? 0,
    dailyChartData,
    porProfissional,
    history: lista.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')) as LancamentoFinanceiro[]
  };
}
// ---------- ADMIN: AGENDAMENTOS ----------
export async function listAgendamentosAdmin(
  barbeiroId: string,
  profissionalId?: string
): Promise<Agendamento[]> {
  await purgeOldAgendamentos(barbeiroId);
  const client = sb();
  if (!client) {
    const db = loadDB();
    return [...db.agendamentos].sort((a, b) => a.inicio_em.localeCompare(b.inicio_em));
  }
  let q = client
    .from('agendamentos')
    .select('*')
    .eq('barbeiro_id', barbeiroId);
  if (profissionalId) q = q.eq('profissional_id', profissionalId);
  const { data, error } = await q.order('inicio_em', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToAgendamento);
}

// ---------- ADMIN: SERVIÇOS CRUD ----------
export async function listAllServicosAdmin(barbeiroId: string): Promise<Servico[]> {
  const client = sb();
  if (!client) {
    const db = loadDB();
    return db.servicos.filter(s => s.barbeiro_id === barbeiroId).sort((a, b) => a.ordem - b.ordem);
  }
  const { data, error } = await client
    .from('servicos').select('*').eq('barbeiro_id', barbeiroId).order('ordem', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToServico);
}

export async function createServico(barbeiroId: string, payload: {
  nome: string; descricao?: string; preco: number; duracao_minutos: number; imagem_url?: string;
}): Promise<Servico> {
  const client = sb();
  if (!client) throw new Error('Supabase not configured');
  const maxOrdem = await client.from('servicos').select('ordem').eq('barbeiro_id', barbeiroId).order('ordem', { ascending: false }).limit(1);
  const nextOrdem = ((maxOrdem.data?.[0]?.ordem ?? 0) as number) + 1;
  const { data, error } = await client.from('servicos').insert({
    barbeiro_id: barbeiroId,
    nome: payload.nome,
    descricao: payload.descricao ?? '',
    preco: payload.preco,
    duracao_minutos: payload.duracao_minutos,
    imagem_url: payload.imagem_url ?? 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=500&auto=format&fit=crop&q=80',
    ativo: true,
    ordem: nextOrdem
  }).select('*').single();
  if (error || !data) throw error ?? new Error('Erro ao criar serviço');
  return rowToServico(data);
}

export async function updateServico(id: string, barbeiroId: string, patch: Partial<{
  nome: string; descricao: string; preco: number; duracao_minutos: number; imagem_url: string; ativo: boolean; ordem: number;
}>): Promise<Servico | null> {
  const client = sb();
  if (!client) return null;
  const { data, error } = await client.from('servicos')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id).eq('barbeiro_id', barbeiroId).select('*').single();
  if (error || !data) return null;
  return rowToServico(data);
}

// ---------- ADMIN: PRODUTOS CRUD ----------
export async function listAllProdutosAdmin(barbeiroId: string): Promise<Produto[]> {
  const client = sb();
  if (!client) {
    const db = loadDB();
    return db.produtos.filter(p => p.barbeiro_id === barbeiroId).sort((a, b) => a.ordem - b.ordem);
  }
  const { data, error } = await client
    .from('produtos').select('*').eq('barbeiro_id', barbeiroId).order('ordem', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToProduto);
}

export async function createProduto(barbeiroId: string, payload: {
  nome: string; descricao?: string; preco: number; estoque: number; imagem_url?: string;
}): Promise<Produto> {
  const client = sb();
  if (!client) throw new Error('Supabase not configured');
  const maxOrdem = await client.from('produtos').select('ordem').eq('barbeiro_id', barbeiroId).order('ordem', { ascending: false }).limit(1);
  const nextOrdem = ((maxOrdem.data?.[0]?.ordem ?? 0) as number) + 1;
  const { data, error } = await client.from('produtos').insert({
    barbeiro_id: barbeiroId,
    nome: payload.nome,
    descricao: payload.descricao ?? '',
    preco: payload.preco,
    estoque: payload.estoque,
    imagem_url: payload.imagem_url ?? 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=500&auto=format&fit=crop&q=80',
    ativo: true,
    ordem: nextOrdem
  }).select('*').single();
  if (error || !data) throw error ?? new Error('Erro ao criar produto');
  return rowToProduto(data);
}

export async function updateProduto(id: string, barbeiroId: string, patch: Partial<{
  nome: string; descricao: string; preco: number; estoque: number; imagem_url: string; ativo: boolean; ordem: number;
}>): Promise<Produto | null> {
  const client = sb();
  if (!client) return null;
  const { data, error } = await client.from('produtos')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id).eq('barbeiro_id', barbeiroId).select('*').single();
  if (error || !data) return null;
  return rowToProduto(data);
}

// ---------- ADMIN: CLIENTES CRUD ----------
function rowToCliente(r: any): Cliente {
  return {
    id: r.id,
    barbeiro_id: r.barbeiro_id,
    nome: r.nome,
    telefone: r.telefone ?? '',
    email: r.email ?? '',
    data_nascimento: r.data_nascimento ?? null,
    observacoes: r.observacoes ?? '',
    ativo: r.ativo,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

export async function listClientesAdmin(barbeiroId: string): Promise<Cliente[]> {
  const client = sb();
  if (!client) {
    const db = loadDB();
    return db.clientes.filter(c => c.ativo && c.barbeiro_id === barbeiroId);
  }
  const { data, error } = await client
    .from('clientes').select('*').eq('barbeiro_id', barbeiroId).eq('ativo', true).order('nome', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToCliente);
}

export async function createCliente(barbeiroId: string, payload: {
  nome: string; telefone: string; email?: string; data_nascimento?: string | null; observacoes?: string;
}): Promise<Cliente> {
  const client = sb();
  if (!client) throw new Error('Supabase not configured');
  const { data, error } = await client.from('clientes').insert({
    barbeiro_id: barbeiroId,
    nome: payload.nome,
    telefone: payload.telefone,
    email: payload.email ?? '',
    data_nascimento: payload.data_nascimento ?? null,
    observacoes: payload.observacoes ?? '',
    ativo: true
  }).select('*').single();
  if (error || !data) throw error ?? new Error('Erro ao criar cliente');
  return rowToCliente(data);
}

export async function updateCliente(id: string, barbeiroId: string, patch: Partial<{
  nome: string; telefone: string; email: string; data_nascimento: string | null; observacoes: string; ativo: boolean;
}>): Promise<Cliente | null> {
  const client = sb();
  if (!client) return null;
  const { data, error } = await client.from('clientes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id).eq('barbeiro_id', barbeiroId).select('*').single();
  // PGRST116 = "no rows returned" (linha não existe/não pertence a esse barbeiro) — é o único
  // caso que deve virar "não encontrado". Qualquer outro erro (ex: valor inválido pra uma
  // coluna) precisa estourar de verdade, senão vira um 404 enganoso.
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  if (!data) return null;
  return rowToCliente(data);
}

// ---------- ADMIN: EXPEDIENTES / BLOQUEIOS ----------
function rowToExpediente(r: any): Expediente {
  return {
    id: r.id,
    barbeiro_id: r.barbeiro_id,
    profissional_id: r.profissional_id,
    dia_semana: r.dia_semana,
    hora_inicio: typeof r.hora_inicio === 'string' ? r.hora_inicio.slice(0, 5) : r.hora_inicio,
    hora_fim: typeof r.hora_fim === 'string' ? r.hora_fim.slice(0, 5) : r.hora_fim,
    intervalo_inicio: typeof r.intervalo_inicio === 'string' ? r.intervalo_inicio.slice(0, 5) : r.intervalo_inicio,
    intervalo_fim: typeof r.intervalo_fim === 'string' ? r.intervalo_fim.slice(0, 5) : r.intervalo_fim,
    ativo: r.ativo,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

function rowToBloqueio(r: any): Bloqueio {
  return {
    id: r.id,
    barbeiro_id: r.barbeiro_id,
    profissional_id: r.profissional_id ?? null,
    data: r.data,
    hora_inicio: typeof r.hora_inicio === 'string' ? r.hora_inicio.slice(0, 5) : r.hora_inicio,
    hora_fim: typeof r.hora_fim === 'string' ? r.hora_fim.slice(0, 5) : r.hora_fim,
    motivo: r.motivo ?? '',
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

// ---------- ADMIN: PROFISSIONAIS (equipe) ----------
function rowToProfissional(r: any): Profissional {
  return {
    id: r.id,
    barbeiro_id: r.barbeiro_id,
    nome: r.nome,
    avatar_url: r.avatar_url ?? null,
    telefone: r.telefone ?? '',
    bio: r.bio ?? '',
    ativo: r.ativo,
    ordem: r.ordem ?? 0,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

// Usado pelo admin (todos) e pelo site público (só ativos, via slug)
export async function listProfissionais(
  barbeiroIdOrSlug: string,
  somenteAtivos = false
): Promise<Profissional[]> {
  const client = sb();
  if (!client) return [];
  const barbeiroId = await resolveBarbeiroId(barbeiroIdOrSlug);
  if (!barbeiroId) return [];
  let q = client.from('profissionais').select('*').eq('barbeiro_id', barbeiroId);
  if (somenteAtivos) q = q.eq('ativo', true);
  const { data, error } = await q.order('ordem', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToProfissional);
}

export async function createProfissional(barbeiroId: string, payload: {
  nome: string; telefone?: string; bio?: string; avatar_url?: string;
}): Promise<Profissional> {
  const client = sb();
  if (!client) throw new Error('Supabase not configured');

  const maxOrdem = await client.from('profissionais').select('ordem')
    .eq('barbeiro_id', barbeiroId).order('ordem', { ascending: false }).limit(1);
  const nextOrdem = ((maxOrdem.data?.[0]?.ordem ?? 0) as number) + 1;

  const { data, error } = await client.from('profissionais').insert({
    barbeiro_id: barbeiroId,
    nome: payload.nome,
    telefone: payload.telefone ?? '',
    bio: payload.bio ?? '',
    avatar_url: payload.avatar_url ?? null,
    ordem: nextOrdem
  }).select('*').single();
  if (error || !data) throw error ?? new Error('Erro ao criar barbeiro');

  // Sem expediente o barbeiro nunca aparece com horário livre — falha silenciosa
  // e confusa. Copia o expediente de quem já existe na barbearia, INCLUINDO
  // o intervalo de almoço.
  const { data: modelo } = await client.from('expedientes')
    .select('profissional_id, dia_semana, hora_inicio, hora_fim, intervalo_inicio, intervalo_fim, ativo')
    .eq('barbeiro_id', barbeiroId)
    .neq('profissional_id', data.id)
    .order('profissional_id')
    .order('dia_semana');

  if (modelo && modelo.length > 0) {
    const primeiro = modelo[0].profissional_id;
    const base = modelo.filter((e: any) => e.profissional_id === primeiro);
    await client.from('expedientes').insert(
      base.map((e: any) => ({
        barbeiro_id: barbeiroId,
        profissional_id: data.id,
        dia_semana: e.dia_semana,
        hora_inicio: e.hora_inicio,
        hora_fim: e.hora_fim,
        intervalo_inicio: e.intervalo_inicio,
        intervalo_fim: e.intervalo_fim,
        ativo: e.ativo
      }))
    );
  }

  return rowToProfissional(data);
}

export async function updateProfissional(id: string, barbeiroId: string, patch: Partial<{
  nome: string; telefone: string; bio: string; avatar_url: string | null; ativo: boolean; ordem: number;
}>): Promise<Profissional | null> {
  const client = sb();
  if (!client) return null;
  const { data, error } = await client.from('profissionais')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id).eq('barbeiro_id', barbeiroId)
    .select('*').single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  if (!data) return null;
  return rowToProfissional(data);
}

export async function listConfiguracoes(barbeiroId: string): Promise<{ expedientes: Expediente[]; bloqueios: Bloqueio[] }> {
  const client = sb();
  if (!client) throw new Error('Supabase not configured');
  const [{ data: exp, error: expErr }, { data: bloq, error: bloqErr }] = await Promise.all([
    client.from('expedientes').select('*').eq('barbeiro_id', barbeiroId).order('dia_semana', { ascending: true }),
    client.from('bloqueios').select('*').eq('barbeiro_id', barbeiroId).order('data', { ascending: true })
  ]);
  if (expErr) throw expErr;
  if (bloqErr) throw bloqErr;
  return {
    expedientes: (exp ?? []).map(rowToExpediente),
    bloqueios: (bloq ?? []).map(rowToBloqueio)
  };
}

export async function updateExpediente(id: string, barbeiroId: string, patch: Partial<{
  hora_inicio: string; hora_fim: string; intervalo_inicio: string | null; intervalo_fim: string | null; ativo: boolean;
}>): Promise<Expediente | null> {
  const client = sb();
  if (!client) return null;
  const { data, error } = await client.from('expedientes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id).eq('barbeiro_id', barbeiroId).select('*').single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  if (!data) return null;
  return rowToExpediente(data);
}

// profissionalId ausente = aplica a todos os barbeiros da barbearia
export async function applyDefaultInterval(
  barbeiroId: string,
  intervaloInicio: string | null,
  intervaloFim: string | null,
  profissionalId?: string
): Promise<void> {
  const client = sb();
  if (!client) throw new Error('Supabase not configured');
  let q = client.from('expedientes')
    .update({ intervalo_inicio: intervaloInicio, intervalo_fim: intervaloFim, updated_at: new Date().toISOString() })
    .eq('barbeiro_id', barbeiroId);
  if (profissionalId) q = q.eq('profissional_id', profissionalId);
  const { error } = await q;
  if (error) throw error;
}

// profissional_id null = feriado, fecha a barbearia toda
export async function createBloqueio(barbeiroId: string, payload: {
  data: string; hora_inicio?: string | null; hora_fim?: string | null; motivo: string;
  profissional_id?: string | null;
}): Promise<Bloqueio> {
  const client = sb();
  if (!client) throw new Error('Supabase not configured');

  // Bloqueio de um barbeiro específico só vale se ele for desta barbearia
  if (payload.profissional_id) {
    const { data: prof } = await client.from('profissionais').select('id')
      .eq('id', payload.profissional_id).eq('barbeiro_id', barbeiroId).maybeSingle();
    if (!prof) throw Object.assign(new Error('Barbeiro não encontrado.'), { status: 404 });
  }

  const { data, error } = await client.from('bloqueios').insert({
    barbeiro_id: barbeiroId,
    profissional_id: payload.profissional_id ?? null,
    data: payload.data,
    hora_inicio: payload.hora_inicio ?? null,
    hora_fim: payload.hora_fim ?? null,
    motivo: payload.motivo
  }).select('*').single();
  if (error || !data) throw error ?? new Error('Erro ao criar bloqueio');
  return rowToBloqueio(data);
}

export async function deleteBloqueio(id: string, barbeiroId: string): Promise<boolean> {
  const client = sb();
  if (!client) return false;
  const { error, count } = await client.from('bloqueios')
    .delete({ count: 'exact' })
    .eq('id', id).eq('barbeiro_id', barbeiroId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// ---------- ADMIN: CATEGORIAS FINANCEIRAS ----------
function rowToCategoria(r: any): CategoriaFinanceira {
  return {
    id: r.id,
    nome: r.nome,
    tipo: r.tipo,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

export async function listCategoriasFinanceiras(barbeiroId: string): Promise<CategoriaFinanceira[]> {
  const client = sb();
  if (!client) throw new Error('Supabase not configured');
  const { data, error } = await client.from('categorias_financeiras')
    .select('*').eq('barbeiro_id', barbeiroId).order('nome', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToCategoria);
}

export async function createCategoriaFinanceira(barbeiroId: string, nome: string, tipo: 'entrada' | 'saida'): Promise<CategoriaFinanceira> {
  const client = sb();
  if (!client) throw new Error('Supabase not configured');
  const { data, error } = await client.from('categorias_financeiras')
    .insert({ barbeiro_id: barbeiroId, nome, tipo })
    .select('*').single();
  if (error || !data) throw error ?? new Error('Erro ao criar categoria');
  return rowToCategoria(data);
}

export async function updateCategoriaFinanceira(id: string, barbeiroId: string, patch: Partial<{ nome: string; tipo: 'entrada' | 'saida' }>): Promise<CategoriaFinanceira | null> {
  const client = sb();
  if (!client) return null;
  const { data, error } = await client.from('categorias_financeiras')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id).eq('barbeiro_id', barbeiroId).select('*').single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  if (!data) return null;
  return rowToCategoria(data);
}

export async function deleteCategoriaFinanceira(id: string, barbeiroId: string): Promise<boolean> {
  const client = sb();
  if (!client) return false;
  const { error, count } = await client.from('categorias_financeiras')
    .delete({ count: 'exact' })
    .eq('id', id).eq('barbeiro_id', barbeiroId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function deleteCliente(id: string, barbeiroId: string): Promise<boolean> {
  const client = sb();
  if (!client) return false;
  // Soft delete: ativo = false
  const { error } = await client.from('clientes')
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq('id', id).eq('barbeiro_id', barbeiroId);
  return !error;
}
