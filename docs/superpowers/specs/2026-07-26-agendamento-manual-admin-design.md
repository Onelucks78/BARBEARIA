# Specification: Agendamento Manual no Painel Administrativo

## Contexto e Objetivo
O barbeiro precisa registrar agendamentos recebidos por canais externos (WhatsApp, ligação telefônica ou presencialmente) diretamente pelo Painel Administrativo (`AdminLayout.tsx`). 

Essa ação deve travar o horário do profissional no sistema, impedindo que outros clientes reservem o mesmo horário pela landing page pública.

---

## Requisitos do Sistema

### 1. Interface de Usuário (Frontend - `AdminLayout.tsx`)
- **Botão de Ação**: Adicionar botão `+ Novo Agendamento` com destaque visual na aba **Agenda** do Painel Admin.
- **Modal de Agendamento Manual**:
  - **Dados do Cliente**:
    - Opção de selecionar cliente existente da base de clientes cadastrada.
    - Opção de cadastrar dados rápidos para novo cliente (`Nome Completo` e `Telefone/WhatsApp`).
  - **Seleção de Profissional**: Dropdown para selecionar qual barbeiro atenderá o cliente.
  - **Seleção de Serviço(s)**: Lista de serviços com checkbox para selecionar um ou mais cortes/serviços.
  - **Data e Horário**:
    - Campo de data (`YYYY-MM-DD`).
    - Grid de horários livres calculados em tempo real com base na agenda e expediente do barbeiro selecionado.
  - **Observações / Origem**: Campo opcional (pré-preenchido com "Agendamento via WhatsApp/Admin").
- **Validação e Envio**:
  - Validar campos obrigatórios (Cliente, Barbeiro, Serviço, Data e Horário).
  - Chamar a API backend para efetuar o agendamento.
  - Atualizar a lista de agendamentos e estatísticas do Dashboard automaticamente.

---

## 2. Backend & Regras de Negócio (`server.ts`)
- **Endpoint**: `POST /api/agendamentos`
- **Validação de Conflito de Horário**:
  - A API já verifica se o profissional possui horário livre para a duração acumulada dos serviços na data escolhida.
  - Garante trava total da agenda contra reservas simultâneas no site público.
- **Persistência**:
  - Salva o agendamento no Supabase / `db.json` com status `'agendado'`.
  - Registra o nome e telefone do cliente nos dados do agendamento.

---

## 3. Fluxo de Experiência do Usuário (UX)
1. Barbeiro recebe mensagem no WhatsApp pedindo horário.
2. Abre o Painel Admin > Aba Agenda > Clica em `+ Novo Agendamento`.
3. Informa o nome/telefone do cliente, seleciona o serviço, a data e o horário livre.
4. Clica em **"Confirmar & Travar Horário"**.
5. O sistema salva o agendamento, atualiza a agenda na tela e bloqueia aquele horário para todos no site público.
