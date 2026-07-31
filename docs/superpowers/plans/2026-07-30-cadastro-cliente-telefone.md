# Cadastro de Cliente por Telefone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o cliente crie conta e faça login com telefone + senha (sem Google), e que o barbeiro cadastre o cliente no balcão e dispare a cobrança do plano recorrente — sem alterar o motor de assinatura do Stripe que já funciona.

**Architecture:** Cada telefone é convertido de forma determinística num e-mail sintético (`5511987654321@cliente.detalhebarbearia.com.br`). O cliente nunca vê nem digita esse e-mail: ele conhece só telefone e senha. Como Supabase Auth e Stripe recebem um e-mail válido, toda a cadeia existente (checkout, webhook, portal, cancelamento, marcação de VIP) continua funcionando sem alteração. A criação do login usa a Admin API do Supabase no servidor, com `email_confirm: true`, porque não existe caixa de e-mail para confirmar.

**Tech Stack:** TypeScript, React 19, Vite, Express, Supabase (Auth + Postgres), Stripe, Zod, Tailwind v4, Vitest (adicionado na Tarefa 2).

**Spec:** `docs/superpowers/specs/2026-07-30-cadastro-cliente-telefone-design.md`

## Global Constraints

- **INVARIANTE CRÍTICA:** para qualquer cliente com login por telefone, `clientes.email` **tem que ser exatamente igual** ao e-mail do usuário no Supabase Auth (o sintético). O webhook do Stripe encontra o cliente por `clientes.email` (`server.ts:112`) e o customer do Stripe é criado com o e-mail do JWT. Se os dois divergirem, o cliente paga e **nunca** vira VIP. Nenhuma tarefa pode gravar um e-mail digitado à mão na ficha de um cliente que tem login por telefone.
- **Não alterar `server/stripe.ts`** exceto por um único `export` na Tarefa 1. Nenhuma mudança de lógica de cobrança.
- **Não alterar `server/auth.ts`.** O JWT do cliente de telefone traz o e-mail sintético e todo o resto do servidor funciona sem saber a diferença.
- **Login com Google não pode regredir em nada.** Nenhum botão do Google é removido ou movido.
- Domínio do e-mail sintético: `cliente.detalhebarbearia.com.br` (barbearia é **"detalhe"**, singular — o nome da pasta do projeto está no plural e não serve de referência). Nenhum registro DNS precisa ser criado.
- `clientes.telefone` continua guardando **10 ou 11 dígitos**, sem DDI. O `55` entra só no e-mail.
- Senha mínima: **6 caracteres**, igual ao `clientLogin` que já existe (`server/schemas.ts:35`).
- Comentários e mensagens de interface em português, seguindo o código existente. Comentário só onde explica um *porquê* não óbvio.
- Estilo visual: `rounded-sm`, tokens de tema (`bg-card`, `border-border`, `text-muted-foreground`), seguindo `src/components/AuthModal.tsx`.
- Verificação de tipos a cada tarefa: `npm run lint` (é `tsc --noEmit`) precisa passar limpo antes do commit.

---

### Task 1: Gravar `renews_at` no webhook do Stripe (bug pré-existente)

Hoje o webhook grava `status`, `plan`, `stripeReferenceId` e `pendencia`, mas **nunca grava `renews_at`** (`server.ts:108-138`, `server.ts:382-440`). A interface lê esse campo em 6 lugares e trata sua ausência como plano vencido:

- `src/components/UserLayout.tsx:84` — sem `renews_at`, o painel do cliente não mostra o plano como vigente.
- `src/components/AdminLayout.tsx:1030` — `new Date(undefined) >= new Date()` é `false`, então todo assinante aparece com a tarja "vencido".

Sem esta correção, todo cliente criado pelo fluxo novo nasce marcado como vencido e a tarja de inadimplência da Tarefa 11 fica inútil (tudo já estaria vermelho). Vale igualmente para os clientes que já entram pelo Google.

**Files:**
- Modify: `server/stripe.ts:84` (só trocar `function` por `export function`)
- Modify: `server.ts:382-440` (`registrarAssinatura`)
- Modify: `server.ts:339-346` (case `customer.subscription.updated`)

**Interfaces:**
- Consumes: nada.
- Produces: `stripe.extrairCurrentPeriodEnd(sub: Stripe.Subscription): string | null` — passa a ser exportado; usado na Tarefa 1 apenas.

- [ ] **Step 1: Exportar `extrairCurrentPeriodEnd`**

Em `server/stripe.ts`, linha 84, trocar a assinatura da função (o corpo não muda):

```ts
export function extrairCurrentPeriodEnd(sub: Stripe.Subscription): string | null {
```

- [ ] **Step 2: Gravar `renews_at` e `price` em `registrarAssinatura`**

Em `server.ts`, dentro de `async function registrarAssinatura(...)`, logo depois de `const planoDescricao = plan || 'plano não identificado';`, inserir:

```ts
  // renews_at: a interface do cliente (UserLayout.tsx:84) e o painel do barbeiro
  // (AdminLayout.tsx:1030) tratam a ausência dessa data como plano vencido. O webhook
  // nunca a gravava, então quem pagava aparecia como vencido no mesmo dia.
  const vigente = await stripe.getActiveSubscription(email);
  const renewsAt = vigente?.currentPeriodEnd ?? null;
```

No mesmo arquivo, no bloco Supabase da função, trocar a chamada:

```ts
      await patchSubscriptionObservacoes(email, {
        status: 'ativo',
        ...(plan ? { plan } : {}),
        ...(renewsAt ? { renews_at: renewsAt } : {}),
        price: valor,
        stripeReferenceId: referenceId,
        pendencia: false
      });
      return;
```

E no bloco de fallback `db.json` da mesma função, trocar o objeto `obs.subscription = {...}` por:

```ts
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
```

- [ ] **Step 3: Gravar `renews_at` no `customer.subscription.updated`**

Em `server.ts`, no `case 'customer.subscription.updated'`, logo antes de `const atualizou = await patchSubscriptionObservacoes(email, {`, inserir:

```ts
          const renewsAt = stripe.extrairCurrentPeriodEnd(sub);
```

E acrescentar a linha dentro do objeto passado:

```ts
          const atualizou = await patchSubscriptionObservacoes(email, {
            status,
            ...(plan ? { plan } : {}),
            ...(renewsAt ? { renews_at: renewsAt } : {}),
            stripeReferenceId: sub.id,
            // past_due = cartão falhou mas ainda em recobrança; active/trialing limpa a pendência.
            pendencia: sub.status === 'past_due'
          });
```

- [ ] **Step 4: Verificar tipos**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 5: Verificar o comportamento manualmente**

Não há harness de teste para o webhook neste projeto. Verificação por inspeção dirigida:

Run: `grep -n "renews_at" server.ts`
Expected: 3 ocorrências — duas em `registrarAssinatura` (Supabase e fallback db.json), uma no `customer.subscription.updated`.

Run: `grep -n "export function extrairCurrentPeriodEnd" server/stripe.ts`
Expected: 1 ocorrência.

A verificação end-to-end com Stripe em modo teste está na Tarefa 12 — não repetir aqui.

- [ ] **Step 6: Commit**

```bash
git add server.ts server/stripe.ts
git commit -m "fix(stripe): gravar renews_at no webhook para o plano nao nascer vencido"
```

---

### Task 2: Módulo `lib/telefone.ts` com testes

Conversão telefone ↔ e-mail sintético. É o único ponto do sistema que precisa dar exatamente o mesmo resultado no front e no servidor: se divergirem, o cliente cadastra por um e-mail e tenta entrar por outro, e o login falha sem mensagem que explique. Por isso é a única parte do plano com teste automatizado — e por isso o Vitest entra aqui.

**Files:**
- Create: `lib/telefone.ts`
- Create: `lib/telefone.test.ts`
- Modify: `package.json` (devDependency `vitest` + script `test`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `DOMINIO_CLIENTE: string`
  - `normalizarTelefone(telefone: string): string`
  - `telefoneEValido(telefone: string): boolean`
  - `telefoneParaEmail(telefone: string): string` — lança `Error` se o telefone não tiver 10 ou 11 dígitos
  - `emailEDeTelefone(email?: string | null): boolean`

- [ ] **Step 1: Instalar o Vitest**

```bash
npm install -D vitest
```

Depois, em `package.json`, acrescentar ao bloco `"scripts"`, logo abaixo de `"lint"`:

```json
    "test": "vitest run",
```

O Vitest lê `vite.config.ts` sozinho e roda `*.test.ts` em Node por padrão. Nenhum arquivo de configuração novo é necessário.

- [ ] **Step 2: Escrever o teste que falha**

Criar `lib/telefone.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  DOMINIO_CLIENTE,
  normalizarTelefone,
  telefoneEValido,
  telefoneParaEmail,
  emailEDeTelefone
} from './telefone';

describe('normalizarTelefone', () => {
  it('remove máscara e deixa só dígitos', () => {
    expect(normalizarTelefone('(11) 98765-4321')).toBe('11987654321');
  });

  it('devolve string vazia para entrada vazia', () => {
    expect(normalizarTelefone('')).toBe('');
  });
});

describe('telefoneEValido', () => {
  it('aceita celular de 11 dígitos', () => {
    expect(telefoneEValido('(11) 98765-4321')).toBe(true);
  });

  it('aceita fixo de 10 dígitos', () => {
    expect(telefoneEValido('1132654321')).toBe(true);
  });

  it('recusa telefone curto', () => {
    expect(telefoneEValido('11987')).toBe(false);
  });

  it('recusa string vazia', () => {
    expect(telefoneEValido('')).toBe(false);
  });
});

describe('telefoneParaEmail', () => {
  it('prefixa o DDI 55 e usa o domínio da barbearia', () => {
    expect(telefoneParaEmail('(11) 98765-4321')).toBe(`5511987654321@${DOMINIO_CLIENTE}`);
  });

  it('dá o mesmo resultado para o telefone com e sem máscara', () => {
    expect(telefoneParaEmail('(11) 98765-4321')).toBe(telefoneParaEmail('11987654321'));
  });

  it('usa o domínio "detalhe" no singular', () => {
    expect(DOMINIO_CLIENTE).toBe('cliente.detalhebarbearia.com.br');
  });

  it('lança erro para telefone inválido em vez de gerar e-mail quebrado', () => {
    expect(() => telefoneParaEmail('11987')).toThrow();
  });
});

describe('emailEDeTelefone', () => {
  it('reconhece e-mail sintético', () => {
    expect(emailEDeTelefone(`5511987654321@${DOMINIO_CLIENTE}`)).toBe(true);
  });

  it('não confunde com e-mail real do cliente', () => {
    expect(emailEDeTelefone('joao@gmail.com')).toBe(false);
  });

  it('trata undefined e null sem quebrar', () => {
    expect(emailEDeTelefone(undefined)).toBe(false);
    expect(emailEDeTelefone(null)).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./telefone"`, porque o módulo ainda não existe.

- [ ] **Step 4: Implementar `lib/telefone.ts`**

```ts
// Conversão telefone -> e-mail sintético.
//
// O app identifica o cliente por e-mail em toda a cadeia do Stripe (checkout, webhook,
// portal, cancelamento). Cliente que se cadastra só com telefone não tem e-mail, então
// derivamos um endereço estável a partir do número. Ele nunca é exibido nem digitado
// pelo usuário — serve só para o Supabase Auth e o Stripe terem uma chave válida.
//
// Este módulo é importado pelo front E pelo servidor de propósito: os dois lados
// PRECISAM gerar exatamente o mesmo e-mail para o mesmo telefone, senão o cliente
// cadastra por um endereço e tenta entrar por outro.

// Subdomínio do domínio real da barbearia (detalhebarbearia.com.br — "detalhe",
// singular). Não tem registro MX e nunca recebe e-mail: é só um identificador.
export const DOMINIO_CLIENTE = 'cliente.detalhebarbearia.com.br';

/** Só dígitos. Mesma regra do `onlyDigits` de server/validation.ts. */
export function normalizarTelefone(telefone: string): string {
  return (telefone || '').replace(/\D/g, '');
}

/** 10 dígitos (fixo) ou 11 (celular) — o mesmo que o schema `phone` do servidor aceita. */
export function telefoneEValido(telefone: string): boolean {
  const digitos = normalizarTelefone(telefone);
  return digitos.length === 10 || digitos.length === 11;
}

/**
 * Telefone -> e-mail sintético.
 * O DDI 55 entra SÓ aqui: a coluna clientes.telefone continua com 10 ou 11 dígitos,
 * como toda a base já faz. Mudar isso quebraria o índice único e os agendamentos.
 * Lança erro em vez de gerar um endereço quebrado que só falharia lá na frente.
 */
export function telefoneParaEmail(telefone: string): string {
  const digitos = normalizarTelefone(telefone);
  if (digitos.length !== 10 && digitos.length !== 11) {
    throw new Error('Telefone precisa ter 10 ou 11 dígitos.');
  }
  return `55${digitos}@${DOMINIO_CLIENTE}`;
}

/** Usado pela interface para nunca exibir o e-mail sintético ao usuário. */
export function emailEDeTelefone(email?: string | null): boolean {
  return !!email && email.toLowerCase().endsWith(`@${DOMINIO_CLIENTE}`);
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npm test`
Expected: PASS — 13 testes.

- [ ] **Step 6: Verificar tipos**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add lib/telefone.ts lib/telefone.test.ts package.json package-lock.json
git commit -m "feat(auth): modulo de conversao telefone para e-mail sintetico"
```

---

### Task 3: Criação do login no servidor (`server/clienteAuth.ts`)

Módulo focado, em arquivo novo, porque `server.ts` já tem 82 KB e a mesma lógica é usada por duas rotas (auto-cadastro na Tarefa 4 e cadastro pelo barbeiro na Tarefa 8).

**Files:**
- Create: `server/clienteAuth.ts`

**Interfaces:**
- Consumes: `serviceClient()` de `server/supabase.ts:36`; `telefoneParaEmail` de `lib/telefone.ts` (Tarefa 2).
- Produces:
  - `class TelefoneJaCadastradoError extends Error`
  - `criarLoginClienteTelefone(input: { nome: string; telefone: string; senha: string; barbeiroId?: string }): Promise<{ authUserId: string; clienteId: string; email: string }>`
  - `redefinirSenhaCliente(authUserId: string, senha: string): Promise<void>`

- [ ] **Step 1: Criar o módulo**

Criar `server/clienteAuth.ts`:

```ts
import { serviceClient } from './supabase.ts';
import { telefoneParaEmail } from '../lib/telefone.ts';

export interface LoginClienteCriado {
  authUserId: string;
  clienteId: string;
  email: string;
}

/** Telefone já tem usuário no Supabase Auth. Vira 409 nas rotas. */
export class TelefoneJaCadastradoError extends Error {
  constructor() {
    super('Esse telefone já tem conta. Entre com sua senha.');
    this.name = 'TelefoneJaCadastradoError';
  }
}

/**
 * A Admin API do Supabase não expõe um código estável para "e-mail já registrado":
 * a resposta é 422 com uma mensagem em inglês. Checamos os dois sinais.
 */
function eErroDeEmailDuplicado(erro: any): boolean {
  if (!erro) return false;
  if (erro.status === 422) return true;
  const msg = String(erro.message || '').toLowerCase();
  return msg.includes('already registered') || msg.includes('already been registered');
}

/**
 * Cria o usuário no Supabase Auth com e-mail sintético e garante a ficha em `clientes`.
 *
 * `barbeiroId` vem preenchido quando é o painel que está cadastrando; no auto-cadastro
 * fica vazio e usamos a barbearia ativa, mesma regra do upsertClientProfile
 * (server/storage.ts:560).
 */
export async function criarLoginClienteTelefone(input: {
  nome: string;
  telefone: string; // só dígitos, já validado pelo schema Zod
  senha: string;
  barbeiroId?: string;
}): Promise<LoginClienteCriado> {
  const client = serviceClient();
  if (!client) throw new Error('Supabase não configurado no servidor.');

  const email = telefoneParaEmail(input.telefone);

  let barbeiroId = input.barbeiroId;
  if (!barbeiroId) {
    const { data: barb } = await client
      .from('barbeiros').select('id').eq('ativo', true).limit(1).single();
    if (!barb) throw new Error('Nenhum barbeiro ativo encontrado.');
    barbeiroId = barb.id as string;
  }

  const { data: criado, error: erroAuth } = await client.auth.admin.createUser({
    email,
    password: input.senha,
    // OBRIGATÓRIO: sem isso o Supabase fica esperando o clique num link de confirmação
    // enviado para uma caixa que não existe, e o cliente nunca consegue entrar.
    email_confirm: true,
    user_metadata: { nome: input.nome, telefone: input.telefone, role: 'cliente' }
  });

  if (erroAuth || !criado?.user) {
    if (eErroDeEmailDuplicado(erroAuth)) throw new TelefoneJaCadastradoError();
    throw erroAuth ?? new Error('Erro ao criar login do cliente.');
  }

  const authUserId = criado.user.id;

  try {
    const { data: existente } = await client
      .from('clientes')
      .select('id')
      .eq('barbeiro_id', barbeiroId)
      .eq('telefone', input.telefone)
      .maybeSingle();

    if (existente?.id) {
      // Ficha criada antes pelo barbeiro (sem senha): liga o login nela em vez de
      // criar uma segunda, senão o histórico de agendamentos do cliente se perde.
      // O `nome` NÃO é sobrescrito: o barbeiro pode ter anotado algo que o ajuda
      // a identificar o cliente.
      const { error } = await client
        .from('clientes')
        .update({ auth_user_id: authUserId, email })
        .eq('id', existente.id);
      if (error) throw error;
      return { authUserId, clienteId: existente.id as string, email };
    }

    const { data: nova, error } = await client.from('clientes').insert({
      barbeiro_id: barbeiroId,
      auth_user_id: authUserId,
      nome: input.nome,
      telefone: input.telefone,
      email,
      observacoes: ''
    }).select('id').single();
    if (error || !nova) throw error ?? new Error('Erro ao criar ficha do cliente.');

    return { authUserId, clienteId: nova.id as string, email };
  } catch (err) {
    // Sem este rollback sobra um login órfão: o cliente bateria em 409 para sempre
    // numa conta que não tem ficha e não dá para usar.
    await client.auth.admin.deleteUser(authUserId).catch(() => {});
    throw err;
  }
}

export async function redefinirSenhaCliente(authUserId: string, senha: string): Promise<void> {
  const client = serviceClient();
  if (!client) throw new Error('Supabase não configurado no servidor.');
  const { error } = await client.auth.admin.updateUserById(authUserId, { password: senha });
  if (error) throw error;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run lint`
Expected: sem erros. Se `tsc` reclamar do import `'../lib/telefone.ts'`, confirmar que `tsconfig.json` tem `allowImportingTsExtensions` — os arquivos de `server/` já importam assim (`server/auth.ts:3`), então o padrão está estabelecido.

- [ ] **Step 3: Commit**

```bash
git add server/clienteAuth.ts
git commit -m "feat(auth): modulo de criacao de login de cliente por telefone"
```

---

### Task 4: Rota pública de cadastro por telefone

**Files:**
- Modify: `server/schemas.ts:38` (acrescentar `clientSignupTelefone` depois de `clientSignup`)
- Modify: `server.ts:908` (nova rota antes de `app.post('/api/auth/login', ...)`)

**Interfaces:**
- Consumes: `criarLoginClienteTelefone`, `TelefoneJaCadastradoError` (Tarefa 3).
- Produces: `POST /api/auth/cadastro-telefone` — body `{ nome, telefone, senha }`; `201 { ok: true, email }`; `409 { error, code: 'telefone_ja_cadastrado' }`; `501` se o Supabase não estiver configurado.

- [ ] **Step 1: Adicionar o schema**

Em `server/schemas.ts`, logo depois do bloco `clientSignup` (linha 38-43), inserir:

```ts
  // O `phone` compartilhado aceita string vazia (campo opcional em outros formulários).
  // Aqui o telefone é a identidade do cliente, então o vazio precisa ser recusado.
  clientSignupTelefone: z.object({
    nome: z.string().min(2, 'Informe o nome do cliente.').max(120),
    telefone: phone.refine(
      d => d.length === 10 || d.length === 11,
      'Telefone deve ter 10 ou 11 dígitos.'
    ),
    senha: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres.')
  }),
```

- [ ] **Step 2: Importar o módulo no server.ts**

Em `server.ts`, junto dos outros imports de `./server/`, acrescentar:

```ts
import { criarLoginClienteTelefone, redefinirSenhaCliente, TelefoneJaCadastradoError } from './server/clienteAuth.ts';
```

`redefinirSenhaCliente` já entra aqui porque é usada na Tarefa 9; importar duas vezes o mesmo módulo seria ruído.

- [ ] **Step 3: Adicionar a rota**

Em `server.ts`, imediatamente **antes** de `app.post('/api/auth/login', ...)` (linha 910), inserir:

```ts
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
```

- [ ] **Step 4: Verificar tipos**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 5: Verificar a rota com o servidor rodando**

Em um terminal: `npm run dev`

Em outro:

```bash
curl -s -X POST http://localhost:3000/api/auth/cadastro-telefone \
  -H "Content-Type: application/json" \
  -d '{"nome":"Teste Telefone","telefone":"(11) 98888-7777","senha":"senha123"}'
```

Expected: `201` com `{"ok":true,"email":"5511988887777@cliente.detalhebarbearia.com.br"}`.
(Se a porta for outra, conferir o log do `npm run dev`.)

Rodar o mesmo comando de novo.
Expected: `409` com `{"error":"Esse telefone já tem conta. Entre com sua senha.","code":"telefone_ja_cadastrado"}`.

Testar validação:

```bash
curl -s -X POST http://localhost:3000/api/auth/cadastro-telefone \
  -H "Content-Type: application/json" \
  -d '{"nome":"X","telefone":"119","senha":"123"}'
```

Expected: `400` com `issues` citando nome, telefone e senha.

Limpar o usuário de teste depois: no Supabase Dashboard > Authentication > Users, apagar `5511988887777@cliente.detalhebarbearia.com.br`, e em Table Editor > clientes apagar a linha correspondente.

- [ ] **Step 6: Commit**

```bash
git add server.ts server/schemas.ts
git commit -m "feat(auth): rota publica de cadastro de cliente por telefone"
```

---

### Task 5: Funções de sessão no front

**Files:**
- Modify: `src/lib/useAdminSession.ts:177` (acrescentar depois de `signUpClient`)

**Interfaces:**
- Consumes: `telefoneParaEmail`, `telefoneEValido` de `lib/telefone.ts` (Tarefa 2); `POST /api/auth/cadastro-telefone` (Tarefa 4).
- Produces:
  - `signInClientTelefone(telefone: string, senha: string)` — mesma forma de retorno do `signInWithPassword`: `{ data, error }`
  - `signUpClientTelefone(nome: string, telefone: string, senha: string)` — `{ data, error }`, onde `error` pode ter `code: 'telefone_ja_cadastrado'`

- [ ] **Step 1: Adicionar o import**

No topo de `src/lib/useAdminSession.ts`, junto dos outros imports:

```ts
import { telefoneParaEmail, telefoneEValido } from '../../lib/telefone';
```

- [ ] **Step 2: Adicionar as funções**

Em `src/lib/useAdminSession.ts`, logo depois de `signUpClient` (linha 177) e antes de `signOut`:

```ts
/**
 * Login do cliente por telefone. Por baixo é o mesmo signInWithPassword de sempre —
 * só o e-mail é derivado do telefone. O cliente nunca vê esse endereço.
 */
export async function signInClientTelefone(telefone: string, senha: string) {
  if (!telefoneEValido(telefone)) {
    return { data: null, error: { message: 'Telefone inválido. Use DDD + número.' } as any };
  }
  return supabase.auth.signInWithPassword({
    email: telefoneParaEmail(telefone),
    password: senha
  });
}

/**
 * Cadastro por telefone. O usuário é criado no servidor (Admin API, com o e-mail já
 * confirmado); aqui só entramos na conta em seguida para o cliente não precisar
 * digitar tudo de novo.
 */
export async function signUpClientTelefone(nome: string, telefone: string, senha: string) {
  if (!telefoneEValido(telefone)) {
    return { data: null, error: { message: 'Telefone inválido. Use DDD + número.' } as any };
  }

  const res = await fetch('/api/auth/cadastro-telefone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, telefone, senha })
  });
  const payload = await res.json().catch(() => ({} as any));

  if (!res.ok) {
    return {
      data: null,
      error: { message: payload.error || 'Não foi possível criar a conta.', code: payload.code } as any
    };
  }

  return signInClientTelefone(telefone, senha);
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/useAdminSession.ts
git commit -m "feat(auth): funcoes de login e cadastro por telefone no front"
```

---

### Task 6: Componente `ClientAuthModal`

Um componente só, usado nos dois pontos onde hoje existe o botão do Google para o cliente. Sem isso o formulário seria duplicado em `VisitorLayout.tsx` (77 KB) e `BookingWizard.tsx` (59 KB).

**Files:**
- Create: `src/components/ClientAuthModal.tsx`

**Interfaces:**
- Consumes: `signInClientTelefone`, `signUpClientTelefone` (Tarefa 5); `supabase` de `src/lib/supabase.ts`.
- Produces: `export default function ClientAuthModal(props: { onClose: () => void; onLoginSuccess?: () => void })`

- [ ] **Step 1: Criar o componente**

Criar `src/components/ClientAuthModal.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Phone, Lock, User, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { signInClientTelefone, signUpClientTelefone } from '../lib/useAdminSession.ts';
import { supabase } from '../lib/supabase.ts';

interface ClientAuthModalProps {
  onClose: () => void;
  onLoginSuccess?: () => void;
}

/** Máscara visual (11) 98765-4321. O valor enviado é sempre só dígitos. */
function formatarTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function ClientAuthModal({ onClose, onLoginSuccess }: ClientAuthModalProps) {
  const [aba, setAba] = useState<'entrar' | 'criar'>('entrar');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      if (sessao) {
        onLoginSuccess?.();
        onClose();
      }
    });
    return () => subscription.unsubscribe();
  }, [onLoginSuccess, onClose]);

  const trocarAba = (nova: 'entrar' | 'criar') => {
    setAba(nova);
    setErro('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const resultado = aba === 'entrar'
        ? await signInClientTelefone(telefone, senha)
        : await signUpClientTelefone(nome, telefone, senha);

      if (resultado.error) {
        // Telefone já cadastrado: em vez de só reclamar, joga o cliente na aba certa
        // com o telefone preservado.
        if ((resultado.error as any).code === 'telefone_ja_cadastrado') {
          setAba('entrar');
          setSenha('');
          setErro('Esse telefone já tem conta. Digite sua senha para entrar.');
          return;
        }
        // O Supabase responde em inglês; traduzimos o caso mais comum.
        const msg = (resultado.error as any).message || '';
        setErro(/invalid login credentials/i.test(msg)
          ? 'Telefone ou senha incorretos.'
          : msg || 'Não foi possível continuar.');
        return;
      }

      onLoginSuccess?.();
      onClose();
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível continuar.');
    } finally {
      setCarregando(false);
    }
  };

  const abaClasse = (ativa: boolean) =>
    `flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest rounded-sm transition ${
      ativa
        ? 'bg-primary text-primary-foreground'
        : 'bg-transparent text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-card border border-border rounded-sm w-full max-w-md shadow-2xl overflow-hidden z-10"
      >
        <div className="p-6 bg-sidebar text-foreground flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide text-foreground">Entrar com telefone</h3>
              <p className="text-[10px] text-muted-foreground">Sem precisar de conta do Google.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-sm hover:bg-accent transition"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex gap-1 p-1 bg-background border border-border rounded-sm">
            <button type="button" className={abaClasse(aba === 'entrar')} onClick={() => trocarAba('entrar')}>
              Já tenho conta
            </button>
            <button type="button" className={abaClasse(aba === 'criar')} onClick={() => trocarAba('criar')}>
              Criar conta
            </button>
          </div>

          {erro && (
            <div className="p-3.5 bg-destructive/10 border border-destructive/40 text-destructive rounded-sm text-xs flex gap-2 items-start leading-relaxed">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {aba === 'criar' && (
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">Seu nome</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/70" />
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Como podemos te chamar"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-background border border-input rounded-sm text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">Telefone</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/70" />
                <input
                  type="tel"
                  inputMode="numeric"
                  value={formatarTelefone(telefone)}
                  onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ''))}
                  placeholder="(11) 98765-4321"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-background border border-input rounded-sm text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground block">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/70" />
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder={aba === 'criar' ? 'Crie uma senha (mínimo 6)' : 'Sua senha'}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-10 py-3 bg-background border border-input rounded-sm text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-[10px] font-bold uppercase tracking-widest rounded-sm transition duration-150 cursor-pointer"
            >
              {carregando
                ? 'Aguarde...'
                : aba === 'entrar' ? 'Entrar' : 'Criar minha conta'}
            </button>
          </form>

          {aba === 'entrar' && (
            <p className="text-[10px] text-muted-foreground text-center leading-relaxed pt-2 border-t border-border">
              Esqueceu a senha? Fale com a barbearia pelo WhatsApp que a gente cadastra
              uma nova para você.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
```

Nota sobre a mensagem de senha esquecida: cliente de telefone não tem caixa de e-mail para receber link de recuperação. Quem redefine é o barbeiro, pelo painel (Tarefa 9).

- [ ] **Step 2: Verificar tipos**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/ClientAuthModal.tsx
git commit -m "feat(auth): modal de login e cadastro de cliente por telefone"
```

---

### Task 7: Plugar o modal nas duas telas do cliente

O botão do Google **permanece intacto** nos dois lugares. O de telefone entra abaixo dele.

**Files:**
- Modify: `src/components/VisitorLayout.tsx` (import + estado + botão logo depois do botão do Google que termina por volta da linha 525)
- Modify: `src/components/BookingWizard.tsx` (import + estado + botão logo depois do botão do Google que termina por volta da linha 1272)

**Interfaces:**
- Consumes: `ClientAuthModal` (Tarefa 6).
- Produces: nada para tarefas seguintes.

- [ ] **Step 1: VisitorLayout — import e estado**

Em `src/components/VisitorLayout.tsx`, junto dos outros imports de componentes:

```tsx
import ClientAuthModal from './ClientAuthModal.tsx';
```

E junto dos outros `useState` do componente:

```tsx
  const [showTelefoneAuth, setShowTelefoneAuth] = useState(false);
```

- [ ] **Step 2: VisitorLayout — botão**

Localizar o `</button>` que fecha o botão "Logar com o Google" (o bloco que começa em `onClick={async () => { setIsGoogleLoading(true);` por volta da linha 494). Imediatamente **depois** desse `</button>`, inserir:

```tsx
                          <button
                            type="button"
                            onClick={() => {
                              setShowProfilePop(false);
                              setShowTelefoneAuth(true);
                            }}
                            className="w-full py-2.5 bg-transparent border border-border hover:border-primary/40 text-foreground text-xs font-bold uppercase tracking-widest rounded-lg transition duration-150 cursor-pointer flex items-center justify-center gap-2"
                          >
                            <Phone className="w-4 h-4 text-primary" />
                            Entrar com telefone
                          </button>
```

Conferir se `Phone` já está importado de `lucide-react` no arquivo; se não estiver, acrescentar ao import existente.

- [ ] **Step 3: VisitorLayout — renderizar o modal**

Junto de onde os outros modais do arquivo são renderizados (perto do `return` de nível mais alto, ao lado de `{showAuthModal && ...}` se existir), acrescentar:

```tsx
      {showTelefoneAuth && (
        <ClientAuthModal onClose={() => setShowTelefoneAuth(false)} />
      )}
```

- [ ] **Step 4: BookingWizard — import e estado**

Em `src/components/BookingWizard.tsx`, junto dos outros imports:

```tsx
import ClientAuthModal from './ClientAuthModal.tsx';
```

E junto dos outros `useState`:

```tsx
  const [showTelefoneAuth, setShowTelefoneAuth] = useState(false);
```

- [ ] **Step 5: BookingWizard — botão**

Localizar o `</button>` que fecha o botão "Entrar com o Google" (bloco iniciado em `onClick={async () => { setIsGoogleLoading(true);` por volta da linha 1241). Imediatamente **depois** dele, inserir:

```tsx
              <button
                type="button"
                onClick={() => setShowTelefoneAuth(true)}
                className="w-full py-3 bg-transparent border border-slate-200 hover:border-primary/40 text-slate-900 text-xs font-bold uppercase tracking-widest rounded-sm transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4 shrink-0 text-primary" />
                Entrar com telefone
              </button>
```

Conferir se `Phone` já está importado de `lucide-react`; se não, acrescentar.

- [ ] **Step 6: BookingWizard — renderizar o modal**

No mesmo nível dos outros modais do componente:

```tsx
      {showTelefoneAuth && (
        <ClientAuthModal onClose={() => setShowTelefoneAuth(false)} />
      )}
```

- [ ] **Step 7: Verificar tipos**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 8: Verificar no navegador**

Run: `npm run dev`

1. Abrir a home. No menu de perfil, confirmar que **os dois** botões aparecem: Google e Telefone.
2. Clicar em "Entrar com telefone" > aba "Criar conta" > preencher nome, telefone e senha > "Criar minha conta".
   Expected: o modal fecha e o app entra logado, sem tela de confirmação de e-mail.
3. Sair, clicar de novo em "Entrar com telefone" > aba "Já tenho conta" > mesmo telefone e senha.
   Expected: entra.
4. Tentar criar conta de novo com o mesmo telefone.
   Expected: volta para a aba "Já tenho conta" com a mensagem "Esse telefone já tem conta.".
5. Digitar senha errada no login.
   Expected: "Telefone ou senha incorretos." (em português, não em inglês).
6. Abrir o agendamento até a etapa de login e confirmar que o botão de telefone também está lá.

- [ ] **Step 9: Commit**

```bash
git add src/components/VisitorLayout.tsx src/components/BookingWizard.tsx
git commit -m "feat(auth): botao de entrar com telefone ao lado do Google"
```

---

### Task 8: Senha opcional no cadastro de cliente do painel

**Files:**
- Modify: `server/schemas.ts:115` (`createClient`)
- Modify: `server.ts:1445` (`POST /api/admin/clientes`)

**Interfaces:**
- Consumes: `criarLoginClienteTelefone` (Tarefa 3), já importado na Tarefa 4.
- Produces: `POST /api/admin/clientes` passa a aceitar `senha?: string`. Quando presente, cria também o login e devolve `201` com a ficha.

- [ ] **Step 1: Adicionar `senha` ao schema**

Em `server/schemas.ts`, no bloco `createClient`, acrescentar o campo:

```ts
  createClient: z.object({
    nome: z.string().min(2).max(120),
    telefone: phone,
    email: z.string().email().optional().or(z.literal('')),
    data_nascimento: date.optional().or(z.literal('')),
    observacoes: z.string().max(1000).optional(),
    // Opcional: quando vem preenchida, o cliente ganha login por telefone no app.
    senha: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres.').optional()
  }),
```

- [ ] **Step 2: Tratar `senha` na rota**

Em `server.ts`, substituir o corpo do handler de `app.post('/api/admin/clientes', ...)` pelo seguinte (o restante da rota, incluindo o fallback `db.json`, fica igual):

```ts
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
```

A função de listagem é `storage.listClientesAdmin(barbeiroId): Promise<Cliente[]>` (`server/storage.ts:992`) — devolve array, não `null`, por isso o `.find` direto. O front recarrega a lista logo depois de salvar (`fetchClientes()` em `AdminLayout.tsx:673`), então o corpo exato da resposta não é crítico.

- [ ] **Step 3: Verificar tipos**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 4: Verificar manualmente**

Com `npm run dev` rodando e logado como admin no painel (ou usando o `mock-token` local):

```bash
curl -s -X POST http://localhost:3000/api/admin/clientes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-token" \
  -d '{"nome":"Cliente Balcao","telefone":"(11) 97777-6666","senha":"senha123"}'
```

Expected: `201`. No Supabase, conferir que:
- existe usuário `5511977776666@cliente.detalhebarbearia.com.br` em Authentication > Users;
- a linha em `clientes` tem `telefone = '11977776666'`, `email = '5511977776666@cliente.detalhebarbearia.com.br'` e `auth_user_id` preenchido.

Sem senha, o comportamento antigo continua:

```bash
curl -s -X POST http://localhost:3000/api/admin/clientes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-token" \
  -d '{"nome":"Cliente Avulso","telefone":"(11) 96666-5555"}'
```

Expected: `201`, ficha criada **sem** usuário em Authentication.

- [ ] **Step 5: Commit**

```bash
git add server.ts server/schemas.ts
git commit -m "feat(admin): senha opcional no cadastro de cliente cria login por telefone"
```

---

### Task 9: Rotas de redefinir senha e gerar link de pagamento

**Files:**
- Modify: `server/schemas.ts` (dois schemas novos, junto dos outros de admin)
- Modify: `server.ts:1512` (duas rotas novas, depois de `app.patch('/api/admin/clientes/:id', ...)`)

**Interfaces:**
- Consumes: `redefinirSenhaCliente` (Tarefa 3, já importado na Tarefa 4); `stripe.createCheckoutSession` (`server/stripe.ts:183`, sem alteração); `serviceClient()`.
- Produces:
  - `POST /api/admin/clientes/:id/redefinir-senha` — body `{ senha }`; `200 { ok: true }`
  - `POST /api/admin/clientes/:id/link-pagamento` — body `{ planId }`; `200 { url }`; `409 { code: 'already_subscribed' }`

- [ ] **Step 1: Adicionar os schemas**

Em `server/schemas.ts`, na seção de admin (perto de `patchClient`):

```ts
  redefinirSenhaCliente: z.object({
    senha: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres.')
  }),
  linkPagamento: z.object({
    planId: z.enum(['essential', 'premium', 'exclusive'])
  }),
```

- [ ] **Step 2: Adicionar as rotas**

Em `server.ts`, logo depois do handler `app.patch('/api/admin/clientes/:id', ...)`, inserir:

```ts
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
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 4: Verificar manualmente**

Usando o id do "Cliente Balcao" criado na Tarefa 8 (pegar em Table Editor > clientes):

```bash
curl -s -X POST http://localhost:3000/api/admin/clientes/<ID>/link-pagamento \
  -H "Content-Type: application/json" -H "Authorization: Bearer mock-token" \
  -d '{"planId":"essential"}'
```

Expected: `200` com uma `url` começando por `https://checkout.stripe.com/`.

Abrir a URL no navegador. Expected: a página do Stripe mostra o campo de e-mail **preenchido e travado** com `5511977776666@cliente.detalhebarbearia.com.br` — este é o comportamento pedido.

```bash
curl -s -X POST http://localhost:3000/api/admin/clientes/<ID>/redefinir-senha \
  -H "Content-Type: application/json" -H "Authorization: Bearer mock-token" \
  -d '{"senha":"novasenha456"}'
```

Expected: `200 {"ok":true}`. Confirmar entrando no app com o telefone e a senha nova.

Testar cliente sem login (o "Cliente Avulso" da Tarefa 8):
Expected: `400` com a mensagem sobre cadastrar uma senha antes.

- [ ] **Step 5: Commit**

```bash
git add server.ts server/schemas.ts
git commit -m "feat(admin): rotas de redefinir senha e gerar link de pagamento do cliente"
```

---

### Task 10: Painel — campo de senha e botões na ficha do cliente

**Files:**
- Modify: `src/components/AdminLayout.tsx:166` (estado `newClient`)
- Modify: `src/components/AdminLayout.tsx:651-679` (`handleSaveClient` e `handleEditClientSelect`)
- Modify: `src/components/AdminLayout.tsx:2837-2843` (reset do botão "Novo Cliente")
- Modify: `src/components/AdminLayout.tsx:2878-2890` (formulário: campo de senha e e-mail)

**Interfaces:**
- Consumes: `POST /api/admin/clientes` com `senha` (Tarefa 8); `POST /api/admin/clientes/:id/redefinir-senha` e `/link-pagamento` (Tarefa 9).
- Produces: nada para tarefas seguintes.

- [ ] **Step 1: Acrescentar `senha` ao estado**

Em `src/components/AdminLayout.tsx:166`, trocar:

```tsx
  const [newClient, setNewClient] = useState({ nome: '', telefone: '', email: '', data_nascimento: '', observacoes: '', senha: '' });
```

Há **três** outros lugares que reinicializam esse objeto sem `senha` — `handleSaveClient` (linha ~668), o botão "Novo Cliente" (linha ~2840) e o "Cancelar" do formulário (linha ~2915). Acrescentar `senha: ''` nos três, senão o TypeScript acusa e o campo fica com valor antigo entre cadastros.

- [ ] **Step 2: Não enviar `senha` no PATCH**

Em `handleSaveClient` (linha ~651), trocar o corpo da requisição:

```tsx
      // senha só existe na criação: o PATCH usa a rota de redefinir senha.
      const { senha, ...semSenha } = newClient;
      const payload = isEditing
        ? semSenha
        : (senha ? newClient : semSenha);

      const res = await authedFetch(url, {
        method,
        body: payload
      });
```

- [ ] **Step 3: Adicionar os estados de apoio**

Junto dos outros `useState` do componente:

```tsx
  const [linkPagamento, setLinkPagamento] = useState<{ clienteId: string; url: string } | null>(null);
  const [gerandoLink, setGerandoLink] = useState(false);
```

- [ ] **Step 4: Adicionar os handlers**

Logo depois de `handleDeleteClient` (linha ~718):

```tsx
  const handleGerarLinkPagamento = async (c: Cliente, planId: string) => {
    setGerandoLink(true);
    setLinkPagamento(null);
    try {
      const res = await authedFetch(`/api/admin/clientes/${c.id}/link-pagamento`, {
        method: 'POST',
        body: { planId }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível gerar o link.');
      setLinkPagamento({ clienteId: c.id, url: data.url });
      setSuccessMsg('Link de pagamento pronto. Copie ou mande no WhatsApp.');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setGerandoLink(false);
    }
  };

  const handleRedefinirSenhaCliente = async (c: Cliente) => {
    const nova = window.prompt(`Nova senha para ${c.nome} (mínimo 6 caracteres):`);
    if (!nova) return;
    if (nova.length < 6) {
      setErrorMsg('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    try {
      const res = await authedFetch(`/api/admin/clientes/${c.id}/redefinir-senha`, {
        method: 'POST',
        body: { senha: nova }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível redefinir a senha.');
      setSuccessMsg(`Senha de ${c.nome} atualizada. Avise o cliente.`);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };
```

- [ ] **Step 5: Ajustar o formulário**

Em `AdminLayout.tsx`, no bloco do campo "E-mail (opcional)" (linha ~2880), substituir aquele `<div className="space-y-1.5">` inteiro por:

```tsx
                {!editingClientId && (
                  <div className="space-y-1.5">
                    <Label>Senha de acesso ao app (opcional)</Label>
                    <Input
                      type="text"
                      value={newClient.senha}
                      onChange={(e) => setNewClient({ ...newClient, senha: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      minLength={6}
                    />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Combine a senha com o cliente. Ele entra no app com o telefone e essa senha.
                      Deixe em branco para só criar a ficha, sem login.
                    </p>
                  </div>
                )}

                {!newClient.senha && (
                  <div className="space-y-1.5">
                    <Label>E-mail (opcional)</Label>
                    <Input
                      type="email"
                      value={newClient.email}
                      onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                      placeholder="cliente@exemplo.com"
                    />
                  </div>
                )}
```

O e-mail some quando há senha porque o cliente com login por telefone precisa ter `clientes.email` igual ao e-mail sintético — ver a invariante nas Global Constraints. Esconder o campo evita que o barbeiro digite algo que seria ignorado em silêncio.

- [ ] **Step 6: Adicionar os botões na lista de clientes**

Na lista de clientes, dentro do card de cada cliente (depois do bloco do WhatsApp, por volta da linha 3005), acrescentar:

```tsx
                        <div
                          className="flex flex-wrap gap-2 pt-2 border-t border-border"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {PLAN_TIERS.map(tier => (
                            <Button
                              key={tier.key}
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={gerandoLink}
                              onClick={() => handleGerarLinkPagamento(c, tier.key)}
                            >
                              Cobrar {tier.label}
                            </Button>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRedefinirSenhaCliente(c)}
                          >
                            Redefinir senha
                          </Button>
                        </div>

                        {linkPagamento?.clienteId === c.id && (
                          <div
                            className="space-y-2 pt-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p className="text-[10px] text-muted-foreground break-all">{linkPagamento.url}</p>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(linkPagamento.url);
                                  setSuccessMsg('Link copiado.');
                                }}
                              >
                                Copiar link
                              </Button>
                              <a
                                href={`${getWhatsAppLink(c.telefone)}?text=${encodeURIComponent(
                                  `Olá ${c.nome}! Segue o link para ativar seu plano: ${linkPagamento.url}`
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Button type="button" size="sm" variant="outline">
                                  Mandar no WhatsApp
                                </Button>
                              </a>
                            </div>
                          </div>
                        )}
```

O `stopPropagation` é necessário porque o card inteiro já tem um `onClick` que abre o formulário de edição (linha ~2960); sem ele, clicar em "Cobrar" também abriria o formulário.

`PLAN_TIERS` está declarado em `src/components/AdminLayout.tsx:70` com as propriedades `key` (`'essential' | 'premium' | 'exclusive'`), `label`, `price`, `features`, `textClass`, `borderClass` e `badgeClass` — daí `tier.key` para a rota e `tier.label` para o texto do botão. O `Button` do projeto aceita `variant="outline"` e `size="sm"` (`components/ui/button.tsx:12,26`).

- [ ] **Step 7: Verificar tipos**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 8: Verificar no navegador**

Run: `npm run dev`, entrar no painel, aba de clientes.

1. "Novo Cliente" > preencher nome, telefone e senha. Confirmar que o campo de e-mail **some** quando a senha é digitada.
2. Salvar. Confirmar que o cliente aparece na lista.
3. Sair do painel e entrar no app com o telefone e a senha cadastrados. Expected: entra.
4. Voltar ao painel, clicar em "Cobrar Essential" no card do cliente. Expected: aparece o link, sem abrir o formulário de edição.
5. "Copiar link" e colar no navegador. Expected: página do Stripe com o e-mail preenchido e travado.
6. "Redefinir senha" > digitar senha nova > entrar no app com ela. Expected: entra.

- [ ] **Step 9: Commit**

```bash
git add src/components/AdminLayout.tsx
git commit -m "feat(admin): senha, cobranca de plano e redefinicao de senha na ficha do cliente"
```

---

### Task 11: Tarja "Pagamento falhou" na lista de clientes

O webhook já grava `pendencia: true` dentro de `observacoes.subscription` (`server.ts:317`), mas nada na interface lê isso. Como ninguém recebe e-mail de cartão recusado (decisão da spec), esta tarja é o **único** aviso de mensalidade perdida que o barbeiro tem.

**Files:**
- Modify: `src/types.ts:134-141` (`ClienteSubscription`)
- Modify: `src/components/AdminLayout.tsx:2985-2995` (badges no card do cliente)

**Interfaces:**
- Consumes: `ClienteSubscription` com o campo novo.
- Produces: nada.

- [ ] **Step 1: Declarar o campo no tipo**

Em `src/types.ts`, no `ClienteSubscription`:

```ts
export interface ClienteSubscription {
  plan: string;
  status: string;
  price: number;
  renews_at: string; // ISO date
  card_last4?: string;
  card_brand?: string;
  // true quando a Stripe avisou que a cobrança falhou e ainda está recobrando.
  // Gravado por patchSubscriptionObservacoes (server.ts:108).
  pendencia?: boolean;
}
```

- [ ] **Step 2: Mostrar a tarja**

Em `src/components/AdminLayout.tsx`, no `<h5>` do card do cliente, logo **depois** do bloco `{vipEntry && (<Badge ...>)}` que já existe (linha ~2985-2995), acrescentar:

```tsx
                                {vipEntry?.subscription.pendencia && (
                                  <Badge className="text-xs uppercase tracking-wider font-bold bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-900/40">
                                    Pagamento falhou
                                  </Badge>
                                )}
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 4: Verificar com dado forjado**

No Supabase, Table Editor > `clientes`, escolher um cliente e pôr em `observacoes`:

```json
{"subscription":{"plan":"essential","status":"ativo","price":109.99,"renews_at":"2027-01-01T00:00:00.000Z","pendencia":true}}
```

Abrir o painel, aba de clientes.
Expected: o cliente aparece com a tarja do plano **e** a tarja vermelha "Pagamento falhou".

Trocar `"pendencia":true` por `false` e recarregar.
Expected: só a tarja do plano.

Desfazer a alteração no banco depois do teste.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/components/AdminLayout.tsx
git commit -m "feat(admin): tarja de pagamento falhou na lista de clientes"
```

---

### Task 12: Verificação end-to-end do Stripe

Esta é a tarefa que responde ao requisito principal: **a cobrança que já funciona não pode ter regredido**. Nada aqui é código novo — é a bateria de verificação da spec (seção 10) rodada de ponta a ponta em modo teste.

**Files:**
- Modify: `docs/superpowers/plans/2026-07-30-cadastro-cliente-telefone.md` (marcar os cenários)

**Interfaces:**
- Consumes: tudo das Tarefas 1-11.
- Produces: nada.

- [ ] **Step 1: Preparar o ambiente de teste**

Confirmar que `.env.local` tem `STRIPE_SECRET_KEY` começando com `sk_test_`. **Não rodar esta tarefa com chave `sk_live_`.**

Em um terminal: `npm run dev`
Em outro, encaminhar os webhooks:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copiar o `whsec_...` que o comando imprime para `STRIPE_WEBHOOK_SECRET` no `.env.local` e reiniciar o `npm run dev`.

Cartão de teste: `4242 4242 4242 4242`, validade futura, CVC qualquer.

- [ ] **Step 2: Cenário — regressão do cliente Google (o mais importante)**

1. Entrar no app com uma conta Google.
2. Assinar um plano pelo fluxo normal do cliente.
3. Conferir no Supabase que a ficha desse cliente tem em `observacoes`: `status: "ativo"`, `plan` correto, **`renews_at` preenchido** (correção da Tarefa 1) e `pendencia: false`.
4. Conferir que entrou um lançamento em `lancamentos_financeiros` com categoria `Plano`.
5. No painel do cliente, conferir que o plano aparece como vigente, com data de renovação — não como vencido.
6. Cancelar a assinatura pelo app e conferir que o Stripe registrou `cancel_at_period_end`.

Expected: tudo igual a antes, mais o `renews_at` que antes faltava.

- [ ] **Step 3: Cenário — cliente de telefone assina sozinho**

1. Criar conta pelo "Entrar com telefone".
2. Assinar um plano pelo fluxo do cliente.
3. Conferir na página do Stripe que o e-mail aparece preenchido e travado com `55...@cliente.detalhebarbearia.com.br`.
4. Pagar com o cartão de teste.
5. Conferir no Supabase: `observacoes.subscription.status = "ativo"`, `plan`, `renews_at`.
6. Conferir o selo de VIP no painel do barbeiro e o plano vigente no painel do cliente.

Expected: mesmo resultado do cliente Google.

- [ ] **Step 4: Cenário — cadastro pelo barbeiro com link**

1. No painel, cadastrar cliente com nome, telefone e senha.
2. "Cobrar Premium" > "Copiar link" > abrir no navegador > pagar com o cartão de teste.
3. Conferir que o cliente virou VIP no painel.
4. Entrar no app com o telefone e a senha e conferir que o plano aparece no painel do cliente.

- [ ] **Step 5: Cenário — cartão recusado acende a tarja**

Repetir o passo 4 com o cartão de falha do Stripe `4000 0000 0000 0341` (autoriza e falha na cobrança seguinte), ou disparar o evento direto:

```bash
stripe trigger invoice.payment_failed
```

Expected: `observacoes.subscription.pendencia` vira `true` e a tarja vermelha "Pagamento falhou" aparece na lista de clientes do painel.

- [ ] **Step 6: Cenário — assinatura duplicada é barrada**

Com um cliente já assinante, clicar em "Cobrar Essential" no painel.
Expected: erro "Esse cliente já tem plano ativo" — nenhuma sessão de checkout nova.

- [ ] **Step 7: Rodar as verificações automáticas**

Run: `npm test`
Expected: PASS.

Run: `npm run lint`
Expected: sem erros.

Run: `npm run build`
Expected: build conclui sem erro.

- [ ] **Step 8: Limpar os dados de teste**

Apagar do Supabase (Authentication > Users e Table Editor > clientes) os usuários de teste criados, e os lançamentos de teste em `lancamentos_financeiros`.

- [ ] **Step 9: Commit**

```bash
git add docs/superpowers/plans/2026-07-30-cadastro-cliente-telefone.md
git commit -m "docs(plan): marcar verificacao end-to-end do cadastro por telefone"
```

---

## Notas para quem for implementar

- **Se o `npm test` da Tarefa 2 falhar depois de outras tarefas**, é sinal de que front e servidor divergiram na conversão telefone → e-mail. Não "ajustar o teste": achar a divergência.
- **Nenhuma migração de banco é necessária.** `clientes.auth_user_id` e `clientes.email` já existem (`supabase/migrations/001_init.sql:70-84`), e `email` já é nullable.
- **Não mexer em `server/auth.ts`.** Se alguma coisa parecer exigir mudança ali, é sintoma de que a invariante do e-mail foi quebrada em outro lugar.
- O `db.json` (modo offline, sem Supabase) **não suporta** cadastro por telefone: a criação de usuário depende da Admin API do Supabase. As rotas devolvem 501 nesse modo, de propósito. O modo offline continua usando `logged_client` no localStorage, como hoje.
