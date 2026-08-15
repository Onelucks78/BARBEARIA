# Status do Projeto — Detalhe Barbearia

> Documento vivo: registra o estado atual do sistema (agenda, agendamento e
> login de clientes) e o histórico do fluxo Stripe/Planos/VIP. Atualize aqui
> sempre que mexer nesses fluxos.

**Última atualização:** 14/08/2026 · commit `f6588f4` (produção: detalhebarbearia.com.br)

---

## PARTE A — AGENDA & AGENDAMENTO (estado atual)

### 1. Grade semanal (`src/components/admin/AgendaSemanal.tsx`)

- **Blocos pintados por agendamento** (sem card flutuante): cada célula de 15min
  coberta pelo horário do agendamento é pintada (fundo + barra lateral forte de 4px).
- **Cores alternadas a cada agendamento** (azul, roxo, vermelho, verde, laranja,
  azul-claro, rosa) — ordenadas pelo início do dia, para diferenciar quando um
  termina e outro começa.
- **Sem linhas internas dentro do mesmo agendamento**: os blocos do mesmo
  agendamento ficam colados (a linha horizontal só aparece no fim do agendamento
  e entre agendamentos diferentes).
- **Alinhado às linhas da grade**: o bloco começa e termina exatamente na linha
  de 15min (fim arredondado para cima com `Math.ceil`).
- **Preenchimento reforçado** (`bg-*/30`) para a duração inteira ficar visível.
- **Clique:** bloco pintado → abre o detalhe; célula livre → abre o modal de
  novo agendamento com data/horário pré-selecionados.
- **Responsivo:** sem `min-width` fixo, largura total; no celular a grade encosta
  na lateral (`-mx-6 md:mx-0`); navegação `[<] Hoje [>]` centralizada; sem
  indicador de data e sem título do dia.

### 2. Cancelar = excluir

- O botão do modal de detalhe virou **"Excluir"** (com confirmação).
- Novo endpoint `DELETE /api/admin/agendamentos/:id` (`server.ts` +
  `storage.deleteAgendamento`), que resolve código `#000xxx` → uuid e apaga a
  linha do Supabase (ou do db.json em dev).
- Agendamentos com status `cancelado`/`faltou` não pintam mais blocos na grade.

### 3. Bug crítico corrigido — purge apagando agendamentos do dia

- **Sintoma:** agendamentos "sumiam" sem erro no console.
- **Causa:** `purgeOldAgendamentos` usava a data do servidor (**UTC**) como corte
  (`inicio_em < hoje-00:00`). Depois da meia-noite UTC (que é à noite no Brasil),
  ele apagava todos os agendamentos do dia local.
- **Correção:** `getTodayLocalDateString` agora subtrai 3h (Brasil, UTC-3) antes
  de pegar a data — nunca mais apaga o dia atual.
- **Dado:** agendamentos purgados foram restaurados via script (não recuperável
  automaticamente).

### 4. Popup de agendamento virou wizard de 5 passos (`ManualBookingModal.tsx`)

Ordem: **Cliente → Serviço → Dia → Horário → Revisão**, com barra de progresso
e botões Voltar/Avançar. Serviço agora é seleção por cards (nome + preço + duração).

### 5. Criar conta do cliente na tela de agendamento

- Checkbox **"Criar acesso de login para o cliente"** no passo Cliente.
- **Senha padrão fixa:** `DETALHE@123` (o cliente entra no site com o telefone
  + essa senha; pode trocar via "Esqueci minha senha").
- Reaproveita o fluxo existente: `POST /api/admin/clientes` com `senha` →
  `criarLoginClienteTelefone` (server/clienteAuth.ts) cria o usuário no Supabase
  Auth com **e-mail sintético derivado do telefone**
  (`55DDD+numero@cliente.detalhebarbearia.com.br`, `lib/telefone.ts`).
- **Telefone já com conta** → não trava: agenda com a conta existente e mostra
  aviso suave (vinculo via `cliente_email` sintético).
- O agendamento agora **vincula ao cliente** (autocomplete ou conta criada) via
  `cliente_id`/`cliente_email`.

### 6. Outras correções de horários

- **RPC `get_available_slots`** (migration `019_fix_slots_overlap.sql`): o check
  de sobreposição usava `v_step` (15min) em vez de `v_duracao` — um slot dentro
  da janela do serviço não era bloqueado. Corrigido com `v_current_end`.
- **Modal com lista de horários desatualizada:** o efeito de busca agora depende
  de `isOpen` — reabrir o modal refaz a consulta (não mostra mais horário
  "disponível" logo após reservar).

---

## PARTE B — STRIPE / PLANOS / VIP (histórico)

## 7. Contexto

- App de barbearia com assinatura mensal de 3 planos (Essential, Premium, Exclusive).
- Pagamento via **Stripe Checkout** (mode `subscription`), cobrança mensal automática.
- Backend: `server.ts` + `server/stripe.ts`. Frontend da área do cliente: `UserLayout.tsx`.
- VIP do cliente = campo `subscription.status === 'ativo'` gravado nas `observacoes`
  do cliente pelo webhook da Stripe (`server/storage.ts:242` `isClientVip`).

## 8. O problema (venda perdida) — resolvido

Cliente tentou assinar o **Premium (R$ 149,99)** e o checkout falhou com
`No such price ... a similar object exists in test mode`.

**Causa raiz:** `STRIPE_PRICE_PREMIUM` de produção apontava para um preço de
**modo TESTE**; o servidor usa a chave **LIVE**, e objetos Stripe não atravessam
test/live.

## 9. Preços (verificados em LIVE)

| Plano | Preço | Price ID (LIVE) | Status |
|---|---|---|---|
| Essential | R$ 109,99 | `price_1Ty0CVQ7pBi8E9SgfyhgWOUm` | ✅ LIVE |
| Premium | R$ 149,99 | `price_1U0qeSQ7pBi8E9Sgrr8cEsm0` | ✅ LIVE |
| Exclusive | R$ 199,99 | `price_1Ty0CYQ7pBi8E9Sgy70wPizn` | ✅ LIVE |

## 10. Fluxo da assinatura

1. Cliente logado escolhe o plano → `POST /api/stripe/create-checkout-session`.
2. Stripe Checkout (subscription) → cliente paga.
3. Webhooks (`/api/stripe/webhook`): `checkout.session.completed` → VIP;
   `invoice.paid` → renovação; `invoice.payment_failed` → pendência; subscription
   updated/deleted → atualiza/corta VIP.
4. **Autocura:** `GET /api/stripe/subscription` consulta a Stripe direto e grava
   o VIP se o webhook atrasar. Frontend faz polling (volta do checkout, aba
   "Meu Plano" e a cada 2min).

## 11. Pontos de atenção futuros

- **NUNCA** criar preço/produto em modo teste para produção — objetos não
  atravessam test/live.
- Mudou valor de plano? Criar o novo `price_` **em LIVE**, atualizar a env na
  Vercel e redeploy. `scripts/setup-stripe-live.ts` é a referência idempotente.
- `STRIPE_WEBHOOK_SECRET` é específico do endpoint live.
- Teste local de Stripe: chave `sk_test_...` E preços de teste correspondentes.
- Não remover o polling do `/api/stripe/subscription` — é o que autocura o VIP.
- **Agenda:** a correção do purge (data UTC-3) é crítica — não regredir para
  `new Date()` puro no servidor.
