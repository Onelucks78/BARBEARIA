# Design — Grade Semanal de Agenda (estilo FullCalendar) + Painel Inicial Agenda & Status

Data: 2026-08-09
Status: Aprovado

## Objetivo

Clonar a experiência de agenda do appbarber (sistema.appbarber.com.br#/agenda) para o painel admin do Detalhes Barbearia:

1. A tela inicial do painel admin passa a ser **Agenda & Status** (e a sidebar reordena: 1º Agenda & Status, 2º Balanço Financeiro).
2. A aba Agenda deixa de ser apenas lista e ganha uma **grade semanal estilo FullCalendar**, com uma coluna por barbeiro, agendamentos como blocos coloridos por status.
3. Modal de agendamento (encaixe) com **busca de cliente por prefixo** (autocomplete nos clientes cadastrados) e **duração/preço já calculados** a partir do serviço.

## Escopo

### 1. Reordenação do painel admin

- `src/components/AdminLayout.tsx`:
  - Estado inicial de `activeTab` muda de `'dashboard'` para `'agenda'` (o painel abre na agenda).
  - Menu mobile (off-canvas): trocar a ordem dos botões — 1º Agenda & Status, 2º Balanço Financeiro.
- `src/components/Layout.tsx`:
  - `Sidebar` desktop: mesma inversão de ordem (1º Agenda & Status, 2º Balanço Financeiro).
  - `Header`: títulos seguem a ordem (sem mudança de lógica, só coerência).
- **Não** alterar `UserLayout`/`VisitorLayout` (visão do cliente continua como está).

### 2. Componente novo `src/components/admin/AgendaSemanal.tsx`

Grade semanal customizada em React + Tailwind (sem biblioteca).

- **Estrutura visual**:
  - Coluna de horas à esquerda (intervalo 07:00–24:00, divisões de 30 min).
  - Uma coluna por **profissional ativo** (cabeçalho com nome; avatar se houver).
  - Blocos de agendamento posicionados por `inicio_em`/`fim_em` (top/height proporcionais ao horário).
- **Cores por status**:
  - `agendado`/`confirmado` → primária (destaque).
  - `concluido` → verde, com opacidade reduzida.
  - `cancelado`/`faltou` → vermelho, com opacidade reduzida.
- **Navegação**: botões ‹ / › (semana anterior/próxima), indicador do dia atual, título com o intervalo da semana em exibição.
- **Interações**:
  - Clique em **slot vazio** → abre o `ManualBookingModal` com a data e a hora do slot pré-selecionadas.
  - Clique em **agendamento** → abre modal de detalhes com ações de status (Concluir / Cancelar).
- **Filtro**: reutiliza `FiltroBarbeiro` para exibir apenas um barbeiro quando houver mais de um (opcional; mantém o comportamento atual do filtro global).
- **Dados**: recebe `agendamentos`, `profissionais`, `servicos`, `clientes` como props (mesmos estados já carregados no `AdminLayout`). Sem novo fetch.
- **Responsivo**: no mobile, a grade vira scroll horizontal com largura mínima (colunas de barbeiro lado a lado).

### 3. Upgrade do `ManualBookingModal` (encaixe)

- **Autocomplete de cliente por prefixo**:
  - O campo "Nome do Cliente" passa a buscar clientes cadastrados (nome ou telefone) conforme o usuário digita.
  - Dropdown de seleção; ao escolher, preenche telefone automaticamente.
  - Se não houver correspondência, o admin pode seguir digitando nome livre (sem cadastro), como hoje.
  - Recebe a lista de `clientes` como prop.
- **Duração/preço**: já calculados hoje (`totalPreco`/`totalDuracao`); mantém e exibe claramente.
- **Nova prop `slotInicial`** (`{ data: string; horario: string }`): quando aberto a partir de um slot vazio da grade, já vem com data/hora selecionadas.
- O formulário continua gravando via `POST /api/agendamentos` (mesma rota atual, sem mudança no backend).

### 4. Backend / banco

- **Nenhuma alteração**. Usa as tabelas e endpoints existentes:
  - `/api/admin/agendamentos`, `/api/admin/profissionais`, `/api/admin/servicos`, `/api/admin/clientes`.
  - Realtime/polling de agendamentos já existentes no `AdminLayout` continuam funcionando.

## Fora de escopo

- Nenhuma alteração no backend, schemas ou migrações.
- Nenhuma alteração na visão pública/cliente (`UserLayout`, `VisitorLayout`, `BookingWizard`).
- Sem drag-and-drop de agendamentos na grade (apenas clique para criar/editar status).
- Sem bibliotecas novas (FullCalendar fica de fora).

## Arquivos afetados

- `src/components/AdminLayout.tsx` (default tab, menu mobile, integrar `AgendaSemanal`)
- `src/components/Layout.tsx` (ordem da sidebar e header)
- `src/components/admin/AgendaSemanal.tsx` (novo)
- `src/components/admin/ManualBookingModal.tsx` (autocomplete cliente + slot inicial)

## Verificação

- `npm run lint` (tsc --noEmit) sem erros.
- `npm run build` sem erros.
- Teste manual: painel abre na agenda; sidebar com Agenda & Status em 1º; clique em slot vazio abre modal com data/hora; digitar prefixo filtra clientes; criar agendamento aparece na grade do barbeiro escolhido; clique no bloco permite Concluir/Cancelar.
