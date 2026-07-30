# Design Spec: Reformulação Responsiva & Planos VIP no Painel do Cliente

**Data**: 29/07/2026  
**Status**: Aprovado pelo Usuário  
**Escopo**: `src/components/UserLayout.tsx`, `src/components/VisitorLayout.tsx`  
*(Observação: `AdminLayout.tsx` e qualquer arquivo do painel admin permanecem 100% intocados).*

---

## 1. Objetivos

1. **Menu Hambúrguer no Mobile**:
   - Adicionar menu hambúrguer no `VisitorLayout.tsx` (visão pública de visitantes/clientes) para navegação responsiva em smartphones.
   - Substituir a barra lateral estática no topo do `UserLayout.tsx` no mobile por um header fixo com botão Hambúrguer e menu gaveta (drawer/overlay), garantindo que o menu não fique cobrindo o conteúdo ("menu na frente").
2. **Planos VIP em Destaque na Tela Inicial**:
   - Exibir os cartões dos Planos de Assinatura (**Essential**, **Premium**, **Exclusive**) na tela principal do cliente (`Meu Painel`) com botões diretos de checkout Stripe ("Assinar Agora"), permitindo a contratação imediata sem precisar navegar entre abas.
3. **Responsividade & UX Premium**:
   - Ajustar z-index, espaçamentos, tipografia e botões para garantir usabilidade em telas de 320px até desktops full HD.

---

## 2. Arquitetura das Mudanças

### A. `src/components/UserLayout.tsx`
- **Mobile Header (`lg:hidden`)**:
  - Sticky topbar com Logo, Foto do Usuário, indicador de plano VIP (se ativo) e Botão Hambúrguer (`Menu` / `X` do `lucide-react`).
  - Drawer flutuante (`AnimatePresence` + `motion.div`) com backdrop desfocado para alternância de abas (`Meu Painel`, `Novo Agendamento`, `Meu Plano`, `Meus Agendamentos`, `Meus Dados`, `Sair`).
  - Ao selecionar uma aba no mobile, o drawer fecha automaticamente.
- **Desktop Sidebar (`hidden lg:flex`)**:
  - Mantém a barra lateral existente para telas grandes (`lg:`).
- **Conteúdo da Aba `Meu Painel`**:
  - **Banner de Boas-Vindas**: Saudação + Ações rápidas.
  - **Status da Assinatura & Próximo Agendamento**: Cards no topo.
  - **Vitrine de Planos VIP**: Seção em destaque com os 3 planos, preços em BRL, benefícios detalhados e botão **"Assinar Agora via Stripe"** para acionar `handleStartStripeCheckout(plano.key)`.
  - **Vitrine de Produtos Recomendados**: Mantida e responsiva.

### B. `src/components/VisitorLayout.tsx`
- **Header Mobile (`md:hidden`)**:
  - Adição do botão Hambúrguer ao lado das ações do topo (Tema / Perfil / Agendar).
  - Drawer deslizante no mobile exibindo as âncoras da página:
    - `#como-funciona` (Como Funciona)
    - `#planos` (Planos VIP)
    - `#servicos` (Serviços)
    - `#produtos` (Vitrine)
    - `#depoimentos` (Clientes)
    - `#localizacao` (Localização)
  - Botão de ação em destaque: "Agende Já".

---

## 3. Critérios de Aceitação

- [x] O painel admin (`AdminLayout.tsx`) permanece inalterado.
- [x] Em dispositivos móveis (telas inteligentes / smartphones), existe um botão Hambúrguer visível no header tanto no modo visitante quanto no cliente logado.
- [x] O menu mobile não sobrepõe permanentemente o conteúdo ("menu na frente").
- [x] Os planos de assinatura aparecem na página inicial do cliente logado com botão direto de compra/assinatura Stripe.
- [x] Não ocorrem regressões de TypeScript (`npm run lint`).
