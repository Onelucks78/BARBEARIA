import Stripe from 'stripe';

// Versão da API fixada explicitamente. Em produção não queremos que uma
// mudança de versão padrão do Stripe altere o formato das respostas sem aviso.
// Precisa ser exatamente o literal aceito por Stripe.LatestApiVersion do SDK
// instalado (stripe@22.3.2) — se divergir, o TypeScript quebra.
const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2026-06-24.dahlia';

// Status considerados "assinatura vigente" (o cliente tem acesso ao plano).
// past_due entra aqui porque o período pago ainda não terminou — a cobrança
// falhou mas o Stripe ainda está tentando; bloquear novo checkout evita duplicidade.
const STATUS_ATIVOS = ['active', 'trialing', 'past_due'];

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION });
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export interface PlanDefinition {
  id: string;
  nome: string;
  priceId: string;
  valor: number;
  categorias: string[];
  destaques: string[];
}

export function getPlanos(): PlanDefinition[] {
  const priceEssential = process.env.STRIPE_PRICE_ESSENTIAL || '';
  const pricePremium = process.env.STRIPE_PRICE_PREMIUM || '';
  const priceExclusive = process.env.STRIPE_PRICE_EXCLUSIVE || '';

  return [
    {
      id: 'essential',
      nome: 'Essential',
      priceId: priceEssential,
      valor: 109.99,
      categorias: ['corte'],
      destaques: ['Cortes ilimitados', 'Agendamento prioritário', 'Sem taxa de reagendamento']
    },
    {
      id: 'premium',
      nome: 'Premium',
      priceId: pricePremium,
      valor: 159.99,
      categorias: ['corte', 'barba'],
      destaques: ['Tudo do Essential', 'Barba ilimitada', 'Produtos com 10% de desconto']
    },
    {
      id: 'exclusive',
      nome: 'Exclusive',
      priceId: priceExclusive,
      valor: 199.99,
      categorias: ['corte', 'barba', 'sobrancelha', 'penteado'],
      destaques: ['Tudo do Premium', 'Sobrancelha e penteado inclusos', 'Atendimento VIP express', 'Produtos com 20% de desconto']
    }
  ];
}

/**
 * Traduz um priceId do Stripe para o id interno do plano.
 * Fonte única de verdade — evita repetir o if/else pelo servidor.
 */
export function planFromPriceId(priceId?: string | null): string | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ESSENTIAL) return 'essential';
  if (priceId === process.env.STRIPE_PRICE_PREMIUM) return 'premium';
  if (priceId === process.env.STRIPE_PRICE_EXCLUSIVE) return 'exclusive';
  return null;
}

/**
 * Extrai o fim do período vigente como ISO string.
 * Nas versões recentes da API o campo vive no subscription item
 * (items.data[0].current_period_end); em versões antigas ficava na raiz.
 * Tratamos os dois casos para não depender da versão negociada.
 */
export function extrairCurrentPeriodEnd(sub: Stripe.Subscription): string | null {
  const item: any = sub?.items?.data?.[0];
  const raiz: any = sub;

  let epoch: number | null = null;
  if (typeof item?.current_period_end === 'number') {
    epoch = item.current_period_end;
  } else if (typeof raiz?.current_period_end === 'number') {
    epoch = raiz.current_period_end;
  }

  if (epoch === null) return null;
  return new Date(epoch * 1000).toISOString();
}

function extrairPriceId(sub: Stripe.Subscription): string | null {
  const item: any = sub?.items?.data?.[0];
  return item?.price?.id || null;
}

export interface ActiveSubscriptionInfo {
  id: string;
  status: string;
  plan: string | null;
  priceId: string | null;
  currentPeriodEnd: string | null;
}

/**
 * Busca a assinatura vigente mais recente de um e-mail.
 * Retorna null se não houver customer ou nenhuma assinatura em STATUS_ATIVOS.
 */
export async function getActiveSubscription(email: string): Promise<ActiveSubscriptionInfo | null> {
  const stripe = getStripe();
  if (!stripe || !email) return null;

  try {
    // O mesmo e-mail pode ter mais de um customer (checkouts antigos, testes).
    const customers = await stripe.customers.list({ email, limit: 10 });
    if (customers.data.length === 0) return null;

    const vigentes: Stripe.Subscription[] = [];
    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'all',
        limit: 100
      });
      for (const sub of subs.data) {
        if (STATUS_ATIVOS.includes(sub.status)) vigentes.push(sub);
      }
    }

    if (vigentes.length === 0) return null;

    // Mais recente primeiro.
    vigentes.sort((a, b) => (b.created || 0) - (a.created || 0));
    const sub = vigentes[0];
    const priceId = extrairPriceId(sub);

    return {
      id: sub.id,
      status: sub.status,
      plan: planFromPriceId(priceId),
      priceId,
      currentPeriodEnd: extrairCurrentPeriodEnd(sub)
    };
  } catch (err: any) {
    console.error('[Stripe] Erro ao buscar assinatura ativa:', err.message);
    return null;
  }
}

/**
 * Agenda o cancelamento para o fim do período vigente.
 * Nunca cancela na hora: o cliente já pagou o mês corrente.
 */
export async function cancelSubscriptionAtPeriodEnd(
  email: string
): Promise<{ ok: boolean; error?: string; currentPeriodEnd?: string }> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: 'Stripe não configurado no servidor.' };

  try {
    const vigente = await getActiveSubscription(email);
    if (!vigente) return { ok: false, error: 'Nenhuma assinatura ativa encontrada.' };

    const atualizada = await stripe.subscriptions.update(vigente.id, {
      cancel_at_period_end: true
    });

    const fim = extrairCurrentPeriodEnd(atualizada) || vigente.currentPeriodEnd;
    return { ok: true, currentPeriodEnd: fim || undefined };
  } catch (err: any) {
    console.error('[Stripe] Erro ao agendar cancelamento da assinatura:', err.message);
    return { ok: false, error: err.message };
  }
}

export async function createCheckoutSession(params: {
  planId: string;
  clienteEmail: string;
  clienteNome: string;
  successUrl: string;
  cancelUrl: string;
  clienteId?: string;
}): Promise<{ url: string | null; error?: string; code?: 'already_subscribed' }> {
  const stripe = getStripe();
  if (!stripe) return { url: null, error: 'Stripe não configurado no servidor.' };

  const plano = getPlanos().find(p => p.id === params.planId);
  if (!plano || !plano.priceId) {
    return { url: null, error: `Plano "${params.planId}" não encontrado ou sem priceId configurado.` };
  }

  // Barra assinatura duplicada antes de gastar uma sessão de checkout.
  const jaAssinante = await getActiveSubscription(params.clienteEmail);
  if (jaAssinante) {
    return { url: null, error: 'Você já possui um plano ativo.', code: 'already_subscribed' };
  }

  try {
    let customerId: string | undefined;
    const customers = await stripe.customers.list({ email: params.clienteEmail, limit: 1 });
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: params.clienteEmail,
        name: params.clienteNome,
        metadata: { plan: params.planId }
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      // Somente cartão: a conta tem boleto habilitado e boleto em assinatura
      // conclui o checkout antes de o dinheiro entrar.
      payment_method_types: ['card'],
      line_items: [{ price: plano.priceId, quantity: 1 }],
      ...(params.clienteId ? { client_reference_id: params.clienteId } : {}),
      metadata: {
        plan: params.planId,
        cliente_email: params.clienteEmail,
        ...(params.clienteId ? { cliente_id: params.clienteId } : {})
      },
      subscription_data: {
        metadata: {
          plan: params.planId,
          cliente_email: params.clienteEmail,
          ...(params.clienteId ? { cliente_id: params.clienteId } : {})
        }
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      allow_promotion_codes: true
    });

    return { url: session.url };
  } catch (err: any) {
    console.error('[Stripe] Erro ao criar checkout session:', err.message);
    return { url: null, error: err.message };
  }
}

export async function createPortalSession(params: {
  customerEmail: string;
  returnUrl: string;
}): Promise<{ url: string | null; error?: string }> {
  const stripe = getStripe();
  if (!stripe) return { url: null, error: 'Stripe não configurado.' };

  try {
    const customers = await stripe.customers.list({ email: params.customerEmail, limit: 1 });
    if (customers.data.length === 0) {
      return { url: null, error: 'Cliente não encontrado no Stripe.' };
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: params.returnUrl,
      configuration: undefined
    });

    return { url: portal.url };
  } catch (err: any) {
    console.error('[Stripe] Erro ao criar portal session:', err.message);
    return { url: null, error: err.message };
  }
}

export type StripeSubscriptionStatus = 'ativo' | 'cancelado' | 'inadimplente' | 'expirado';

export interface SubscriptionInfo {
  status: StripeSubscriptionStatus;
  plan: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  currentPeriodEnd: string;
}

export function constructSubscriptionInfo(event: {
  status: string;
  plan: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  currentPeriodEnd: string;
}): SubscriptionInfo {
  const statusMap: Record<string, StripeSubscriptionStatus> = {
    active: 'ativo',
    trialing: 'ativo',
    past_due: 'inadimplente',
    unpaid: 'inadimplente',
    canceled: 'cancelado',
    incomplete_expired: 'expirado'
  };

  return {
    status: statusMap[event.status] || 'cancelado',
    plan: event.plan,
    stripeCustomerId: event.stripeCustomerId,
    stripeSubscriptionId: event.stripeSubscriptionId,
    currentPeriodEnd: event.currentPeriodEnd
  };
}

export function getStripeClientForWebhook(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
}
