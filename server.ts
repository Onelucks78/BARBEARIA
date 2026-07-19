import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: true });

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { 
  loadDB, 
  saveDB, 
  calculateAvailableSlots,
  calculateAllSlotsWithAvailability
} from './server/database.ts';
import {
  Agendamento,
  Cliente,
  Produto,
  Servico,
  Bloqueio,
  Expediente,
  LancamentoFinanceiro,
  DashboardStats
} from './src/types.ts';
import { attachUser, requireAdmin, AuthRequest } from './server/auth.ts';
import { isSupabaseConfigured, serviceClient, anonClient, setSupabaseOffline } from './server/supabase.ts';
import { validate } from './server/validation.ts';
import { schemas } from './server/schemas.ts';
import * as storage from './server/storage.ts';

// Authenticate middleware
// (substituído por server/auth.ts que verifica JWT real do Supabase)

async function startServer() {
  // Test connectivity
  if (isSupabaseConfigured()) {
    try {
      console.log('[Supabase] Testando conectividade...');
      const client = serviceClient() || anonClient();
      if (client) {
        // Testa consulta rápida
        const { error } = await client.from('barbeiros').select('id').limit(1);
        if (error) throw error;
        console.log('[Supabase] Conectado com sucesso!');
      }
    } catch (err: any) {
      console.warn('[Supabase] Conectividade indisponível. Ativando fallback local offline (db.json).');
      setSupabaseOffline(true);
    }
  }

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Anexa req.userId / req.barbeiroId / req.isAdmin a partir do JWT do Supabase.
  // Rotas públicas continuam funcionando porque o middleware só preenche req.*.
  app.use(attachUser);

  // --- HEALTH CHECK ---
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      supabaseOffline: !isSupabaseConfigured(),
      serverTime: new Date().toISOString() 
    });
  });

  // --- STRIPE WEBHOOK (MOCK / API) ---
  app.post('/api/stripe/webhook', async (req, res) => {
    try {
      const { customer_email, amount } = req.body;
      const valor = amount ? Number(amount) / 100 : 150.00;
      
      const db = loadDB();
      const firstBarber = db.barbeiros[0];
      const barbeiroId = firstBarber ? firstBarber.id : 'b-1';
      const splitDate = new Date().toISOString().split('T')[0];
      
      if (isSupabaseConfigured()) {
        const client = serviceClient();
        if (client) {
          const { data: barb } = await client.from('barbeiros').select('id').eq('ativo', true).limit(1).single();
          const targetBarbeiroId = barb ? barb.id : barbeiroId;
          
          const { error } = await client.from('lancamentos_financeiros').insert({
            barbeiro_id: targetBarbeiroId,
            tipo: 'entrada',
            descricao: customer_email ? `Assinatura Stripe: ${customer_email}` : 'Assinatura Stripe Recorrente (Confirmada)',
            valor,
            categoria: 'Plano',
            forma_pagamento: 'outro',
            data: splitDate
          });
          if (error) throw error;
        }
      } else {
        db.lancamentos_financeiros.push({
          id: `lf-stripe-${Date.now()}`,
          barbeiro_id: barbeiroId,
          tipo: 'entrada',
          descricao: customer_email ? `Assinatura Stripe: ${customer_email}` : 'Assinatura Stripe Recorrente (Confirmada)',
          valor,
          categoria: 'Plano',
          forma_pagamento: 'outro',
          agendamento_id: null,
          produto_id: null,
          data: splitDate,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        saveDB(db);
      }
      res.json({ received: true });
    } catch (err: any) {
      console.error('[Stripe Webhook Error]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- PUBLIC APIS: SITE GUEST FLOW ---

  // 1. Get Active Services
  app.get('/api/servicos', async (req, res) => {
    try {
      const slug = req.query.slug as string | undefined;
      const servicos = await storage.listActiveServicos(slug);
      res.json(servicos);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao buscar serviços.' });
    }
  });

  // 2. Get Active Products
  app.get('/api/produtos', async (req, res) => {
    try {
      const slug = req.query.slug as string | undefined;
      const produtos = await storage.listActiveProdutos(slug);
      res.json(produtos);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao buscar produtos.' });
    }
  });

  // 3. Get Calculate Free Slots/Hours
  // Query params: slug=barbearia, data=YYYY-MM-DD, servico_id=ID, all=true|false
  app.get('/api/horarios-livres', validate(schemas.freeSlotsQuery, 'query'), async (req, res) => {
    try {
      const { data, servico_id, all } = req.query as { data: string; servico_id: string; all?: string };
      // slug default = imperial (back-compat com db.json)
      const slug = (req.query.slug as string) || 'imperial';
      const slots = await storage.getAvailableSlots(slug, data, servico_id, all === 'true');
      res.json(slots);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao calcular horários disponíveis.' });
    }
  });

  // 4a. Get Public Bookings for a Logged Client
  app.get('/api/agendamentos/cliente', async (req, res) => {
    try {
      const { email, telefone } = req.query as { email?: string; telefone?: string };
      if (!email && !telefone) {
        return res.status(400).json({ error: 'Parâmetro email ou telefone é obrigatório.' });
      }
      const telefoneDigits = telefone ? telefone.replace(/\D/g, '') : undefined;
      const bookings = await storage.listClientBookings(email, telefoneDigits);
      res.json(bookings);
    } catch (error) {
      console.error('[GET /api/agendamentos/cliente]', error);
      res.status(500).json({ error: 'Erro ao buscar agendamentos do cliente.' });
    }
  });

  // 4b. Get Client Profile by Email
  app.get('/api/cliente/perfil', async (req, res) => {
    try {
      const { email } = req.query as { email?: string };
      if (!email) {
        return res.status(400).json({ error: 'Parâmetro email é obrigatório.' });
      }
      const profile = await storage.getClientProfile(email);
      if (profile) return res.json({ found: true, profile });
      return res.json({ found: false });
    } catch (error) {
      console.error('[GET /api/cliente/perfil]', error);
      res.status(500).json({ error: 'Erro ao buscar perfil do cliente.' });
    }
  });

  // 4c. Create or Update Client Profile
  app.post('/api/cliente/perfil', async (req, res) => {
    try {
      const { email, nome, telefone, foto_url, observacoes } = req.body as {
        email?: string; nome?: string; telefone?: string; foto_url?: string; observacoes?: string;
      };
      if (!email) {
        return res.status(400).json({ error: 'Parâmetro email é obrigatório.' });
      }
      const profile = await storage.upsertClientProfile({
        email,
        nome,
        telefone: telefone ? telefone.replace(/\D/g, '') : undefined,
        foto_url,
        observacoes
      });
      res.json({ success: true, profile });
    } catch (error) {
      console.error('[POST /api/cliente/perfil]', error);
      res.status(500).json({ error: 'Erro ao salvar perfil do cliente.' });
    }
  });

  // 4. Create Booking from Guest/Client Flow
  app.post('/api/agendamentos', validate(schemas.createBooking), async (req, res) => {
    try {
      const body = req.body as {
        servico_id: string;
        data: string;
        horario: string;
        nome_cliente: string;
        telefone_cliente: string;
        observacao?: string;
        cliente_id?: string;
        cliente_email?: string;
      };
      const slug = (req.query.slug as string) || 'imperial';

      if (isSupabaseConfigured()) {
        // Caminho novo: Supabase (EXCLUDE constraint + trigger financeiro)
        try {
          const novo = await storage.createBooking(slug, body);
          return res.status(201).json(novo);
        } catch (err: any) {
          console.error('[POST /api/agendamentos]', err);
          const status = err.status || 500;
          return res.status(status).json({
            error: err.message || 'Erro ao registrar agendamento.',
            details: err.details || err.hint || undefined
          });
        }
      }

      // Caminho dev/preview: db.json
      const db = loadDB();
      const ids = body.servico_id.includes(',') ? body.servico_id.split(',') : [body.servico_id];
      const selected_servicos = db.servicos.filter(s => ids.includes(s.id) && s.ativo);
      if (selected_servicos.length === 0) {
        return res.status(404).json({ error: 'Nenhum serviço encontrado/ativo.' });
      }

      // Check if client is VIP
      let isVip = false;
      const emailToMatch = body.cliente_email || (body.cliente_id && body.cliente_id.includes('@') ? body.cliente_id : null);
      if (emailToMatch) {
        const existing = db.clientes.find(c => c.email && c.email.toLowerCase() === emailToMatch.toLowerCase());
        if (existing && storage.isClientVip(existing.observacoes)) {
          isVip = true;
        }
      } else if (body.cliente_id) {
        const existing = db.clientes.find(c => c.id === body.cliente_id);
        if (existing && storage.isClientVip(existing.observacoes)) {
          isVip = true;
        }
      }

      const totalPreco = selected_servicos.reduce((sum, s) => {
        if (isVip && storage.isServiceEligibleForVip(s.nome)) {
          return sum + 0;
        }
        return sum + s.preco;
      }, 0);
      const totalDuracao = selected_servicos.reduce((sum, s) => sum + s.duracao_minutos, 0);

      const inicio_em = `${body.data}T${body.horario}:00`;
      const [h, m] = body.horario.split(':').map(Number);
      const fimMin = h * 60 + m + totalDuracao;
      const fimHhmm = `${String(Math.floor(fimMin/60)).padStart(2,'0')}:${String(fimMin%60).padStart(2,'0')}`;
      const fim_em = `${body.data}T${fimHhmm}:00`;

      const slots = calculateAvailableSlots(body.data, body.servico_id);
      if (!slots.includes(body.horario)) {
        return res.status(400).json({ error: 'Desculpe, este horário acabou de ser reservado.' });
      }

      let resolvedClienteId: string | null = body.cliente_id || null;
      if (emailToMatch) {
        const existing = db.clientes.find(c => c.email && c.email.toLowerCase() === emailToMatch.toLowerCase());
        if (existing) {
          resolvedClienteId = existing.id;
          if (!existing.telefone && body.telefone_cliente) existing.telefone = body.telefone_cliente;
        } else {
          const novoCliente: Cliente = {
            id: `c-auto-${Date.now()}`,
            barbeiro_id: 'b-1',
            nome: body.nome_cliente,
            telefone: body.telefone_cliente,
            email: emailToMatch,
            data_nascimento: null,
            observacoes: 'Cliente auto-cadastrado via agendamento',
            ativo: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          db.clientes.push(novoCliente);
          resolvedClienteId = novoCliente.id;
        }
      }

      let highestNum = 0;
      db.agendamentos.forEach(a => {
        if (a.id && a.id.startsWith('#')) {
          const num = parseInt(a.id.slice(1), 10);
          if (!isNaN(num) && num > highestNum) highestNum = num;
        }
      });
      const bookingCodeId = `#${String(highestNum + 1).padStart(6, '0')}`;

      const novoAgendamento: Agendamento = {
        id: bookingCodeId,
        barbeiro_id: 'b-1',
        servico_id: body.servico_id,
        cliente_id: resolvedClienteId,
        nome_cliente: body.nome_cliente,
        telefone_cliente: body.telefone_cliente,
        inicio_em, fim_em,
        status: 'agendado',
        preco_cobrado: totalPreco,
        observacao: body.observacao || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.agendamentos.push(novoAgendamento);
      saveDB(db);
      res.status(201).json(novoAgendamento);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao registrar agendamento.' });
    }
  });

  // Cancel booking from client dashboard
  app.post('/api/agendamentos/:id/cancelar', async (req, res) => {
    try {
      const { id } = req.params;

      if (isSupabaseConfigured()) {
        let uuid = id;
        if (id.startsWith('#')) {
          const svc = serviceClient();
          const { data: row } = await svc!.from('agendamentos').select('id').eq('codigo', id).single();
          if (!row) return res.status(404).json({ error: 'Agendamento não encontrado.' });
          uuid = row.id;
        }
        const updated = await storage.updateBookingStatus(uuid, { status: 'cancelado' });
        if (!updated) return res.status(404).json({ error: 'Agendamento não encontrado.' });
        return res.json(updated);
      }

      // Fallback db.json
      const db = loadDB();
      const idx = db.agendamentos.findIndex(a => a.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Agendamento não encontrado.' });
      const original = db.agendamentos[idx];
      original.status = 'cancelado';
      original.updated_at = new Date().toISOString();
      saveDB(db);
      res.json(original);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao cancelar agendamento.' });
    }
  });

  // 5. Get Barber Public Info
  app.get('/api/public-info', async (req, res) => {
    try {
      const slug = (req.query.slug as string) || 'imperial';
      const barber = await storage.getBarbeiroBySlug(slug);
      if (!barber) return res.status(404).json({ error: 'Barbearia não encontrada.' });
      res.json({
        nome: barber.nome,
        nome_barbearia: barber.nome_barbearia,
        bio: barber.bio,
        avatar_url: barber.avatar_url,
        telefone: barber.telefone,
        email: barber.email,
        slug: barber.slug
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao buscar informações.' });
    }
  });


  // --- ADMIN AUTH ROUTE ---
  // O admin se autentica via Google OAuth no front (Supabase Auth).
  // Este endpoint valida o JWT e devolve os dados do barbeiro.
  // Se Supabase não estiver configurado (modo dev), aceita qualquer e-mail
  // e devolve o barbeiro de seed — preserva o fluxo de preview do AI Studio.
  app.post('/api/auth/login', async (req: AuthRequest, res) => {
    try {
      const { email } = req.body as { email?: string };
      if (!email) {
        return res.status(400).json({ error: 'Email é obrigatório.' });
      }

      // Em produção, o front já mandou o JWT no header Authorization e
      // attachUser preencheu req.userId. Aqui só retornamos o barbeiro.
      const db = loadDB();
      const barber = db.barbeiros[0];
      barber.ultimo_acesso_em = new Date().toISOString();
      saveDB(db);

      return res.json({
        barbeiro: {
          id: barber.id,
          nome: barber.nome,
          email: barber.email,
          avatar_url: barber.avatar_url,
          nome_barbearia: barber.nome_barbearia
        },
        supabase_configured: isSupabaseConfigured()
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro na autenticação.' });
    }
  });


  // --- SECURE ADMIN APIS (Requires Bearer ADMIN_TOKEN) ---

  // 1. Get Dashboard Financial Summary and Charts
  // Query param: period = 'all' | 'last_30_days' | 'this_month' | 'today'
  app.get('/api/admin/dashboard', requireAdmin, validate(schemas.dashboardQuery, 'query'), async (req: AuthRequest, res) => {
    try {
      const { start_date, end_date, is_today } = req.query as { start_date?: string; end_date?: string; is_today?: string };

      if (isSupabaseConfigured() && req.barbeiroId) {
        const stats = await storage.getDashboardStats(
          req.barbeiroId,
          start_date,
          end_date,
          is_today === 'true'
        );
        if (stats) return res.json(stats);
      }

      // Caminho dev/preview: db.json
      const db = loadDB();

      // Determine date range filters
      let filterStart = start_date ? new Date(start_date as string) : null;
      let filterEnd = end_date ? new Date(end_date as string) : null;

      // Completed cutting schedules
      const completedAgendamentos = db.agendamentos.filter(a => {
        if (a.status !== 'concluido') return false;
        if (filterStart || filterEnd) {
          const apptDate = new Date(a.inicio_em);
          if (filterStart && apptDate < filterStart) return false;
          if (filterEnd && apptDate > filterEnd) return false;
        }
        return true;
      });

      // Other financial launches (entradas / saídas)
      const lancamentosFiltered = db.lancamentos_financeiros.filter(l => {
        if (l.excluido) return false;
        if (filterStart || filterEnd) {
          const lDate = new Date(l.data + 'T12:00:00');
          if (filterStart && lDate < filterStart) return false;
          if (filterEnd && lDate > filterEnd) return false;
        }
        return true;
      });

      // Calculate totals accurately across categories
      const completedCutsBookingSum = completedAgendamentos.reduce((sum, a) => sum + a.preco_cobrado, 0);
      let cutsManualSum = 0;
      let produtosSum = 0;
      let despesasSum = 0;
      let outrasEntradasSum = 0;

      lancamentosFiltered.forEach(l => {
        if (l.tipo === 'saida') {
          despesasSum += l.valor;
        } else if (l.tipo === 'entrada') {
          if (l.agendamento_id === null) {
            const isProduct = l.produto_id !== null || 
                             l.categoria === 'Produtos' || 
                             l.categoria === 'Venda de Produtos' || 
                             l.categoria === 'Venda de Produto' || 
                             l.categoria.toLowerCase().includes('produto') ||
                             l.descricao.toLowerCase().includes('produto');

            if (isProduct) {
              produtosSum += l.valor;
            } else if (l.categoria === 'Plano') {
              outrasEntradasSum += l.valor;
            } else {
              cutsManualSum += l.valor;
            }
          }
        }
      });

      const faturamento = completedCutsBookingSum + cutsManualSum;
      const produtosVendidos = produtosSum;
      const outrasEntradas = outrasEntradasSum;
      const despesas = despesasSum;
      const lucro = (faturamento + produtosVendidos + outrasEntradas) - despesas;

      // Group completed bookings + other input launches by day (or hour if today filter is selected) for charts with advanced details
      const isTodayFilter = req.query.is_today === 'true' || 
                            (start_date && end_date && (start_date as string).split('T')[0] === (end_date as string).split('T')[0]);

      const dailyDetails: Record<string, { cortes: number; produtos: number; outras: number; despesas: number }> = {};
      
      const hourlyKeys = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];
      
      if (isTodayFilter) {
        hourlyKeys.forEach(h => {
          dailyDetails[h] = { cortes: 0, produtos: 0, outras: 0, despesas: 0 };
        });
      }

      const getHourKey = (isoOrTimeText: string) => {
        if (!isoOrTimeText) return '12:00';
        try {
          const d = new Date(isoOrTimeText);
          if (isNaN(d.getTime())) return '12:00';
          const localHour = new Date(d.getTime() - d.getTimezoneOffset() * 60000).getUTCHours();
          return `${String(localHour).padStart(2, '0')}:00`;
        } catch {
          return '12:00';
        }
      };

      completedAgendamentos.forEach(a => {
        const dateKey = isTodayFilter ? getHourKey(a.inicio_em) : a.inicio_em.split('T')[0];
        if (!dailyDetails[dateKey]) {
          dailyDetails[dateKey] = { cortes: 0, produtos: 0, outras: 0, despesas: 0 };
        }
        dailyDetails[dateKey].cortes += a.preco_cobrado;
      });

      lancamentosFiltered.forEach(l => {
        const dateKey = isTodayFilter ? (l.created_at ? getHourKey(l.created_at) : '12:00') : l.data;
        if (!dailyDetails[dateKey]) {
          dailyDetails[dateKey] = { cortes: 0, produtos: 0, outras: 0, despesas: 0 };
        }
        if (l.tipo === 'saida') {
          dailyDetails[dateKey].despesas += l.valor;
        } else if (l.tipo === 'entrada') {
          if (l.agendamento_id === null) {
            const isProduct = l.produto_id !== null || 
                             l.categoria === 'Produtos' || 
                             l.categoria === 'Venda de Produtos' || 
                             l.categoria === 'Venda de Produto' || 
                             l.categoria.toLowerCase().includes('produto') ||
                             l.descricao.toLowerCase().includes('produto');

            if (isProduct) {
              dailyDetails[dateKey].produtos += l.valor;
            } else {
              dailyDetails[dateKey].cortes += l.valor;
            }
          }
        }
      });

      // Convert daily map to ordered chart data array
      const dailyChartData = Object.keys(dailyDetails)
        .sort()
        .slice(isTodayFilter ? -100 : -20) // Keep all standard hours if today's filter, otherwise last 20 days
        .map(date => {
          const d = dailyDetails[date];
          const totalLucro = (d.cortes + d.produtos) - d.despesas;
          const totalReceitas = d.cortes + d.produtos; // Yellow line = cuts + products
          return {
            data: date,
            total: Number(totalLucro.toFixed(2)),
            receitas: Number(totalReceitas.toFixed(2)),
            despesas: Number(d.despesas.toFixed(2)),
            lucro: Number(totalLucro.toFixed(2))
          };
        });

      // Counts of active agendamentos
      const agendadosCount = db.agendamentos.filter(a => a.status === 'agendado' || a.status === 'confirmado').length;
      const concluidosCount = db.agendamentos.filter(a => a.status === 'concluido').length;

      // Return unified dashboard stats
      const stats: DashboardStats = {
        faturamento,
        outrasEntradas,
        produtosVendidos,
        despesas,
        lucro,
        agendadosCount,
        concluidosCount,
        dailyChartData,
        history: lancamentosFiltered.sort((a, b) => b.created_at.localeCompare(a.created_at))
      };

      res.json(stats);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao processar dados do dashboard.' });
    }
  });

  // 2. Agenda List with Status Controls
  app.get('/api/admin/agendamentos', requireAdmin, async (req: AuthRequest, res) => {
    try {
      if (isSupabaseConfigured() && req.barbeiroId) {
        const list = await storage.listAgendamentosAdmin(req.barbeiroId);
        return res.json(list);
      }
      const db = loadDB();
      const list = [...db.agendamentos].sort((a,b) => a.inicio_em.localeCompare(b.inicio_em));
      res.json(list);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao carregar agendamentos.' });
    }
  });

  // Patch booking (especially changing status e.g., concluido/confirmado/cancelado/faltou, linking client)
  app.patch('/api/admin/agendamentos/:id', requireAdmin, validate(schemas.patchBooking), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const patch = req.body;

      // Caminho Supabase: trigger cria/remove lançamento automaticamente
      if (isSupabaseConfigured()) {
        // id pode ser o código "#000001" — busca o uuid real
        let uuid = id;
        if (id.startsWith('#')) {
          const svc = serviceClient();
          const { data: row } = await svc!.from('agendamentos').select('id').eq('codigo', id).single();
          if (!row) return res.status(404).json({ error: 'Agendamento não encontrado.' });
          uuid = row.id;
        }
        const updated = await storage.updateBookingStatus(uuid, patch);
        if (!updated) return res.status(404).json({ error: 'Agendamento não encontrado.' });
        return res.json(updated);
      }

      // Caminho dev: db.json
      const db = loadDB();
      const idx = db.agendamentos.findIndex(a => a.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Agendamento não encontrado.' });
      const original = db.agendamentos[idx];
      const previousStatus = original.status;

      if (patch.status) original.status = patch.status;
      if (patch.cliente_id !== undefined) original.cliente_id = patch.cliente_id;
      if (patch.observacao !== undefined) original.observacao = patch.observacao;
      original.updated_at = new Date().toISOString();

      if (patch.status === 'concluido' && previousStatus !== 'concluido') {
        const exists = db.lancamentos_financeiros.find(l => l.agendamento_id === id);
        if (!exists) {
          const srv = db.servicos.find(s => s.id === original.servico_id);
          const splitDate = original.inicio_em.split('T')[0];
          db.lancamentos_financeiros.push({
            id: `lf-auto-${Date.now()}`,
            barbeiro_id: 'b-1',
            tipo: 'entrada',
            descricao: `${srv ? srv.nome : 'Serviço de Corte'} - Cliente: ${original.nome_cliente}`,
            valor: original.preco_cobrado,
            categoria: 'Serviço de Corte',
            forma_pagamento: 'pix',
            agendamento_id: id,
            produto_id: null,
            data: splitDate,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }
      if (previousStatus === 'concluido' && patch.status && patch.status !== 'concluido') {
        db.lancamentos_financeiros = db.lancamentos_financeiros.filter(l => l.agendamento_id !== id);
      }
      saveDB(db);
      res.json(original);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao atualizar agendamento.' });
    }
  });


  // 3. SERVICES CRUD (Prevent actual deleting, just flip active flag / deativar)
  app.get('/api/admin/servicos', requireAdmin, async (req: AuthRequest, res) => {
    try {
      if (isSupabaseConfigured() && req.barbeiroId) {
        const list = await storage.listAllServicosAdmin(req.barbeiroId);
        return res.json(list);
      }
      const db = loadDB();
      res.json(db.servicos.sort((a,b) => a.ordem - b.ordem));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao listar serviços.' });
    }
  });

  app.post('/api/admin/servicos', requireAdmin, validate(schemas.createService), async (req: AuthRequest, res) => {
    try {
      const { nome, descricao, preco, duracao_minutos, imagem_url } = req.body;
      if (!nome || !preco || !duracao_minutos) {
        return res.status(400).json({ error: 'Nome, preço e duração são obrigatórios.' });
      }

      if (isSupabaseConfigured() && req.barbeiroId) {
        const novo = await storage.createServico(req.barbeiroId, { nome, descricao, preco: Number(preco), duracao_minutos: Number(duracao_minutos), imagem_url });
        return res.status(201).json(novo);
      }

      const db = loadDB();
      const novoServico: Servico = {
        id: `s-${Date.now()}`,
        barbeiro_id: 'b-1',
        nome,
        descricao: descricao || '',
        preco: Number(preco),
        duracao_minutos: Number(duracao_minutos),
        imagem_url: imagem_url || 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=500&auto=format&fit=crop&q=80',
        ativo: true,
        ordem: db.servicos.length + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.servicos.push(novoServico);
      saveDB(db);
      res.status(201).json(novoServico);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao criar serviço.' });
    }
  });

  app.patch('/api/admin/servicos/:id', requireAdmin, validate(schemas.patchService), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { nome, descricao, preco, duracao_minutos, imagem_url, ativo, ordem } = req.body;

      if (isSupabaseConfigured() && req.barbeiroId) {
        const updated = await storage.updateServico(id, req.barbeiroId, {
          ...(nome !== undefined && { nome }),
          ...(descricao !== undefined && { descricao }),
          ...(preco !== undefined && { preco: Number(preco) }),
          ...(duracao_minutos !== undefined && { duracao_minutos: Number(duracao_minutos) }),
          ...(imagem_url !== undefined && { imagem_url }),
          ...(ativo !== undefined && { ativo: Boolean(ativo) }),
          ...(ordem !== undefined && { ordem: Number(ordem) })
        });
        if (!updated) return res.status(404).json({ error: 'Serviço não encontrado.' });
        return res.json(updated);
      }

      const db = loadDB();
      const item = db.servicos.find(s => s.id === id);
      if (!item) return res.status(404).json({ error: 'Serviço não encontrado.' });
      if (nome !== undefined) item.nome = nome;
      if (descricao !== undefined) item.descricao = descricao;
      if (preco !== undefined) item.preco = Number(preco);
      if (duracao_minutos !== undefined) item.duracao_minutos = Number(duracao_minutos);
      if (imagem_url !== undefined) item.imagem_url = imagem_url;
      if (ativo !== undefined) item.ativo = Boolean(ativo);
      if (ordem !== undefined) item.ordem = Number(ordem);
      item.updated_at = new Date().toISOString();
      saveDB(db);
      res.json(item);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao atualizar serviço.' });
    }
  });

  // 4. PRODUCTS CRUD
  app.get('/api/admin/produtos', requireAdmin, async (req: AuthRequest, res) => {
    try {
      if (isSupabaseConfigured() && req.barbeiroId) {
        const list = await storage.listAllProdutosAdmin(req.barbeiroId);
        return res.json(list);
      }
      const db = loadDB();
      res.json(db.produtos.sort((a,b) => a.ordem - b.ordem));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao listar produtos.' });
    }
  });

  app.post('/api/admin/produtos', requireAdmin, validate(schemas.createProduct), async (req: AuthRequest, res) => {
    try {
      const { nome, descricao, preco, estoque, imagem_url } = req.body;
      if (!nome || !preco || estoque === undefined) {
        return res.status(400).json({ error: 'Nome, preço e estoque são obrigatórios.' });
      }

      if (isSupabaseConfigured() && req.barbeiroId) {
        const novo = await storage.createProduto(req.barbeiroId, { nome, descricao, preco: Number(preco), estoque: Number(estoque), imagem_url });
        return res.status(201).json(novo);
      }

      const db = loadDB();
      const novo: Produto = {
        id: `p-${Date.now()}`,
        barbeiro_id: 'b-1',
        nome,
        descricao: descricao || '',
        preco: Number(preco),
        estoque: Number(estoque),
        imagem_url: imagem_url || 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=500&auto=format&fit=crop&q=80',
        ativo: true,
        ordem: db.produtos.length + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.produtos.push(novo);
      saveDB(db);
      res.status(201).json(novo);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao criar produto.' });
    }
  });

  app.patch('/api/admin/produtos/:id', requireAdmin, validate(schemas.patchProduct), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { nome, descricao, preco, estoque, imagem_url, ativo, ordem } = req.body;

      if (isSupabaseConfigured() && req.barbeiroId) {
        const updated = await storage.updateProduto(id, req.barbeiroId, {
          ...(nome !== undefined && { nome }),
          ...(descricao !== undefined && { descricao }),
          ...(preco !== undefined && { preco: Number(preco) }),
          ...(estoque !== undefined && { estoque: Number(estoque) }),
          ...(imagem_url !== undefined && { imagem_url }),
          ...(ativo !== undefined && { ativo: Boolean(ativo) }),
          ...(ordem !== undefined && { ordem: Number(ordem) })
        });
        if (!updated) return res.status(404).json({ error: 'Produto não encontrado.' });
        return res.json(updated);
      }

      const db = loadDB();
      const item = db.produtos.find(p => p.id === id);
      if (!item) return res.status(404).json({ error: 'Produto não encontrado.' });
      if (nome !== undefined) item.nome = nome;
      if (descricao !== undefined) item.descricao = descricao;
      if (preco !== undefined) item.preco = Number(preco);
      if (estoque !== undefined) item.estoque = Number(estoque);
      if (imagem_url !== undefined) item.imagem_url = imagem_url;
      if (ativo !== undefined) item.ativo = Boolean(ativo);
      if (ordem !== undefined) item.ordem = Number(ordem);
      item.updated_at = new Date().toISOString();
      saveDB(db);
      res.json(item);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao atualizar produto.' });
    }
  });


  // 5. CLIENTS CRUD (Manual insert and details observations)
  app.get('/api/admin/clientes', requireAdmin, async (req: AuthRequest, res) => {
    try {
      if (isSupabaseConfigured() && req.barbeiroId) {
        const list = await storage.listClientesAdmin(req.barbeiroId);
        return res.json(list);
      }
      const db = loadDB();
      res.json(db.clientes.filter(c => c.ativo));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao listar clientes.' });
    }
  });

  app.post('/api/admin/clientes', requireAdmin, validate(schemas.createClient), async (req: AuthRequest, res) => {
    try {
      const { nome, telefone, email, data_nascimento, observacoes } = req.body;
      if (!nome || !telefone) {
        return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
      }

      if (isSupabaseConfigured() && req.barbeiroId) {
        const novo = await storage.createCliente(req.barbeiroId, { nome, telefone, email, data_nascimento, observacoes });
        return res.status(201).json(novo);
      }

      const db = loadDB();
      const novo: Cliente = {
        id: `c-${Date.now()}`,
        barbeiro_id: 'b-1',
        nome, telefone,
        email: email || '',
        data_nascimento: data_nascimento || null,
        observacoes: observacoes || '',
        ativo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.clientes.push(novo);
      saveDB(db);
      res.status(201).json(novo);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao criar cliente.' });
    }
  });

  app.patch('/api/admin/clientes/:id', requireAdmin, validate(schemas.patchClient), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { nome, telefone, email, data_nascimento, observacoes, ativo } = req.body;

      if (isSupabaseConfigured() && req.barbeiroId) {
        const updated = await storage.updateCliente(id, req.barbeiroId, {
          ...(nome !== undefined && { nome }),
          ...(telefone !== undefined && { telefone }),
          ...(email !== undefined && { email }),
          ...(data_nascimento !== undefined && { data_nascimento }),
          ...(observacoes !== undefined && { observacoes }),
          ...(ativo !== undefined && { ativo: Boolean(ativo) })
        });
        if (!updated) return res.status(404).json({ error: 'Cliente não encontrado.' });
        return res.json(updated);
      }

      const db = loadDB();
      const item = db.clientes.find(c => c.id === id);
      if (!item) return res.status(404).json({ error: 'Cliente não encontrado.' });
      if (nome !== undefined) item.nome = nome;
      if (telefone !== undefined) item.telefone = telefone;
      if (email !== undefined) item.email = email;
      if (data_nascimento !== undefined) item.data_nascimento = data_nascimento;
      if (observacoes !== undefined) item.observacoes = observacoes;
      if (ativo !== undefined) item.ativo = Boolean(ativo);
      item.updated_at = new Date().toISOString();
      saveDB(db);
      res.json(item);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao atualizar cliente.' });
    }
  });

  app.delete('/api/admin/clientes/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      if (isSupabaseConfigured() && req.barbeiroId) {
        const ok = await storage.deleteCliente(id, req.barbeiroId);
        if (!ok) return res.status(404).json({ error: 'Cliente não encontrado.' });
        return res.json({ success: true, message: 'Cliente arquivado com sucesso.' });
      }

      const db = loadDB();
      const index = db.clientes.findIndex(c => c.id === id);
      if (index === -1) return res.status(404).json({ error: 'Cliente não encontrado.' });
      db.clientes.splice(index, 1);
      saveDB(db);
      res.json({ success: true, message: 'Cliente deletado com sucesso.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao deletar cliente.' });
    }
  });


  // 6. FINANCE CRUD
  app.get('/api/admin/financeiro', requireAdmin, async (req: AuthRequest, res) => {
    try {
      if (isSupabaseConfigured() && req.barbeiroId) {
        const list = await storage.listLancamentos(req.barbeiroId);
        if (list) return res.json(list);
      }
      const db = loadDB();
      // Return sorted by date decending
      res.json(db.lancamentos_financeiros.sort((a,b) => b.data.localeCompare(a.data)));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao carregar lançamentos.' });
    }
  });

  app.post('/api/admin/financeiro', requireAdmin, validate(schemas.createLancamento), async (req: AuthRequest, res) => {
    try {
      let { tipo, descricao, valor, categoria, forma_pagamento, data, produto_id } = req.body;
      if (!tipo || !valor || !forma_pagamento || !data) {
        return res.status(400).json({ error: 'Tipo, valor, forma de pagamento e data são obrigatórios.' });
      }

      if (!descricao || !descricao.trim()) {
        descricao = tipo === 'entrada' ? 'entrada' : 'saída';
      }

      if (Number(valor) < 0) {
        return res.status(400).json({ error: 'O valor do lançamento deve ser positivo. O tipo (entrada/saida) ditará a operação.' });
      }

      if (isSupabaseConfigured() && req.barbeiroId) {
        const novo = await storage.createLancamento(req.barbeiroId, {
          tipo, descricao, valor: Number(valor), categoria, forma_pagamento, data, produto_id
        });
        if (novo) return res.status(201).json(novo);
      }

      const db = loadDB();

      // If product_id is associated (product sales manually entered), deduct stock by 1
      if (tipo === 'entrada' && produto_id) {
        const prod = db.produtos.find(p => p.id === produto_id);
        if (prod && prod.estoque > 0) {
          prod.estoque -= 1;
        }
      }

      const novo: LancamentoFinanceiro = {
        id: `lf-${Date.now()}`,
        barbeiro_id: 'b-1',
        tipo,
        descricao,
        valor: Number(valor),
        categoria: categoria || 'Serviços',
        forma_pagamento,
        agendamento_id: null,
        produto_id: produto_id || null,
        data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      db.lancamentos_financeiros.push(novo);
      saveDB(db);
      res.status(201).json(novo);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao registrar movimentação financeira.' });
    }
  });

  // Soft-delete/Exclude financial transaction
  app.delete('/api/admin/financeiro/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      if (isSupabaseConfigured() && req.barbeiroId) {
        const item = await storage.excluirLancamento(req.barbeiroId, id);
        if (item) return res.json({ success: true, message: 'Lançamento marcado como excluído.', item });
      }

      const db = loadDB();
      const index = db.lancamentos_financeiros.findIndex(l => l.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Lançamento não encontrado.' });
      }
      db.lancamentos_financeiros[index].excluido = true;
      db.lancamentos_financeiros[index].updated_at = new Date().toISOString();
      saveDB(db);
      res.json({ success: true, message: 'Lançamento marcado como excluído.', item: db.lancamentos_financeiros[index] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao excluir movimentação.' });
    }
  });

  // Update financial transaction
  app.patch('/api/admin/financeiro/:id', requireAdmin, validate(schemas.patchLancamento), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { tipo, descricao, valor, categoria, forma_pagamento, data } = req.body;

      if (isSupabaseConfigured() && req.barbeiroId) {
        const item = await storage.patchLancamento(req.barbeiroId, id, {
          tipo, descricao, valor: valor !== undefined ? Number(valor) : undefined, categoria, forma_pagamento, data
        });
        if (item) return res.json(item);
      }

      const db = loadDB();
      const index = db.lancamentos_financeiros.findIndex(l => l.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Lançamento não encontrado.' });
      }
      const item = db.lancamentos_financeiros[index];
      if (tipo !== undefined) item.tipo = tipo;
      if (descricao !== undefined) {
        const itemTipo = tipo || item.tipo;
        item.descricao = descricao.trim() || (itemTipo === 'entrada' ? 'entrada' : 'saída');
      }
      if (valor !== undefined) item.valor = Number(valor);
      if (categoria !== undefined) item.categoria = categoria;
      if (forma_pagamento !== undefined) item.forma_pagamento = forma_pagamento;
      if (data !== undefined) item.data = data;
      item.updated_at = new Date().toISOString();

      saveDB(db);
      res.json(item);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao atualizar movimentação.' });
    }
  });

  // --- FINANCIAL CATEGORIES CRUD ---
  // Get all categories
  app.get('/api/admin/categorias-financeiras', requireAdmin, (req, res) => {
    try {
      const db = loadDB();
      res.json(db.categorias_financeiras || []);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao buscar categorias financeiras.' });
    }
  });

  // Create a category
  app.post('/api/admin/categorias-financeiras', requireAdmin, validate(schemas.createCategoria), (req, res) => {
    try {
      const { nome, tipo } = req.body;
      if (!nome || !tipo) {
        return res.status(400).json({ error: 'Nome e tipo são obrigatórios.' });
      }
      if (tipo !== 'entrada' && tipo !== 'saida') {
        return res.status(400).json({ error: 'Tipo inválido. Deve ser entrada ou saida.' });
      }

      const db = loadDB();
      // Avoid duplicate names for same type
      const exists = db.categorias_financeiras.some(c => 
        c.nome.toLowerCase() === nome.toLowerCase() && c.tipo === tipo
      );
      if (exists) {
        return res.status(400).json({ error: 'Já existe uma categoria com este nome para este tipo.' });
      }

      const nova = {
        id: `cat-${Date.now()}`,
        nome,
        tipo,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      db.categorias_financeiras.push(nova);
      saveDB(db);
      res.status(201).json(nova);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao criar categoria financeira.' });
    }
  });

  // Edit a category
  app.patch('/api/admin/categorias-financeiras/:id', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { nome, tipo } = req.body;
      const db = loadDB();
      const index = db.categorias_financeiras.findIndex(c => c.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Categoria não encontrada.' });
      }

      const item = db.categorias_financeiras[index];
      if (nome !== undefined) {
        // Check for duplicates
        const exists = db.categorias_financeiras.some(c => 
          c.id !== id && c.nome.toLowerCase() === nome.toLowerCase() && c.tipo === (tipo || item.tipo)
        );
        if (exists) {
          return res.status(400).json({ error: 'Já existe uma categoria com este nome.' });
        }
        item.nome = nome;
      }
      if (tipo !== undefined) {
        if (tipo !== 'entrada' && tipo !== 'saida') {
          return res.status(400).json({ error: 'Tipo inválido. Deve ser entrada ou saida.' });
        }
        item.tipo = tipo;
      }
      item.updated_at = new Date().toISOString();

      saveDB(db);
      res.json(item);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao editar categoria financeira.' });
    }
  });

  // Delete a category
  app.delete('/api/admin/categorias-financeiras/:id', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const db = loadDB();
      const index = db.categorias_financeiras.findIndex(c => c.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Categoria não encontrada.' });
      }

      db.categorias_financeiras.splice(index, 1);
      saveDB(db);
      res.json({ success: true, message: 'Categoria financeira excluída.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao excluir categoria financeira.' });
    }
  });


  // 7. EXPEDIENTE & BLOCKS GET/POST
  app.get('/api/admin/configuracoes', requireAdmin, (req, res) => {
    const db = loadDB();
    res.json({
      expedientes: db.expedientes.sort((a,b) => a.dia_semana - b.dia_semana),
      bloqueios: db.bloqueios.sort((a,b) => a.data.localeCompare(b.data))
    });
  });

  // Edit expediente day
  app.post('/api/admin/expedientes/intervalo-padrao', requireAdmin, validate(schemas.patchIntervaloPadrao), (req, res) => {
    try {
      const { intervalo_inicio, intervalo_fim } = req.body;
      const db = loadDB();

      db.expedientes.forEach(ex => {
        ex.intervalo_inicio = intervalo_inicio || null;
        ex.intervalo_fim = intervalo_fim || null;
        ex.updated_at = new Date().toISOString();
      });

      saveDB(db);
      res.json({ success: true, message: 'Intervalo padrão atualizado para todos os dias.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao cadastrar o intervalo padrão.' });
    }
  });

  // Edit expediente day
  app.patch('/api/admin/expedientes/:id', requireAdmin, validate(schemas.patchExpediente), (req, res) => {
    try {
      const { id } = req.params;
      const { hora_inicio, hora_fim, intervalo_inicio, intervalo_fim, ativo } = req.body;
      const db = loadDB();

      const item = db.expedientes.find(ex => ex.id === id);
      if (!item) return res.status(404).json({ error: 'Configuração de expediente não encontrada.' });

      if (hora_inicio !== undefined) item.hora_inicio = hora_inicio;
      if (hora_fim !== undefined) item.hora_fim = hora_fim;
      if (intervalo_inicio !== undefined) item.intervalo_inicio = intervalo_inicio;
      if (intervalo_fim !== undefined) item.intervalo_fim = intervalo_fim;
      if (ativo !== undefined) item.ativo = Boolean(ativo);
      item.updated_at = new Date().toISOString();

      saveDB(db);
      res.json(item);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao atualizar horário de expediente.' });
    }
  });

  // Add block
  app.post('/api/admin/bloqueios', requireAdmin, validate(schemas.createBloqueio), (req, res) => {
    try {
      const { data, hora_inicio, hora_fim, motivo } = req.body;
      if (!data || !motivo) {
        return res.status(400).json({ error: 'Data e motivo do bloqueio são obrigatórios.' });
      }

      const db = loadDB();
      const novo: Bloqueio = {
        id: `bl-${Date.now()}`,
        barbeiro_id: 'b-1',
        data,
        hora_inicio: hora_inicio || null,
        hora_fim: hora_fim || null,
        motivo,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      db.bloqueios.push(novo);
      saveDB(db);
      res.status(201).json(novo);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao criar bloqueio.' });
    }
  });

  // Delete block
  app.delete('/api/admin/bloqueios/:id', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const db = loadDB();

      const originalLength = db.bloqueios.length;
      db.bloqueios = db.bloqueios.filter(b => b.id !== id);

      if (db.bloqueios.length === originalLength) {
        return res.status(404).json({ error: 'Bloqueio não encontrado.' });
      }

      saveDB(db);
      res.json({ success: true, message: 'Bloqueio removido com sucesso.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao remover bloqueio.' });
    }
  });


  // --- BIND LIVE VITE MIDDLEWARE (DEV) OR SERVE BUILDS (PROD) ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Barbearia Fullstack Server] rodando em http//0.0.0.0:${PORT}`);
  });
}

startServer();
