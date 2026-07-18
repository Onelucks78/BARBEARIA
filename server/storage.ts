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
  Barbeiro, Servico, Produto, Cliente, Agendamento,
  DashboardStats, LancamentoFinanceiro
} from '../src/types.ts';

// ---------- HELPERS ----------
function sb(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return serviceClient() ?? anonClient();
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
  all: boolean = false
): Promise<{ horario: string; disponivel: boolean; motivo?: string }[]> {
  const client = sb();
  if (!client) {
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
    p_all: all
  });
  if (error) throw error;
  return (rows ?? []).map((r: any) => ({
    horario: typeof r.horario === 'string' ? r.horario.slice(0, 5) : r.horario,
    disponivel: r.disponivel,
    motivo: r.motivo ?? undefined
  }));
}

// ---------- HELPER DE ASSINATURA VIP ----------
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

export function isServiceEligibleForVip(nome: string): boolean {
  const n = nome.toLowerCase();
  const isSpecial = n.includes('pintura') || n.includes('selagem') || n.includes('progressiva') || n.includes('quimica') || n.includes('luzes') || n.includes('colora');
  const isEligible = n.includes('corte') || n.includes('cabelo') || n.includes('barba') || n.includes('sobrancelha');
  return isEligible && !isSpecial;
}

// ---------- CRIAÇÃO DE AGENDAMENTO ----------
export interface CreateBookingInput {
  servico_id: string;
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
    if (isVip && isServiceEligibleForVip(x.nome)) {
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
    if (agErr.code === '23P01') {
      throw Object.assign(new Error('Desculpe, este horário acabou de ser reservado. Escolha outro.'), { status: 400 });
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
        nome: input.nome || input.email.split('@')[0],
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
      nome: input.nome || input.email.split('@')[0],
      telefone: input.telefone || '',
      foto_url: input.foto_url || '',
      observacoes: input.observacoes || 'Cliente auto-cadastrado'
    }).select('*').single();
    if (error) throw error;
    return data as ClientProfile;
  }
}

// ---------- DASHBOARD ----------
export async function getDashboardStats(
  barbeiroId: string,
  startDate?: string,
  endDate?: string,
  isToday?: boolean
): Promise<DashboardStats | null> {
  const client = sb();
  if (!client) return null;

  // Busca agendamentos concluídos no intervalo
  let agQ = client.from('agendamentos').select('id, codigo, servico_id, inicio_em, status, preco_cobrado')
    .eq('barbeiro_id', barbeiroId).eq('status', 'concluido');
  if (startDate) agQ = agQ.gte('inicio_em', startDate);
  if (endDate) agQ = agQ.lte('inicio_em', endDate + 'T23:59:59');
  const { data: concluidos, error: agErr } = await agQ;
  if (agErr) throw agErr;

  // Lançamentos no intervalo
  let lfQ = client.from('lancamentos_financeiros').select('*')
    .eq('barbeiro_id', barbeiroId).eq('excluido', false);
  if (startDate) lfQ = lfQ.gte('data', startDate);
  if (endDate) lfQ = lfQ.lte('data', endDate);
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
  const { count: agendadosCount } = await client.from('agendamentos')
    .select('id', { count: 'exact', head: true })
    .eq('barbeiro_id', barbeiroId)
    .in('status', ['agendado', 'confirmado']);
  const { count: concluidosCount } = await client.from('agendamentos')
    .select('id', { count: 'exact', head: true })
    .eq('barbeiro_id', barbeiroId)
    .eq('status', 'concluido');

  return {
    faturamento,
    outrasEntradas,
    produtosVendidos: produtos,
    despesas,
    lucro,
    agendadosCount: agendadosCount ?? 0,
    concluidosCount: concluidosCount ?? 0,
    dailyChartData: [], // simplificado nesta migration; calculado em rota dedicada se precisar
    history: lista.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')) as LancamentoFinanceiro[]
  };
}
