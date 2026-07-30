# Cadastro de cliente por telefone (sem Google)

Data: 2026-07-30
Status: aprovado, pronto pra virar plano de implementação

## 1. Problema

Hoje o cliente só entra no app pelo Google (`src/lib/useAdminSession.ts:135`, botões em
`src/components/VisitorLayout.tsx:498` e `src/components/BookingWizard.tsx:1245`). Parte da
clientela não tem conta Google — usuários de iPhone que só usam o Apple ID, e clientes que
simplesmente não lembram do login. Esses clientes não conseguem assinar plano, que é o foco
comercial do app.

São dois cenários a resolver:

1. **Auto-cadastro**: o cliente se cadastra sozinho pelo celular usando telefone e senha.
2. **Cadastro assistido**: o barbeiro cadastra o cliente no balcão e dispara a cobrança do
   plano recorrente na hora.

## 2. Restrição que define o desenho

O app inteiro identifica o cliente pelo **e-mail**, não por um id estável:

- `stripe.getActiveSubscription(email)` procura o customer por e-mail (`server/stripe.ts:122`)
- checkout, portal, cancelamento e status de assinatura leem `req.userEmail` do JWT
  (`server.ts:465`, `server.ts:510`, `server.ts:539`, `server.ts:561`)
- o webhook do Stripe grava a assinatura achando o cliente por e-mail (`server.ts:280-440`)
- `storage.getClientProfile(email)` / `upsertClientProfile({ email })` (`server/storage.ts:497`)

Um cliente literalmente sem e-mail quebraria toda essa cadeia — justamente a parte que faz o
plano recorrente funcionar.

**Decisão**: não reescrever essa cadeia. Em vez disso, todo cliente de telefone recebe um
**e-mail derivado do telefone**, determinístico e invisível pro usuário. Aos olhos do Supabase
Auth e do Stripe ele é um e-mail normal, então **nenhum dos arquivos acima muda**.

## 3. Decisões tomadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Verificação do telefone | Telefone + senha, **sem SMS** | Custo zero, nada a contratar. Assume o risco de número não verificado. |
| E-mail do cliente | E-mail invisível derivado do telefone | Preserva toda a cadeia Stripe existente. Cliente nunca digita e-mail. |
| Campo e-mail no Checkout Stripe | Vem **preenchido e travado** com o e-mail invisível | Cliente só digita o cartão. Recibo/dunning não chegam a ninguém — por decisão. |
| Senha no cadastro assistido | O barbeiro digita a senha combinada com o cliente | Cliente sai do balcão com login funcionando. |

Consequência aceita: quando um cartão falha, ninguém recebe e-mail. Quem detecta é o barbeiro,
pelo painel — por isso a tarja de inadimplência da seção 7 faz parte do escopo, não é extra.

## 4. O e-mail invisível

Módulo novo `lib/telefone.ts`, na raiz, importado **tanto pelo front quanto pelo servidor**
(o alias `@/` já mapeia a raiz e ambos os lados importam de `lib/`).

```ts
// subdomínio do domínio real da barbearia (detalhebarbearia.com.br — "detalhe",
// singular; o nome da pasta do projeto está no plural e não serve de referência).
// Nunca recebe e-mail: é só um endereço estável e único por telefone.
export const DOMINIO_CLIENTE = 'cliente.detalhebarbearia.com.br';

export function normalizarTelefone(t: string): string   // só dígitos
export function telefoneParaEmail(t: string): string    // '5511987654321@cliente.detalhebarbearia.com.br'
export function emailEDeTelefone(e: string): boolean    // termina em @DOMINIO_CLIENTE
```

Usar um subdomínio de domínio próprio, e não um domínio inventado, evita dois problemas: o
endereço não colide com o de outra pessoa e, se um cliente chegar a enxergá-lo na tela de
pagamento do Stripe, ele parece legítimo. **Não criar registro MX nesse subdomínio** — sem MX,
os e-mails do Stripe são recusados na entrega em vez de sumirem em silêncio, e nada polui a
caixa principal `@detalhebarbearia.com.br`.

Regras:

- O telefone é normalizado pra só dígitos antes de virar e-mail. Já existe `onlyDigits`
  em `server/validation.ts` e o schema `phone` em `server/schemas.ts:5` aceita 10 ou 11
  dígitos — `normalizarTelefone` segue a mesma regra pra os dois lados baterem sempre.
- O prefixo `55` entra **só no e-mail**, para o formato ficar estável se um dia entrar SMS.
  A coluna `clientes.telefone` continua guardando 10 ou 11 dígitos, como toda a base já faz —
  mudar isso quebraria o índice único e os agendamentos existentes.
- `emailEDeTelefone` existe para a UI **nunca exibir** esse e-mail ao usuário: onde hoje
  o painel mostra o e-mail do cliente, mostra o telefone quando o e-mail for sintético.

Colisão não é possível dentro de uma barbearia: `clientes` já tem `unique (barbeiro_id, telefone)`
(`supabase/migrations/001_init.sql:83`), e o e-mail é função pura do telefone.

## 5. Auto-cadastro pelo cliente

### 5.1 Servidor — `POST /api/auth/cadastro-telefone`

Rota pública (sem `requireAuth`). Corpo: `{ nome, telefone, senha }`, validado por um schema
novo `clientSignupTelefone` em `server/schemas.ts`, reaproveitando o `phone` existente e
exigindo `senha` com mínimo de 6 caracteres (mesma regra do `clientLogin` atual).

Fluxo:

1. Normaliza o telefone e deriva o e-mail.
2. Cria o usuário via `serviceClient().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nome, telefone } })`.
   - **`email_confirm: true` é obrigatório.** Sem isso o Supabase espera o clique num link
     de confirmação enviado pra uma caixa que não existe, e o cadastro nunca ativa.
   - Exige `SUPABASE_SERVICE_ROLE_KEY`, que já está configurada e já é usada assim
     (`server/supabase.ts:36`).
3. Grava a linha em `clientes` com `barbeiro_id` (barbearia ativa), `nome`, `telefone`,
   `email` sintético e `auth_user_id` do usuário criado. Se já existir ficha com esse telefone
   — caso comum, o barbeiro cadastrou o cliente antes sem senha —, **reaproveita a ficha**
   preenchendo `auth_user_id` e `email`, em vez de criar uma segunda. O histórico de
   agendamentos do cliente não pode se perder por causa do cadastro.
4. Se o usuário já existe: **409** com `{ error: 'Esse telefone já tem conta. Entre com sua senha.' }`.
   O front trata esse código abrindo a aba de login com o telefone já preenchido.

Se o passo 3 falhar depois do passo 2 ter dado certo, a rota apaga o usuário recém-criado
(`auth.admin.deleteUser`) antes de retornar erro. Sem isso sobra um login órfão que impede o
cliente de tentar de novo — ele bateria em 409 pra sempre com uma conta que não tem ficha.

A rota não é chamada quando `isSupabaseConfigured()` é falso: no modo `db.json` ela responde
501 explicando que o cadastro por telefone exige Supabase. O modo offline continua usando o
`logged_client` do localStorage como hoje.

### 5.2 Front — funções de sessão

Em `src/lib/useAdminSession.ts`, ao lado das que já existem:

```ts
signUpClientTelefone(nome, telefone, senha)  // chama a rota acima, depois loga
signInClientTelefone(telefone, senha)        // signInWithPassword({ email: telefoneParaEmail(telefone), senha })
```

O login é o `signInWithPassword` que já existe — só muda o e-mail que entra nele. Nenhuma
mudança em `attachUser` (`server/auth.ts:46`): o JWT vem com o e-mail sintético e todo o resto
do servidor funciona sem saber a diferença.

### 5.3 Front — telas

Componente novo `src/components/ClientAuthModal.tsx`, usado nos **dois** pontos onde hoje
existe o botão do Google pro cliente (`VisitorLayout.tsx:498` e `BookingWizard.tsx:1245`),
para não duplicar formulário.

- Botão "Entrar com telefone" ao lado do "Entrar com Google". **O Google continua intacto.**
- Duas abas: *Já tenho conta* (telefone + senha) e *Criar conta* (nome + telefone + senha).
- Máscara de telefone na digitação; envio sempre só com dígitos.
- Segue o design system do projeto (`rounded-sm`, tokens de tema, padrão do `AuthModal.tsx`).

`AuthModal.tsx` é a porta do **barbeiro** e não muda.

## 6. Cadastro assistido pelo barbeiro

### 6.1 Senha no cadastro de cliente

`schemas.createClient` (`server/schemas.ts:115`) ganha `senha: z.string().min(6).optional()`.

Em `POST /api/admin/clientes` (`server.ts:1445`):

- **sem `senha`**: comportamento de hoje, cria só a ficha (cliente avulso que nunca vai usar o app).
- **com `senha`**: cria a ficha e o login, exatamente como a seção 5.1, e grava `auth_user_id`.

O campo aparece no formulário de cliente do painel como opcional, com um texto curto explicando
que é a senha que o cliente vai usar pra entrar no app.

### 6.2 `POST /api/admin/clientes/:id/link-pagamento`

`requireAdmin`. Corpo: `{ planId }` (`essential | premium | exclusive`).

1. Carrega o cliente e confere que ele pertence ao `req.barbeiroId` (multi-tenant; mesmo cuidado
   do `updateCliente`, `server/storage.ts:1022`).
2. Chama `stripe.createCheckoutSession` (`server/stripe.ts:183`) com o e-mail do cliente e
   `clienteId` = `auth_user_id`. A função já cria ou reaproveita o customer do Stripe e **já
   bloqueia assinatura duplicada** devolvendo `already_subscribed` — esse 409 é repassado ao painel.
3. Responde `{ url }`.

Como o customer do Stripe é criado com o e-mail sintético, o Checkout mostra o campo de e-mail
preenchido e travado — que é o comportamento pedido. Nenhuma mudança em `server/stripe.ts`.

### 6.3 UI do painel

Na ficha do cliente, botão **"Cobrar plano"**: escolhe o plano, chama a rota e mostra o link
com *Copiar link* e *Mandar no WhatsApp* (`https://wa.me/55<telefone>?text=<mensagem+link>`).

O cartão é sempre digitado pelo cliente na página do Stripe — no tablet do barbeiro ou no
celular dele pelo link. **Em nenhum momento o app coleta número de cartão.**

## 7. Os dois buracos que entram no mesmo escopo

### 7.1 Redefinir senha

`AuthModal.tsx:77` recupera senha por e-mail. Cliente de telefone não tem caixa de e-mail, então
ficaria trancado pra fora permanentemente no primeiro esquecimento.

Rota nova `POST /api/admin/clientes/:id/redefinir-senha` (`requireAdmin`, corpo `{ senha }`),
usando `auth.admin.updateUserById`. Botão "Redefinir senha" na ficha do cliente. O cliente pede
ao barbeiro, presencial ou por telefone.

Na tela do cliente, o link "Esqueceu sua senha?" só aparece para login por e-mail. No modo
telefone, o texto vira uma orientação pra falar com a barbearia.

### 7.2 Inadimplente visível no painel

Com o e-mail invisível, o aviso de cartão recusado do Stripe não chega a ninguém. O dado existe:
o webhook grava `pendencia: true` dentro do JSON de `observacoes` (`server.ts:317`), lido por
`isClientVip` / `getClientPlan` (`server/storage.ts:242`).

Adicionar um helper `temPendenciaPagamento(observacoes)` no mesmo lugar e exibir uma tarja
**"Pagamento falhou"** na lista de clientes do painel, junto do selo de VIP que já existe.
Sem isso, a decisão "o barbeiro avisa" não tem como ser cumprida — ele não teria onde ver.

## 8. Fora de escopo

- SMS / OTP. O desenho não impede ligar isso depois: o e-mail sintético já carrega o DDI, e a
  verificação entraria como um passo a mais no cadastro, sem mexer em Stripe nem no banco.
- Login por Apple ID.
- Trocar a chave de identidade de e-mail para `auth_user_id` no servidor. É o caminho
  arquiteturalmente correto a longo prazo, mas mexeria em Stripe, webhook e storage de uma vez —
  risco alto e sem ganho imediato para o objetivo atual.
- Recibo por WhatsApp automático.

## 9. Riscos assumidos

1. **Telefone não verificado.** Sem SMS, ninguém prova que o número é do dono. Um número já
   cadastrado é protegido (o 409 barra a segunda conta), então o risco real é alguém cadastrar
   preventivamente um número alheio. Impacto baixo: quem paga é o dono do cartão e o cliente
   aparece presencialmente. Mitigável depois com SMS.
2. **E-mails do Stripe caem no vazio.** Recibos e avisos de cobrança batem num subdomínio sem
   MX e voltam como não entregues. É o comportamento escolhido; a tarja da seção 7.2 é a
   compensação. Volume alto de rejeição não afeta a conta Stripe (são e-mails transacionais para
   um endereço só), mas se um dia a barbearia passar a mandar marketing por e-mail, vale revisar.
3. **Recuperação de senha depende do barbeiro.** Não há caminho self-service.

## 10. Verificação

Cenários que precisam passar antes de considerar pronto:

1. Cliente novo se cadastra por telefone e **entra na mesma hora**, sem tela de confirmação.
2. Tentar cadastrar o mesmo telefone de novo devolve 409 com a mensagem de login.
3. Cliente de telefone assina um plano pelo Checkout e vira VIP: `observacoes.subscription.status`
   fica `ativo` e entra o lançamento em `lancamentos_financeiros`.
4. Cliente que entrou pelo Google continua entrando, assinando e cancelando igual a hoje —
   nenhuma regressão.
5. Barbeiro cadastra cliente com senha, gera o link de pagamento e o cliente paga pelo link.
6. Barbeiro cadastra cliente **sem** senha: cria só a ficha, sem login, como hoje.
7. Barbeiro redefine a senha de um cliente e o cliente entra com a senha nova.
8. Cliente com `pendencia: true` aparece com a tarja "Pagamento falhou" na lista do painel.
9. `npm run lint` (`tsc --noEmit`) limpo.
