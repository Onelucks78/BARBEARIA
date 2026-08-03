# Plano de Auditoria de Segurança — Detalhe Barbearia

> Documento de rastreio. Cada finding tem status, local e evidência de verificação.
> "Concluído" = correção aplicada + `npm run lint` passando (e migração aplicada quando aplicável).

**Auditor:** Morpheus (Red Team Agent)
**Frameworks:** OWASP Top 10, OWASP API Security 2023, OWASP LLM Top 10 2025, MITRE ATT&CK
**Stack:** React 19 + Vite + Express + Supabase (Postgres/RLS) + Stripe

---

## Sumário Executivo

O app tem boa base (JWT do Supabase verificado no servidor, RLS multi-tenant, idempotência
de webhook), mas apresentava 3 vulnerabilidades críticas de autorização:

1. **Qualquer pessoa podia cancelar qualquer agendamento** (`#code` sequencial, sem auth).
2. **Cliente podia se auto-conceder VIP** escrevendo `observacoes.subscription` no próprio perfil.
3. **Enumeração de agendamentos de terceiros por e-mail/telefone** em endpoint público.

Além disso: token de admin mock frágil, políticas RLS de inserção anônima abertas (a anon key
é pública), rate-limit por IP ineficaz na Vercel, upload sem limite de tamanho, XSS no comprovante
de impressão e headers de segurança ausentes. Gemini está declarado no stack mas **não é usado** —
sem superfície LLM explorável.

---

## Resumo dos Findings

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 4 |
| Medium | 5 |
| Low | 2 |
| Informational | 2 |

---

## Findings

### MORPH-001 — Mass Assignment: auto-concessão de VIP via `observacoes`
- **Severity:** High | **CWE:** CWE-639 | **OWASP:** API3:2023 (Broken Object Property Level Authorization)
- **Local:** `server.ts:709-730`, `server/storage.ts:509-575`
- **Descrição:** `POST /api/cliente/perfil` aceita `observacoes` do cliente sem sanitizar.
  `isClientVip()` considera VIP qualquer `observacoes.subscription.status === 'ativo'`. Um cliente
  envia `{"subscription":{"status":"ativo","plan":"exclusive"}}` e ganha todos os benefícios pagos.
- **Correção:** preservar o bloco `subscription` já gravado no banco; ignorar o que o cliente enviar.
- **Status:** Concluído ✔

### MORPH-002 — Cancelamento de agendamento sem autenticação/autorização (IDOR/BFLA)
- **Severity:** High | **CWE:** CWE-639 | **OWASP:** API1:2023, API5:2023
- **Local:** `server.ts:866-896`
- **Descrição:** `POST /api/agendamentos/:id/cancelar` não exige login nem ownership. Os códigos
  são sequenciais (`#000001`...), então qualquer anônimo itera códigos e cancela a agenda inteira.
- **Correção:** `requireAuth` + checagem de posse (admin liberado; cliente só os próprios).
- **Status:** Concluído ✔

### MORPH-003 — Token de admin mock habilitado por padrão fora de produção
- **Severity:** High | **CWE:** CWE-798 | **OWASP:** API2:2023
- **Local:** `server/auth.ts:43-67`
- **Descrição:** `Authorization: Bearer mock-token` vira admin sempre que
  `NODE_ENV !== 'production' && !VERCEL`. Um deploy Express standalone sem `NODE_ENV=production`
  expõe admin total sem senha. No front, `mock_admin_session` no localStorage alimenta isso.
- **Correção:** exigir `ALLOW_MOCK_AUTH=true` explícito (além das condições atuais).
- **Status:** Concluído ✔

### MORPH-004 — Enumeração de agendamentos de terceiros (e-mail/telefone)
- **Severity:** High | **CWE:** CWE-639 | **OWASP:** API1:2023
- **Local:** `server.ts:670-683`, `server/storage.ts:439-484`
- **Descrição:** `GET /api/agendamentos/cliente` é público: com o e-mail ou telefone de alguém,
  qualquer um lê o histórico completo de agendamentos (nome, telefone, observações, horários).
- **Correção:** `requireAuth`; identidade resolvida do JWT (admin pode filtrar via query).
- **Status:** Concluído ✔

### MORPH-005 — Políticas RLS de inserção anônima abertas (`with check (true)`)
- **Severity:** Medium | **CWE:** CWE-284 | **OWASP:** API5:2023
- **Local:** `supabase/migrations/003_rls.sql:119-139`
- **Descrição:** A anon key é pública (embutida no bundle `src/lib/supabase.ts`). Com ela, um
  atacante chama o PostgREST diretamente e insere agendamentos/clientes arbitrários — inclusive
  `status='concluido'` com `preco_cobrado` alto (infla o dashboard financeiro) ou lota a agenda.
- **Correção:** migração `015_harden_anon_rls.sql` restringe insert anon a dados consistentes.
- **Status:** Concluído ✔ (aplicada em 2026-08-03; políticas verificadas no banco via `pg_policies.with_check`)

### MORPH-006 — Rate-limit de cadastro ineficaz por IP na Vercel (sem `trust proxy`)
- **Severity:** Medium | **CWE:** CWE-307 | **OWASP:** API4:2023
- **Local:** `server.ts:925-957`
- **Descrição:** `req.ip` sem `trust proxy` devolve o IP do proxy na Vercel → todos os usuários
  compartilham o mesmo balde (429 coletivo) ou o limite é trivialmente burlado.
- **Correção:** `app.set('trust proxy', true)` em `createApp`.
- **Status:** Concluído ✔

### MORPH-007 — Upload de imagem sem limite de tamanho/bytes
- **Severity:** Medium | **CWE:** CWE-400 | **OWASP:** API4:2023
- **Local:** `server.ts:1266-1306`
- **Descrição:** O buffer base64 decodificado não tem limite; o fallback ecoa o `dataUrl` gigante
  como `imagem_url` persistida (abuso de storage, strings enormes no banco).
- **Correção:** rejeitar buffers > 5 MB.
- **Status:** Concluído ✔

### MORPH-008 — XSS no comprovante de impressão (`document.write`)
- **Severity:** Low | **CWE:** CWE-79 | **OWASP:** A03:2021
- **Local:** `src/components/BookingWizard.tsx:460-589`
- **Descrição:** `document.write` interpola `nomeCliente` (input do usuário) sem escape num HTML
  aberto com `window.open('', '_blank')` — self/stored XSS no contexto da janela de impressão.
- **Correção:** função `esc()` e escape de todas as interpolações.
- **Status:** Concluído ✔

### MORPH-009 — PII de assinatura (`card_last4`/`card_brand`) e `observacoes` em localStorage
- **Severity:** Low | **CWE:** CWE-312 | **OWASP:** A02:2021
- **Local:** `src/App.tsx:65,81`, `src/components/VisitorLayout.tsx:205`
- **Descrição:** `logged_client` persiste `observacoes` (JSON de assinatura com dados do cartão) —
  exposto a qualquer XSS e a scripts locais. Mitigado pelo backend (card_last4 não permite cobrança).
- **Correção:** aceito como risco residual (Low) — não altera UX; documentado aqui.
- **Status:** Aceito (documentado)

### MORPH-010 — `POST /api/auth/login` não valida JWT (rota legada sem uso no front)
- **Severity:** Low | **CWE:** CWE-287 | **OWASP:** API2:2023
- **Local:** `server.ts:964-1015`
- **Descrição:** Aceita qualquer e-mail e devolve dados do barbeiro sem validar token quando o
  Supabase está configurado. Não concede admin (outras rotas exigem `requireAdmin`), mas é
  verificação ausente.
- **Correção:** exigir `req.userId` quando Supabase configurado.
- **Status:** Concluído ✔

### MORPH-011 — Headers de segurança ausentes
- **Severity:** Informational | **CWE:** CWE-693 | **OWASP:** API8:2023
- **Local:** `server.ts` (setup do app)
- **Descrição:** Sem `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`. CSP não aplicada (evitada por risco de quebrar o print inline).
- **Correção:** middleware mínimo de headers.
- **Status:** Concluído ✔

### MORPH-012 — Gemini declarado mas não usado
- **Severity:** Informational
- **Local:** `package.json`, `AGENTS.md`, `metadata.json`
- **Descrição:** `@google/genai` instalado e documentado, mas não há `import` nem chamada em
  lugar nenhum. Sem superfície LLM explorável. Nenhuma `GEMINI_API_KEY` vaza para o bundle.
- **Status:** Informação (nenhuma ação)

---

## Recomendações Prioritizadas

1. **[High] Aplicar a migração `015_harden_anon_rls.sql`** no Supabase (`npm run db:push`).
2. **[High] Rotacionar `SUPABASE_SERVICE_ROLE_KEY` se algum dia vazou**; garantir
   `NODE_ENV=production` em qualquer deploy standalone do Express.
3. **[Low] Revisar política de localStorage** (aceita como risco residual).
4. **[Info] Remover `@google/genai` e `GEMINI_API_KEY`** do stack se o recurso não for implementar.

---

## Log de Execução

| Data | Ação |
|------|------|
| 2026-08-03 | Auditoria completa. Correções MORPH-001..004, 006, 007, 008, 010, 011 aplicadas. |
| 2026-08-03 | **Verificação:** `npm run lint` (tsc) sem erros; `npx vite build` OK; bundle servidor (esbuild) e bundle serverless Vercel (`build:api`) OK. |
| 2026-08-03 | Migração MORPH-005 escrita; **aplicação bloqueada** — `SUPABASE_DB_PASSWORD` ausente no `.env.local`. Para aplicar: definir a senha do banco e rodar `npm run db:push`. |
| 2026-08-03 | **MORPH-005 aplicada e verificada** no banco (políticas `agendamentos_anon_insert`, `agendamentos_cliente_insert`, `clientes_anon_insert` endurecidas). `db:verify` OK. |
| 2026-08-03 | **Observação pré-existente:** constraint `no_overlap_per_barbeiro` (EXCLUDE) está AUSENTE no banco — fora do escopo desta auditoria; validar com a RPC `get_available_slots`/replicar migração 002 se necessário. |

## Pendências (bloqueadas)

1. **Aplicar `015_harden_anon_rls.sql`** — requer `SUPABASE_DB_PASSWORD` em `.env.local`. → **Concluído em 2026-08-03.**
2. **(Recomendado)** Garantir `NODE_ENV=production` em qualquer deploy standalone do Express; `ALLOW_MOCK_AUTH` deve ficar vazio em produção.
3. **(Recomendado)** Rotacionar secrets se algum dia expostos.
4. **(Pré-existente, fora do escopo)** Investigar a ausência da EXCLUDE constraint `no_overlap_per_barbeiro`.
