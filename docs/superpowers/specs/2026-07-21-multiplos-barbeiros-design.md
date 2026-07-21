# Múltiplos barbeiros por barbearia — Design

**Data:** 2026-07-21
**Status:** Aprovado para implementação
**Contexto:** Site em produção. Migração precisa ser aditiva, idempotente e preservar o histórico.

---

## Problema

A barbearia passou a ter mais de um barbeiro atendendo. Hoje o sistema não tem como
representar isso: a tabela `barbeiros` é a **conta/tenant**, e todo dado (`servicos`,
`clientes`, `agendamentos`, `lancamentos_financeiros`, `expedientes`, `bloqueios`)
aponta para o dono da conta via `barbeiro_id`.

Não existe o conceito de "quem executou o serviço".

### O que quebra hoje com dois barbeiros

| Ponto | Comportamento atual | Por que quebra |
|---|---|---|
| `no_overlap_per_barbeiro` (EXCLUDE em `agendamentos`) | Impede dois agendamentos ativos no mesmo `barbeiro_id` e horário | Os dois barbeiros compartilham o mesmo `barbeiro_id` (a conta). O banco **rejeita** o agendamento do barbeiro B às 10h se o barbeiro A já tem 10h |
| `get_available_slots(p_slug, ...)` | Resolve a barbearia pelo slug e varre todos os agendamentos dela | Horário aparece ocupado para o salão inteiro quando só um barbeiro está ocupado |
| `expedientes` unique `(barbeiro_id, dia_semana)` | Um expediente por dia por barbearia | Cada barbeiro pode ter horário e folga próprios |
| `sync_financeiro_from_agendamento` (trigger) | Cria lançamento com `new.barbeiro_id` | Receita não fica atribuída a ninguém em específico |

Conclusão: **não é possível resolver adicionando um campo de texto.** É preciso separar
o conceito de *conta* do conceito de *profissional*.

---

## Decisões tomadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Serviços e preços | Compartilhados pela barbearia | Catálogo único; todo profissional executa qualquer serviço. Padrão em barbearia pequena |
| Login por barbeiro | Não — só o dono | Evita mexer em auth/RLS/papéis. Pode ser adicionado depois sem refazer o modelo |
| Expediente e folgas | Por profissional | É o que faz o horário livre aparecer corretamente por barbeiro |
| Comissão | Fora de escopo | Apenas atribuição e filtro. Sem cálculo de repasse |
| Venda de produto | Receita da casa, sem barbeiro | Decisão do cliente. Produto não é atribuído a profissional |
| Opção "qualquer barbeiro" no agendamento | Fora de escopo | Exige união de agendas + desempate. O barbeiro pediu atribuição explícita |

---

## Nomenclatura

Esta é a maior fonte de confusão do projeto e precisa ficar explícita:

- **`barbeiros`** (tabela existente) — a **conta / a barbearia**. Dona do tenant, tem
  `auth_user_id`, `slug`, `email` único. **Não muda.**
- **`profissionais`** (tabela nova) — **quem corta o cabelo**. É o que o cliente escolhe
  no agendamento e o que o financeiro atribui.

Na interface o usuário sempre lê **"Barbeiro"**. `profissional` é nome interno
(banco e código) para não colidir com a tabela de conta.

---

## Modelo de dados

### Tabela nova: `profissionais`

```sql
create table public.profissionais (
  id uuid primary key default gen_random_uuid(),
  barbeiro_id uuid not null references public.barbeiros(id) on delete cascade,
  nome text not null,
  avatar_url text,
  telefone text not null default '',
  bio text default '',
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Colunas adicionadas

| Tabela | Coluna | Nulo? | Semântica |
|---|---|---|---|
| `agendamentos` | `profissional_id` | NOT NULL (após backfill) | Quem vai atender |
| `expedientes` | `profissional_id` | NOT NULL (após backfill) | Horário daquele barbeiro |
| `bloqueios` | `profissional_id` | **NULL permitido** | NULL = fecha a barbearia toda (feriado). Preenchido = folga daquele barbeiro |
| `lancamentos_financeiros` | `profissional_id` | **NULL permitido** | NULL = receita/despesa da casa (produto, aluguel, luz). Preenchido = atribuído ao barbeiro |

Os dois campos nulos são intencionais e carregam significado — não são "ainda não preenchido".

### Constraints alteradas

```sql
-- Anti-sobreposição passa a ser por profissional
alter table agendamentos drop constraint no_overlap_per_barbeiro;
alter table agendamentos add constraint no_overlap_per_profissional
  exclude using gist (profissional_id with =, tstzrange(inicio_em, fim_em, '[)') with &&)
  where (status in ('agendado','confirmado','concluido'));

-- Expediente passa a ser por profissional
alter table expedientes drop constraint expedientes_barbeiro_id_dia_semana_key;
alter table expedientes add constraint expedientes_profissional_dia_key
  unique (profissional_id, dia_semana);
```

`agendamentos.barbeiro_id` **permanece** — é o tenant, usado por RLS e pelos filtros de
barbearia. `profissional_id` é adicional, não substituto.

### Backfill (segurança do histórico)

Executado dentro da mesma transação da migração:

1. Para cada barbearia em `barbeiros`, cria um profissional a partir do dono
   (mesmo `nome`, `avatar_url`, `telefone`), se ainda não existir.
2. `agendamentos.profissional_id` ← profissional padrão da barbearia.
3. `expedientes.profissional_id` ← profissional padrão da barbearia.
4. `lancamentos_financeiros.profissional_id` ← profissional padrão **apenas** para
   lançamentos com `agendamento_id` não nulo (receita de serviço). Demais ficam NULL
   (receita/despesa da casa) — consistente com a decisão sobre produtos.
5. Só então aplica `NOT NULL` e troca as constraints.

Resultado: todo faturamento e agenda anteriores continuam batendo, atribuídos ao dono.

### RLS

`profissionais` entra no mesmo padrão das demais tabelas de recurso:

```sql
create policy profissionais_admin_all on public.profissionais
  for all using (barbeiro_id = current_barbeiro_id() or is_admin())
  with check (barbeiro_id = current_barbeiro_id() or is_admin());
create policy profissionais_public_active on public.profissionais
  for select to anon using (ativo = true);
```

A leitura pública é necessária: o wizard de agendamento precisa listar os barbeiros
antes de o visitante se autenticar.

---

## Disponibilidade de horários

`get_available_slots` ganha um parâmetro `p_profissional_id uuid` e passa a filtrar:

- **expediente** — do profissional (`where profissional_id = p_profissional_id`)
- **bloqueios** — do profissional **ou** da barbearia inteira
  (`where profissional_id = p_profissional_id or profissional_id is null`)
- **agendamentos** — apenas os daquele profissional

O restante do algoritmo (passo de 30min, soma de duração para combo, intervalo de
almoço) fica inalterado.

**Expediente de barbeiro novo:** ao criar um profissional pelo admin, o sistema copia
os expedientes do profissional padrão da barbearia. Sem isso o barbeiro nasce sem
horário nenhum e nunca aparece slot disponível — falha silenciosa e confusa.

---

## API

### Públicas

| Rota | Mudança |
|---|---|
| `GET /api/profissionais?slug=` | **Nova.** Lista profissionais ativos da barbearia (id, nome, avatar_url, bio) |
| `GET /api/horarios-livres` | Novo parâmetro **obrigatório** `profissional_id` |
| `POST /api/agendamentos` | Aceita `profissional_id`. Valida que pertence à barbearia e está ativo |

### Admin

| Rota | Mudança |
|---|---|
| `GET/POST/PATCH /api/admin/profissionais` | **Novas.** CRUD da equipe |
| `GET /api/admin/agendamentos` | Filtro opcional `profissional_id` |
| `GET /api/admin/financeiro` | Filtro opcional `profissional_id` |
| `POST/PATCH /api/admin/financeiro` | Aceita `profissional_id` (nulo permitido). Forçado a NULL quando `produto_id` presente |
| `GET /api/admin/dashboard` | Filtro opcional `profissional_id` + quebra de faturamento por barbeiro |
| `GET /api/admin/configuracoes` | Expedientes e bloqueios agrupados por profissional |
| `PATCH /api/admin/expedientes/:id` | Escopo por profissional |
| `POST /api/admin/bloqueios` | Aceita `profissional_id` (nulo = barbearia toda) |

**Desativação, não exclusão:** profissional tem `ativo`. Desativar remove dos novos
agendamentos mas preserva todo o histórico. Não há DELETE — `agendamentos.profissional_id`
é NOT NULL e apagar quebraria o histórico financeiro.

---

## Interface

**Fora de escopo:** `VisitorLayout.tsx` (landing page). Está sendo editado em paralelo
pelo usuário; não tocar para evitar conflito.

### BookingWizard

Novo passo entre serviço e data:

```
Serviço → Barbeiro → Data/Hora → Confirmação
```

O barbeiro vem **antes** da data porque o horário livre depende de quem atende.
Cards com foto e nome, seguindo o padrão visual dos cards de serviço existentes.
Seleção obrigatória.

### Admin

| Aba | Mudança |
|---|---|
| **Equipe** (nova) | CRUD de barbeiros: nome, foto, telefone, bio, ativo. Segue o padrão "lista + botão revelar formulário" já usado em Serviços/Produtos |
| **Agenda** | Filtro por barbeiro no topo (padrão "Todos") + nome do barbeiro em cada card |
| **Financeiro** | Seletor de barbeiro no formulário de lançamento (com opção "Barbearia") + filtro na listagem |
| **Dashboard** | Filtro por barbeiro + quebra de faturamento por barbeiro no período |
| **Configurações** | Seletor de barbeiro no topo; expediente e bloqueios passam a ser por barbeiro |

---

## Arquivos afetados

| Arquivo | Natureza da mudança |
|---|---|
| `supabase/migrations/009_profissionais.sql` | **Novo.** Tabela, colunas, backfill, constraints, RLS |
| `supabase/migrations/010_slots_profissional.sql` | **Novo.** `get_available_slots` com `p_profissional_id` |
| `src/types.ts` | Interface `Profissional`; `profissional_id` em `Agendamento`, `LancamentoFinanceiro`, `Expediente`, `Bloqueio` |
| `server/schemas.ts` | Validação zod dos novos campos |
| `server/storage.ts` | CRUD de profissionais; `profissional_id` em booking, lançamentos, slots, dashboard |
| `server.ts` | Rotas novas e parâmetros de filtro |
| `src/components/BookingWizard.tsx` | Passo de seleção de barbeiro |
| `src/components/AdminLayout.tsx` | Aba Equipe + filtros nas abas existentes |

`AdminLayout.tsx` já tem 3697 linhas. A aba Equipe deve nascer como componente próprio
em `src/components/admin/EquipeTab.tsx` em vez de engordar mais o arquivo.

---

## Riscos

| Risco | Mitigação |
|---|---|
| Migração em produção corrompe histórico | Aditiva, idempotente, em transação com rollback. Backfill antes de aplicar NOT NULL |
| Janela sem trava anti-sobreposição durante o swap de constraint | Swap ocorre dentro da mesma transação |
| Barbeiro novo sem expediente → nenhum slot | Cópia automática do expediente padrão ao criar |
| Caminho `db.json` (dev/preview) diverge do Supabase | Supabase é o caminho de produção e tem prioridade. `db.json` recebe os mesmos campos mas sem constraints |
| Conflito com edição paralela da landing page | `VisitorLayout.tsx` fora de escopo; commits com arquivos explícitos, nunca `git add -A` |

---

## Critérios de sucesso

1. Dois barbeiros conseguem ter agendamento no **mesmo horário** sem o banco rejeitar.
2. Cliente escolhe o barbeiro no agendamento e vê apenas os horários livres **daquele** barbeiro.
3. Folga de um barbeiro não fecha a agenda do outro; feriado da barbearia fecha as duas.
4. Admin filtra a agenda por barbeiro.
5. Lançamento financeiro é atribuído a um barbeiro (ou à casa) e o faturamento filtra por barbeiro.
6. Todo agendamento e faturamento **anteriores à migração** continuam visíveis e somando igual.
