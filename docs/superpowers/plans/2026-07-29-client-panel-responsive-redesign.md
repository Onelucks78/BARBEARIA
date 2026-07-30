# Reformulação Responsiva e Planos VIP no Painel do Cliente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o menu hambúrguer responsivo no modo visitante (`VisitorLayout.tsx`) e no painel do cliente logado (`UserLayout.tsx`), além de exibir os Planos VIP de Assinatura diretamente na tela principal do cliente para contratação imediata via Stripe, mantendo o painel admin intocado.

**Architecture:** 
No `UserLayout.tsx`, adicionaremos um header fixo para telas móveis (`lg:hidden`) com hambúrguer que alterna a visibilidade de uma gaveta (drawer) flutuante com as abas do cliente, mantendo a barra lateral padrão para telas grandes (`lg:flex`). Na aba `Meu Painel`, exibiremos os cartões dos Planos VIP com ações diretas de assinatura via Stripe (`handleStartStripeCheckout`). No `VisitorLayout.tsx`, adicionaremos um botão hambúrguer para abrir o menu gaveta mobile com todos os links de ancoragem da landing page.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Lucide React (`Menu`, `X`, `Crown`, `Calendar`, `User`, `LogOut`, etc.), Motion (`motion`, `AnimatePresence`), Supabase Auth, Stripe API.

## Global Constraints
- NUNCA alterar o painel admin (`src/components/AdminLayout.tsx` ou arquivos dentro de `src/components/admin/`).
- Manter tipagem TypeScript válida sem erros ao rodar `npm run lint`.
- Manter responsividade impecável de 320px até telas 4K.

---

### Task 1: Adicionar Menu Hambúrguer e Gaveta Responsiva em VisitorLayout.tsx

**Files:**
- Modify: `src/components/VisitorLayout.tsx`

**Interfaces:**
- `mobileMenuOpen` state (boolean) em `VisitorLayout`
- Botão hambúrguer no header (`md:hidden`)
- Overlay drawer com animação `motion.div` contendo links da landing page

- [ ] **Step 1: Adicionar o estado `mobileMenuOpen` em `VisitorLayout.tsx`**

Adicionar `const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);` no topo do componente `VisitorLayout`.

- [ ] **Step 2: Atualizar o Header para incluir o Botão Hambúrguer (`md:hidden`)**

No `header` de `VisitorLayout.tsx`, ao lado de `ThemeToggle` e botões de ação:
```tsx
<button
  type="button"
  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
  className="md:hidden p-2 rounded-lg text-foreground hover:bg-accent border border-border/60 transition cursor-pointer"
  aria-label="Abrir menu de navegação"
>
  {mobileMenuOpen ? <X className="w-6 h-6 text-primary" /> : <Scissors className="w-6 h-6 text-primary" />}
</button>
```

- [ ] **Step 3: Adicionar a Gaveta (Drawer Overlay) do Menu Mobile em VisitorLayout**

Abaixo da tag `<header>`:
```tsx
<AnimatePresence>
  {mobileMenuOpen && (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setMobileMenuOpen(false)}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
      />
      <motion.div
        initial={{ y: "-100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "-100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed top-20 left-0 right-0 bg-card/95 border-b border-border shadow-2xl p-6 z-50 md:hidden flex flex-col space-y-4 max-h-[calc(100vh-80px)] overflow-y-auto"
      >
        <nav className="flex flex-col space-y-3 text-sm font-bold uppercase tracking-wider text-foreground">
          <a href="#como-funciona" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-lg hover:bg-accent hover:text-primary transition">Como Funciona</a>
          <a href="#planos" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-lg hover:bg-accent hover:text-primary transition flex items-center gap-2"><Crown className="w-4 h-4 text-primary" /> Planos VIP</a>
          <a href="#servicos" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-lg hover:bg-accent hover:text-primary transition">Serviços</a>
          <a href="#produtos" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-lg hover:bg-accent hover:text-primary transition">Vitrine</a>
          <a href="#depoimentos" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-lg hover:bg-accent hover:text-primary transition">Clientes</a>
          <a href="#localizacao" onClick={() => setMobileMenuOpen(false)} className="p-2.5 rounded-lg hover:bg-accent hover:text-primary transition">Localização</a>
        </nav>
        <div className="pt-4 border-t border-border flex flex-col gap-3">
          <button
            type="button"
            onClick={() => { setMobileMenuOpen(false); setPreselectedService(null); setShowBookingPopup(true); }}
            className="w-full bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-primary-foreground font-bold text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-md cursor-pointer text-gold-glow flex items-center justify-center gap-2"
          >
            <Calendar className="w-4 h-4" /> Agende Já seu Horário
          </button>
        </div>
      </motion.div>
    </>
  )}
</AnimatePresence>
```

- [ ] **Step 4: Executar verificação e compilação**

Executar `npm run lint` para garantir que não há erros no `VisitorLayout.tsx`.

---

### Task 2: Reformular UserLayout.tsx com Mobile Topbar, Drawer e Planos VIP no Painel Principal

**Files:**
- Modify: `src/components/UserLayout.tsx`

**Interfaces:**
- `mobileNavOpen` state em `UserLayout`
- Header Mobile (`lg:hidden`) com Hambúrguer + Drawer com abas (`painel`, `agendar`, `assinatura`, `agendamentos`, `perfil`)
- Seção de Planos VIP em destaque no dashboard (`Meu Painel`) com botões diretos `handleStartStripeCheckout(plano.key)`

- [ ] **Step 1: Adicionar o estado `mobileNavOpen` em `UserLayout.tsx`**

Adicionar `const [mobileNavOpen, setMobileNavOpen] = useState(false);` no topo de `UserLayout`.

- [ ] **Step 2: Adicionar a Barra Superior (Topbar) Fixo para Mobile em `UserLayout.tsx`**

No retorno JSX de `UserLayout`, renderizar antes de `<aside>`:
```tsx
{/* Mobile Header Bar */}
<header className="lg:hidden sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between shadow-sm">
  <div className="flex items-center gap-3">
    <Logo className="h-10 w-auto object-contain" />
  </div>

  <div className="flex items-center gap-3">
    <ThemeToggle />
    
    {/* Profile Thumbnail */}
    <div className="w-8 h-8 rounded-full border border-primary/60 overflow-hidden bg-background shrink-0">
      {loggedClient.foto_url ? (
        <img src={loggedClient.foto_url} alt="Profile" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-primary font-bold text-xs uppercase">
          {loggedClient.nome.charAt(0)}
        </div>
      )}
    </div>

    {/* Hamburger Toggle */}
    <button
      type="button"
      onClick={() => setMobileNavOpen(!mobileNavOpen)}
      className="p-2 rounded-lg bg-accent/60 hover:bg-accent text-foreground border border-border transition cursor-pointer"
      aria-label="Alternar menu do cliente"
    >
      {mobileNavOpen ? <X className="w-5 h-5 text-primary" /> : <User className="w-5 h-5 text-primary" />}
    </button>
  </div>
</header>
```

- [ ] **Step 3: Transformar a `<aside>` em Gaveta (Drawer Overlay) no Mobile e Sidebar em Desktop**

Esconder o `<aside>` no mobile (`hidden lg:flex`) e adicionar o Drawer Overlay com `AnimatePresence` para telas móveis:
```tsx
{/* Mobile Navigation Drawer */}
<AnimatePresence>
  {mobileNavOpen && (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setMobileNavOpen(false)}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
      />
      <motion.div
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed top-0 bottom-0 left-0 w-[280px] max-w-[85vw] bg-card border-r border-border shadow-2xl p-5 z-50 lg:hidden flex flex-col justify-between overflow-y-auto"
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <Logo className="h-12 w-auto object-contain" />
            <button onClick={() => setMobileNavOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3 p-3 bg-card/60 border border-border rounded-xl">
            <div className="w-10 h-10 rounded-full border border-primary/60 overflow-hidden bg-background shrink-0">
              {loggedClient.foto_url ? (
                <img src={loggedClient.foto_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-primary font-bold uppercase text-sm">
                  {loggedClient.nome.charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-xs text-foreground truncate">{loggedClient.nome}</h4>
              <p className="text-[10px] text-muted-foreground truncate">{loggedClient.email}</p>
            </div>
          </div>

          <nav className="space-y-1.5">
            <button onClick={() => { setActiveTab('painel'); setMobileNavOpen(false); }} className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${activeTab === 'painel' ? 'bg-primary text-primary-foreground font-black shadow-md' : 'text-muted-foreground hover:bg-accent'}`}>
              <User className="w-4 h-4" /> Meu Painel
            </button>
            <button onClick={() => { setActiveTab('agendar'); setMobileNavOpen(false); }} className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${activeTab === 'agendar' ? 'bg-primary text-primary-foreground font-black shadow-md' : 'text-muted-foreground hover:bg-accent'}`}>
              <Calendar className="w-4 h-4" /> Novo Agendamento
            </button>
            <button onClick={() => { setActiveTab('assinatura'); setMobileNavOpen(false); }} className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${activeTab === 'assinatura' ? 'bg-primary text-primary-foreground font-black shadow-md' : 'text-muted-foreground hover:bg-accent'}`}>
              <Crown className="w-4 h-4 text-amber-500" /> Meu Plano VIP
            </button>
            <button onClick={() => { setActiveTab('agendamentos'); setMobileNavOpen(false); }} className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${activeTab === 'agendamentos' ? 'bg-primary text-primary-foreground font-black shadow-md' : 'text-muted-foreground hover:bg-accent'}`}>
              <Clock className="w-4 h-4" /> Meus Agendamentos
            </button>
            <button onClick={() => { setActiveTab('perfil'); setMobileNavOpen(false); }} className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${activeTab === 'perfil' ? 'bg-primary text-primary-foreground font-black shadow-md' : 'text-muted-foreground hover:bg-accent'}`}>
              <Settings className="w-4 h-4" /> Meus Dados
            </button>
          </nav>
        </div>

        <div className="pt-4 border-t border-border space-y-3">
          <button onClick={() => { setMobileNavOpen(false); onLogout(); }} className="w-full text-left px-3.5 py-3 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-500/10 border border-red-500/20 transition flex items-center gap-2.5 uppercase tracking-wider cursor-pointer">
            <LogOut className="w-4 h-4" /> Sair da Conta
          </button>
        </div>
      </motion.div>
    </>
  )}
</AnimatePresence>
```

Configurar a `<aside>` desktop para ter a classe `hidden lg:flex`.

- [ ] **Step 4: Exibir os Planos VIP em Destaque com Botões de Compra Direta na aba `Meu Painel`**

Na aba `activeTab === 'painel'`, substituir a seção secundária de planos por um bloco completo de **Planos de Assinatura VIP** com botões diretos "Assinar via Stripe":
```tsx
{/* Seção VIP de Planos no Painel Principal */}
<div className="space-y-5 pt-4 border-t border-border/60">
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
    <div>
      <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
        <Crown className="w-5 h-5 text-primary" /> Planos de Assinatura Ilimitada
      </h3>
      <p className="text-xs text-muted-foreground mt-0.5">
        Assine online e tenha acesso ilimitado a cortes, barba e estilos com economia garantida.
      </p>
    </div>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
    {PLANOS.map((plano) => {
      const isCurrentPlan = subscription?.status === 'ativo' && (subscription.plan || '').toLowerCase() === plano.key;
      return (
        <div 
          key={plano.key}
          className={`p-6 rounded-2xl border bg-card/90 backdrop-blur-sm transition-all duration-300 flex flex-col justify-between space-y-4 shadow-sm hover:shadow-lg relative overflow-hidden ${
            plano.destaque 
              ? 'border-primary shadow-primary/10 ring-1 ring-primary/40' 
              : 'border-border/80 hover:border-primary/40'
          }`}
        >
          {plano.destaque && (
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl shadow-md">
              Mais Vendido
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-lg text-foreground tracking-tight">{plano.nome}</span>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-primary tracking-tight">R$ {formatPreco(plano.preco)}</span>
              <span className="text-xs text-muted-foreground font-semibold">/mês</span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {plano.descricao}
            </p>

            <ul className="space-y-2 pt-2 border-t border-border/60 text-xs">
              {plano.beneficios.map((beneficio, i) => (
                <li key={i} className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{beneficio}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-3 border-t border-border/60">
            {isCurrentPlan ? (
              <div className="w-full py-3 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 font-bold text-xs uppercase tracking-wider rounded-xl text-center flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Plano Atual Ativo
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleStartStripeCheckout(plano.key)}
                disabled={redirectingPlan === plano.key}
                className="w-full bg-gradient-to-r from-primary via-primary/90 to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground font-bold text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-200 cursor-pointer text-gold-glow flex items-center justify-center gap-2"
              >
                <Crown className="w-4 h-4" />
                {redirectingPlan === plano.key ? 'Iniciando Checkout...' : `Assinar ${plano.nome}`}
              </button>
            )}
          </div>
        </div>
      );
    })}
  </div>
</div>
```

---

### Task 3: Verificação & Teste de Compilação

**Files:**
- Test/Check: Whole project via TypeScript check and local execution

- [ ] **Step 1: Executar verificação de tipos com TypeScript**

Executar `npm run lint` no terminal para assegurar 0 erros de compilação TS.

- [ ] **Step 2: Verificar comportamento no browser/servidor dev**

Garantir que a aplicação inicia normalmente com `npm run dev` e que não há alertas ou erros em tempo de execução.

---
