import React, { useState, useEffect } from 'react';
import { X, Calendar, User, CheckCircle } from 'lucide-react';
import { Servico, Profissional } from '../../types.ts';

interface ManualBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  profissionais: Profissional[];
  services: Servico[];
  clientes?: { id: string; nome: string; telefone: string; email?: string }[];
  onBookingSuccess: () => void;
  defaultProfissionalId?: string;
}

interface SlotState {
  horario: string;
  disponivel: boolean;
  motivo?: 'ocupado' | 'intervalo' | 'bloqueado';
}

export default function ManualBookingModal({
  isOpen,
  onClose,
  profissionais,
  services,
  onBookingSuccess,
  defaultProfissionalId = ''
}: ManualBookingModalProps) {
  const [nomeCliente, setNomeCliente] = useState('');
  const [selectedProfissionalId, setSelectedProfissionalId] = useState(defaultProfissionalId);
  const [selectedServices, setSelectedServices] = useState<Servico[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [observacao, setObservacao] = useState('');

  const [availableSlots, setAvailableSlots] = useState<SlotState[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (defaultProfissionalId) {
      setSelectedProfissionalId(defaultProfissionalId);
    } else if (profissionais.length > 0 && !selectedProfissionalId) {
      setSelectedProfissionalId(profissionais[0].id);
    }
  }, [defaultProfissionalId, profissionais]);

  // Pre-select first service by default for convenience
  useEffect(() => {
    if (services.length > 0 && selectedServices.length === 0) {
      setSelectedServices([services[0]]);
    }
  }, [services]);

  useEffect(() => {
    if (!selectedProfissionalId || !selectedDate || selectedServices.length === 0) {
      setAvailableSlots([]);
      return;
    }

    const fetchSlots = async () => {
      setLoadingSlots(true);
      setErrorMsg('');
      try {
        const servicosIds = selectedServices.map(s => s.id).join(',');
        const res = await fetch(`/api/agendamentos/disponibilidade?profissional_id=${selectedProfissionalId}&data=${selectedDate}&servicos_ids=${servicosIds}`);
        if (res.ok) {
          const data = await res.json();
          setAvailableSlots(data.horarios || []);
        } else {
          setAvailableSlots([]);
        }
      } catch (err) {
        console.error('Erro ao buscar disponibilidade:', err);
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [selectedProfissionalId, selectedDate, selectedServices]);

  const handleToggleService = (s: Servico) => {
    if (selectedServices.some(item => item.id === s.id)) {
      if (selectedServices.length > 1) {
        setSelectedServices(prev => prev.filter(item => item.id !== s.id));
      }
    } else {
      setSelectedServices(prev => [...prev, s]);
    }
    setSelectedSlot('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCliente.trim()) {
      setErrorMsg('Informe o nome do cliente.');
      return;
    }
    if (selectedServices.length === 0) {
      setErrorMsg('Selecione pelo menos um serviço.');
      return;
    }
    if (!selectedProfissionalId) {
      setErrorMsg('Selecione o barbeiro.');
      return;
    }
    if (!selectedDate || !selectedSlot) {
      setErrorMsg('Selecione a data e o horário.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        cliente_nome: nomeCliente.trim(),
        cliente_telefone: '',
        profissional_id: selectedProfissionalId,
        servicos_ids: selectedServices.map(s => s.id),
        data: selectedDate,
        horario: selectedSlot,
        observacoes: observacao.trim()
      };

      const res = await fetch('/api/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao agendar horário.');
      }

      // Reset form
      setNomeCliente('');
      setObservacao('');
      setSelectedSlot('');

      onBookingSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao realizar agendamento.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92dvh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2 text-primary">
              <Calendar className="w-5 h-5" /> Novo Agendamento
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">Informe o nome do cliente e trave o horário</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 rounded-md text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Nome do Cliente */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Nome do Cliente *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Ex: João Silva"
                required
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-md text-xs focus:outline-none focus:border-primary text-foreground font-medium"
              />
            </div>
          </div>

          {/* Barbeiro */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Barbeiro *
            </label>
            <select
              value={selectedProfissionalId}
              onChange={(e) => {
                setSelectedProfissionalId(e.target.value);
                setSelectedSlot('');
              }}
              className="w-full p-2.5 bg-background border border-border rounded-md text-xs focus:outline-none focus:border-primary text-foreground font-semibold"
            >
              {profissionais.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>

          {/* Serviço */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Serviço *
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-background border border-border rounded-md">
              {services.map(s => {
                const isSelected = selectedServices.some(item => item.id === s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleToggleService(s)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer border ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-card hover:bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {s.nome} (R$ {s.preco.toFixed(2).replace('.', ',')})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Data e Horário */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Data & Horário *
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedSlot('');
                }}
                className="p-2.5 bg-background border border-border rounded-md text-xs font-semibold text-foreground focus:outline-none focus:border-primary shrink-0"
              />
              <div className="flex-1">
                {loadingSlots ? (
                  <div className="text-xs text-muted-foreground py-2 italic animate-pulse">Buscando horários...</div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2 italic">Sem horários livres nesta data.</div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-32 overflow-y-auto p-1 border border-border rounded-md bg-background">
                    {availableSlots.map(slot => (
                      <button
                        key={slot.horario}
                        type="button"
                        disabled={!slot.disponivel}
                        onClick={() => setSelectedSlot(slot.horario)}
                        className={`py-1.5 px-1 text-center rounded text-xs font-bold border transition cursor-pointer ${
                          selectedSlot === slot.horario
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                            : slot.disponivel
                              ? 'bg-card hover:bg-muted text-foreground border-border'
                              : 'bg-muted/30 text-muted-foreground border-transparent line-through cursor-not-allowed opacity-40'
                        }`}
                      >
                        {slot.horario}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Observação (Sem texto pré-setado, campo em branco) */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Observação (Opcional)
            </label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Digite alguma observação se desejar..."
              className="w-full p-2.5 bg-background border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-md text-xs font-bold hover:bg-muted text-muted-foreground cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedSlot || !nomeCliente.trim()}
              className="px-5 py-2 bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider rounded-md shadow-md hover:bg-primary/90 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {submitting ? 'Salvando...' : <>Salvar Agendamento <CheckCircle className="w-4 h-4" /></>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
