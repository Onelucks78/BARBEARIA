import { useMemo, useState } from 'react';
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
const PASSO_MIN = 15;     // horários de 15 em 15 min (como o AppBarber)

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

  // Horários (a cada 15 min) — o dia escolhido determina quais blocos aparecem
  const slots = useMemo(() => {
    const out: number[] = [];
    for (let m = 0; m < MINUTOS_GRADE; m += PASSO_MIN) out.push(HORA_INICIO * 60 + m);
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
                  const agendamentosDoDia = agendamentos.filter(a =>
                    a.profissional_id === p.id && a.inicio_em.split('T')[0] === dataAtual
                  );
                  const cobrindo = agendamentosDoDia.find(a => {
                    const s = timeToMinutes(a.inicio_em.split('T')[1]?.substring(0, 5) || '00:00');
                    const fimRaw = a.fim_em ? timeToMinutes(a.fim_em.split('T')[1]?.substring(0, 5) || '00:00') : s + 30;
                    const e = Math.ceil(fimRaw / PASSO_MIN) * PASSO_MIN;
                    return s < min + PASSO_MIN && e > min;
                  });
                  const ehInicio = cobrindo && timeToMinutes(cobrindo.inicio_em.split('T')[1]?.substring(0, 5) || '00:00') === min;
                  const servNome = cobrindo ? (servicos.find(s => s.id === cobrindo.servico_id)?.nome || 'Serviço') : '';
                  return (
                    <div
                      key={p.id}
                      className={`relative border-b border-r border-border min-h-[15px] transition ${cobrindo ? `border-l-4 cursor-pointer ${statusClasses(cobrindo.status)}` : 'hover:bg-accent/40 cursor-pointer'}`}
                      onClick={() => cobrindo ? onAgendamentoClick(cobrindo) : onSlotClickWrapped(min)}
                      title={cobrindo ? `${cobrindo.nome_cliente} — ${servNome} (${cobrindo.inicio_em.split('T')[1]?.substring(0, 5)}h)` : undefined}
                    >
                      {ehInicio && (
                        <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 px-2 py-1 overflow-visible text-left">
                          <span className="block text-[10px] font-black break-words leading-tight">{cobrindo.nome_cliente}</span>
                          <span className="block text-[9px] break-words leading-tight opacity-80">
                            {cobrindo.inicio_em.split('T')[1]?.substring(0, 5)} · {servNome}
                          </span>
                        </div>
                      )}
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
