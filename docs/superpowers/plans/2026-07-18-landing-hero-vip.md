# Landing Hero + Plano VIP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Diferenciar o hero no light mode, melhorar a tipografia do H1 e adicionar seção full-bleed do Plano VIP na landing pública, com CTA que só abre login.

**Architecture:** Tudo em `VisitorLayout.tsx`. Hero ganha classes de gradiente light + dark escuro e CTAs atualizados. Nova seção `#vip` full-bleed entre Agendar e Cortes. CTA Assinar chama `onAdminLoginClick()` (mesmo fluxo do botão admin/auth já wired em `App.tsx` → `AuthModal`). Sem nova API.

**Tech Stack:** React 19, Tailwind CSS 4, Lucide icons, Motion (já no projeto), CSS variables de tema existentes.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-landing-hero-vip-design.md`
- CTA Assinar VIP **sempre** abre auth (`onAdminLoginClick`) — nunca assina na landing
- Hero “Ver Plano VIP” só faz scroll para `#vip`
- Preço VIP: **R$ 120,00/mês** (copy alinhada a `UserLayout`)
- Benefícios: cortes de cabelo, barba e sobrancelhas ilimitados, sem taxas extras
- Não alterar fluxo de Agendar Horário nem listagem Cortes & Cuidados
- Preços de serviços/produtos permanecem `text-foreground` (sem `text-primary` + glow)
- Commits só se o usuário pedir explicitamente

---

## File map

| File | Responsibility |
|------|----------------|
| `src/components/VisitorLayout.tsx` | Hero visual/tipografia/CTAs; seção `#vip`; wire auth |
| `src/index.css` | (Opcional) utilitário `.hero-surface` se classes inline ficarem longas demais |
| `src/App.tsx` | Sem mudança (já passa `onAdminLoginClick`) |

---

### Task 1: Hero surface + tipografia premium

**Files:**
- Modify: `src/components/VisitorLayout.tsx` (seção Hero ~linhas 578–651)
- Optional: `src/index.css` se preferir classe utilitária

**Interfaces:**
- Consumes: props existentes do `VisitorLayout`; classes Tailwind + `dark:` variant
- Produces: hero visual distinto do menu no light; H1 mais premium

- [ ] **Step 1: Localizar o bloco Hero**

Abrir `src/components/VisitorLayout.tsx` e encontrar:

```tsx
{/* Hero Banner Section */}
<section className="relative bg-background text-muted-foreground overflow-hidden py-24 sm:py-32">
```

e o H1:

```tsx
<h1 className="font-normal text-4xl sm:text-5xl lg:text-6.5xl tracking-wide leading-[1.1] text-foreground">
```

- [ ] **Step 2: Atualizar fundo do hero (gradiente light + dark escuro)**

Substituir a `<section>` do hero por:

```tsx
<section className="relative overflow-hidden py-24 sm:py-32 text-muted-foreground bg-gradient-to-b from-[#f7f2e8] via-[#faf8f4] to-background dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950">
  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(197,160,89,0.10),transparent_55%)] dark:bg-[radial-gradient(circle_at_30%_30%,rgba(197,160,89,0.08),transparent_55%)] animate-pulse-slow pointer-events-none" />
```

Manter o restante da grid interna.

- [ ] **Step 3: Tipografia do H1**

Substituir o H1 por:

```tsx
<h1 className="font-normal text-4xl sm:text-5xl lg:text-7xl tracking-tight leading-[1.05] text-foreground">
  Corte Perfeito <br />
  <span className="text-primary">Sem Cadastro</span> e Sem Burocracia
</h1>
```

- Remover classes inválidas/ruído como `not-text-gold-glow` / `lg:text-6.5xl` se ainda existirem.
- Manter subtítulo e badge superior; opcionalmente reduzir peso visual dos 3 badges inferiores (já ok se legíveis).

- [ ] **Step 4: Verificar no browser**

Run: abrir `http://localhost:3000`, toggle light/dark.

Expected:
- Light: hero bege→branco, diferente do header branco flat
- Dark: hero quase preto (`zinc-950`), legível
- H1 maior e com tracking mais premium

- [ ] **Step 5: Typecheck**

Run: `npm run lint`  
Expected: exit 0

---

### Task 2: CTAs do hero (Agendar + Ver Plano VIP)

**Files:**
- Modify: `src/components/VisitorLayout.tsx` (bloco de botões do hero ~597–610)

**Interfaces:**
- Consumes: `setShowBookingPopup`, `setPreselectedService` (já no componente)
- Produces: CTA primário Agendar; CTA secundário anchor `#vip`

- [ ] **Step 1: Trocar o CTA secundário “Ver Serviços” por “Ver Plano VIP”**

Substituir o par de CTAs do hero por:

```tsx
<div className="flex flex-col sm:flex-row gap-4 pt-4">
  <button
    type="button"
    onClick={() => { setPreselectedService(null); setShowBookingPopup(true); }}
    className="bg-gradient-to-r from-primary to-primary/70 hover:from-primary/80 hover:to-primary text-black text-xs uppercase tracking-[0.2em] font-black px-7 py-4.5 rounded-md text-center shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center gap-2.5 cursor-pointer"
  >
    Escolher Horário Imperial <ArrowDown className="w-4 h-4 text-black animate-bounce" />
  </button>
  <a
    href="#vip"
    className="bg-background/60 hover:bg-card text-foreground border border-border hover:border-primary/40 text-xs uppercase tracking-[0.18em] font-bold px-7 py-4.5 rounded-md text-center transition-all duration-300 flex items-center justify-center gap-2 shadow-md hover:scale-105"
  >
    Ver Plano VIP <Sparkles className="w-4 h-4 text-primary" />
  </a>
</div>
```

Notas:
- `Sparkles` já é importado de `lucide-react` neste arquivo.
- Não remover o CTA de agendar do header nem a seção Agendar mais abaixo.

- [ ] **Step 2: Verificar scroll**

No browser: clicar “Ver Plano VIP”.  
Expected: por enquanto pode não ter âncora (Task 3 cria `#vip`). Após Task 3, deve rolar até a seção.

- [ ] **Step 3: Typecheck**

Run: `npm run lint`  
Expected: exit 0

---

### Task 3: Seção full-bleed Plano VIP + CTA auth

**Files:**
- Modify: `src/components/VisitorLayout.tsx`
  - Import: adicionar `Crown` (ou `Gem`) de `lucide-react`
  - Inserir seção entre o fim de `#agendar-sessao-section` e o início de `<main ...>`

**Interfaces:**
- Consumes: `onAdminLoginClick: () => void` (já na props)
- Produces: âncora `#vip`; CTA chama `onAdminLoginClick()`

- [ ] **Step 1: Garantir ícone no import**

No import de `lucide-react`, adicionar `Crown` (se ainda não existir):

```tsx
import {
  // ...existing icons...
  Crown,
} from 'lucide-react';
```

- [ ] **Step 2: Inserir seção VIP full-bleed**

Imediatamente **depois** do fechamento de:

```tsx
</section>
{/* end of #agendar-sessao-section */}
```

e **antes** de:

```tsx
<main className="max-w-7xl mx-auto ...">
```

inserir:

```tsx
{/* Plano VIP — full-bleed */}
<section
  id="vip"
  className="relative scroll-mt-20 overflow-hidden bg-zinc-950 text-zinc-100 border-y border-primary/25"
>
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(197,160,89,0.16),transparent_55%)] pointer-events-none" />
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_80%,rgba(197,160,89,0.08),transparent_50%)] pointer-events-none" />

  <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">
      <div className="space-y-5 max-w-xl">
        <span className="inline-flex items-center gap-2 bg-primary/15 text-primary border border-primary/30 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.22em]">
          <Crown className="w-3.5 h-3.5" /> VIP Imperial
        </span>

        <h2 className="font-normal text-3xl sm:text-4xl lg:text-5xl tracking-tight text-white leading-[1.1]">
          Plano VIP com cortes, barba e sobrancelha{' '}
          <span className="text-primary">ilimitados</span>
        </h2>

        <p className="text-zinc-400 text-sm leading-relaxed max-w-lg">
          Assine o Plano VIP da Detalhe Barbearia e tenha atendimento recorrente sem taxas extras nos serviços elegíveis.
        </p>

        <ul className="space-y-2.5 text-sm text-zinc-300">
          <li className="flex items-center gap-2.5">
            <Check className="w-4 h-4 text-primary shrink-0" /> Cortes de cabelo ilimitados
          </li>
          <li className="flex items-center gap-2.5">
            <Check className="w-4 h-4 text-primary shrink-0" /> Barba ilimitada
          </li>
          <li className="flex items-center gap-2.5">
            <Check className="w-4 h-4 text-primary shrink-0" /> Sobrancelhas ilimitadas
          </li>
          <li className="flex items-center gap-2.5">
            <Check className="w-4 h-4 text-primary shrink-0" /> Sem taxas extras nos serviços do plano
          </li>
        </ul>
      </div>

      <div className="w-full lg:w-auto lg:min-w-[280px]">
        <div className="relative rounded-xl border border-primary/35 bg-zinc-900/80 p-7 shadow-2xl shadow-primary/10 backdrop-blur-sm">
          <div className="absolute -inset-px rounded-xl bg-gradient-to-br from-primary/20 via-transparent to-primary/5 pointer-events-none" />
          <div className="relative space-y-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-1">Mensalidade</p>
              <p className="text-4xl sm:text-5xl font-semibold text-white tracking-tight">
                R$&nbsp;120<span className="text-lg text-zinc-400 font-normal">/mês</span>
              </p>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Entre na sua conta para assinar. A confirmação da assinatura acontece no painel do cliente.
            </p>
            <button
              type="button"
              onClick={onAdminLoginClick}
              className="w-full bg-gradient-to-r from-primary to-primary/70 hover:from-primary/80 hover:to-primary text-black text-xs uppercase tracking-[0.2em] font-black px-6 py-4 rounded-md shadow-lg shadow-primary/15 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer flex items-center justify-center gap-2"
            >
              <Crown className="w-4 h-4" /> Assinar Plano VIP
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
```

Regras:
- **Não** chamar API de assinatura.
- **Não** usar `setActiveTab` do `UserLayout`.
- `Check` e `Crown` devem estar importados.
- `onAdminLoginClick` já está desestruturado nas props do componente.

- [ ] **Step 3: Verificar âncora do hero**

Confirmar que o CTA do Task 2 usa `href="#vip"` e que a seção tem `id="vip"` e `scroll-mt-20` (header sticky).

- [ ] **Step 4: Teste manual completo**

1. Light: hero ≠ menu; VIP dark full-bleed entre Agendar e Cortes  
2. Dark: hero + VIP legíveis  
3. “Ver Plano VIP” → scroll até `#vip`  
4. “Assinar Plano VIP” → abre `AuthModal` (mesmo de admin login)  
5. Agendar e Cortes intactos  
6. Mobile: sem overflow horizontal  

- [ ] **Step 5: Typecheck**

Run: `npm run lint`  
Expected: exit 0

- [ ] **Step 6: Commit (somente se o usuário pedir)**

```bash
git add src/components/VisitorLayout.tsx src/index.css docs/superpowers/specs/2026-07-18-landing-hero-vip-design.md docs/superpowers/plans/2026-07-18-landing-hero-vip.md
git commit -m "feat(landing): hero gradient + VIP full-bleed section"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Hero light gradiente bege→branco | Task 1 |
| Hero dark escuro premium | Task 1 |
| Tipografia H1 premium | Task 1 |
| CTA Agendar no hero | Task 2 |
| CTA Ver VIP → `#vip` | Task 2 |
| Seção VIP full-bleed entre Agendar e Cortes | Task 3 |
| Preço R$ 120 + benefícios | Task 3 |
| CTA Assinar → só login (`onAdminLoginClick`) | Task 3 |
| Agendar / Cortes intactos | Tasks 1–3 (não tocar) |
| Preços serviços `text-foreground` | Já feito; não reverter |

## Self-review notes

- Sem placeholders TBD/TODO no plano.
- Auth path real: `onAdminLoginClick` → `App.tsx` `setShowAuthModal(true)` → `AuthModal`.
- `Check` já importado em `VisitorLayout`; `Crown` a adicionar.
- Não há suite de testes automatizados de UI no projeto; validação é manual + `npm run lint`.
