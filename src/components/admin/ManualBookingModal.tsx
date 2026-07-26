import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, Phone, CheckCircle, Scissors } from 'lucide-react';
import { Servico, Profissional } from '../../types.ts';

interface ManualBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  profissionais: Profissional[];
  services: Servico[];
  clientes: { id: string; nome: string; telefone: string; email?: string }[];
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
  clientes,
  onBookingSuccess,
  defaultProfissionalId = ''
}: ManualBookingModalProps) {
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('new');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  
  const [selectedProfissionalId, setSelectedProfissionalId] = useState(defaultProfissionalId);
  const [selectedServices, setSelectedServices] = useState<Servico[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [observacao, setObservacao] = useState('Agendamento feito via WhatsApp / Admin');

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

  useEffect(() => {
    if (clientMode === 'existing' && selectedClientId) {
      const client = clientes.find(c => c.id === selectedClientId);
      if (client) {
        setNomeCliente(client.nome);
        setTelefoneCliente(client.telefone || '');
      }
    }
  }, [clientMode, selectedClientId, clientes]);

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
      setSelectedServices(prev => prev.filter(item => item.id !== s.id));
    } else {
      setSelectedServices(prev => [...prev, s]);
    }
    setSelectedSlot('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCliente.trim()) {
      setErrorMsg('Por favor, informe o nome do cliente.');
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
        cliente_telefone: telefoneCliente.trim(),
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

      onBookingSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao realizar agendamento manual.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const totalPreco = selectedServices.reduce((sum, s) => sum + s.preco, 0);
  const totalDuracao = selectedServices.reduce((sum, s) => sum + s.duracao_minutos, 0);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92dvh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2 text-primary">
              <Calendar className="w-5 h-5" /> Novo Agendamento Manual (WhatsApp / Ligação)
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">Trave o horário na agenda para o cliente</p>
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 rounded-md text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* 1. Cliente */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              1. Dados do Cliente
            </label>
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input
                  type="radio"
                  name="clientMode"
                  checked={clientMode === 'new'}
                  onChange={() => setClientMode('new')}
                  className="accent-primary"
                />
                Novo Cliente (WhatsApp/Presencial)
              </label>
              {clientes.length > 0 && (
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="radio"
                    name="clientMode"
                    checked={clientMode === 'existing'}
                    onChange={() => setClientMode('existing')}
                    className="accent-primary"
                  />
                  Cliente Cadastrado
                </label>
              )}
            </div>

            {clientMode === 'existing' ? (
              <div>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full p-2.5 bg-background border border-border rounded-md text-xs focus:outline-none focus:border-primary text-foreground"
                >
                  <option value="">Selecione um cliente...</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} ({c.telefone || 'sem telefone'})</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Nome do Cliente *"
                    required
                    value={nomeCliente}
                    onChange={(e) => setNomeCliente(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-md text-xs focus:outline-none focus:border-primary text-foreground"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="tel"
                    placeholder="Telefone / WhatsApp (ex: 11 98765-4321)"
                    value={telefoneCliente}
                    onChange={(e) => setTelefoneCliente(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-md text-xs focus:outline-none focus:border-primary text-foreground"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. Barbeiro */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              2. Selecione o Barbeiro / Profissional *
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

          {/* 3. Serviços */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              3. Selecione os Serviço(s) *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {services.map(s => {
                const isSelected = selectedServices.some(item => item.id === s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleToggleService(s)}
                    className={`p-3 rounded-md border text-left flex items-center justify-between text-xs transition cursor-pointer ${
                      isSelected
                        ? 'bg-primary/15 border-primary text-foreground shadow-sm'
                        : 'bg-background hover:bg-muted/50 border-border text-foreground'
                    }`}
                  >
                    <div>
                      <span className="font-semibold block">{s.nome}</span>
                      <span className="text-muted-foreground text-[11px]">{s.duracao_minutos} min</span>
                    </div>
                    <span className="font-bold text-primary">
                      R$ {s.preco.toFixed(2).replace('.', ',')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Data e Horário */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              4. Data e Horário Livre *
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
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
                  <div className="text-xs text-muted-foreground py-2 italic animate-pulse">Carregando horários...</div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2 italic">Selecione o serviço e data para ver horários livres.</div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {availableSlots.map(slot => (
                      <button
                        key={slot.horario}
                        type="button"
                        disabled={!slot.disponivel}
                        onClick={() => setSelectedSlot(slot.horario)}
                        className={`py-2 px-2 text-center rounded text-xs font-bold border transition cursor-pointer ${
                          selectedSlot === slot.horario
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : slot.disponivel
                              ? 'bg-background hover:bg-muted text-foreground border-border'
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

          {/* 5. Observação */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Observação / Origem
            </label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Agendado pelo WhatsApp com Barbeiro"
              className="w-full p-2.5 bg-background border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-border flex items-center justify-between gap-3 shrink-0">
            <div className="text-xs">
              <span className="text-muted-foreground block">Total Estimado:</span>
              <span className="font-extrabold text-primary text-sm">
                R$ {totalPreco.toFixed(2).replace('.', ',')} ({totalDuracao} min)
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 border border-border rounded-md text-xs font-bold hover:bg-muted text-muted-foreground cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedSlot || selectedServices.length === 0 || !nomeCliente.trim()}
                className="px-5 py-2.5 bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider rounded-md shadow-md hover:bg-primary/90 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {submitting ? 'Agendando...' : <>Travar & Agendar <CheckCircle className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
