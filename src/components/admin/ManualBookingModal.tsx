import React, { useState, useEffect } from 'react';
import { X, Calendar, User, CheckCircle, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
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

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

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

  // Calendar month state
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState<number>(new Date().getMonth());
  const [currentCalendarYear, setCurrentCalendarYear] = useState<number>(new Date().getFullYear());

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

  // Pre-select first service by default
  useEffect(() => {
    if (services.length > 0 && selectedServices.length === 0) {
      setSelectedServices([services[0]]);
    }
  }, [services]);

  // Fetch live availability from database API
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

  // Calendar Helpers
  const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    const today = new Date();
    if (currentCalendarYear > today.getFullYear() || (currentCalendarYear === today.getFullYear() && currentCalendarMonth > today.getMonth())) {
      if (currentCalendarMonth === 0) {
        setCurrentCalendarMonth(11);
        setCurrentCalendarYear(prev => prev - 1);
      } else {
        setCurrentCalendarMonth(prev => prev - 1);
      }
    }
  };

  const handleNextMonth = () => {
    if (currentCalendarMonth === 11) {
      setCurrentCalendarMonth(0);
      setCurrentCalendarYear(prev => prev + 1);
    } else {
      setCurrentCalendarMonth(prev => prev + 1);
    }
  };

  const isDateInPast = (dayNumber: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(currentCalendarYear, currentCalendarMonth, dayNumber);
    return targetDate < today;
  };

  const handleSelectDay = (dayNumber: number) => {
    const dateStr = `${currentCalendarYear}-${String(currentCalendarMonth + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    setSelectedSlot('');
  };

  const calendarCells = React.useMemo(() => {
    const totalDays = getDaysInMonth(currentCalendarMonth, currentCalendarYear);
    const firstDayIndex = getFirstDayOfMonth(currentCalendarMonth, currentCalendarYear);
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    return cells;
  }, [currentCalendarMonth, currentCalendarYear]);

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
      setErrorMsg('Selecione o dia no calendário e o horário.');
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
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92dvh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2 text-primary">
              <Calendar className="w-5 h-5" /> Agendar para Cliente
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">Trave o horário no sistema para o cliente</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 rounded-md text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* 1. Nome do Cliente & Barbeiro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>

          {/* 2. Serviço */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Serviço *
            </label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-background border border-border rounded-md">
              {services.map(s => {
                const isSelected = selectedServices.some(item => item.id === s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleToggleService(s)}
                    className={`px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer border ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs font-bold'
                        : 'bg-card hover:bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {s.nome} (R$ {s.preco.toFixed(2).replace('.', ',')})
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. CALENDÁRIO ABERTO (Open Visual Calendar Grid) */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Selecione o Dia no Calendário *
            </label>

            <div className="p-4 bg-background border border-border rounded-lg space-y-3">
              {/* Header do Mês com Setas */}
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-md hover:bg-muted border border-border text-foreground transition cursor-pointer"
                  title="Mês Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs sm:text-sm font-bold text-primary uppercase tracking-wider">
                  {MONTHS_PT[currentCalendarMonth]} {currentCalendarYear}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-md hover:bg-muted border border-border text-foreground transition cursor-pointer"
                  title="Próximo Mês"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Dias da Semana (Dom -> Sáb) */}
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted-foreground uppercase">
                {DAYS_SHORT.map((day, idx) => (
                  <div key={idx} className="py-1">{day}</div>
                ))}
              </div>

              {/* Grid dos Dias do Mês */}
              <div className="grid grid-cols-7 gap-1.5 text-center">
                {calendarCells.map((cell, idx) => {
                  if (cell === null) return <div key={`empty-${idx}`} />;
                  
                  const isPast = isDateInPast(cell);
                  const dateStr = `${currentCalendarYear}-${String(currentCalendarMonth + 1).padStart(2, '0')}-${String(cell).padStart(2, '0')}`;
                  const isSelected = selectedDate === dateStr;
                  const today = new Date();
                  const isToday = today.getDate() === cell && today.getMonth() === currentCalendarMonth && today.getFullYear() === currentCalendarYear;

                  return (
                    <button
                      key={`day-${cell}`}
                      type="button"
                      disabled={isPast}
                      onClick={() => handleSelectDay(cell)}
                      className={`py-2 text-xs font-bold rounded-md transition flex flex-col items-center justify-center relative cursor-pointer ${
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/40'
                          : isPast
                            ? 'text-muted-foreground/30 line-through cursor-not-allowed opacity-30'
                            : 'bg-card hover:bg-muted text-foreground border border-border'
                      }`}
                    >
                      <span>{cell}</span>
                      {isToday && !isSelected && (
                        <span className="w-1 h-1 bg-primary rounded-full mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. HORÁRIOS LIVRES ABERTOS (Open Time Slots Grid) */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" /> Horários Livres (Banco de Dados em Tempo Real) *
            </label>
            {loadingSlots ? (
              <div className="p-4 border border-border rounded-lg bg-background text-center text-xs text-muted-foreground italic animate-pulse">
                Consultando banco de dados...
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="p-4 border border-border rounded-lg bg-background text-center text-xs text-muted-foreground">
                Selecione um dia no calendário acima para visualizar os horários disponíveis no banco.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 p-3 bg-background border border-border rounded-lg max-h-44 overflow-y-auto">
                {availableSlots.map(slot => (
                  <button
                    key={slot.horario}
                    type="button"
                    disabled={!slot.disponivel}
                    onClick={() => setSelectedSlot(slot.horario)}
                    className={`py-2 px-1 text-center rounded text-xs font-bold border transition cursor-pointer ${
                      selectedSlot === slot.horario
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm font-extrabold scale-105'
                        : slot.disponivel
                          ? 'bg-card hover:bg-muted text-foreground border-border'
                          : 'bg-muted/20 text-muted-foreground/40 border-transparent line-through cursor-not-allowed'
                    }`}
                  >
                    {slot.horario}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Observação (Em branco por padrão) */}
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

          {/* Footer Submit */}
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
