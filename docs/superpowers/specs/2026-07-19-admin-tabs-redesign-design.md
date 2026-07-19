# Especificação de Design — Redesign das Abas Admin (Agenda, Serviços, Produtos e Clientes)

## 🎯 Objetivo
Padronizar a experiência de usuário e a estética das abas **Agenda & Status**, **Serviços CRUD**, **Produtos CRUD** e **Fichas de Clientes** do painel administrativo, seguindo o padrão moderno de alta visibilidade aplicado na aba de **Fluxo de Caixa**.

---

## 🎨 Componentes e Estruturas por Aba

### 1. Agenda & Status (`activeTab === 'agenda'`)
- **Cabeçalho de Filtros:**
  - Seletor de data ("Hoje", "Amanhã" ou Data personalizada).
  - Badges com contagem de agendamentos por status (Total, Agendados, Concluídos, Cancelados).
- **Timeline de Atendimentos:**
  - Grid/Lista de cards organizados por horário de início.
  - Card de atendimento com destaque visual por status:
    - `agendado` / `confirmado`: Borda dourada/primária com badge reluzente.
    - `concluido`: Borda e acento verde emerald.
    - `cancelado`: Borda e acento muted/vermelho.
  - Informações: Foto/Avatar, Nome do Cliente, WhatsApp, Serviço Selecionado, Preço Cobrado e Horário.
  - **Ações Rápidas em Destaque:**
    - Botão Verde "Concluir" (com alimentação automática do livro caixa e modal/confirmação).
    - Botão Vermelho "Cancelar".
    - Botão Verde WhatsApp (link direto `https://wa.me/55...`).

---

### 2. Serviços CRUD (`activeTab === 'servicos'`)
- **Card de Destaque no Topo (Novo Serviço):**
  - Título em caixa alta: `REGISTRAR NOVO SERVIÇO`.
  - Formulário limpo com cantos suaves (`rounded-sm`), sem outlines indesejados.
  - Campos: Nome do Serviço, Preço (R$), Duração (minutos), Descrição e Imagem URL.
  - Botão principal destacado: "Salvar Serviço".
- **Vitrine / Lista de Serviços:**
  - Grid de cards de serviços cadastrados.
  - Preço em destaque em tamanho grande, duração e descrição.
  - Botões para alterar status (Ativo/Inativo), editar e ordenar.

---

### 3. Produtos CRUD (`activeTab === 'produtos'`)
- **Card de Destaque no Topo (Novo Produto):**
  - Título: `CADASTRAR NOVO PRODUTO`.
  - Campos: Nome do Produto, Preço (R$), Estoque Inicial (unidades), Descrição e Foto URL.
  - Botão principal: "Salvar Produto no Estoque".
- **Vitrine & Controle de Estoque:**
  - Cards de produtos em estoque com alerta visual de nível baixo (badge de atenção para estoque ≤ 3 unidades).
  - Ações rápidas de ajuste rápido de quantidade (+1 / -1 estoque) e toggle de ativo.

---

### 4. Fichas de Clientes (`activeTab === 'clientes'`)
- **Card de Destaque no Topo (Novo Cliente):**
  - Título: `CADASTRAR NOVO CLIENTE`.
  - Campos: Nome Completo, WhatsApp/Telefone (com máscara), E-mail, Data de Nascimento e Observações/Status VIP.
  - Botão principal: "Salvar Ficha de Cliente".
- **Lista de Fichas com Busca:**
  - Campo de busca em tempo real por nome ou telefone.
  - Lista/Tabela com Avatar, WhatsApp com botão direto, Tag de Assinante VIP, data de cadastro e histórico de cortes.

---

## 🛠️ Regras de Estilo e UX Padronizadas
- Cantos de campos de entrada e selects padronizados com `rounded-sm`.
- Foco nos campos de valor com contorno limpo `focus:border-border` e `focus:ring-0`.
- Botões de ação em cores de contraste intencionais (Verde Emerald para confirmar/concluir/salvar, Vermelho para cancelar/excluir, Dourado/Primary para destaques).
