# Análise do Projeto — Pontos a Corrigir

Documento de referência gerado a partir da revisão do código atual (pré-Supabase).
Cada item tem origem, impacto e a forma como pretendemos resolver.

---

## 1. Encoding do `db.json` corrompido

**Onde:** `db.json` (gravado em Latin-1, lido como UTF-8).

**Sintomas:**
- `degradǦ` em vez de `degradê`
- `Odontolgica` em vez de `Odontológica`
- `Utilidades` virou `"?gua`

**Impacto:** cosmético no protótipo, mas impede usar o `db.json` como seed da Supabase.

**Resolução:** Não usar `db.json` como seed. Gerar seed novo em UTF-8 puro via migration `003_seed.sql`.

---

## 2. IDs hardcoded (`barbeiro_id: 'b-1'`) — decisão single vs multi-tenant

**Onde:** todo o seed, todos os `POST`s, todos os types.

**Impacto:** se for multi-tenant precisa virar FK com RLS; se for single-tenant, remove o campo e o `slug`.

**Resolução:** confirmar com o usuário antes da migration. Schema vai depender dessa decisão.

---

## 3. `ADMIN_TOKEN` e `ADMIN_EMAIL` hardcoded no servidor

**Onde:** `server.ts:21-22`.

**Sintomas:**
```ts
const ADMIN_EMAIL = '78787878one@gmail.com';
const ADMIN_TOKEN = 'barber-admin-session-secret-token-12345';
```

**Impacto:** qualquer um com acesso ao bundle vê. Inaceitável em produção.

**Resolução:** migrar admin pra Supabase Auth (e-mail/senha ou magic link). `verifyAdminToken` passa a verificar JWT do Supabase. Service Role key fica **só** no servidor, nunca no front.

---

## 4. Login "Google" do cliente é falso

**Onde:** `App.tsx:27-45` — só grava no `localStorage`.

**Impacto:** cliente "logado" hoje não existe no banco; recarregar a aba num dispositivo novo perde a sessão.

**Resolução:** trocar por `supabase.auth.signInWithOAuth({ provider: 'google' })`. Tabela `clientes` ganha `auth_user_id uuid references auth.users`.

---

## 5. Telefone armazenado em dois formatos

**Onde:** seed usa `(11) 99999-1111`, agendamentos reais guardam `64992174770`.

**Impacto:** busca por telefone falha, JOIN cliente↔agendamento vira pesadelo.

**Resolução:** padronizar — guardar sempre o número cru (só dígitos), formatar só na exibição. Migration faz `UPDATE` limpando valores antigos.

---

## 6. `server.ts` monolítico (1157 linhas, ~40 rotas)

**Onde:** `server.ts` inteiro.

**Impacto:** dificulta evoluir pra RLS, middleware granular, versionamento.

**Resolução:** dividir por recurso:
```
server/routes/servicos.ts
server/routes/produtos.ts
server/routes/clientes.ts
server/routes/agendamentos.ts
server/routes/financeiro.ts
server/routes/configuracoes.ts
server/routes/auth.ts
server/middleware/verifyAdmin.ts
```

---

## 7. `db.json` lido/escrito em toda requisição, sem lock

**Onde:** `server/database.ts:552-590` — `loadDB()` e `saveDB()` síncronos.

**Impacto:** dois admins editando ao mesmo tempo = último a salvar ganha. `writeFileSync` trava o event loop.

**Resolução:** Supabase/Postgres resolve nativamente. Não há código pra reescrever, só não portar essa lógica.

---

## 8. Validação zero

**Onde:** todos os handlers — só `Number(preco)` e checagens de string vazia.

**Impacto:** payload mal formado vira `NaN`, quebra `toFixed(2)` (`server.ts:504`), corrompe estoque.

**Resolução:** adicionar **Zod** e um middleware `validate(schema)` reaproveitado por todas as rotas.

---

## 9. IDs sequenciais (`#000001`) com race condition

**Onde:** `server.ts:274-285` — `parseInt` no array inteiro a cada POST.

**Impacto:** dois POSTs simultâneos podem pegar o mesmo `highestNum + 1`.

**Resolução:** Postgres `bigserial` ou `uuid` + sequence. Decide na migration inicial.

---

## 10. Script `clean` apaga `db.json`

**Onde:** `package.json`:
```json
"clean": "rm -rf dist server.js db.json"
```

**Impacto:** depois da migração não existe mais `db.json`. Linha perigosa de manter.

**Resolução:** remover `db.json` do `clean` assim que o Supabase estiver em produção.

---

## 11. Mistura de responsabilidade: cálculo de slot no servidor Node

**Onde:** `server/database.ts:593-796` — `calculateAvailableSlots` e `calculateAllSlotsWithAvailability`.

**Impacto:** lógica boa, mas se quisermos usar como `EXCLUDE constraint` no Postgres, parte dela vira `tstzrange`.

**Resolução:** manter a função JS pra UI/admin (que precisa explicar por que horário tá indisponível), e usar EXCLUDE constraint no banco como **rede de segurança** final.

---

## 12. Type `Date` em formato `YYYY-MM-DD` ou ISO sem `Z`

**Onde:** `inicio_em`, `data`, `ultimo_acesso_em` — alguns têm `Z`, outros não.

**Impacto:** confusão de fuso. Postgres vai exigir `timestamptz`; UI vai ter que converter.

**Resolução:** padronizar `timestamptz` no banco. Front formata pra local no momento de exibir.

---

## Resumo executivo

| # | Item | Esforço | Bloqueante |
|---|------|---------|------------|
| 1 | Encoding `db.json` | baixo | não |
| 2 | Single vs multi-tenant | médio | **sim** (define schema) |
| 3 | Admin token hardcoded | médio | **sim** (segurança) |
| 4 | Login Google falso | médio | não (funcional) |
| 5 | Telefone em 2 formatos | baixo | **sim** (dados) |
| 6 | Server monolítico | médio | não |
| 7 | Race condition `db.json` | já resolvido por Supabase | não |
| 8 | Validação zero | médio | **sim** (robustez) |
| 9 | IDs sequenciais | já resolvido por Postgres | não |
| 10 | `clean` script | baixo | não |
| 11 | Slot calc | baixo | não |
| 12 | Tipos de data | baixo | **sim** (dados) |

---

## Próximos passos sugeridos

1. Decidir single-tenant vs multi-tenant (#2).
2. Criar migrations Supabase com schema correto + RLS (#2, #3, #4, #5, #12).
3. Adicionar Zod no `server.ts` antes de qualquer rota nova (#8).
4. Dividir `server.ts` em rotas (#6).
5. Remover `db.json` do `clean` (#10).
6. Limpar encoding do seed quando gerar a migration inicial (#1).
