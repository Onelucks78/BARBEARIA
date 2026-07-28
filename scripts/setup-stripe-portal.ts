// scripts/setup-stripe-portal.ts
//
// Cria/atualiza a configuração do Portal do Cliente da Stripe.
// O portal é onde o assinante troca o cartão, vê faturas e cancela o plano.
// A configuração NÃO atravessa test/live — precisa existir nos dois modos.
//
//   $env:STRIPE_LIVE_KEY = "sk_live_..."
//   npx tsx scripts/setup-stripe-portal.ts
//
// Idempotente: se já existir uma configuração padrão, atualiza em vez de criar.

import Stripe from 'stripe';

const KEY = process.env.STRIPE_LIVE_KEY || '';
const RETURN_URL = process.env.APP_URL || 'https://detalhebarbearia.com.br';

async function main() {
  if (!KEY) {
    console.error('ERRO: defina STRIPE_LIVE_KEY antes de rodar.');
    process.exit(1);
  }

  const stripe = new Stripe(KEY);

  // Espelha a configuração que já existe em modo de teste:
  // cancelamento ao fim do período, troca de cartão e histórico de faturas.
  // subscription_update fica desligado: a troca de plano passa pelo app.
  const features: any = {
    customer_update: {
      enabled: true,
      allowed_updates: ['name', 'email', 'address', 'phone']
    },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: {
      enabled: true,
      mode: 'at_period_end',
      proration_behavior: 'none',
      cancellation_reason: {
        enabled: true,
        options: ['too_expensive', 'switched_service', 'unused', 'other']
      }
    },
    subscription_pause: { enabled: false }
  };

  const existentes = await stripe.billingPortal.configurations.list({ limit: 10 });
  const padrao = existentes.data.find(c => c.is_default) || existentes.data[0];

  if (padrao) {
    const atualizada = await stripe.billingPortal.configurations.update(padrao.id, {
      features,
      default_return_url: RETURN_URL
    });
    console.log(`Portal atualizado: ${atualizada.id} (livemode=${atualizada.livemode})`);
  } else {
    const criada = await stripe.billingPortal.configurations.create({
      features,
      default_return_url: RETURN_URL,
      business_profile: {}
    });
    console.log(`Portal criado: ${criada.id} (livemode=${criada.livemode})`);
  }

  console.log(`Retorno do portal aponta para: ${RETURN_URL}`);
}

main().catch(err => {
  console.error('\nFalhou:', err?.message || err);
  if (String(err?.message || '').toLowerCase().includes('terms')) {
    console.error(
      '\nA Stripe exige Termos de Serviço e Política de Privacidade públicos para o portal em live.'
    );
    console.error('Preencha em: Dashboard → Settings → Public details / Branding.');
  }
  process.exit(1);
});
