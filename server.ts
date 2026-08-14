import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: true });

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
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
import { attachUser, requireAdmin, requireAuth, AuthRequest } from './server/auth.ts';
import { isSupabaseConfigured, serviceClient, anonClient, setSupabaseOffline } from './server/supabase.ts';
import { validate } from './server/validation.ts';
import { schemas } from './server/schemas.ts';
import * as storage from './server/storage.ts';
import * as stripe from './server/stripe.ts';
import { criarLoginClienteTelefone, redefinirSenhaCliente, TelefoneJaCadastradoError } from './server/clienteAuth.ts';

// Authenticate middleware
// (substituído por server/auth.ts que verifica JWT real do Supabase)

// --- IDEMPOTÊNCIA DO WEBHOOK DA STRIPE ---
// A Stripe reentrega o MESMO evento sempre que a gente responde 500 ou estoura
// o timeout. Sem trava, cada reentrega inseria outro lançamento financeiro e
// inflava o faturamento. Fonte da verdade: tabela `stripe_webhook_events`
// (id = event.id da Stripe). Sem Supabase, cai num Set em memória
// (best-effort — só cobre o processo atual, serve pra dev/preview).
const eventosStripeProcessados = new Set<string>();

async function eventoStripeJaProcessado(eventId: string): Promise<boolean> {
  if (eventosStripeProcessados.has(eventId)) return true;

  const client = isSupabaseConfigured() ? serviceClient() : null;
  if (!client) return false;

  try {
    const { data, error } = await client
      .from('stripe_webhook_events')
      .select('id')
      .eq('id', eventId)
      .maybeSingle();

    if (error) {
      // Falha na checagem não pode derrubar o webhook: seguimos o processamento.
      console.warn('[Stripe Webhook] Falha ao checar idempotência:', error.message);
      return false;
    }
    return Boolean(data);
  } catch (err: any) {
    console.warn('[Stripe Webhook] Erro ao checar idempotência:', err?.message);
    return false;
  }
}

// Só é chamado DEPOIS do processamento bem-sucedido — se algo explodir no meio,
// o evento continua "não processado" e a reentrega da Stripe conserta o estado.
async function marcarEventoStripeProcessado(eventId: string, tipo: string): Promise<void> {
  eventosStripeProcessados.add(eventId);

  const client = isSupabaseConfigured() ? serviceClient() : null;
  if (!client) return;

  try {
    const { error } = await client
      .from('stripe_webhook_events')
      .insert({ id: eventId, type: tipo });
    // 23505 = PK duplicada (corrida entre duas entregas simultâneas) — ok ignorar.
    if (error && error.code !== '23505') {
      console.warn('[Stripe Webhook] Falha ao registrar evento processado:', error.message);
    }
  } catch (err: any) {
    console.warn('[Stripe Webhook] Erro ao registrar evento processado:', err?.message);
  }
}

// --- POLÍTICA DE INADIMPLÊNCIA ---
// isClientVip() (server/storage.ts) só considera VIP quem tem status === 'ativo'.
// past_due entra como 'ativo' de propósito: a Stripe ainda tenta recobrar por ~2
// semanas e cortar o acesso na primeira falha de cartão é agressivo demais.
// O corte real acontece em unpaid/canceled/incomplete_expired.
function mapearStatusAssinatura(stripeStatus: string): 'ativo' | 'cancelado' {
  if (stripeStatus === 'active' || stripeStatus === 'trialing' || stripeStatus === 'past_due') {
    return 'ativo';
  }
  if (stripeStatus === 'unpaid' || stripeStatus === 'canceled' || stripeStatus === 'incomplete_expired') {
    return 'cancelado';
  }
  // incomplete / paused e afins: sem pagamento confirmado, não libera VIP.
  console.warn(`[Stripe] Status de assinatura sem mapeamento: ${stripeStatus} → cancelado`);
  return 'cancelado';
}

// Mescla um patch dentro de observacoes.subscription do cliente (as observações
// guardam um JSON). Mesclar em vez de sobrescrever preserva campos que outro
// evento já tinha gravado (plano, referência, pendência).
async function patchSubscriptionObservacoes(email: string, patch: Record<string, any>): Promise<boolean> {
  const client = isSupabaseConfigured() ? serviceClient() : null;
  if (!client) return false;

  const { data: clientes } = await client
    .from('clientes')
    .select('id, observacoes')
    .eq('email', email)
    .limit(1);
  if (!clientes || clientes.length === 0) {
    // Assinou na Stripe com um e-mail que não existe na base de clientes.
    console.warn(`[Stripe] Cliente não encontrado para o e-mail da assinatura: ${email}`);
    return false;
  }

  const cliente = clientes[0];
  let obs: any = {};
  try {
    if (cliente.observacoes && cliente.observacoes.trim().startsWith('{')) {
      obs = JSON.parse(cliente.observacoes);
    }
  } catch { obs = {}; }

  obs.subscription = {
    ...(obs.subscription || {}),
    ...patch,
    updatedAt: new Date().toISOString()
  };

  await client.from('clientes').update({ observacoes: JSON.stringify(obs) }).eq('id', cliente.id);
  return true;
}

// Resolve o e-mail do cliente a partir do customer da Stripe.
async function emailDoCustomerStripe(customerId: string): Promise<string | null> {
  if (!customerId) return null;
  const stripeClient = stripe.getStripeClientForWebhook();
  if (!stripeClient) return null;
  try {
    const customer: any = await stripeClient.customers.retrieve(customerId);
    if (customer && !customer.deleted && customer.email) return customer.email as string;
  } catch (err: any) {
    console.error('[Stripe Webhook] Erro ao buscar customer:', err?.message);
  }
  return null;
}

// Extrai o plano de uma invoice tolerando as DUAS formas da API da Stripe.
// Da Basil em diante os metadados da assinatura vivem em
// invoice.parent.subscription_details e o preço da linha em
// pricing.price_details.price; antes disso era subscription_details na raiz e
// lines.data[].price.id. A versão do payload é definida pela CONTA (não pelo SDK),
// então lemos os dois formatos. Último recurso: consulta a assinatura, cujo
// subscription item continua expondo price.id em qualquer versão.
async function planoDaInvoice(invoice: any): Promise<string | null> {
  const metaPlan =
    invoice?.parent?.subscription_details?.metadata?.plan ||
    invoice?.subscription_details?.metadata?.plan ||
    invoice?.metadata?.plan;
  if (metaPlan) return metaPlan as string;

  const linha = invoice?.lines?.data?.[0];
  const precoNovo = linha?.pricing?.price_details?.price;
  const priceId =
    (typeof precoNovo === 'string' ? precoNovo : precoNovo?.id) ||
    linha?.price?.id ||
    null;
  const porPreco = stripe.planFromPriceId(priceId);
  if (porPreco) return porPreco;

  const subRef = invoice?.parent?.subscription_details?.subscription || invoice?.subscription;
  const subId = typeof subRef === 'string' ? subRef : subRef?.id;
  if (!subId) return null;

  const stripeClient = stripe.getStripeClientForWebhook();
  if (!stripeClient) return null;
  try {
    const sub: any = await stripeClient.subscriptions.retrieve(subId);
    return sub.metadata?.plan || stripe.planFromPriceId(sub.items?.data?.[0]?.price?.id);
  } catch (err: any) {
    console.error('[Stripe Webhook] Erro ao resolver plano da invoice:', err?.message);
    return null;
  }
}

export async function createApp() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // MORPH-006: confia no proxy (Vercel/Cloudflare) para resolver req.ip real.
  // Sem isso o rate-limit por IP enxerga o IP do proxy — ou vira 429 coletivo
  // (todo mundo no mesmo balde) ou é trivialmente burlado. Em dev local mantém 1 hop.
  app.set('trust proxy', process.env.VERCEL ? true : 1);

  // MORPH-011: headers mínimos de segurança. CSP propositalmente não adicionada
  // (o voucher de impressão usa HTML inline).
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // Body parsers
  // Stripe webhook precisa do body RAW (antes do json parser)
  app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
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

  // --- STRIPE WEBHOOK ---
  app.post('/api/stripe/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      console.warn('[Stripe Webhook] Assinatura ou webhook secret ausente.');
      return res.status(400).json({ error: 'Assinatura ausente.' });
    }

    const stripeClient = stripe.getStripeClientForWebhook();
    if (!stripeClient) {
      console.warn('[Stripe Webhook] Stripe não configurado.');
      return res.status(500).json({ error: 'Stripe não configurado.' });
    }

    let event: any;
    try {
      event = stripeClient.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error('[Stripe Webhook] Assinatura inválida:', err.message);
      return res.status(400).json({ error: `Assinatura inválida: ${err.message}` });
    }

    // Idempotência: se a Stripe já entregou esse evento antes, não processa de novo.
    // Sem isso, todo retry (500/timeout) duplicava o lançamento financeiro.
    if (await eventoStripeJaProcessado(event.id)) {
      console.log(`[Stripe Webhook] Evento duplicado ignorado: ${event.id} (${event.type})`);
      return res.json({ received: true, duplicate: true });
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const email = session.customer_details?.email || session.metadata?.cliente_email;
          let plan = session.metadata?.plan;

          if (!plan && session.subscription) {
            try {
              const stripeClient = stripe.getStripeClientForWebhook();
              if (stripeClient) {
                const sub: any = await stripeClient.subscriptions.retrieve(session.subscription as string);
                plan = sub.metadata?.plan;
                if (!plan && sub.items?.data?.length > 0) {
                  plan = stripe.planFromPriceId(sub.items.data[0].price?.id);
                }
              }
            } catch (e) {
              console.error('[Stripe Webhook] Erro ao buscar subscrição no checkout:', e);
            }
          }
          // Piso só no checkout: aqui NÓS mesmos setamos metadata.plan, então cair
          // aqui é anomalia. O customer.subscription.updated corrige logo em seguida.
          if (!plan) {
            console.error(`[Stripe] Plano não identificado no checkout ${session.id} — usando 'essential' como piso.`);
            plan = 'essential';
          }
          const valor = (session.amount_total || 0) / 100;

          // Só registra receita de dinheiro que REALMENTE entrou. Checkout pode
          // completar com pagamento pendente (boleto, 3DS, etc) — nesse caso quem
          // lança a receita é o invoice.paid, quando o dinheiro cai.
          if (session.payment_status !== 'paid') {
            console.log(`[Stripe] Checkout sem pagamento confirmado (payment_status=${session.payment_status}): ${email} — nada lançado.`);
            break;
          }

          await registrarAssinatura(email, plan, valor, session.id);
          console.log(`[Stripe] Checkout concluído: ${email} → ${plan} (R$ ${valor})`);
          break;
        }

        case 'invoice.paid': {
          const invoice = event.data.object;
          const email = invoice.customer_email || await emailDoCustomerStripe(invoice.customer as string);
          const valor = (invoice.amount_paid || 0) / 100;
          // Nunca chute o plano numa renovação: chutar 'essential' rebaixa
          // silenciosamente quem paga Premium/Exclusive. null = preserva o atual.
          const plan = await planoDaInvoice(invoice);
          if (!plan) {
            console.error(`[Stripe] Plano não identificado na invoice ${invoice.id} — plano anterior do cliente preservado.`);
          }

          if (email && invoice.billing_reason === 'subscription_cycle') {
            await registrarAssinatura(email, plan, valor, invoice.id);
            console.log(`[Stripe] Pagamento recorrente: ${email} → ${plan} (R$${valor.toFixed(2)})`);
          }
          break;
        }

        // Falha de cobrança: NÃO derruba o VIP. A Stripe ainda vai tentar recobrar
        // (dunning, ~2 semanas). Só marcamos a pendência pro front avisar o cliente.
        // Quem realmente corta o acesso é o unpaid/canceled em subscription.updated.
        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const email = invoice.customer_email || await emailDoCustomerStripe(invoice.customer as string);
          if (!email) {
            console.warn('[Stripe] invoice.payment_failed sem e-mail do cliente — ignorado.');
            break;
          }
          await patchSubscriptionObservacoes(email, { pendencia: true });
          console.log(`[Stripe] Pagamento falhou: ${email} → pendência marcada (acesso mantido).`);
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object;
          const customerId = sub.customer as string;
          let plan = sub.metadata?.plan;
          if (!plan && sub.items?.data?.length > 0) {
            plan = stripe.planFromPriceId(sub.items.data[0].price?.id);
          }
          // Sem chute: este é justamente o evento que corrige o plano do cliente.
          // Se não deu pra identificar, preserva o que já está gravado.
          if (!plan) {
            console.error(`[Stripe] Plano não identificado na assinatura ${sub.id} — plano anterior preservado.`);
          }

          const email = await emailDoCustomerStripe(customerId);
          if (!email) break;

          const status = mapearStatusAssinatura(sub.status);
          // Mesma razão do renews_at em registrarAssinatura: sem esta data a interface
          // mostra o plano como vencido mesmo estando em dia.
          const renewsAt = stripe.extrairCurrentPeriodEnd(sub);
          const atualizou = await patchSubscriptionObservacoes(email, {
            status,
            ...(plan ? { plan } : {}),
            ...(renewsAt ? { renews_at: renewsAt } : {}),
            stripeReferenceId: sub.id,
            // past_due = cartão falhou mas ainda em recobrança; active/trialing limpa a pendência.
            pendencia: sub.status === 'past_due'
          });
          if (atualizou) {
            console.log(`[Stripe] Assinatura atualizada: ${email} → ${plan} (${sub.status} → ${status})`);
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          const email = await emailDoCustomerStripe(sub.customer as string);
          if (!email) break;

          const atualizou = await patchSubscriptionObservacoes(email, {
            status: 'cancelado',
            pendencia: false
          });
          if (atualizou) {
            console.log(`[Stripe] Assinatura cancelada: ${email}`);
          }
          break;
        }

        default:
          console.log(`[Stripe] Evento ignorado: ${event.type}`);
      }

      // Só marca como processado no fim, com tudo já persistido.
      await marcarEventoStripeProcessado(event.id, event.type);

      res.json({ received: true });
    } catch (err: any) {
      // 500 de propósito: a Stripe DEVE reentregar. A idempotência acima é que
      // impede a reentrega de duplicar lançamento financeiro.
      console.error('[Stripe Webhook Error]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // plan === null significa "não consegui identificar o plano": nesse caso o plano
  // já gravado no cliente é preservado, em vez de sobrescrito por um chute.
  async function registrarAssinatura(email: string | undefined, plan: string | null, valor: number, referenceId: string) {
    if (!email) return;
    const splitDate = new Date().toISOString().split('T')[0];
    const planoDescricao = plan || 'plano não identificado';

    // renews_at: a área do cliente (UserLayout.tsx:84) e o painel do barbeiro
    // (AdminLayout.tsx:1030) tratam a ausência dessa data como plano vencido. O webhook
    // nunca a gravava, então quem pagava aparecia como vencido no mesmo dia.
    const vigente = await stripe.getActiveSubscription(email);
    const renewsAt = vigente?.currentPeriodEnd ?? null;

    if (isSupabaseConfigured()) {
      const client = serviceClient();
      if (!client) return;

      const { data: barb } = await client.from('barbeiros').select('id').eq('ativo', true).limit(1).single();
      const barbeiroId = barb?.id || 'b-1';

      await client.from('lancamentos_financeiros').insert({
        barbeiro_id: barbeiroId,
        profissional_id: null,
        tipo: 'entrada',
        descricao: `Assinatura Stripe (${planoDescricao}): ${email}`,
        valor,
        categoria: 'Plano',
        forma_pagamento: 'outro',
        data: splitDate
      });

      // Dinheiro entrou: assinatura ativa e sem pendência.
      await patchSubscriptionObservacoes(email, {
        status: 'ativo',
        ...(plan ? { plan } : {}),
        ...(renewsAt ? { renews_at: renewsAt } : {}),
        price: valor,
        stripeReferenceId: referenceId,
        pendencia: false
      });
      return;
    }

    const db = loadDB();
    const barbeiroId = db.barbeiros[0]?.id || 'b-1';
    db.lancamentos_financeiros.push({
      id: `lf-stripe-${Date.now()}`,
      barbeiro_id: barbeiroId,
      profissional_id: null,
      tipo: 'entrada',
      descricao: `Assinatura Stripe (${plan}): ${email}`,
      valor,
      categoria: 'Plano',
      forma_pagamento: 'outro',
      agendamento_id: null,
      produto_id: null,
      data: splitDate,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const cliente = db.clientes.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
    if (cliente) {
      let obs: any = {};
      try {
        if (cliente.observacoes && cliente.observacoes.trim().startsWith('{')) {
          obs = JSON.parse(cliente.observacoes);
        }
      } catch { obs = {}; }
      obs.subscription = {
        ...(obs.subscription || {}),
        status: 'ativo',
        ...(plan ? { plan } : {}),
        ...(renewsAt ? { renews_at: renewsAt } : {}),
        price: valor,
        stripeReferenceId: referenceId,
        pendencia: false,
        updatedAt: new Date().toISOString()
      };
      cliente.observacoes = JSON.stringify(obs);
    }
    saveDB(db);
  }

  // --- STRIPE: LISTAR PLANOS ---
  app.get('/api/stripe/plans', (req, res) => {
    res.json(stripe.getPlanos());
  });

  // --- STRIPE: CRIAR CHECKOUT SESSION ---
  // requireAuth + req.userEmail: o cliente só assina PRA SI MESMO. Nada de e-mail
  // vindo do corpo da requisição — era um jeito de assinar em nome de terceiros.
  app.post('/api/stripe/create-checkout-session', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { planId, nome } = req.body as { planId: string; nome?: string };
      const email = req.userEmail;
      if (!planId) {
        return res.status(400).json({ error: 'planId é obrigatório.' });
      }
      if (!email) {
        return res.status(401).json({ error: 'Sessão sem e-mail. Faça login novamente.' });
      }

      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
      const result = await stripe.createCheckoutSession({
        planId,
        clienteEmail: email,
        clienteNome: nome || email,
        // liga o customer da Stripe ao usuário do Supabase Auth
        clienteId: req.userId,
        successUrl: `${appUrl}/planos/sucesso?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${appUrl}/planos`
      });

      // Já tem assinatura ativa: 409 pro front tratar (mandar pro portal, não pro checkout).
      if (result.code === 'already_subscribed') {
        return res.status(409).json({
          error: result.error || 'Você já possui uma assinatura ativa.',
          code: 'already_subscribed'
        });
      }

      if (result.error) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ url: result.url });
    } catch (err: any) {
      console.error('[Stripe] Erro ao criar checkout:', err);
      res.status(500).json({ error: 'Erro ao criar sessão de checkout.' });
    }
  });

  // --- STRIPE: CUSTOMER PORTAL ---
  // IDOR corrigido: o portal de faturamento é sempre o de quem está logado.
  // O ?email= da query é IGNORADO de propósito — era o buraco que entregava
  // o faturamento de qualquer cliente pra qualquer pessoa.
  app.get('/api/stripe/portal', requireAuth, async (req: AuthRequest, res) => {
    try {
      const email = req.userEmail;
      if (!email) {
        return res.status(401).json({ error: 'Sessão sem e-mail. Faça login novamente.' });
      }

      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
      const result = await stripe.createPortalSession({
        customerEmail: email,
        returnUrl: `${appUrl}/planos`
      });

      if (result.error) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ url: result.url });
    } catch (err: any) {
      console.error('[Stripe] Erro ao criar portal:', err);
      res.status(500).json({ error: 'Erro ao criar portal do cliente.' });
    }
  });

  // --- STRIPE: CANCELAR ASSINATURA (no fim do período pago) ---
  // O cancelamento tem que acontecer NA STRIPE — antes o front só "cancelava"
  // localmente e o cartão do cliente seguia sendo cobrado pra sempre.
  // As observações do cliente NÃO são tocadas aqui: quem atualiza é o webhook
  // customer.subscription.updated/deleted, mantendo uma fonte da verdade só.
  app.post('/api/stripe/cancel-subscription', requireAuth, async (req: AuthRequest, res) => {
    try {
      const email = req.userEmail;
      if (!email) {
        return res.status(401).json({ error: 'Sessão sem e-mail. Faça login novamente.' });
      }

      const result = await stripe.cancelSubscriptionAtPeriodEnd(email);
      if (!result.ok) {
        return res.status(400).json({ error: result.error || 'Não foi possível cancelar a assinatura.' });
      }

      console.log(`[Stripe] Cancelamento agendado para o fim do período: ${email}`);
      res.json({ ok: true, currentPeriodEnd: result.currentPeriodEnd });
    } catch (err: any) {
      console.error('[Stripe] Erro ao cancelar assinatura:', err);
      res.status(500).json({ error: 'Erro ao cancelar assinatura.' });
    }
  });

  // --- STRIPE: STATUS DA ASSINATURA DO CLIENTE ---
  // Mesma correção de IDOR do portal: só o próprio status, vindo do JWT.
  //
  // Autocura: o status gravado nas observações vem do webhook. Se o webhook
  // atrasar ou se perder (ex.: indisponibilidade no momento do pagamento), o
  // cliente PAGO ficaria sem VIP pra sempre. Por isso este endpoint também
  // consulta a Stripe DIRETO (fonte da verdade) e reconcilia as observações
  // quando encontra assinatura ativa — o VIP vira assim que a Stripe confirmar,
  // sem depender da entrega do webhook.
  app.get('/api/stripe/subscription', requireAuth, async (req: AuthRequest, res) => {
    try {
      const email = req.userEmail;
      if (!email) {
        return res.status(401).json({ error: 'Sessão sem e-mail. Faça login novamente.' });
      }

      // 1) Rápido: se as observações locais já marcam VIP, devolve direto.
      let observacoesLocais: string | null = null;
      if (isSupabaseConfigured()) {
        const client = serviceClient();
        if (client) {
          const { data: clientes } = await client.from('clientes').select('observacoes').eq('email', email).limit(1);
          if (clientes && clientes.length > 0) observacoesLocais = clientes[0].observacoes;
        }
      } else {
        const db = loadDB();
        const cliente = db.clientes.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
        if (cliente) observacoesLocais = cliente.observacoes;
      }

      if (observacoesLocais && storage.isClientVip(observacoesLocais)) {
        return res.json({
          ativo: true,
          plan: storage.getClientPlan(observacoesLocais),
          observacoes: observacoesLocais
        });
      }

      // 2) Autocura: consulta a Stripe direto. Se existir assinatura ativa,
      //    grava o VIP nas observações e devolve ativo.
      try {
        const vigente = await stripe.getActiveSubscription(email);
        if (vigente) {
          await patchSubscriptionObservacoes(email, {
            status: 'ativo',
            ...(vigente.plan ? { plan: vigente.plan } : {}),
            ...(vigente.currentPeriodEnd ? { renews_at: vigente.currentPeriodEnd } : {}),
            stripeReferenceId: vigente.id,
            pendencia: false
          });
          return res.json({
            ativo: true,
            plan: vigente.plan,
            currentPeriodEnd: vigente.currentPeriodEnd
          });
        }
      } catch (err: any) {
        console.error('[Stripe] Erro ao consultar assinatura direto na Stripe:', err?.message);
      }

      return res.json({ ativo: false });
    } catch (err: any) {
      console.error('[Stripe] Erro ao buscar assinatura:', err);
      res.status(500).json({ error: 'Erro ao buscar assinatura.' });
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

  // 1b. Get Active Professionals (barbeiros que atendem)
  app.get('/api/profissionais', async (req, res) => {
    try {
      const slug = (req.query.slug as string) || 'imperial';
      const profissionais = await storage.listProfissionais(slug, true);
      res.json(profissionais);
    } catch (error) {
      console.error('[GET /api/profissionais]', error);
      res.status(500).json({ error: 'Erro ao buscar barbeiros.' });
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
      const { data, servico_id, profissional_id, all } = req.query as {
        data: string; servico_id: string; profissional_id: string; all?: string;
      };
      // slug default = imperial (back-compat com db.json)
      const slug = (req.query.slug as string) || 'imperial';
      const slots = await storage.getAvailableSlots(slug, data, servico_id, profissional_id, all === 'true');
      res.json(slots);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao calcular horários disponíveis.' });
    }
  });

  // 4a. Get Bookings for a Logged Client
  // MORPH-004: antes só exigia e-mail/telefone na query — qualquer pessoa lia o
  // histórico de terceiros (nomes, telefones, observações). Agora exige login e
  // resolve a identidade do JWT; só o admin pode filtrar por query.
  app.get('/api/agendamentos/cliente', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { email, telefone } = req.query as { email?: string; telefone?: string };

      let emailMatch = email;
      let telefoneDigits = telefone ? telefone.replace(/\D/g, '') : undefined;

      if (!req.isAdmin) {
        emailMatch = req.userEmail;
        telefoneDigits = undefined;
        // Puxa o telefone do próprio cadastro para achar agendamentos antigos
        // criados só com telefone (sem cliente_id ligado).
        if (isSupabaseConfigured() && req.userId) {
          const svc = serviceClient();
          if (svc) {
            const { data: me } = await svc
              .from('clientes').select('telefone')
              .eq('auth_user_id', req.userId).maybeSingle();
            if (me?.telefone) telefoneDigits = String(me.telefone).replace(/\D/g, '');
          }
        }
      }

      if (!emailMatch && !telefoneDigits) {
        return res.status(400).json({ error: 'Parâmetro email ou telefone é obrigatório.' });
      }

      const bookings = await storage.listClientBookings(emailMatch, telefoneDigits);
      res.json(bookings);
    } catch (error) {
      console.error('[GET /api/agendamentos/cliente]', error);
      res.status(500).json({ error: 'Erro ao buscar agendamentos do cliente.' });
    }
  });

  // 4b. Get Client Profile by Email
  // O e-mail vem do JWT (req.userEmail) — o ?email= da query só é aceito do admin.
  // Grep em src/: hoje nenhuma tela de admin lê esse endpoint (o admin usa
  // /api/admin/clientes), mas a exceção fica pra não travar o painel no futuro.
  app.get('/api/cliente/perfil', requireAuth, async (req: AuthRequest, res) => {
    try {
      const emailQuery = (req.query.email as string | undefined)?.trim();
      const email = (req.isAdmin && emailQuery) ? emailQuery : req.userEmail;
      if (!email) {
        return res.status(401).json({ error: 'Sessão sem e-mail. Faça login novamente.' });
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
  // Mesma regra do GET: o cliente só edita o PRÓPRIO perfil (e-mail do JWT).
  // Sem isso qualquer um sobrescrevia nome/telefone/observações de outro cliente
  // — inclusive o bloco `subscription` que define quem é VIP.
  app.post('/api/cliente/perfil', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { email: emailBody, nome, telefone, foto_url, observacoes } = req.body as {
        email?: string; nome?: string; telefone?: string; foto_url?: string; observacoes?: string;
      };
      const email = (req.isAdmin && emailBody) ? emailBody.trim() : req.userEmail;
      if (!email) {
        return res.status(401).json({ error: 'Sessão sem e-mail. Faça login novamente.' });
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
        profissional_id: string;
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

      // Check if client is VIP and get their subscription plan
      let isVip = false;
      let clientPlan = '';
      const emailToMatch = body.cliente_email || (body.cliente_id && body.cliente_id.includes('@') ? body.cliente_id : null);
      if (emailToMatch) {
        const existing = db.clientes.find(c => c.email && c.email.toLowerCase() === emailToMatch.toLowerCase());
        if (existing && storage.isClientVip(existing.observacoes)) {
          isVip = true;
          clientPlan = storage.getClientPlan(existing.observacoes);
        }
      } else if (body.cliente_id) {
        const existing = db.clientes.find(c => c.id === body.cliente_id);
        if (existing && storage.isClientVip(existing.observacoes)) {
          isVip = true;
          clientPlan = storage.getClientPlan(existing.observacoes);
        }
      }

      const totalPreco = selected_servicos.reduce((sum, s) => {
        if (isVip && storage.isServiceEligibleForPlan(s.nome, clientPlan)) {
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
        profissional_id: body.profissional_id,
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
  // MORPH-002: exige login e só permite cancelar os PRÓPRIOS agendamentos.
  // Antes era público e o código é sequencial (#000001...): um anônimo podia
  // iterar códigos e cancelar a agenda inteira (IDOR + BFLA).
  app.post('/api/agendamentos/:id/cancelar', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      if (isSupabaseConfigured()) {
        const svc = serviceClient()!;
        let uuid = id;
        if (id.startsWith('#')) {
          const { data: row } = await svc.from('agendamentos').select('id').eq('codigo', id).single();
          if (!row) return res.status(404).json({ error: 'Agendamento não encontrado.' });
          uuid = row.id;
        }

        // Admin da barbearia pode cancelar qualquer agendamento.
        if (!req.isAdmin) {
          const { data: booking } = await svc
            .from('agendamentos')
            .select('cliente_id, telefone_cliente')
            .eq('id', uuid)
            .maybeSingle();
          if (!booking) return res.status(404).json({ error: 'Agendamento não encontrado.' });

          let me: any = null;
          const { data: meAuth } = await svc
            .from('clientes').select('id, telefone, email')
            .eq('auth_user_id', req.userId).maybeSingle();
          if (meAuth) {
            me = meAuth;
          } else if (req.userEmail) {
            const { data: meEmail } = await svc
              .from('clientes').select('id, telefone, email')
              .eq('email', req.userEmail).maybeSingle();
            me = meEmail;
          }

          const mePhone = me?.telefone ? String(me.telefone).replace(/\D/g, '') : '';
          const bookingPhone = booking.telefone_cliente ? String(booking.telefone_cliente).replace(/\D/g, '') : '';
          const owned = me && (
            booking.cliente_id === me.id ||
            (mePhone && bookingPhone && mePhone === bookingPhone)
          );
          if (!owned) {
            return res.status(403).json({ error: 'Você só pode cancelar os seus próprios agendamentos.' });
          }
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
      if (!req.isAdmin) {
        const cliente = db.clientes.find(c =>
          req.userEmail && c.email && c.email.toLowerCase() === req.userEmail.toLowerCase()
        );
        const mePhone = cliente?.telefone ? cliente.telefone.replace(/\D/g, '') : '';
        const bookingPhone = original.telefone_cliente ? original.telefone_cliente.replace(/\D/g, '') : '';
        const owned = (cliente && original.cliente_id === cliente.id) ||
          (mePhone && bookingPhone && mePhone === bookingPhone);
        if (!owned) {
          return res.status(403).json({ error: 'Você só pode cancelar os seus próprios agendamentos.' });
        }
      }
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


  // --- CADASTRO DE CLIENTE POR TELEFONE ---
  // Rota pública: cria login de cliente com telefone + senha, para quem não tem Google.
  // Limite simples por IP porque é a única rota sem autenticação que cria usuário.
  // Em serverless a memória não é compartilhada entre instâncias, então isso é
  // best-effort — segura script ingênuo, não ataque distribuído.
  const tentativasCadastro = new Map<string, { count: number; resetEm: number }>();
  const LIMITE_CADASTRO_POR_IP = 5;
  const JANELA_CADASTRO_MS = 60 * 60 * 1000;

  app.post('/api/auth/cadastro-telefone', validate(schemas.clientSignupTelefone), async (req: AuthRequest, res) => {
    try {
      if (!isSupabaseConfigured()) {
        return res.status(501).json({ error: 'Cadastro por telefone exige o Supabase configurado.' });
      }

      const ip = req.ip || 'desconhecido';
      const agora = Date.now();
      const registro = tentativasCadastro.get(ip);
      if (registro && registro.resetEm > agora) {
        if (registro.count >= LIMITE_CADASTRO_POR_IP) {
          return res.status(429).json({ error: 'Muitas tentativas. Tente de novo mais tarde.' });
        }
        registro.count += 1;
      } else {
        tentativasCadastro.set(ip, { count: 1, resetEm: agora + JANELA_CADASTRO_MS });
      }

      const { nome, telefone, senha } = req.body as { nome: string; telefone: string; senha: string };
      const criado = await criarLoginClienteTelefone({ nome, telefone, senha });
      return res.status(201).json({ ok: true, email: criado.email });
    } catch (err: any) {
      if (err instanceof TelefoneJaCadastradoError) {
        return res.status(409).json({ error: err.message, code: 'telefone_ja_cadastrado' });
      }
      console.error('[POST /api/auth/cadastro-telefone]', err);
      return res.status(500).json({ error: 'Erro ao criar cadastro.' });
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

      // MORPH-010: em produção (Supabase configurado) exige JWT válido — o front
      // já manda o token e attachUser validou. Em dev (sem Supabase) mantém o
      // fluxo de preview do AI Studio.
      if (isSupabaseConfigured() && !req.userId) {
        return res.status(401).json({ error: 'Autenticação necessária.' });
      }

      // Em produção, o front já mandou o JWT no header Authorization e
      // attachUser preencheu req.userId. Buscamos o barbeiro no Supabase.
      // Só caímos no db.json (seed) quando o Supabase não está configurado
      // (dev/preview) — nunca em serverless, onde o FS é read-only.
      let barber: any = null;
      if (isSupabaseConfigured()) {
        const client = serviceClient();
        if (client) {
          const { data } = await client
            .from('barbeiros')
            .select('id, nome, email, avatar_url, nome_barbearia')
            .eq('ativo', true)
            .limit(1)
            .single();
          barber = data;
          if (barber) {
            await client
              .from('barbeiros')
              .update({ ultimo_acesso_em: new Date().toISOString() })
              .eq('id', barber.id);
          }
        }
      }
      if (!barber) {
        const db = loadDB();
        barber = db.barbeiros[0];
        barber.ultimo_acesso_em = new Date().toISOString();
        saveDB(db);
      }

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
      const { start_date, end_date, is_today, profissional_id } = req.query as {
        start_date?: string; end_date?: string; is_today?: string; profissional_id?: string;
      };

      if (isSupabaseConfigured() && req.barbeiroId) {
        const stats = await storage.getDashboardStats(
          req.barbeiroId,
          start_date,
          end_date,
          is_today === 'true',
          profissional_id
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
        porProfissional: [], // db.json (dev) não modela múltiplos barbeiros
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
        const profissionalId = req.query.profissional_id as string | undefined;
        const list = await storage.listAgendamentosAdmin(req.barbeiroId, profissionalId);
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

      saveDB(db);
      res.json(original);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao atualizar agendamento.' });
    }
  });

  app.delete('/api/admin/agendamentos/:id', requireAdmin, async (req: AuthRequest, res) => {
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
        await storage.deleteAgendamento(uuid);
        return res.json({ ok: true });
      }

      const db = loadDB();
      const idx = db.agendamentos.findIndex(a => a.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Agendamento não encontrado.' });
      db.agendamentos.splice(idx, 1);
      saveDB(db);
      return res.json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao excluir agendamento.' });
    }
  });


  // 3. SERVICES CRUD (Prevent actual deleting, just flip active flag / deativar)
  // Upload de imagem decorativa (serviços/produtos) para o Supabase Storage (bucket "imagens")
  app.post('/api/admin/upload-imagem', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { dataUrl, pasta } = req.body;
      const match = typeof dataUrl === 'string' ? dataUrl.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/) : null;
      if (!match) {
        return res.status(400).json({ error: 'Imagem inválida. Envie um arquivo JPEG, PNG ou WebP.' });
      }

      // MORPH-007: limite de tamanho ANTES de qualquer ramificação (Supabase OU
      // fallback offline). Sem isto, um dataUrl gigante vira imagem_url persistida
      // no fallback — o cap do body (10mb) não basta.
      const buffer = Buffer.from(match[3], 'base64');
      if (buffer.byteLength > 5 * 1024 * 1024) {
        return res.status(413).json({ error: 'Imagem muito grande. Máximo de 5 MB.' });
      }

      if (isSupabaseConfigured() && req.barbeiroId) {
        const client = serviceClient();
        if (client) {
          try {
            const mime = match[1];
            const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
            const pastasPermitidas = ['servicos', 'produtos', 'profissionais'];
            const folder = pastasPermitidas.includes(pasta) ? pasta : 'servicos';
            const filePath = `${folder}/${req.barbeiroId}/${randomUUID()}.${ext}`;

            const { error: uploadError } = await client.storage
              .from('imagens')
              .upload(filePath, buffer, { contentType: mime, upsert: true });

            if (!uploadError) {
              const { data } = client.storage.from('imagens').getPublicUrl(filePath);
              return res.json({ url: data.publicUrl });
            }
            console.warn('[Storage] Upload no Supabase falhou, usando dataUrl fallback:', uploadError.message);
          } catch (storageErr: any) {
            console.warn('[Storage] Exceção no upload Supabase, usando dataUrl fallback:', storageErr.message);
          }
        }
      }

      // Fallback gracioso (funciona sempre sem depender do bucket do Supabase):
      return res.json({ url: dataUrl });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao processar imagem.' });
    }
  });

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
      const { nome, telefone, email, data_nascimento, observacoes, senha } = req.body;
      if (!nome || !telefone) {
        return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
      }

      if (isSupabaseConfigured() && req.barbeiroId) {
        // Com senha: cria o login por telefone e a ficha de uma vez. O e-mail digitado
        // no formulário é IGNORADO de propósito — o login e o Stripe têm que usar o
        // e-mail sintético derivado do telefone, senão o cliente paga e nunca vira VIP
        // (o webhook procura a ficha por clientes.email).
        if (senha) {
          const criado = await criarLoginClienteTelefone({
            nome, telefone, senha, barbeiroId: req.barbeiroId
          });
          const extras: any = {};
          if (data_nascimento) extras.data_nascimento = data_nascimento;
          if (observacoes) extras.observacoes = observacoes;
          const atualizado = Object.keys(extras).length
            ? await storage.updateCliente(criado.clienteId, req.barbeiroId, extras)
            : null;
          const ficha = atualizado
            ?? (await storage.listClientesAdmin(req.barbeiroId)).find(c => c.id === criado.clienteId);
          return res.status(201).json(ficha ?? { id: criado.clienteId, nome, telefone, email: criado.email });
        }

        const novo = await storage.createCliente(req.barbeiroId, { nome, telefone, email, data_nascimento: data_nascimento || null, observacoes });
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
    } catch (error: any) {
      if (error instanceof TelefoneJaCadastradoError) {
        return res.status(409).json({ error: 'Já existe cliente com esse telefone e login no app.' });
      }
      console.error(error);
      res.status(500).json({ error: error?.message || 'Erro ao criar cliente.' });
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
          ...(data_nascimento !== undefined && { data_nascimento: data_nascimento || null }),
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
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error?.message || 'Erro ao atualizar cliente.' });
    }
  });

  // Cliente com login por telefone não tem caixa de e-mail para receber link de
  // recuperação (AuthModal.tsx:77 só serve para quem entrou com e-mail real).
  // Sem esta rota, quem esquece a senha fica trancado para fora permanentemente.
  app.post('/api/admin/clientes/:id/redefinir-senha', requireAdmin, validate(schemas.redefinirSenhaCliente), async (req: AuthRequest, res) => {
    try {
      const client = serviceClient();
      if (!client) return res.status(501).json({ error: 'Supabase não configurado.' });

      const { data: cliente } = await client
        .from('clientes')
        .select('id, auth_user_id')
        .eq('id', req.params.id)
        .eq('barbeiro_id', req.barbeiroId!)
        .maybeSingle();

      if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado.' });
      if (!cliente.auth_user_id) {
        return res.status(400).json({ error: 'Esse cliente ainda não tem login no app. Cadastre uma senha para ele.' });
      }

      await redefinirSenhaCliente(cliente.auth_user_id as string, (req.body as any).senha);
      res.json({ ok: true });
    } catch (err: any) {
      console.error('[POST /api/admin/clientes/:id/redefinir-senha]', err);
      res.status(500).json({ error: 'Erro ao redefinir a senha.' });
    }
  });

  // Link de checkout para o barbeiro mandar no WhatsApp ou abrir no tablet.
  // Reusa createCheckoutSession sem alteração: ela já cria/reaproveita o customer
  // e já barra assinatura duplicada.
  app.post('/api/admin/clientes/:id/link-pagamento', requireAdmin, validate(schemas.linkPagamento), async (req: AuthRequest, res) => {
    try {
      const client = serviceClient();
      if (!client) return res.status(501).json({ error: 'Supabase não configurado.' });

      const { data: cliente } = await client
        .from('clientes')
        .select('id, nome, email, auth_user_id')
        .eq('id', req.params.id)
        .eq('barbeiro_id', req.barbeiroId!)
        .maybeSingle();

      if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado.' });
      if (!cliente.email) {
        return res.status(400).json({ error: 'Cliente sem login no app. Cadastre uma senha para ele antes de cobrar o plano.' });
      }

      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
      const result = await stripe.createCheckoutSession({
        planId: (req.body as any).planId,
        clienteEmail: cliente.email as string,
        clienteNome: cliente.nome as string,
        clienteId: (cliente.auth_user_id as string) || undefined,
        successUrl: `${appUrl}/planos/sucesso?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${appUrl}/planos`
      });

      if (result.code === 'already_subscribed') {
        return res.status(409).json({ error: result.error || 'Esse cliente já tem plano ativo.', code: 'already_subscribed' });
      }
      if (result.error) return res.status(400).json({ error: result.error });

      res.json({ url: result.url });
    } catch (err: any) {
      console.error('[POST /api/admin/clientes/:id/link-pagamento]', err);
      res.status(500).json({ error: 'Erro ao gerar o link de pagamento.' });
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
        // profissional_id=casa filtra só os lançamentos sem barbeiro
        const raw = req.query.profissional_id as string | undefined;
        const filtro = raw === 'casa' ? null : raw;
        const list = await storage.listLancamentos(req.barbeiroId, filtro);
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
      let { tipo, descricao, valor, categoria, forma_pagamento, data, produto_id, profissional_id } = req.body;
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
          tipo, descricao, valor: Number(valor), categoria, forma_pagamento, data, produto_id,
          profissional_id
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
        // venda de produto é da casa; senão respeita o barbeiro escolhido
        profissional_id: produto_id ? null : (profissional_id ?? null),
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
      const { tipo, descricao, valor, categoria, forma_pagamento, data, profissional_id } = req.body;

      if (isSupabaseConfigured() && req.barbeiroId) {
        const item = await storage.patchLancamento(req.barbeiroId, id, {
          tipo, descricao, valor: valor !== undefined ? Number(valor) : undefined, categoria, forma_pagamento, data,
          profissional_id
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
  app.get('/api/admin/categorias-financeiras', requireAdmin, async (req: AuthRequest, res) => {
    try {
      if (isSupabaseConfigured() && req.barbeiroId) {
        const list = await storage.listCategoriasFinanceiras(req.barbeiroId);
        return res.json(list);
      }
      const db = loadDB();
      res.json(db.categorias_financeiras || []);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error?.message || 'Erro ao buscar categorias financeiras.' });
    }
  });

  // Create a category
  app.post('/api/admin/categorias-financeiras', requireAdmin, validate(schemas.createCategoria), async (req: AuthRequest, res) => {
    try {
      const { nome, tipo } = req.body;
      if (!nome || !tipo) {
        return res.status(400).json({ error: 'Nome e tipo são obrigatórios.' });
      }
      if (tipo !== 'entrada' && tipo !== 'saida') {
        return res.status(400).json({ error: 'Tipo inválido. Deve ser entrada ou saida.' });
      }

      if (isSupabaseConfigured() && req.barbeiroId) {
        try {
          const nova = await storage.createCategoriaFinanceira(req.barbeiroId, nome, tipo);
          return res.status(201).json(nova);
        } catch (err: any) {
          if (err?.code === '23505') {
            return res.status(400).json({ error: 'Já existe uma categoria com este nome para este tipo.' });
          }
          throw err;
        }
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
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error?.message || 'Erro ao criar categoria financeira.' });
    }
  });

  // Edit a category
  app.patch('/api/admin/categorias-financeiras/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { nome, tipo } = req.body;

      if (tipo !== undefined && tipo !== 'entrada' && tipo !== 'saida') {
        return res.status(400).json({ error: 'Tipo inválido. Deve ser entrada ou saida.' });
      }

      if (isSupabaseConfigured() && req.barbeiroId) {
        try {
          const updated = await storage.updateCategoriaFinanceira(id, req.barbeiroId, {
            ...(nome !== undefined && { nome }),
            ...(tipo !== undefined && { tipo })
          });
          if (!updated) return res.status(404).json({ error: 'Categoria não encontrada.' });
          return res.json(updated);
        } catch (err: any) {
          if (err?.code === '23505') {
            return res.status(400).json({ error: 'Já existe uma categoria com este nome.' });
          }
          throw err;
        }
      }

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
        item.tipo = tipo;
      }
      item.updated_at = new Date().toISOString();

      saveDB(db);
      res.json(item);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error?.message || 'Erro ao editar categoria financeira.' });
    }
  });

  // Delete a category
  app.delete('/api/admin/categorias-financeiras/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      if (isSupabaseConfigured() && req.barbeiroId) {
        const ok = await storage.deleteCategoriaFinanceira(id, req.barbeiroId);
        if (!ok) return res.status(404).json({ error: 'Categoria não encontrada.' });
        return res.json({ success: true, message: 'Categoria financeira excluída.' });
      }

      const db = loadDB();
      const index = db.categorias_financeiras.findIndex(c => c.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Categoria não encontrada.' });
      }

      db.categorias_financeiras.splice(index, 1);
      saveDB(db);
      res.json({ success: true, message: 'Categoria financeira excluída.' });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error?.message || 'Erro ao excluir categoria financeira.' });
    }
  });


  // 6b. EQUIPE (profissionais) CRUD
  // Não existe DELETE de propósito: agendamentos.profissional_id é NOT NULL e
  // apagar quebraria o histórico financeiro. Desativar (ativo=false) esconde
  // dos novos agendamentos e preserva tudo que já passou.
  app.get('/api/admin/profissionais', requireAdmin, async (req: AuthRequest, res) => {
    try {
      if (!req.barbeiroId) return res.status(401).json({ error: 'Não autenticado.' });
      const list = await storage.listProfissionais(req.barbeiroId);
      res.json(list);
    } catch (error) {
      console.error('[GET /api/admin/profissionais]', error);
      res.status(500).json({ error: 'Erro ao carregar a equipe.' });
    }
  });

  app.post('/api/admin/profissionais', requireAdmin, validate(schemas.createProfissional), async (req: AuthRequest, res) => {
    try {
      if (!req.barbeiroId) return res.status(401).json({ error: 'Não autenticado.' });
      const { nome, telefone, bio, avatar_url } = req.body;
      const novo = await storage.createProfissional(req.barbeiroId, { nome, telefone, bio, avatar_url });
      res.status(201).json(novo);
    } catch (error: any) {
      console.error('[POST /api/admin/profissionais]', error);
      res.status(error?.status || 500).json({ error: error?.message || 'Erro ao criar barbeiro.' });
    }
  });

  app.patch('/api/admin/profissionais/:id', requireAdmin, validate(schemas.patchProfissional), async (req: AuthRequest, res) => {
    try {
      if (!req.barbeiroId) return res.status(401).json({ error: 'Não autenticado.' });
      const atualizado = await storage.updateProfissional(req.params.id, req.barbeiroId, req.body);
      if (!atualizado) return res.status(404).json({ error: 'Barbeiro não encontrado.' });
      res.json(atualizado);
    } catch (error: any) {
      console.error('[PATCH /api/admin/profissionais/:id]', error);
      res.status(error?.status || 500).json({ error: error?.message || 'Erro ao atualizar barbeiro.' });
    }
  });

  // 7. EXPEDIENTE & BLOCKS GET/POST
  app.get('/api/admin/configuracoes', requireAdmin, async (req: AuthRequest, res) => {
    try {
      if (isSupabaseConfigured() && req.barbeiroId) {
        const config = await storage.listConfiguracoes(req.barbeiroId);
        return res.json(config);
      }
      const db = loadDB();
      res.json({
        expedientes: db.expedientes.sort((a,b) => a.dia_semana - b.dia_semana),
        bloqueios: db.bloqueios.sort((a,b) => a.data.localeCompare(b.data))
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao carregar configurações.' });
    }
  });

  // Apply default shift hours & lunch interval to weekdays
  app.post('/api/admin/expedientes/intervalo-padrao', requireAdmin, validate(schemas.patchIntervaloPadrao), async (req: AuthRequest, res) => {
    try {
      const { hora_inicio, hora_fim, intervalo_inicio, intervalo_fim } = req.body;
      const profissionalId = (req.query.profissional_id || req.body.profissional_id) as string | undefined;

      if (isSupabaseConfigured() && req.barbeiroId) {
        await storage.applyDefaultInterval(
          req.barbeiroId,
          intervalo_inicio !== undefined ? (intervalo_inicio || null) : undefined,
          intervalo_fim !== undefined ? (intervalo_fim || null) : undefined,
          profissionalId,
          hora_inicio,
          hora_fim
        );
        return res.json({ success: true, message: 'Horários da escala atualizados com sucesso.' });
      }

      const db = loadDB();
      db.expedientes.forEach(ex => {
        if (!profissionalId || ex.profissional_id === profissionalId) {
          if (hora_inicio) ex.hora_inicio = hora_inicio;
          if (hora_fim) ex.hora_fim = hora_fim;
          if (intervalo_inicio !== undefined) ex.intervalo_inicio = intervalo_inicio || null;
          if (intervalo_fim !== undefined) ex.intervalo_fim = intervalo_fim || null;
          ex.updated_at = new Date().toISOString();
        }
      });

      saveDB(db);
      res.json({ success: true, message: 'Horários da escala atualizados com sucesso.' });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error?.message || 'Erro ao cadastrar os horários do expediente.' });
    }
  });

  // Edit expediente day
  app.patch('/api/admin/expedientes/:id', requireAdmin, validate(schemas.patchExpediente), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { hora_inicio, hora_fim, intervalo_inicio, intervalo_fim, ativo } = req.body;

      if (isSupabaseConfigured() && req.barbeiroId) {
        const updated = await storage.updateExpediente(id, req.barbeiroId, {
          ...(hora_inicio !== undefined && { hora_inicio }),
          ...(hora_fim !== undefined && { hora_fim }),
          ...(intervalo_inicio !== undefined && { intervalo_inicio }),
          ...(intervalo_fim !== undefined && { intervalo_fim }),
          ...(ativo !== undefined && { ativo: Boolean(ativo) })
        });
        if (!updated) return res.status(404).json({ error: 'Configuração de expediente não encontrada.' });
        return res.json(updated);
      }

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
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error?.message || 'Erro ao atualizar horário de expediente.' });
    }
  });

  // Add block
  app.post('/api/admin/bloqueios', requireAdmin, validate(schemas.createBloqueio), async (req: AuthRequest, res) => {
    try {
      const { data, hora_inicio, hora_fim, motivo, profissional_id } = req.body;
      if (!data || !motivo) {
        return res.status(400).json({ error: 'Data e motivo do bloqueio são obrigatórios.' });
      }

      if (isSupabaseConfigured() && req.barbeiroId) {
        const novo = await storage.createBloqueio(req.barbeiroId, {
          data, hora_inicio: hora_inicio || null, hora_fim: hora_fim || null, motivo,
          profissional_id: profissional_id ?? null
        });
        return res.status(201).json(novo);
      }

      const db = loadDB();
      const novo: Bloqueio = {
        id: `bl-${Date.now()}`,
        barbeiro_id: 'b-1',
        profissional_id: profissional_id ?? null,
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
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error?.message || 'Erro ao criar bloqueio.' });
    }
  });

  // Delete block
  app.delete('/api/admin/bloqueios/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      if (isSupabaseConfigured() && req.barbeiroId) {
        const ok = await storage.deleteBloqueio(id, req.barbeiroId);
        if (!ok) return res.status(404).json({ error: 'Bloqueio não encontrado.' });
        return res.json({ success: true, message: 'Bloqueio removido com sucesso.' });
      }

      const db = loadDB();
      const originalLength = db.bloqueios.length;
      db.bloqueios = db.bloqueios.filter(b => b.id !== id);

      if (db.bloqueios.length === originalLength) {
        return res.status(404).json({ error: 'Bloqueio não encontrado.' });
      }

      saveDB(db);
      res.json({ success: true, message: 'Bloqueio removido com sucesso.' });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error?.message || 'Erro ao remover bloqueio.' });
    }
  });


  // --- BIND LIVE VITE MIDDLEWARE (DEV) OR SERVE BUILDS (PROD) ---
  // Vercel handles static file serving via CDN — skip when running serverless.

  if (!process.env.VERCEL || process.env.NODE_ENV !== 'production') {
    if (process.env.NODE_ENV !== 'production') {
      // Import dinâmico: mantém o Vite (dep enorme) fora do bundle serverless da Vercel.
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      app.get('*', async (req, res, next) => {
        if (req.originalUrl.startsWith('/api')) return next();
        try {
          const indexPath = path.resolve(process.cwd(), 'index.html');
          let template = fs.readFileSync(indexPath, 'utf-8');
          template = await vite.transformIndexHtml(req.originalUrl, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).send(template);
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  return app;
}

async function startServer() {
  // Pré-checagem de conectividade — SÓ no servidor local (nunca em serverless).
  // Se o Supabase estiver inacessível, ativa o fallback offline (db.json).
  // Em serverless (Vercel) isso NÃO roda: manter o Supabase como fonte única
  // evita degradar silenciosamente para dados-semente num FS efêmero.
  if (isSupabaseConfigured()) {
    try {
      console.log('[Supabase] Testando conectividade...');
      const client = serviceClient() || anonClient();
      if (client) {
        const { error } = await client.from('barbeiros').select('id').limit(1);
        if (error) throw error;
        console.log('[Supabase] Conectado com sucesso!');
      }
    } catch (err: any) {
      console.warn('[Supabase] Conectividade indisponível. Ativando fallback local offline (db.json).');
      setSupabaseOffline(true);
    }
  }

  const app = await createApp();
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Barbearia Fullstack Server] rodando em http://0.0.0.0:${PORT}`);
  });
}

// Only start the server when run directly (not imported as a module)
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('server.ts') ||
  process.argv[1].endsWith('server.js')
);

if (isMainModule) {
  startServer();
}
