# Design Spec: Unified Login & Dashboard Card Contrast Redesign

This document details the architectural and design decisions for unifying the login flow, improving card styling contrast (using Neon-Retro Midnight Navy & Gold Glassmorphism), adding Stripe subscription plan tracking, and configuring the booking wizard selection highlights across the Barbearia Imperial / Detalhe Barbearia application.

---

## 1. Overview & Context

### Goal
* **Unified Login (Proposal v2):** Replace the separate "Lock" (admin-only) and "User" (client-only) header icons with a single "User" header icon. Clicking this icon opens a unified auth modal. Admins and clients will log in using this single modal and will be routed to `AdminLayout` and `UserLayout` respectively based on their auth profile.
* **Redesign Contrast & Nesting (Midnight Navy & Gold theme):** Enhance visual hierarchy and readability in `AdminLayout` and `UserLayout` using a rich, dark luxury color scheme composed of midnight blue and gold (`#040714` background). Keep the beautiful serif italic Playfair Display fonts (`font-serif italic`) for headers and premium callouts.
* **Light Theme for Visitor page:** To give the public site a clean, premium face, we will apply a Light White/Blue/Gold theme ONLY to the Visitor page (`VisitorLayout.tsx`). The menu will be solid white (`bg-white`) with dark text, and the page background will be a light stone/cream (`#faf9f6`).
* **Booking Wizard Contrast:** Because the Visitor landing page is now light, the Booking Wizard container background must be WHITE (`bg-white` or light glass card `#ffffff` with light/gold borders) for strong visual isolation and contrast against the page background. The texts, labels, and icons inside the Booking Wizard must be blacker/darker (`text-black` or `text-slate-900`) for high contrast on the white card background.
* **Barber & Barbershop Renaming:** The name of the Barber is changed to **"Emerson Santiago"** (formerly "Carlos Silva") and the Barbershop name is changed to **"Detalhe Barbearia"** (formerly "Barbearia Imperial") across the entire database, layouts, text files, and components.
* **Stripe Subscription Tracking (Recorrência):** Automatically track subscription plan revenue. When Stripe payments succeed, a webhook will log a financial entry under a new `'Plano'` category, displaying it in the transactions listing and a new Bento card.

---

## 2. Proposed Changes & Architecture

### 2.1. Unified Login Modal (`AuthModal.tsx` & `VisitorLayout.tsx`)
1. **VisitorLayout Header & Footer Modification:**
   * Remove the Lock button from the navigation header.
   * Remove the Lock button from the footer.
   * Modify the guest user button (`#perfil-guest-btn`) onClick handler: instead of toggling the client-profile popover dropdown, it will directly invoke `onAdminLoginClick` (to be mapped to show the unified `AuthModal`).
2. **AuthModal Refactor:**
   * **Title & Description:** Change "Escritório do Barbeiro" to "Acesse sua Conta" (Sub-header: "Detalhe Barbearia VIP").
   * **Primary State (Two Buttons):** Present two clear actions on open:
     * **"Entrar com o Google"** (primary white button).
     * **"Entrar com E-mail e Senha"** (secondary gold/amber bordered button).
   * **Form State:** Clicking the "Entrar com E-mail e Senha" button sets a React state `showEmailForm` to true, which transitions the modal view to show the email/password form inputs, a "◀ Voltar" button at the top to return to the two-button screen, and the submit button.
   * **Redirection & Bypass Blocking:** Remove the check that logs out and blocks users who are not admins (`role !== 'admin'`). Any successfully authenticated user can close the modal, allowing `App.tsx` routing to route them:
     * Admins (with `isAdmin: true` set by `useAdminSession.ts`) route to `AdminLayout`.
     * Clients (with a valid session) route to `UserLayout`.

### 2.2. Contrast & Card Nesting Redesign (Midnight Navy & Gold Glassmorphism)
1. **Palette and Theme (in `index.css`):**
   * Change layouts (Admin/User) container background to deep royal navy/midnight blue (`#040714`).
   * Define premium glassmorphism classes:
     * `.glass-panel-premium`: `background: rgba(8, 15, 37, 0.75); backdrop-filter: blur(16px); border: 1px solid rgba(197, 160, 89, 0.18);`
     * `.glass-panel-nested`: `background: rgba(2, 6, 23, 0.5); border: none;` (no internal borders to avoid card-in-card nesting appearance).
2. **Flattening Main Workspace Layout (`AdminLayout.tsx`):**
   * Remove the extra level of card nesting in the main workspace. The `<main>` wrapper tag will be flattened (remove `bg-[#161616]`, `border border-stone-800`, `m-4 lg:m-8`, and `shadow-2xl` classes). It will become a flat layout container with standard padding (`p-6 md:p-8`), allowing glassmorphic cards (Bento stats, charts, and tables) to rest directly on the main `#040714` background.
3. **Card Redesign (`AdminLayout.tsx` & `UserLayout.tsx`):**
   * Update stats cards, table containers, forms, and widgets to use `.glass-panel-premium` (navy background, warm gold-tinted border).
   * Update sub-elements (like chart summaries, nested transaction items) to use `.glass-panel-nested` (deep solid backgrounds with no borders).
   * Maintain the classic gold/amber neon accent highlights (`#c5a059`), using emerald for profits and red/rose for expenses.
4. **Green Line Chart Preservation:**
   * Keep the chart as it was originally: a green line chart (line color `#10b981` / `#34d399` with drop shadow and transparent-to-green fill area gradient).
   * Refine line thickness to be thinner (e.g. `strokeWidth="1.5"` or `1`) and remove dot markers completely from the line path for a clean, minimalist feel.
   * All Y-axis markers and hover tooltips will render values formatted in R$ (BRL) (e.g. "R$ 1.500" / "R$ 120,00").
5. **Date Filter Button Switcher:**
   * Filter queries will be driven by the existing period button switcher ("Hoje", "Últimos 7 dias", "30 dias", "Todo histórico") rendered in the dashboard's top-right corner to slice statistical sums dynamically.
6. **Font Size Increments:**
   * Increase text size of transaction logs (descriptions) to `text-sm` (from `text-xs`/`text-[11px]`) and transaction cash values to `text-sm font-bold` or `text-base font-bold` for high visibility.
7. **Italic Styles Preservation for Identity:**
   * Keep and restore the Playfair Display serif italic font styling (`font-serif italic`) for headers, section titles, stats card subtitles, and premium callouts to preserve the brand's elegant identity.
8. **Emoji-Free Presentation:**
   * Remove all visual emojis (like ✂️, 📉, 💰, etc.) from the dashboard Bento card headers and transaction logs. Cards will use clean labels for a clean, professional aesthetic.

### 2.3. Stripe Subscription Plan Tracking (Recorrência)
1. **Mock Stripe Webhook Endpoint:**
   * Implement a mock Stripe webhook endpoint at `/api/stripe/webhook`.
   * When invoked, it reads payload metadata (or client information) and creates a manual financial record in the cashflow data table (`LancamentoFinanceiro` schema) with:
     * `tipo: 'entrada'`
     * `categoria: 'Plano'`
     * `descricao: 'Assinatura Stripe Recorrente (Confirmada)'`
     * `forma_pagamento: 'Stripe'`
     * `valor: 150.00`
2. **Backend Revenue Calculation (`server.ts`):**
   * Calculate `outrasEntradas` by summing up all financial logs where `categoria === 'Plano'`.
   * Modify the dashboard statistics payload (`DashboardStats` type) to include `outrasEntradas` (recurring plan income).
   * The calculation for net profit will be: `faturamentoCortes + outrasEntradas - despesas`.
3. **Bento Card Increment & Simulator Trigger:**
   * Add a new card in the Bento grid titled **"Receita de Planos (Stripe)"** displaying `outrasEntradas`.
   * Add a development-only simulation button or action triggers to make test Webhook calls to `/api/stripe/webhook` and verify the real-time increment on the dashboard.

### 2.4. Visitor Layout & Booking Wizard Contrast Redirection
1. **Light White/Blue/Gold theme for Visitor page:**
   * `VisitorLayout.tsx` will use a light background color (`#faf9f6`) with royal/navy blue texts/details and gold accents.
   * The Header menu in `VisitorLayout` will be solid white (`bg-white` or `bg-[#ffffff]`) with dark text (`text-slate-900`/`text-slate-800`).
2. **Booking Wizard with White Contrast backdrop:**
   * Set the main wizard wrapper container (`BookingWizard.tsx`) to use a solid white background (`bg-white` or `bg-[#ffffff]`) with gold/stone borders to create strong visual contrast against the page background. 
   * All texts, labels, and icons inside the Booking Wizard must use dark colors (`text-slate-900` or `text-black` or `text-slate-700`) for high contrast on the white card background.
3. **Option A Highlights:**
   * Selected items (active services in Step 1, selected date card in Step 2, active hour slot in Step 3) must use a translucent gold/amber background (`bg-[#c5a059]/15`), a solid gold border (`border-[#c5a059]`), and a soft gold shadow glow.
   * Inactive items should use standard light gray/glass borders (`bg-slate-100` or similar).
4. **Italic Styles Preservation:**
   * Playfair Display headings in the Booking Wizard and layouts will use elegant italic typography to match the main landing page aesthetic.

---

## 3. User Experience & User Interface Details

### AuthModal Flow
```
[User Clicks Header Profile Icon (Guest)]
                 │
                 ▼
     ┌───────────────────────┐
     │  Unified Auth Modal   │
     │                       │
     │  [Entrar com Google]  │
     │  [Entrar com E-mail] ───┐
     └───────────────────────┘ │
                               │ (User Clicks E-mail)
                               ▼
                     ┌───────────────────┐
                     │ ◀ Voltar          │
                     │                   │
                     │ [ Campo E-mail ]  │
                     │ [ Campo Senha  ]  │
                     │                   │
                     │   [ Entrar ]      │
                     └───────────────────┘
```

---

## 4. Technical Implementation & Data Flow

1. **Authentication Session Splicing (`App.tsx`):**
   * If `adminSession.session?.isAdmin` matches, render `<AdminLayout>`.
   * Else if `loggedClient` matches, render `<UserLayout>`.
   * Else, render `<VisitorLayout>`.
2. **State & CSS Sync:**
   * Custom CSS variables inside `index.css` under `@theme` for new colors (e.g. `--color-navy-950: #020617`, etc.) will be added if needed, or inline Tailwind values (`bg-[#020617]`) will be used to ensure high visual isolation and contrast.

---

## 5. Testing & Verification

1. **Build Verification:** Execute `npm run build` or `vite build` to ensure no TypeScript compilation or bundling errors exist.
2. **Session Verification:**
   * Test client login via Google OAuth (or mock session). Verify routing to client layout (`UserLayout`).
   * Test admin login via email/password. Verify routing to admin layout (`AdminLayout`).
   * Verify the visual contrast of dashboard elements in both views.
3. **Webhook & Recurrence Verification:**
   * Click the sandbox button to fire simulated webhook. Verify page balance increases in real-time.
