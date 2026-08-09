# Grade Semanal de Agenda (estilo appbarber) + Painel Inicial Agenda & Status — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a aba Agenda do painel admin numa grade semanal estilo FullCalendar (coluna por barbeiro, blocos coloridos por status), com painel abrindo na agenda, sidebar reordenada e modal de agendamento com busca de cliente por prefixo.

**Architecture:** Componente `AgendaSemanal.tsx` em React + Tailwind puro (sem biblioteca) que recebe os estados já carregados no `AdminLayout` e desenha a grade. O `ManualBookingModal` ganha autocomplete de cliente e aceita `slotInicial`. O backend não muda.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Vite, lucide-react.

## Global Constraints

- Nenhuma dependência nova (proibido instalar FullCalendar).
- Nenhuma alteração em `server/`, `supabase/` ou no banco.
- Não alterar `UserLayout`/`VisitorLayout`/`BookingWizard`.
- Seguir o design system atual do painel (cantos `rounded-sm`, cores via tokens `bg-card`/`border-border`/`text-foreground`/`text-muted-foreground`/`bg-primary`/`text-primary-foreground`).
- Componentes usam import com extensão `.tsx`/`.ts` (padrão do repo).
- Rodar `npm run lint` (tsc --noEmit) e `npm run build` ao fim de cada task e colar a saída no relato.

---

### Task 1: Reordenar sidebar e painel inicial = agenda

**Files:**
- Modify: `src/components/Layout.tsx:52-138` (sidebar desktop)
- Modify: `src/components/AdminLayout.tsx:1165-1244` (menu mobile) e `src/components/AdminLayout.tsx:122` (default tab)

**Interfaces:**
- Produces: `AdminLayout` com `activeTab` inicial `'agenda'`; sidebar (desktop e mobile) com 1º item "Agenda & Status" e 2º "Balanço Financeiro".

- [ ] **Step 1: Trocar o default tab do painel para agenda**

Em `src/components/AdminLayout.tsx:122`, alterar o estado inicial:

De:
```tsx
const [activeTab, setActiveTab] = useState<'dashboard' | 'agenda' | 'equipe' | 'servicos' | 'produtos' | 'planos' | 'clientes' | 'financeiro' | 'configuracoes'>('dashboard');
```
Para:
```tsx
const [activeTab, setActiveTab] = useState<'dashboard' | 'agenda' | 'equipe' | 'servicos' | 'produtos' | 'planos' | 'clientes' | 'financeiro' | 'configuracoes'>('agenda');
```

- [ ] **Step 2: Inverter ordem na sidebar desktop**

Em `src/components/Layout.tsx`, o botão "Balanço Financeiro" (`activeTab === 'dashboard'`, com ícone `TrendingUp`, linhas 52-61) deve passar a ficar **depois** do botão "Agenda & Status" (`activeTab === 'agenda'`, com ícone `Calendar`, linhas 63-72). Trocar o bloco inteiro dos dois botões de lugar: primeiro o de `agenda`, depois o de `dashboard`.

O resultado (os dois blocos trocados de ordem, conteúdo inalterado):
```tsx
<button
  onClick={() => setActiveTab('agenda')}
  className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${
    activeTab === 'agenda'
      ? 'bg-primary text-primary-foreground shadow-lg font-bold'
      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
  }`}
>
  <Calendar className="w-4 h-4" /> Agenda & Status
</button>

<button
  onClick={() => setActiveTab('dashboard')}
  className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${
    activeTab === 'dashboard'
      ? 'bg-primary text-primary-foreground shadow-lg font-bold'
      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
  }`}
>
  <TrendingUp className="w-4 h-4" /> Balanço Financeiro
</button>
```

- [ ] **Step 3: Inverter ordem no menu mobile**

Em `src/components/AdminLayout.tsx`, o botão mobile "Balanço Financeiro" (linhas 1168-1177) e "Agenda & Status" (linhas 1179-1188) devem ser trocados de lugar, de modo que "Agenda & Status" apareça primeiro (mantendo `setActiveTab('agenda')` e `setIsMobileMenuOpen(false)`). Trocar os dois blocos de ordem.

- [ ] **Step 4: Verificar typecheck e build**

Run: `npm run lint`
Expected: saída sem erros de TypeScript (0 errors).

Run: `npm run build`
Expected: `✓ built in` sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/Layout.tsx src/components/AdminLayout.tsx
git commit -m "feat(admin): painel abre na agenda e sidebar reordenada (agenda 1º, balanço 2º)"
```

---

### Task 2: Novo componente `AgendaSemanal.tsx` — grade semanal por barbeiro

**Files:**
- Create: `src/components/admin/AgendaSemanal.tsx`
- Test: manual (renderização no painel)

**Interfaces:**
- Consumes (props):
  - `agendamentos: Agendamento[]`
  - `profissionais: Profissional[]`
  - `servicos: Servico[]`
  - `clientes: Cliente[]`
  - `onSlotClick: (data: string, horario: string) => void`
  - `onAgendamentoClick: (agendamento: Agendamento) => void`
- Produces: componente que renderiza a grade; horário de grade de 07:00 às 24:00, divisão de 30min, 1 coluna por profissional ativo.

- [ ] **Step 1: Criar o arquivo com a grade**

Criar `src/components/admin/AgendaSemanal.tsx` com o seguinte conteúdo:

```tsx
import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Agendamento, Profissional, Servico } from '../../types.ts';

interface AgendaSemanalProps {
  agendamentos: Agendamento[];
  profissionais: Profissional[];
  servicos: Servico[];
  onSlotClick: (data: string, horario: string) => void;
  onAgendamentoClick: (agendamento: Agendamento) => void;
}

const HORA_INICIO = 7;    // 07:00
const HORA_FIM = 24;      // até 24:00
const MINUTOS_GRADE = HORA_FIM * 60 - HORA_INICIO * 60; // 1020 min

function getLocalDateString(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

function addDays(d: Date, dias: number): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + dias);
  return n;
}

const DIAS_PT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const DIAS_PT_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// Cores e estilos por status (mesma semântica da lista atual da agenda)
function statusClasses(status: Agendamento['status']): string {
  switch (status) {
    case 'concluido':
      return 'bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border-l-emerald-500 opacity-70 hover:opacity-100';
    case 'cancelado':
    case 'faltou':
      return 'bg-red-500/20 text-red-700 dark:text-red-300 border-l-red-500 opacity-60 hover:opacity-100';
    default:
      return 'bg-primary/20 text-primary border-l-primary hover:bg-primary/30';
  }
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function fmtHora(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function AgendaSemanal({
  agendamentos,
  profissionais,
  servicos,
  onSlotClick,
  onAgendamentoClick
}: AgendaSemanalProps) {
  const hoje = new Date();
  // Domingo da semana em exibição
  const [semanaInicio, setSemanaInicio] = useState<Date>(() => {
    const d = new Date(hoje);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  });
  // Dia da semana (0=dom) selecionado dentro da semana
  const [diaSelecionado, setDiaSelecionado] = useState<number>(hoje.getDay());

  const ativos = profissionais.filter(p => p.ativo !== false);
  const colunas = ativos.length > 0 ? ativos : [];

  const dias = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(semanaInicio, i));
  }, [semanaInicio]);

  const diaAtual: Date = dias[diaSelecionado];
  const dataAtual = getLocalDateString(diaAtual);

  // Horários (a cada 30 min) — o dia escolhido determina quais blocos aparecem
  const slots = useMemo(() => {
    const out: number[] = [];
    for (let m = 0; m < MINUTOS_GRADE; m += 30) out.push(HORA_INICIO * 60 + m);
    return out;
  }, []);

  const onSlotClickWrapped = (min: number) => {
    onSlotClick(dataAtual, fmtHora(min));
  };

  return (
    <div className="space-y-4">
      {/* Navegação da semana */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSemanaInicio(d => addDays(d, -7))}
            className="p-2 border border-border rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition cursor-pointer"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - d.getDay());
              d.setHours(0, 0, 0, 0);
              setSemanaInicio(d);
              setDiaSelecionado(new Date().getDay());
            }}
            className="px-3 py-2 border border-border rounded-sm text-xs font-bold text-primary hover:bg-accent transition cursor-pointer"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => setSemanaInicio(d => addDays(d, 7))}
            className="p-2 border border-border rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition cursor-pointer"
            aria-label="Próxima semana"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="ml-1 text-sm font-bold text-foreground">
            {dias[0].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} – {dias[6].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Seletor dos 7 dias da semana */}
      <div className="grid grid-cols-7 gap-1.5">
        {dias.map((dia, i) => {
          const isHoje = getLocalDateString(dia) === getLocalDateString(hoje);
          const isSelecionado = i === diaSelecionado;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setDiaSelecionado(i)}
              className={`px-2 py-2 border rounded-sm text-center transition cursor-pointer ${
                isSelecionado
                  ? 'bg-primary text-primary-foreground border-primary shadow-md'
                  : isHoje
                  ? 'bg-card border-primary/50 text-foreground hover:bg-accent'
                  : 'bg-card border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              <span className="block text-[9px] uppercase tracking-wider font-bold">{DIAS_PT_SHORT[dia.getDay()]}</span>
              <span className="block text-sm font-black">{dia.getDate()}</span>
            </button>
          );
        })}
      </div>

      {/* Título do dia em exibição */}
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {DIAS_PT[diaAtual.getDay()]} · {diaAtual.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
      </div>

      {colunas.length === 0 ? (
        <div className="py-16 text-center bg-card border border-dashed border-border rounded-sm">
          <CalendarIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Cadastre um barbeiro em Equipe para visualizar a grade.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            {/* Cabeçalho: nomes dos barbeiros acima de cada coluna */}
            <div className="grid" style={{ gridTemplateColumns: `80px repeat(${colunas.length}, 1fr)` }}>
              <div className="border-b border-r border-border bg-card" />
              {colunas.map(p => (
                <div key={p.id} className="border-b border-r border-border bg-card px-2 py-2 text-center">
                  <span className="text-[11px] font-bold text-foreground truncate block">{p.nome}</span>
                </div>
              ))}
            </div>

            {/* Corpo da grade: horários à esquerda, colunas de barbeiro com slots e blocos */}
            {slots.map(min => (
              <div key={min} className="grid" style={{ gridTemplateColumns: `80px repeat(${colunas.length}, 1fr)` }}>
                <div className="border-b border-r border-border text-right pr-2 py-1">
                  <span className="text-[10px] text-muted-foreground font-semibold">{fmtHora(min)}</span>
                </div>
                {colunas.map(p => {
                  const agendamentosDaColuna: Agendamento[] = agendamentos.filter(a => {
                    const dataAge = a.inicio_em.split('T')[0];
                    const minAge = timeToMinutes(a.inicio_em.split('T')[1]?.substring(0, 5) || '00:00');
                    return a.profissional_id === p.id
                      && dataAge === dataAtual
                      && Math.floor(minAge / 30) === min / 30;
                  });
                  return (
                    <div
                      key={p.id}
                      className="relative border-b border-r border-border min-h-[30px] hover:bg-accent/40 transition cursor-pointer"
                      onClick={() => onSlotClickWrapped(min)}
                    >
                      {agendamentosDaColuna.map(a => {
                        const fimMin = a.fim_em ? timeToMinutes(a.fim_em.split('T')[1]?.substring(0, 5) || '00:00') : min + 30;
                        const altura = Math.max(24, ((fimMin - min) / 30) * 30 - 4);
                        const servNome = servicos.find(s => s.id === a.servico_id)?.nome || 'Serviço';
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onAgendamentoClick(a); }}
                            className={`absolute left-1 right-1 z-10 border-l-4 rounded-sm px-2 py-1 text-left shadow-sm transition cursor-pointer ${statusClasses(a.status)}`}
                            style={{ top: 2, height: altura, overflow: 'hidden' }}
                            title={`${a.nome_cliente} — ${servNome} (${a.inicio_em.split('T')[1]?.substring(0, 5)}h)`}
                          >
                            <span className="block text-[10px] font-black truncate">{a.nome_cliente}</span>
                            <span className="block text-[9px] truncate opacity-80">
                              {a.inicio_em.split('T')[1]?.substring(0, 5)} · {servNome}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npm run lint`
Expected: sem erros de TypeScript. Se houver erro de variável não usada (`hoje`), usar `hoje` no cálculo de `dias` (ex.: trocar `dias` para usar `semanaInicio`) e ajustar. (O `hoje` já é usado em `getLocalDateString(hoje)` no cabeçalho.)

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AgendaSemanal.tsx
git commit -m "feat(admin): componente de grade semanal por barbeiro (estilo fullcalendar)"
```

---

### Task 3: Integrar `AgendaSemanal` no `AdminLayout` com modais de slot e de status

**Files:**
- Modify: `src/components/AdminLayout.tsx` (imports, estados, integração na aba agenda, modais de detalhe)
- Create: `src/components/admin/AgendaDetalheModal.tsx`

**Interfaces:**
- Consumes: `AgendaSemanal` (props: `agendamentos`, `profissionais`, `servicos`, `onSlotClick`, `onAgendamentoClick`); `ManualBookingModal` (com `slotInicial` da Task 4).
- Produces: clicar num slot vazio abre o `ManualBookingModal` com data/hora; clicar num bloco abre `AgendaDetalheModal` com ações Concluir/Cancelar.

- [ ] **Step 1: Criar o modal de detalhes do agendamento**

Criar `src/components/admin/AgendaDetalheModal.tsx`:

```tsx
import React from 'react';
import { X, CheckCircle2, Trash2, User } from 'lucide-react';
import { Agendamento, Profissional, Servico } from '../../types.ts';

interface AgendaDetalheModalProps {
  agendamento: Agendamento | null;
  profissionais: Profissional[];
  servicos: Servico[];
  onClose: () => void;
  onConcluir: (id: string) => void;
  onCancelar: (id: string) => void;
}

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

export default function AgendaDetalheModal({
  agendamento,
  profissionais,
  servicos,
  onClose,
  onConcluir,
  onCancelar
}: AgendaDetalheModalProps) {
  if (!agendamento) return null;
  const servico = servicos.find(s => s.id === agendamento.servico_id);
  const profissional = profissionais.find(p => p.id === agendamento.profissional_id);

  const data = agendamento.inicio_em.split('T')[0].split('-').reverse().join('/');
  const hora = agendamento.inicio_em.split('T')[1]?.substring(0, 5) || '';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-card border border-border rounded-sm shadow-2xl overflow-hidden text-foreground">
        <div className="p-5 border-b border-border flex items-center justify-between bg-slate-900">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-primary" /> {agendamento.nome_cliente}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground font-semibold">Data</span>
            <span className="font-bold">{data}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground font-semibold">Horário</span>
            <span className="font-bold">{hora}h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground font-semibold">Serviço</span>
            <span className="font-bold text-right">{servico?.nome || 'Serviço'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground font-semibold">Duração</span>
            <span className="font-bold">{servico?.duracao_minutos || 0} min</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground font-semibold">Barbeiro</span>
            <span className="font-bold">{profissional?.nome || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground font-semibold">Valor</span>
            <span className="font-bold text-primary">{formatBRL(agendamento.preco_cobrado)}</span>
          </div>
          {agendamento.observacao && (
            <div className="p-3 bg-primary/5 border border-primary/10 rounded-sm">
              <span className="font-semibold text-muted-foreground block mb-1">Observação</span>
              <p className="text-primary">{agendamento.observacao}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex items-center justify-end gap-2">
          {agendamento.status !== 'concluido' && agendamento.status !== 'cancelado' ? (
            <>
              <button
                type="button"
                onClick={() => { onConcluir(agendamento.id); onClose(); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-sm bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wide transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> Concluir
              </button>
              <button
                type="button"
                onClick={() => { onCancelar(agendamento.id); onClose(); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-sm bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wide transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Cancelar
              </button>
            </>
          ) : (
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Status: {agendamento.status}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-sm text-xs font-bold text-muted-foreground hover:bg-muted transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Adicionar imports, estado do modal de detalhe e chamada à grade**

Em `src/components/AdminLayout.tsx`:

1. Import (junto aos imports de `./admin/...`, perto da linha 61):
```tsx
import AgendaSemanal from './admin/AgendaSemanal.tsx';
import AgendaDetalheModal from './admin/AgendaDetalheModal.tsx';
```

2. Adicionar estado (perto de `isManualBookingModalOpen`, linha 152):
```tsx
const [slotInicial, setSlotInicial] = useState<{ data: string; horario: string } | undefined>(undefined);
const [agendamentoDetalhe, setAgendamentoDetalhe] = useState<Agendamento | null>(null);
```

3. Substituir o bloco da aba agenda (linhas 2120-2310). Manter o cabeçalho (título + botão "Novo Agendamento" + `FiltroBarbeiro`), mas trocar a seção de lista por:

```tsx
<AgendaSemanal
  agendamentos={filtroProfissional ? agendamentos.filter(a => a.profissional_id === filtroProfissional) : agendamentos}
  profissionais={profissionais}
  servicos={servicos}
  onSlotClick={(data, horario) => {
    setSlotInicial({ data, horario });
    setIsManualBookingModalOpen(true);
  }}
  onAgendamentoClick={(a) => setAgendamentoDetalhe(a)}
/>
```

4. No botão "Novo Agendamento" (desktop e mobile), limpar o slot inicial ao abrir manualmente:
```tsx
onClick={() => { setSlotInicial(undefined); setIsManualBookingModalOpen(true); }}
```

- [ ] **Step 3: Renderizar o `AgendaDetalheModal`**

Perto da chamada `<ManualBookingModal .../>` (linhas 4310-4321), adicionar antes dela:

```tsx
<AgendaDetalheModal
  agendamento={agendamentoDetalhe}
  profissionais={profissionais}
  servicos={servicos}
  onClose={() => setAgendamentoDetalhe(null)}
  onConcluir={(id) => handleUpdateBookingStatus(id, 'concluido')}
  onCancelar={(id) => handleUpdateBookingStatus(id, 'cancelado')}
/>
```

- [ ] **Step 4: Passar `slotInicial` ao `ManualBookingModal`**

Na chamada do `ManualBookingModal` (linha 4310), adicionar a prop `slotInicial={slotInicial}`. (A prop será criada na Task 4; por enquanto isso quebrará o typecheck — concluir a Task 4 antes de rodar o lint.)

- [ ] **Step 5: Verificar typecheck e build**

> **Atenção:** este task depende da prop `slotInicial` que só existe na Task 4. Não rodar `npm run lint` isolado aqui — o `npm run lint`/`npm run build` finais desta Task 3+4 são executados juntos no Step 5 da Task 4.

Run (só para conferir que não há erro além do `slotInicial`): `npx tsc --noEmit --skipLibCheck 2>&1 | Select-String -Pattern "slotInicial" | Select-Object -First 5`
Expected: apenas o erro de `slotInicial` (prop inexistente) — nenhum outro erro.

- [ ] **Step 6: Commit**

```bash
git add src/components/AdminLayout.tsx src/components/admin/AgendaDetalheModal.tsx
git commit -m "feat(admin): grade semanal integrada ao painel com modais de slot e de status"
```

---

### Task 4: Autocomplete de cliente + slot inicial no `ManualBookingModal`

**Files:**
- Modify: `src/components/admin/ManualBookingModal.tsx`

**Interfaces:**
- Consumes: nova prop `slotInicial?: { data: string; horario: string }`; prop `clientes` já declarada na interface (linha 9) mas não desestruturada.
- Produces: campo "Nome do Cliente" com busca por prefixo nos clientes; telefone preenchido ao selecionar; data/hora pré-selecionadas quando `slotInicial` fornecido.

- [ ] **Step 1: Atualizar a interface e desestruturar `clientes` e `slotInicial`**

Em `src/components/admin/ManualBookingModal.tsx`:

1. Na interface `ManualBookingModalProps` (linhas 5-13), acrescentar:
```tsx
  slotInicial?: { data: string; horario: string };
```

2. Na assinatura do componente (linhas 27-34), desestruturar as novas props:
```tsx
export default function ManualBookingModal({
  isOpen,
  onClose,
  profissionais,
  services,
  clientes = [],
  onBookingSuccess,
  defaultProfissionalId = '',
  slotInicial
}: ManualBookingModalProps) {
```

3. Estado de busca de cliente (junto aos estados, após `nomeCliente`):
```tsx
const [buscandoCliente, setBuscandoCliente] = useState(false);
```

- [ ] **Step 2: Sincronizar `slotInicial` quando o modal abre**

Adicionar efeito que, ao abrir o modal com um slot, seleciona data e horário:
```tsx
useEffect(() => {
  if (isOpen && slotInicial) {
    setSelectedDate(slotInicial.data);
    setSelectedSlot(slotInicial.horario);
  }
}, [isOpen, slotInicial]);
```

- [ ] **Step 3: Autocomplete por prefixo no campo de cliente**

Substituir o bloco do campo "Nome do Cliente" (linhas 260-275) pelo seguinte (mantém o ícone e o label, adiciona dropdown):

```tsx
<div className="relative">
  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
  <input
    type="text"
    placeholder="Ex: João Silva"
    required
    value={nomeCliente}
    onChange={(e) => {
      setNomeCliente(e.target.value);
      setBuscandoCliente(true);
    }}
    onFocus={() => setBuscandoCliente(true)}
    className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-md text-xs focus:outline-none focus:border-primary text-foreground font-medium"
  />
  {buscandoCliente && nomeCliente.trim().length > 0 && (
    <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-card border border-border rounded-md shadow-xl max-h-48 overflow-y-auto">
      {clientes
        .filter(c =>
          c.ativo !== false &&
          c.nome.toLowerCase().includes(nomeCliente.trim().toLowerCase())
        )
        .slice(0, 8)
        .map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setNomeCliente(c.nome);
              setTelefoneCliente(c.telefone || '');
              setBuscandoCliente(false);
            }}
            className="w-full text-left px-3 py-2.5 hover:bg-accent text-xs font-semibold text-foreground transition cursor-pointer"
          >
            {c.nome}
            {c.telefone && <span className="block text-[10px] text-muted-foreground">{c.telefone}</span>}
          </button>
        ))}
      {clientes.filter(c => c.nome.toLowerCase().includes(nomeCliente.trim().toLowerCase())).length === 0 && (
        <div className="px-3 py-2.5 text-[10px] text-muted-foreground italic">
          Nenhum cliente encontrado — digite o nome para criar sem cadastro.
        </div>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 4: Estado de telefone controlado**

No estado do componente, o telefone hoje é fixo (`telefone_cliente: ''` no payload). Para o autocomplete preencher, criar estado e usar no payload:

1. Adicionar estado (junto aos demais):
```tsx
const [telefoneCliente, setTelefoneCliente] = useState('');
```

2. No `handleSubmit`, trocar `telefone_cliente: ''` por `telefone_cliente: telefoneCliente.trim()`.

- [ ] **Step 5: Verificar typecheck e build**

Run: `npm run lint`
Expected: sem erros. (Confirma que o `slotInicial` da Task 3 agora compila.)

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/ManualBookingModal.tsx
git commit -m "feat(admin): autocomplete de cliente por prefixo e slot inicial no modal de agendamento"
```

---

### Task 5: Teste manual final (verificação)

**Files:**
- Nenhum (apenas execução)

- [ ] **Step 1: Rodar o app**

Run: `npm run dev` (em outro terminal) e abrir o painel admin logado.

- [ ] **Step 2: Verificar checklist manual**

1. O painel abre na aba **Agenda & Status**.
2. A sidebar (desktop e mobile) mostra **1º Agenda & Status, 2º Balanço Financeiro**.
3. A agenda mostra a grade semanal com coluna por barbeiro.
4. Navegação ‹ / Hoje / › troca de semana.
5. Clicar num slot vazio abre o modal com a data/hora daquele slot.
6. Digitar prefixo de cliente filtra os cadastrados; selecionar preenche nome + telefone.
7. Escolher serviço mostra preço/duração; criar agendamento faz o bloco aparecer na coluna do barbeiro.
8. Clicar no bloco abre os detalhes; Concluir e Cancelar funcionam e atualizam a grade.
9. Status cancelado/concluído ficam vermelho/verde na grade.

- [ ] **Step 3: Rodar lint e build finais**

Run: `npm run lint`
Expected: sem erros.

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 4: Commit final (se houver ajustes)**

```bash
git add -A
git commit -m "chore(admin): ajustes finais na grade semanal"
```
