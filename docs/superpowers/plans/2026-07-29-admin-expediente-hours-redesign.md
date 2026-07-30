# Reformulação da Gestão de Horários & Expediente no Painel Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalizar a validação de horários no backend (transformando `8:00` em `08:00`), refatorar a interface de expedientes no `AdminLayout.tsx` com seletores de hora nativos (`type="time"`), controle de estado reativo e ações em lote para definir horários de funcionamento (como 08:00 às 20:00) de forma simples e 100% persistida no Supabase.

**Architecture:** 
1. Em `server/schemas.ts`, o schema Zod `time` transformará entradas como `8:00` ou `9:00` automaticamente para `08:00` e `09:00`.
2. Em `server.ts` e `server/storage.ts`, ajustaremos o endpoint de lote de expediente para permitir aplicar `hora_inicio`, `hora_fim`, `intervalo_inicio` e `intervalo_fim` a todos os expedientes do barbeiro.
3. Em `src/components/AdminLayout.tsx`, implementaremos campos do tipo `<input type="time">`, botões de cópia rápida (Seg-Sex) e salvamento com feedback visual em tempo real.

**Tech Stack:** TypeScript, Node.js / Express, Zod, Supabase PostgreSQL, React 19, Lucide React.

## Global Constraints
- Manter compatibilidade total com o banco de dados Supabase em produção.
- Garantir que `npm run lint` execute sem nenhum erro.

---

### Task 1: Normalização de Horários no Schema Zod e Endpoints do Servidor

**Files:**
- Modify: `server/schemas.ts`
- Modify: `server.ts`
- Modify: `server/storage.ts`

- [ ] **Step 1: Atualizar a validação `time` em `server/schemas.ts` com `.transform()`**

Substituir em `server/schemas.ts`:
```typescript
const time = z.string()
  .transform(s => {
    if (!s) return s;
    const parts = s.trim().split(':');
    if (parts.length >= 2) {
      const h = parts[0].padStart(2, '0');
      const m = parts[1].slice(0, 2).padStart(2, '0');
      return `${h}:${m}`;
    }
    return s;
  })
  .pipe(z.string().regex(/^\d{2}:\d{2}/, 'Horário deve ser HH:MM.'));
```

- [ ] **Step 2: Expandir o schema `patchIntervaloPadrao` para suportar `hora_inicio` e `hora_fim` em lote em `server/schemas.ts`**

```typescript
patchIntervaloPadrao: z.object({
  hora_inicio: time.optional(),
  hora_fim: time.optional(),
  intervalo_inicio: time.nullable().optional(),
  intervalo_fim: time.nullable().optional()
}),
```

- [ ] **Step 3: Atualizar `applyDefaultInterval` em `server/storage.ts` para atualizar `hora_inicio` e `hora_fim` quando fornecidos**

Em `server/storage.ts`:
```typescript
export async function applyDefaultInterval(
  barbeiroId: string,
  intervaloInicio: string | null,
  intervaloFim: string | null,
  profissionalId?: string,
  horaInicio?: string,
  horaFim?: string
): Promise<void> {
  const client = sb();
  if (!client) throw new Error('Supabase not configured');
  const updateData: any = { updated_at: new Date().toISOString() };
  if (intervaloInicio !== undefined) updateData.intervalo_inicio = intervaloInicio;
  if (intervaloFim !== undefined) updateData.intervalo_fim = intervaloFim;
  if (horaInicio) updateData.hora_inicio = horaInicio;
  if (horaFim) updateData.hora_fim = horaFim;

  let q = client.from('expedientes')
    .update(updateData)
    .eq('barbeiro_id', barbeiroId);
  if (profissionalId) q = q.eq('profissional_id', profissionalId);
  const { error } = await q;
  if (error) throw error;
}
```

- [ ] **Step 4: Atualizar o endpoint `POST /api/admin/expedientes/intervalo-padrao` em `server.ts`**

Em `server.ts`:
```typescript
app.post('/api/admin/expedientes/intervalo-padrao', requireAdmin, validate(schemas.patchIntervaloPadrao), async (req: AuthRequest, res) => {
  try {
    const { hora_inicio, hora_fim, intervalo_inicio, intervalo_fim } = req.body;
    const profissionalId = req.query.profissional_id as string | undefined;

    if (isSupabaseConfigured() && req.barbeiroId) {
      await storage.applyDefaultInterval(
        req.barbeiroId,
        intervalo_inicio !== undefined ? (intervalo_inicio || null) : null,
        intervalo_fim !== undefined ? (intervalo_fim || null) : null,
        profissionalId,
        hora_inicio,
        hora_fim
      );
      return res.json({ success: true, message: 'Horários do expediente atualizados para todos os dias.' });
    }

    const db = loadDB();
    db.expedientes.forEach(ex => {
      if (hora_inicio) ex.hora_inicio = hora_inicio;
      if (hora_fim) ex.hora_fim = hora_fim;
      if (intervalo_inicio !== undefined) ex.intervalo_inicio = intervalo_inicio || null;
      if (intervalo_fim !== undefined) ex.intervalo_fim = intervalo_fim || null;
      ex.updated_at = new Date().toISOString();
    });

    saveDB(db);
    res.json({ success: true, message: 'Horários do expediente atualizados para todos os dias.' });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error?.message || 'Erro ao cadastrar horário do expediente.' });
  }
});
```

---

### Task 2: Refatorar a Interface do Expediente em AdminLayout.tsx

**Files:**
- Modify: `src/components/AdminLayout.tsx`

- [ ] **Step 1: Adicionar estado local `batchHours` para configuração geral em lote**

Em `AdminLayout.tsx`:
```typescript
const [batchStart, setBatchStart] = useState('08:00');
const [batchEnd, setBatchEnd] = useState('20:00');
const [defaultIntervalStart, setDefaultIntervalStart] = useState('12:00');
const [defaultIntervalEnd, setDefaultIntervalEnd] = useState('13:00');
```

- [ ] **Step 2: Atualizar a função `handleApplyDefaultInterval` para enviar `hora_inicio` e `hora_fim`**

Em `AdminLayout.tsx`:
```typescript
const handleApplyBatchHours = async () => {
  if (!batchStart || !batchEnd) {
    setErrorMsg('Por favor, informe a hora de abertura e fechamento.');
    return;
  }
  setSubmitting(true);
  setErrorMsg('');
  setSuccessMsg('');
  try {
    const res = await authedFetch('/api/admin/expedientes/intervalo-padrao', {
      method: 'POST',
      body: {
        hora_inicio: batchStart,
        hora_fim: batchEnd,
        intervalo_inicio: defaultIntervalStart || null,
        intervalo_fim: defaultIntervalEnd || null
      }
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Não foi possível atualizar a escala.');
    }
    setSuccessMsg('Horários aplicados a todos os dias com sucesso!');
    fetchConfiguracoes();
  } catch (err: any) {
    setErrorMsg(err.message);
  } finally {
    setSubmitting(false);
  }
};
```

- [ ] **Step 3: Substituir os campos `<input type="text">` de expedientes por `<input type="time">` com botões de salvamento/atualização clara**

Substituir o grid de expedientes em `AdminLayout.tsx` para usar inputs `type="time"` e salvamento responsivo por dia, com opção de habilitar/desabilitar dia e salvar instantaneamente.

---

### Task 3: Verificação & Teste com `npm run lint`

**Files:**
- Check: Projeto inteiro

- [ ] **Step 1: Rodar `npm run lint`**
- [ ] **Step 2: Fazer commit e push das alterações para o GitHub**

---
