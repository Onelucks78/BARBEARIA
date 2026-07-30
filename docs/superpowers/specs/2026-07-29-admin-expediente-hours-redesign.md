# Design Spec: Reformulação do Gerenciamento de Horários & Expediente no Admin

**Data**: 29/07/2026  
**Status**: Aprovado pelo Usuário  
**Escopo**: `server/schemas.ts`, `server.ts`, `server/storage.ts`, `src/components/AdminLayout.tsx`

---

## 1. Objetivos

1. **Normalização de Horários no Backend**:
   - Garantir que entradas de horário no formato `8:00`, `9:30`, `8:0` sejam transformadas automaticamente em `08:00`, `09:30` antes da validação Zod e persista corretamente no PostgreSQL/Supabase.
2. **Interface Responsiva & Seletores Nativos de Hora**:
   - Substituir os inputs de texto genéricos (`type="text"`) na aba de Configurações de Expediente por campos de hora nativos (`type="time"`), prevenindo erros de digitação e facilitando a escolha de horários (ex: `08:00` às `20:00`).
3. **Ações em Lote & Replicador de Horários**:
   - Permitir aplicar um horário global para todos os dias da semana (Ex: Abertura `08:00`, Fechamento `20:00`, Almoço `12:00`-`13:00`).
   - Adicionar atalho para replicar a jornada de Segunda-feira para os demais dias úteis (Ter-Sexta).
4. **Estado Controlado & Resposta Visual**:
   - Vincular os inputs ao estado do React com salvamento automático ou botão por dia, exibindo status visual claro (sucesso/erro) sem perda de alterações por desfoco de campo (`onBlur`).

---

## 2. Detalhamento Técnico

### A. `server/schemas.ts` & `server.ts`
- Atualizar o esquema `time` no Zod para usar `.transform()`:
  ```ts
  const time = z.string()
    .transform(s => {
      if (!s) return s;
      const parts = s.trim().split(':');
      if (parts.length >= 2) {
        const h = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        return `${h}:${m}`;
      }
      return s;
    })
    .pipe(z.string().regex(/^\d{2}:\d{2}/, 'Horário deve ser no formato HH:MM.'));
  ```
- Atualizar `patchExpediente` e `patchIntervaloPadrao` para aceitar também `hora_inicio` e `hora_fim` em lote ou por profissional.

### B. `src/components/AdminLayout.tsx`
- Adicionar estado local controlado `editingExpedientes` para manipulação em tempo real dos 7 dias da semana.
- Atualizar os campos para utilizar `type="time"`, com botões de alternar ativo/inativo, limpar intervalo de almoço e salvar turno.
- Implementar botão "Replicar Segunda p/ Terça-Sexta" e "Aplicar Horário Geral em Lote".

---

## 3. Critérios de Aceitação

- [x] O horário `8:00` é salvo corretamente como `08:00` no banco de dados sem erro 400 Bad Request.
- [x] Horário das 8:00 às 20:00 pode ser definido para qualquer dia ou para todos os dias de uma só vez.
- [x] `npm run lint` executa sem nenhum erro de compilação TypeScript.
