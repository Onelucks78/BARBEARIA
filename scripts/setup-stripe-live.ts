// scripts/setup-stripe-live.ts
//
// Cria em modo LIVE os 3 produtos/preços dos planos e (opcionalmente) o endpoint
// de webhook. Objetos da Stripe NÃO atravessam test/live — precisam ser recriados.
//
// A chave nunca fica no repositório: passe por variável de ambiente na hora.
//
//   PowerShell:
//     $env:STRIPE_LIVE_KEY = "rk_live_..."   # chave restrita, de preferência
//     npx tsx scripts/setup-stripe-live.ts --dry-run
//     npx tsx scripts/setup-stripe-live.ts
//     npx tsx scripts/setup-stripe-live.ts --webhook https://seudominio.com.br/api/stripe/webhook
//
// O script é idempotente: procura por metadata.plan_key antes de criar, então
// rodar duas vezes não gera produto duplicado.

import Stripe from 'stripe';

const KEY = process.env.STRIPE_LIVE_KEY || '';
const DRY_RUN = process.argv.includes('--dry-run');
const webhookIdx = process.argv.indexOf('--webhook');
const WEBHOOK_URL = webhookIdx >= 0 ? process.argv[webhookIdx + 1] : '';

// Mesmos valores de server/stripe.ts (getPlanos) — fonte única dos planos.
const PLANOS = [
  {
    key: 'essential',
    nome: 'Plano Essential',
    descricao: 'Cortes ilimitados, agendamento prioritário, sem taxa de reagendamento.',
    centavos: 10999,
    envVar: 'STRIPE_PRICE_ESSENTIAL'
  },
  {
    key: 'premium',
    nome: 'Plano Premium',
    descricao: 'Tudo do Essential, barba ilimitada, produtos com 10% de desconto.',
    centavos: 15999,
    envVar: 'STRIPE_PRICE_PREMIUM'
  },
  {
    key: 'exclusive',
    nome: 'Plano Exclusive',
    descricao: 'Tudo do Premium, sobrancelha e penteado inclusos, atendimento VIP express, produtos com 20% de desconto.',
    centavos: 19999,
    envVar: 'STRIPE_PRICE_EXCLUSIVE'
  }
];

// Eventos que o webhook do server.ts realmente trata.
const EVENTOS = [
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted'
];

async function main() {
  if (!KEY) {
    console.error('ERRO: defina STRIPE_LIVE_KEY antes de rodar.');
    console.error('  PowerShell: $env:STRIPE_LIVE_KEY = "rk_live_..."');
    process.exit(1);
  }

  if (KEY.includes('_test_')) {
    console.error('ERRO: STRIPE_LIVE_KEY parece ser uma chave de TESTE. Este script é para live.');
    process.exit(1);
  }

  const stripe = new Stripe(KEY);
  const resultado: Record<string, string> = {};

  console.log(DRY_RUN ? '\n=== DRY RUN (nada será criado) ===\n' : '\n=== CRIANDO EM MODO LIVE ===\n');

  for (const plano of PLANOS) {
    // Idempotência: se já existe produto com esse plan_key, reusa.
    const existentes = await stripe.products.search({
      query: `metadata['plan_key']:'${plano.key}'`,
      limit: 1
    });

    let produtoId: string;
    if (existentes.data.length > 0) {
      produtoId = existentes.data[0].id;
      console.log(`• ${plano.nome}: produto já existe (${produtoId}) — reusando.`);
    } else if (DRY_RUN) {
      console.log(`• ${plano.nome}: criaria produto + preço R$ ${(plano.centavos / 100).toFixed(2)}/mês`);
      continue;
    } else {
      const produto = await stripe.products.create({
        name: plano.nome,
        description: plano.descricao,
        metadata: { plan_key: plano.key }
      });
      produtoId = produto.id;
      console.log(`• ${plano.nome}: produto criado (${produtoId})`);
    }

    // Preço recorrente mensal em BRL.
    const precos = await stripe.prices.list({ product: produtoId, active: true, limit: 10 });
    const jaTem = precos.data.find(
      p => p.unit_amount === plano.centavos && p.currency === 'brl' && p.recurring?.interval === 'month'
    );

    if (jaTem) {
      resultado[plano.envVar] = jaTem.id;
      console.log(`  preço já existe: ${jaTem.id}`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  criaria preço R$ ${(plano.centavos / 100).toFixed(2)}/mês`);
      continue;
    }

    const preco = await stripe.prices.create({
      product: produtoId,
      unit_amount: plano.centavos,
      currency: 'brl',
      recurring: { interval: 'month' },
      metadata: { plan_key: plano.key }
    });
    resultado[plano.envVar] = preco.id;
    console.log(`  preço criado: ${preco.id} (R$ ${(plano.centavos / 100).toFixed(2)}/mês)`);
  }

  if (WEBHOOK_URL) {
    if (!WEBHOOK_URL.startsWith('https://')) {
      console.error(`\nERRO: a URL do webhook precisa ser https:// — recebi "${WEBHOOK_URL}"`);
      process.exit(1);
    }
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const existente = endpoints.data.find(e => e.url === WEBHOOK_URL);

    if (existente) {
      console.log(`\n• Webhook já existe para essa URL (${existente.id}).`);
      console.log('  O signing secret só é exibido na criação — pegue no Dashboard se precisar.');
    } else if (DRY_RUN) {
      console.log(`\n• Criaria webhook em ${WEBHOOK_URL}`);
      console.log(`  eventos: ${EVENTOS.join(', ')}`);
    } else {
      const endpoint = await stripe.webhookEndpoints.create({
        url: WEBHOOK_URL,
        enabled_events: EVENTOS as any
      });
      console.log(`\n• Webhook criado: ${endpoint.id}`);
      console.log(`  STRIPE_WEBHOOK_SECRET=${endpoint.secret}`);
      console.log('  ^ copie AGORA: esse valor não é exibido de novo.');
    }
  }

  if (!DRY_RUN && Object.keys(resultado).length > 0) {
    console.log('\n=== Cole na Vercel (Environment Variables, escopo Production) ===\n');
    for (const [k, v] of Object.entries(resultado)) {
      console.log(`${k}=${v}`);
    }
    console.log('\nNão esqueça também: STRIPE_SECRET_KEY (sk_live_...), STRIPE_WEBHOOK_SECRET e APP_URL.');
  }

  console.log('');
}

main().catch(err => {
  console.error('\nFalhou:', err?.message || err);
  process.exit(1);
});
