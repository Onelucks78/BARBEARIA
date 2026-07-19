# Landing Hero + Plano VIP — Design Spec

**Date:** 2026-07-18  
**Scope:** Página pública (`VisitorLayout`) — hero (bloco 1) e seção Plano VIP  
**Out of scope:** Fluxo de pagamento VIP, admin de planos, mudanças em Agendar/Cortes além do necessário

---

## Problem

1. No modo light, o hero ficou com a mesma cor do menu (`bg-background`), sem hierarquia visual.
2. A tipografia do título principal do hero precisa de mais presença premium.
3. O Plano VIP existe no painel do cliente (R$ 120/mês, cortes/barba/sobrancelha ilimitados), mas **não aparece** na landing pública.

## Goals

- Diferenciar o hero do menu no light com gradiente claro (bege → branco).
- Manter o dark mode do hero com fundo escuro premium (não “igual ao menu”).
- Tipografia do H1 mais impactante e limpa.
- Destacar o Plano VIP: menção no hero + seção full-bleed própria.
- CTA “Assinar VIP” na landing **sempre** abre login/cadastro (nunca assina direto).
- Preservar seções que já estão boas: Agendar Horário e Cortes & Cuidados.
- Preços de serviços/produtos continuam com `text-foreground` (preto no light).

## Non-goals

- Implementar checkout/assinatura na landing.
- Alterar preço/regras do VIP no backend.
- Refatorar layout admin ou UserLayout além do mínimo para reutilizar texto.

---

## Approach (approved: B)

**Hero minimal + VIP full-bleed**

- Hero: visual mais limpo, gradiente no light, tipografia premium, 2 CTAs (Agendar + Ver VIP).
- VIP: seção full-width de alto contraste entre Agendar e Cortes & Cuidados.

---

## Section 1 — Hero (bloco 1)

**File:** `src/components/VisitorLayout.tsx`

### Background

| Theme | Treatment |
|-------|-----------|
| Light | Gradiente bege → branco (ex.: `from-[#f7f2e8] via-[#faf8f4] to-background`), radial dourado sutil opcional |
| Dark | Fundo escuro premium (ex.: `dark:bg-zinc-950` ou equivalente), mantendo contraste com o restante da página |

Não usar o mesmo flat `bg-background` do header no light.

### Typography

- H1 maior e com tracking/leading premium (ex. `text-4xl sm:text-5xl lg:text-7xl`, `tracking-tight` / `leading-[1.05]`).
- Destaque dourado em trecho-chave (manter `text-primary` só no span de destaque).
- Subtítulo `text-muted-foreground`, legível, sem poluir.

### Structure (minimal)

1. Badge superior (manter tom premium atual).
2. H1 + subtítulo.
3. CTAs:
   - **Primário:** Agendar (abre booking popup — comportamento atual).
   - **Secundário:** “Ver Plano VIP” → `href="#vip"` (scroll).
4. Card do barbeiro (direita) permanece.
5. Badges de valor (3 colunas) mais limpos; sem competir com o VIP.

### Explicitly unchanged

- Header/menu sticky.
- Seção Agendar Horário Online.
- Cortes & Cuidados e preços (`text-foreground`).

---

## Section 2 — Plano VIP full-bleed

**Placement:** entre `#agendar-sessao-section` e a `main` de Cortes & Cuidados.  
**Anchor:** `id="vip"`.

### Visual

- Full-bleed (quebra o `max-w` interno; largura total da viewport).
- Fundo dark premium em **ambos** os temas (zinc/stone escuro + glow/borda dourada).
- Contraste forte com a página light; no dark, ainda se destaca por borda/glow dourado e hierarquia.

### Content (copy base)

- Badge: `VIP Imperial` (ou equivalente).
- Título: Plano VIP / assinatura mensal.
- Preço: **R$ 120,00/mês** (alinhado ao painel do cliente em `UserLayout`).
- Benefícios (mínimo):
  - Cortes de cabelo ilimitados
  - Barba ilimitada
  - Sobrancelhas ilimitadas
- Nota curta: sem taxas extras nos serviços elegíveis (texto alinhado ao painel).

### CTA

| Elemento | Comportamento |
|----------|----------------|
| Hero “Ver Plano VIP” | Scroll para `#vip` |
| Seção “Assinar Plano VIP” | **Sempre** abre modal de login/cadastro (`AuthModal` / fluxo existente de auth na landing) |
| Visitante já logado na landing | Mesmo CTA abre auth **ou**, se já autenticado no contexto visitor, redireciona/inicia fluxo de conta — **não** assina na landing |

Regra aprovada: **CTA só login** — nunca confirma assinatura na página pública.

### Interaction notes

- Usar o mesmo mecanismo já usado na landing para abrir auth (ex. botão “Entrar” / `setShowAuth` ou equivalente em `VisitorLayout`).
- Após login bem-sucedido, o usuário cai no painel onde já existe “Assinar Plano VIP” — fora do escopo desta spec alterar esse pós-login além de abrir auth.

---

## Data & consistency

| Item | Source of truth |
|------|-----------------|
| Preço R$ 120 | Copy alinhada a `UserLayout` (hardcoded hoje no painel) |
| Benefícios | Mesmos do painel VIP |
| Sem nova API | Landing não chama endpoint de assinatura |

Se no futuro o preço vier da API, a seção VIP deve consumir a mesma fonte; **não** é requisito desta entrega.

---

## Files to touch

| File | Change |
|------|--------|
| `src/components/VisitorLayout.tsx` | Hero visual + tipografia + CTAs; nova seção `#vip`; wire CTA → auth |
| `src/index.css` (opcional) | Utilitário de gradiente hero se ficar mais limpo no CSS |
| Outros | Só se auth não estiver exposto na visitor (mínimo) |

---

## Acceptance criteria

1. Light: hero visualmente distinto do menu (gradiente bege→branco).
2. Dark: hero continua escuro e legível.
3. H1 com tipografia premium melhorada.
4. CTA secundário do hero rola até `#vip`.
5. Seção VIP full-bleed entre Agendar e Cortes, com preço e benefícios.
6. CTA “Assinar Plano VIP” abre login/cadastro; **não** assina na landing.
7. Agendar e Cortes & Cuidados permanecem intactos em conteúdo e fluxo.
8. Preços de serviços/produtos legíveis no light (foreground, não dourado fraco).

## Testing (manual)

1. Modo light: comparar header vs hero (cores diferentes).
2. Modo dark: hero + VIP legíveis.
3. Clique “Ver Plano VIP” → scroll para seção.
4. Clique “Assinar Plano VIP” → modal auth.
5. Agendar e listagem de cortes ainda funcionam.
6. Mobile: hero e VIP empilham sem overflow horizontal.
