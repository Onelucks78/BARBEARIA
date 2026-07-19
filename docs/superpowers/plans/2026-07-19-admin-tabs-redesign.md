# Redesign das Abas Admin (Agenda, Serviços, Produtos e Clientes) — Plano de Execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nivelar o acabamento visual das abas **Agenda & Status**, **Serviços CRUD**, **Produtos CRUD** e **Fichas de Clientes** ao padrão já aplicado em **Fluxo de Caixa** (considerada ótima, fora de escopo).

**Architecture:** Tudo em `src/components/AdminLayout.tsx`. Sem novas rotas de API — o único endpoint reaproveitado de forma nova é o PATCH parcial de `/api/admin/produtos/:id` (já suporta `{ estoque }` sozinho, confirmado em `server.ts:841`).

**Tech Stack:** React 19, Tailwind CSS 4, Lucide icons, componentes shadcn (`Button`, `Input`, `Textarea`, `Select`, `Badge`) já presentes no projeto.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-19-admin-tabs-redesign-design.md`
- Não tocar em `dashboard`, `planos`, `financeiro` (Fluxo de Caixa) nem `configuracoes`.
- Não remover nenhuma transição de estado já suportada (ex.: `confirmado`, `faltou` na Agenda).
- Reaproveitar helpers/handlers já existentes (`formatBRL`, `parseSubscription`, `assinantesVIP`, `handleUpdateBookingStatus`, `handleToggleServiceActive`, `handleToggleProductActive`, `handleEditClientSelect`).
- Commits só se o usuário pedir explicitamente.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/components/AdminLayout.tsx` | Único arquivo de código alterado — 4 seções de JSX + helpers/handlers compartilhados |

---

### Task 1: Helpers e imports compartilhados

**Files:** Modify `src/components/AdminLayout.tsx` (imports ~linha 1-34, helpers ~linha 780, handlers de produto ~linha 437)

- [x] Adicionar ícones `MessageCircle`, `Search`, `Minus`, `CheckCircle2` ao import de `lucide-react`
- [x] Importar `Badge` de `@/components/ui/badge.tsx`
- [x] Adicionar state `clientSearchQuery` (string) perto dos outros filtros
- [x] Adicionar helper `getWhatsAppLink(telefone)` perto de `formatBRL`/`getDayName`
- [x] Adicionar handler `handleAdjustStock(p, delta)` perto de `handleToggleProductActive`, fazendo `PATCH /api/admin/produtos/:id` só com `{ estoque }`

### Task 2: Aba Agenda — badges de contagem + ações rápidas

**Files:** Modify `src/components/AdminLayout.tsx` (bloco `activeTab === 'agenda'`)

- [x] Linha de `Badge`s com contagem: Total, Agendados (agendado+confirmado), Concluídos, Cancelados (cancelado+faltou)
- [x] Borda `border-l-4` colorida por status no card (primary/emerald/red)
- [x] Botões em destaque "Concluir" (emerald) e "Cancelar" (red) chamando `handleUpdateBookingStatus`
- [x] Link WhatsApp (`getWhatsAppLink` + ícone `MessageCircle`) abrindo em nova aba
- [x] Manter o `<select>` de status e o seletor de vínculo de ficha como estavam

### Task 3: Aba Serviços — vitrine em grid

**Files:** Modify `src/components/AdminLayout.tsx` (bloco `activeTab === 'servicos'`)

- [x] Trocar lista de linhas simples por grid responsivo (`sm:grid-cols-2 lg:grid-cols-3`)
- [x] Card com imagem `aspect-video`, `Badge` Ativo/Inativo, descrição truncada, preço grande + duração
- [x] Botões "Editar" e "Ativar/Desativar" com componente `Button`

### Task 4: Aba Produtos — vitrine em grid + controle de estoque

**Files:** Modify `src/components/AdminLayout.tsx` (bloco `activeTab === 'produtos'`)

- [x] Trocar tabela crua por grid igual ao de Serviços
- [x] `Badge` de alerta "Estoque baixo" quando `estoque <= 3`
- [x] Botões `-`/`+` chamando `handleAdjustStock`
- [x] Botões "Modificar" e "Exibir/Ocultar"

### Task 5: Aba Fichas de Clientes — busca, VIP, WhatsApp, data de nascimento

**Files:** Modify `src/components/AdminLayout.tsx` (bloco `activeTab === 'clientes'`)

- [x] Adicionar campo `Data de nascimento` no formulário (state já existia, campo faltava)
- [x] Barra de busca em tempo real (`clientSearchQuery`) filtrando por nome ou telefone
- [x] `Badge` "VIP"/"VIP vencido" usando `assinantesVIP` já calculado no componente
- [x] Link clicável de WhatsApp com `stopPropagation` (card inteiro é clicável para editar)

### Task 6: Verificação

- [ ] `npm run lint` (`tsc --noEmit`) sem erros
- [ ] `npm run dev` e revisão manual das 4 abas em light/dark (ver checklist no spec e na sessão de implementação)

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Agenda: badges de contagem por status | Task 2 |
| Agenda: cards com destaque de cor por status | Task 2 |
| Agenda: ações rápidas Concluir/Cancelar/WhatsApp | Task 2 |
| Serviços: vitrine em grid com imagem/preço/duração | Task 3 |
| Produtos: vitrine com alerta de estoque baixo | Task 4 |
| Produtos: ajuste rápido de quantidade | Task 4 |
| Clientes: busca em tempo real | Task 5 |
| Clientes: tag VIP + WhatsApp direto | Task 5 |
| Clientes: campo Data de Nascimento | Task 5 (gap encontrado durante implementação) |

## Self-review notes

- Sem placeholders TBD/TODO no plano.
- Nenhuma nova dependência de API introduzida; `handleAdjustStock` reaproveita o PATCH parcial já suportado pelo backend.
- Não há suite de testes automatizados de UI no projeto; validação é manual + `npm run lint`.
