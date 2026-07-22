import Stripe from 'stripe';

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // Sem apiVersion fixa: usa a versão padrão fixada pelo SDK instalado (sempre válida).
  return new Stripe(key);
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

export async function createCheckoutSession(params: {
  planId: string;
  clienteEmail: string;
  clienteNome: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string | null; error?: string }> {
  const stripe = getStripe();
  if (!stripe) return { url: null, error: 'Stripe não configurado no servidor.' };

  const plano = getPlanos().find(p => p.id === params.planId);
  if (!plano || !plano.priceId) {
    return { url: null, error: `Plano "${params.planId}" não encontrado ou sem priceId configurado.` };
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
      line_items: [{ price: plano.priceId, quantity: 1 }],
      metadata: { plan: params.planId, cliente_email: params.clienteEmail },
      subscription_data: {
        metadata: { plan: params.planId, cliente_email: params.clienteEmail }
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
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}
