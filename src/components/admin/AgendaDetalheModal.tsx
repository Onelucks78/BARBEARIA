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
                <Trash2 className="w-4 h-4" /> Excluir
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
