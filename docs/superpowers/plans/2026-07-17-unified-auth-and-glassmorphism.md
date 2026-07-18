# Unified Auth & Glassmorphism Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a unified login modal for clients and admins, replace the Lock button with a unified User header button, flatten the main admin dashboard to eliminate card-in-card nesting, update styling to a premium Midnight Navy & Gold Glassmorphism theme (Style C variant) for internal panels, keep the green line chart (no dots, thinned line), remove emojis from cards, add Stripe subscription tracking, align VisitorLayout landing page with a Light White/Blue/Gold theme, style the Booking Wizard with a white background container and dark text for contrast correction, Option A selection, Playfair Display italic headings, and rename Carlos Silva -> Emerson and Barbearia Imperial -> Detalhe Barbearia.

**Architecture:** 
- Unified auth modal with transition flow between a two-button page (Google/Email) and email/password inputs.
- Flattened layout in `AdminLayout.tsx` by stripping border/background/margins from the `<main>` tag.
- Deep space midnight blue background (`#040714`) with glassmorphic cards (`.glass-panel-premium` and `.glass-panel-nested`) inside internal layouts.
- Stripe webhook endpoint to insert recurring payment logs under `'Plano'` category, with dashboard aggregation (`outrasEntradas`).
- Option Selection Styling (Option A) inside the Booking Wizard.
- Visitor Layout styled in light marble background (`#faf9f6`) with solid white header menu (`bg-white`) and royal/navy blue detail accents.
- Booking Wizard wrapper styled in white background (`bg-white` or `bg-[#ffffff]`) with dark text, labels, and icons (`text-slate-900`/`text-black`) for strong contrast against the light landing page.
- Elegant Serif Italic Playfair Display headers (`font-serif italic`) preserved across layouts.
- Barber name renamed to **"Emerson"** and barbershop name renamed to **"Detalhe Barbearia"** project-wide.

**Tech Stack:** React, TypeScript, Express, Tailwind CSS, Lucide React icons.

## Global Constraints
- Do not import any external CSS files. Use tailwind utility classes or define them in `src/index.css`.
- Keep existing code functionalities fully working.
- Verify using `npm run build` or `vite build` after edits.

---

### Task 1: CSS Theme Variables & Glassmorphism Utilities
**Files:**
- Modify: `src/index.css`

- [x] **Step 1: Add premium glassmorphism classes to `src/index.css`**
  Modify [src/index.css](file:///C:/Users/78787/Documents/Detalhesbarbearia/src/index.css#L55-L62) to add `.glass-panel-premium` and `.glass-panel-nested` utility classes.
  ```css
  /* Premium Glassmorphism & Gold Highlight Utilities */
  .glass-panel {
    background: rgba(18, 16, 14, 0.7);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(197, 160, 89, 0.08);
  }

  .glass-panel-premium {
    background: rgba(8, 15, 37, 0.75);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(197, 160, 89, 0.18);
  }

  .glass-panel-nested {
    background: rgba(2, 6, 23, 0.5);
    border: none;
  }
  ```

- [x] **Step 2: Commit CSS changes**

---

### Task 2: Backend Mock Stripe Webhook & Revenue Calculation
**Files:**
- Modify: `server.ts`
- Modify: `server/storage.ts`

- [x] **Step 1: Add mock stripe webhook endpoint in `server.ts`**
  Add the POST endpoint `/api/stripe/webhook` in `server.ts`.

- [x] **Step 2: Calculate Otras Entradas in `server.ts` dev/preview dashboard query**

- [x] **Step 3: Calculate Otras Entradas in `server/storage.ts` dashboard query (Supabase path)**

- [x] **Step 4: Commit backend changes**

---

### Task 3: Unified Header User Button & VisitorLayout Style Alignment
**Files:**
- Modify: `src/components/VisitorLayout.tsx`

- [ ] **Step 1: Remove admin Lock icon buttons and link Guest User to AuthModal**
  Search for `Lock` or `lock` icons and `#perfil-guest-btn` in `VisitorLayout.tsx`.
  - Delete Lock button in Header.
  - Delete Lock button in Footer.
  - Update Guest User profile icon click behavior (`#perfil-guest-btn`) to trigger showing the auth modal directly.
  - Expose or reuse the modal control trigger (which opens the AuthModal) so clicking the header profile opens it directly.

- [ ] **Step 2: Set Visitor page background to `#faf9f6` (Light Cream)**
  - Change the overall outermost layout tag/body backgrounds from `bg-[#0c0a09]` or `bg-[#060504]` to `bg-[#faf9f6]` with dark navy details and gold accents.

- [ ] **Step 3: Set Header menu to solid white with dark text**
  - Update the `<header>` element background to `bg-white` and text contents to dark slate/royal blue (`text-slate-800` / `text-slate-900`).

- [ ] **Step 4: Commit VisitorLayout changes**

---

### Task 4: Unified Authentication Modal Refactor (AuthModal)
**Files:**
- Modify: `src/components/AuthModal.tsx`

- [ ] **Step 1: Implement transitions and remove admin-only check**
  Refactor `AuthModal.tsx` to:
  - Add a React state `const [showEmailForm, setShowEmailForm] = useState(false);`
  - When `showEmailForm` is false, show a two-button selection screen:
    - Primary white button: **"Entrar com o Google"** (calls Google OAuth).
    - Secondary amber-border button: **"Entrar com E-mail e Senha"** (sets `showEmailForm(true)`).
  - When `showEmailForm` is true, show the email/password form inputs, along with a top button **"◀ Voltar"** (sets `showEmailForm(false)`).
  - Remove the restriction logic in the `onAuthStateChange` listener that logs out and blocks clients (removes: `if (role !== 'admin') { signOut(); ... }`). Allow any successfully logged-in user to close the modal.

- [ ] **Step 2: Commit AuthModal changes**

---

### Task 5: Flatten Admin Dashboard Layout & Glassmorphism Styles (AdminLayout)
**Files:**
- Modify: `src/components/AdminLayout.tsx`

- [ ] **Step 1: Flatten the `<main>` tag wrapper and set deep space background**
  Modify `<main>` tag attributes in `AdminLayout.tsx`:
  - From: `<main className="flex-1 overflow-y-auto bg-[#161616] m-4 lg:m-8 rounded-sm border border-stone-800 p-6 md:p-8 shadow-2xl">`
  - To: `<main className="flex-1 overflow-y-auto p-6 md:p-8">`
  - Ensure the outer layout container wrapper has the style C variant background: `bg-[#040714]` (deep midnight blue).

- [ ] **Step 2: Update dashboard Bento cards (Stripe + Emojis removed + Glass styling)**
  - Add a 4th bento card: **"Receita de Planos (Stripe)"** displaying `formatBRL(dashboardStats.outrasEntradas || 0)`.
  - Remove all emojis from Bento cards.
  - Apply `glass-panel-premium` styling to stats cards, chart card, and lists.
  - Apply `glass-panel-nested` (or borderless solid `bg-slate-950/45` / `bg-black/45`) to sub-cards and list items.
  - Ensure `font-serif italic` Playfair Display headers are preserved/restored for dashboards and sections.

- [ ] **Step 3: Restructure Green Line Chart (Thinned, No Dots)**
  Update the SVG chart code in `AdminLayout.tsx` to:
  - Keep the line green (`stroke="#10b981"` or `#34d399`).
  - Thicken the line to `strokeWidth={1.5}`.
  - Remove any `<circle>` indicators (dots) from the chart paths completely.

- [ ] **Step 4: Add dev simulation button for Stripe webhook**
  - Render a sandbox simulation button (labeled "Testar Webhook Stripe") only visible in dev, firing a POST request to `/api/stripe/webhook` and then reloading stats.

- [ ] **Step 5: Commit AdminLayout changes**

---

### Task 6: Client Dashboard styling Refactor (UserLayout)
**Files:**
- Modify: `src/components/UserLayout.tsx`

- [ ] **Step 1: Update client main container & cards to Glassmorphic styling**
  - Set background to `bg-[#040714]` on the outer wrapper.
  - Replace stats cards classes with `glass-panel-premium`.
  - Ensure elegant `font-serif italic` style is used/preserved for user-facing headers.
  - Set nested detail containers to `glass-panel-nested`.

- [ ] **Step 2: Commit UserLayout changes**

---

### Task 7: Booking Wizard Styling & Selection Refactor (BookingWizard)
**Files:**
- Modify: `src/components/BookingWizard.tsx`

- [ ] **Step 1: Apply White contrast container wrapper & Style C Variant**
  - The main wizard wrapper should use a solid white background `bg-white` or `bg-[#ffffff]` and gold/stone borders for contrast.
  - All texts, labels, and icons inside the Booking Wizard must use dark colors (`text-slate-900` or `text-black` or `text-slate-700`) for high contrast on the white card background.
  - Internal sections and blocks (like the summary footer, ticket/voucher block in Step 5, etc.) should use light slate backgrounds (e.g., `bg-[#f8fafc]` or `bg-slate-50`).
- [ ] **Step 2: Apply Option Selection Styling (Option A)**
  - Selected items (active services in Step 1, selected date card in Step 2, active hour slot in Step 3) must use a translucent gold/amber background (`bg-[#c5a059]/15`), a solid gold border (`border-[#c5a059]`), and a soft gold shadow glow (`gold-glow` or `shadow-[0_0_15px_rgba(197,160,89,0.25)]`).
  - Inactive items must use standard light gray/glass borders (`bg-slate-100` or similar).
- [ ] **Step 3: Preserve Elegant Serif Italic Typography**
  - Keep/restore elegant Playfair Display italic headings (`font-serif italic`) inside `BookingWizard.tsx`.

- [ ] **Step 4: Commit BookingWizard changes**

---

### Task 8: Barbershop and Barber Renaming
**Files:**
- Modify: All source files, databases, and configuration JSON files.

- [ ] **Step 1: Rename "Barbearia Imperial" to "Detalhe Barbearia"**
- [ ] **Step 2: Rename "Carlos Silva" to "Emerson"**

---

### Task 9: Build Verification
- [ ] **Step 1: Run Vite compilation build**
  Execute `npm run build` or `vite build` command to verify TypeScript types, bundle compiler, and import alignments.
