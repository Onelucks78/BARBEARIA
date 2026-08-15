import React, { useState, useEffect } from 'react';
import { X, Calendar, User, Phone, CheckCircle, ChevronLeft, ChevronRight, Clock, KeyRound } from 'lucide-react';
import { Servico, Profissional } from '../../types.ts';
import { authedFetch } from '../../lib/supabase.ts';
import { telefoneParaEmail } from '../../../lib/telefone.ts';

interface ManualBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  profissionais: Profissional[];
  services: Servico[];
  clientes?: { id: string; nome: string; telefone: string; email?: string; ativo?: boolean }[];
  onBookingSuccess: () => void;
  defaultProfissionalId?: string;
  slotInicial?: { data: string; horario: string };
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
const STEP_TITLES = ['Cliente', 'Serviço', 'Dia', 'Horário', 'Revisão'];
const SENHA_PADRAO = 'DETALHE@123';

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

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
  const [step, setStep] = useState(1);
  const [nomeCliente, setNomeCliente] = useState('');
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [clienteIdSelecionado, setClienteIdSelecionado] = useState<string | null>(null);
  const [criarConta, setCriarConta] = useState(false);
  const [selectedProfissionalId, setSelectedProfissionalId] = useState(defaultProfissionalId);
  const [selectedServices, setSelectedServices] = useState<Servico[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [observacao, setObservacao] = useState('');

  const [currentCalendarMonth, setCurrentCalendarMonth] = useState<number>(new Date().getMonth());
  const [currentCalendarYear, setCurrentCalendarYear] = useState<number>(new Date().getFullYear());

  const [availableSlots, setAvailableSlots] = useState<SlotState[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setErrorMsg('');
      setInfoMsg('');
    }
  }, [isOpen]);

  useEffect(() => {
    const activeProfissionais = profissionais.filter(p => p.ativo !== false);
    const matched = activeProfissionais.find(p => p.id === defaultProfissionalId);
    if (matched) {
      setSelectedProfissionalId(matched.id);
    } else if (activeProfissionais.length > 0) {
      setSelectedProfissionalId(activeProfissionais[0].id);
    }
  }, [defaultProfissionalId, profissionais, isOpen]);

  useEffect(() => {
    if (isOpen && slotInicial) {
      setSelectedDate(slotInicial.data);
      setSelectedSlot(slotInicial.horario);
      const [ano, mes] = slotInicial.data.split('-').map(Number);
      if (ano && mes) {
        setCurrentCalendarYear(ano);
        setCurrentCalendarMonth(mes - 1);
      }
    }
  }, [isOpen, slotInicial]);

  useEffect(() => {
    if (!buscandoCliente) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-cliente-dropdown]')) return;
      setBuscandoCliente(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBuscandoCliente(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [buscandoCliente]);

  useEffect(() => {
    if (!isOpen) return;
    if (!selectedProfissionalId || !selectedDate || selectedServices.length === 0) {
      setAvailableSlots([]);
      return;
    }

    const fetchSlots = async () => {
      setLoadingSlots(true);
      setErrorMsg('');
      try {
        const params = new URLSearchParams({
          data: selectedDate,
          servico_id: selectedServices.map(s => s.id).join(','),
          profissional_id: selectedProfissionalId,
          all: 'true'
        });
        const res = await fetch(`/api/horarios-livres?${params.toString()}`);
        if (!res.ok) {
          setAvailableSlots([]);
          setErrorMsg('Não foi possível carregar os horários desta data.');
          return;
        }
        const data = await res.json();
        setAvailableSlots(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Erro ao buscar disponibilidade:', err);
        setAvailableSlots([]);
        setErrorMsg('Falha de conexão ao buscar os horários.');
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [isOpen, selectedProfissionalId, selectedDate, selectedServices]);

  const handleSelectService = (servicoId: string) => {
    const escolhido = services.find(item => item.id === servicoId);
    setSelectedServices(escolhido ? [escolhido] : []);
    setSelectedSlot('');
  };

  const totalPreco = selectedServices.reduce((acc, s) => acc + (s.preco || 0), 0);
  const totalDuracao = selectedServices.reduce((acc, s) => acc + (s.duracao_minutos || 0), 0);

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

  const telefoneLimpo = telefoneCliente.replace(/\D/g, '');
  const telefoneValido = telefoneLimpo.length === 10 || telefoneLimpo.length === 11;

  const handleNext = () => {
    if (step === 1 && !nomeCliente.trim()) {
      setErrorMsg('Informe o nome do cliente.');
      return;
    }
    if (step === 1 && criarConta && !telefoneValido) {
      setErrorMsg('Informe um telefone válido (DDD + número) para criar o acesso.');
      return;
    }
    if (step === 2 && selectedServices.length === 0) {
      setErrorMsg('Selecione um serviço.');
      return;
    }
    if (step === 3 && !selectedDate) {
      setErrorMsg('Selecione um dia no calendário.');
      return;
    }
    if (step === 4 && !selectedSlot) {
      setErrorMsg('Selecione um horário.');
      return;
    }
    setErrorMsg('');
    setStep(s => s + 1);
  };

  const canAdvance =
    (step === 1 && !!nomeCliente.trim()) ||
    (step === 2 && selectedServices.length > 0) ||
    (step === 3 && !!selectedDate) ||
    (step === 4 && !!selectedSlot);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCliente.trim()) { setErrorMsg('Informe o nome do cliente.'); return; }
    if (selectedServices.length === 0) { setErrorMsg('Selecione pelo menos um serviço.'); return; }
    if (!selectedProfissionalId) { setErrorMsg('Selecione o barbeiro.'); return; }
    if (!selectedDate || !selectedSlot) { setErrorMsg('Selecione o dia e o horário.'); return; }
    if (criarConta && !telefoneValido) { setErrorMsg('Informe um telefone válido para criar o acesso do cliente.'); return; }

    setSubmitting(true);
    setErrorMsg('');
    setInfoMsg('');

    try {
      let clienteId = clienteIdSelecionado;
      let clienteEmail: string | undefined;

      if (criarConta && nomeCliente.trim() && telefoneValido) {
        try {
          const resCria = await authedFetch('/api/admin/clientes', {
            method: 'POST',
            body: { nome: nomeCliente.trim(), telefone: telefoneLimpo, senha: SENHA_PADRAO }
          });
          if (resCria.ok) {
            const criado = await resCria.json();
            if (criado?.id) clienteId = criado.id;
            setInfoMsg(`Conta de acesso criada para o cliente (senha ${SENHA_PADRAO}).`);
          } else if (resCria.status === 409) {
            clienteEmail = telefoneParaEmail(telefoneLimpo);
            setInfoMsg('Telefone já tem login no app — agendando com a conta existente.');
          } else {
            clienteEmail = telefoneParaEmail(telefoneLimpo);
            setInfoMsg('Não foi possível criar o login, mas o agendamento será salvo.');
          }
        } catch (errCria) {
          console.error('Erro ao criar conta do cliente:', errCria);
          clienteEmail = telefoneParaEmail(telefoneLimpo);
          setInfoMsg('Não foi possível criar o login, mas o agendamento será salvo.');
        }
      }

      const payload: any = {
        nome_cliente: nomeCliente.trim(),
        telefone_cliente: telefoneLimpo,
        profissional_id: selectedProfissionalId,
        servico_id: selectedServices.map(s => s.id).join(','),
        data: selectedDate,
        horario: selectedSlot,
        observacao: observacao.trim()
      };
      if (clienteId) payload.cliente_id = clienteId;
      else if (clienteEmail) payload.cliente_email = clienteEmail;

      const res = await fetch('/api/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao agendar horário.');
      }

      setNomeCliente('');
      setTelefoneCliente('');
      setClienteIdSelecionado(null);
      setCriarConta(false);
      setObservacao('');
      setSelectedSlot('');
      setStep(1);

      onBookingSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao realizar agendamento.');
    } finally {
      setSubmitting(false);
    }
  };

  const buscaClienteQuery = nomeCliente.trim().toLowerCase();
  const buscaClienteDigits = buscaClienteQuery.replace(/\D/g, '');
  const matchesCliente = (c: { nome: string; telefone: string; ativo?: boolean }) => {
    if (c.ativo === false) return false;
    if (c.nome.toLowerCase().includes(buscaClienteQuery)) return true;
    const telefone = c.telefone || '';
    if (telefone.toLowerCase().includes(buscaClienteQuery)) return true;
    if (buscaClienteDigits.length > 0 && telefone.replace(/\D/g, '').includes(buscaClienteDigits)) return true;
    return false;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92dvh]">
        <div className="p-4 sm:p-5 bg-slate-900 text-white border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2 text-white">
              <Calendar className="w-5 h-5" /> Agendar para Cliente
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">
              Etapa {step} de 5 · {STEP_TITLES[step - 1]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1 px-4 sm:px-5 pt-3 shrink-0">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className={`h-1 flex-1 rounded-full transition ${i <= step ? 'bg-primary' : 'bg-slate-700'}`} />
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {errorMsg && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-500 rounded-md text-xs font-semibold">
                {errorMsg}
              </div>
            )}
            {infoMsg && (
              <div className="mb-4 p-3 bg-sky-500/10 border border-sky-500/30 text-sky-700 dark:text-sky-300 rounded-md text-xs font-semibold">
                {infoMsg}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                      Nome do Cliente *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                      <input
                        type="text"
                        placeholder="Ex: João Silva"
                        required
                        value={nomeCliente}
                        onChange={(e) => {
                          setNomeCliente(e.target.value);
                          setClienteIdSelecionado(null);
                          setBuscandoCliente(true);
                        }}
                        onFocus={() => setBuscandoCliente(true)}
                        className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-md text-xs focus:outline-none focus:border-primary text-foreground font-medium"
                      />
                      {buscandoCliente && nomeCliente.trim().length > 0 && (
                        <div data-cliente-dropdown className="absolute left-0 right-0 top-full mt-1 z-20 bg-card border border-border rounded-md shadow-xl max-h-48 overflow-y-auto">
                          {clientes
                            .filter(matchesCliente)
                            .slice(0, 8)
                            .map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setNomeCliente(c.nome);
                                  setTelefoneCliente(c.telefone || '');
                                  setClienteIdSelecionado(c.id);
                                  setBuscandoCliente(false);
                                }}
                                className="w-full text-left px-3 py-2.5 hover:bg-accent text-xs font-semibold text-foreground transition cursor-pointer"
                              >
                                {c.nome}
                                {c.telefone && <span className="block text-[10px] text-muted-foreground">{c.telefone}</span>}
                              </button>
                            ))}
                          {clientes.filter(matchesCliente).length === 0 && (
                            <div className="px-3 py-2.5 text-[10px] text-muted-foreground italic">
                              Nenhum cliente encontrado — digite o nome para criar sem cadastro.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                      Telefone
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                      <input
                        type="tel"
                        placeholder="(11) 99999-9999"
                        value={telefoneCliente}
                        onChange={(e) => {
                          setTelefoneCliente(e.target.value);
                          setClienteIdSelecionado(null);
                        }}
                        className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-md text-xs focus:outline-none focus:border-primary text-foreground font-medium"
                      />
                    </div>
                  </div>
                </div>

                <label className="flex items-start gap-2 p-3 bg-background border border-border rounded-md cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={criarConta}
                    onChange={(e) => setCriarConta(e.target.checked)}
                    className="mt-0.5 accent-primary cursor-pointer"
                  />
                  <span>
                    <span className="block text-xs font-bold text-foreground">Criar acesso de login para o cliente</span>
                    <span className="block text-[10px] text-muted-foreground italic mt-0.5">
                      O cliente entra no site com o telefone e a senha padrão <span className="font-semibold not-italic text-primary">{SENHA_PADRAO}</span> (pode trocar depois em “Esqueci minha senha”).
                    </span>
                  </span>
                </label>

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
                    className="w-full p-2.5 bg-background border border-border rounded-md text-xs focus:outline-none focus:border-primary text-foreground font-semibold cursor-pointer"
                  >
                    <option value="" className="bg-card text-foreground" disabled>
                      Selecione o barbeiro...
                    </option>
                    {profissionais.filter(p => p.ativo !== false).map(p => (
                      <option key={p.id} value={p.id} className="bg-card text-foreground">
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    Serviço *
                  </label>
                  {selectedServices.length > 0 && (
                    <span className="text-[11px] font-bold text-primary">
                      {formatBRL(totalPreco)}
                      {totalDuracao > 0 && (
                        <em className="font-semibold text-muted-foreground"> · {totalDuracao} min</em>
                      )}
                    </span>
                  )}
                </div>
                {services.length === 0 ? (
                  <div className="p-3 bg-background border border-border rounded-md text-xs text-muted-foreground text-center">
                    Nenhum serviço disponível. Cadastre em “Serviços CRUD” antes de agendar.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {services.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectService(s.id)}
                        className={`p-3 rounded-md border text-left text-xs transition cursor-pointer ${
                          selectedServices[0]?.id === s.id
                            ? 'bg-primary/15 border-primary text-primary font-bold shadow-sm'
                            : 'bg-background border-border text-foreground hover:bg-accent'
                        }`}
                      >
                        <span className="block font-bold">{s.nome}</span>
                        <span className="block text-[10px] text-muted-foreground mt-0.5">
                          {formatBRL(s.preco)} · {s.duracao_minutos} min
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Selecione o Dia no Calendário *
                </label>
                <div className="p-4 bg-background border border-border rounded-lg space-y-3">
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

                  <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted-foreground uppercase">
                    {DAYS_SHORT.map((day, idx) => (
                      <div key={idx} className="py-1">{day}</div>
                    ))}
                  </div>

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
            )}

            {step === 4 && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" /> Horários Livres *
                </label>
                {loadingSlots ? (
                  <div className="p-4 border border-border rounded-lg bg-background text-center text-xs text-muted-foreground italic animate-pulse">
                    Consultando banco de dados...
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="p-4 border border-border rounded-lg bg-background text-center text-xs text-muted-foreground">
                    {selectedServices.length === 0
                      ? 'Escolha o serviço para calcular os horários livres.'
                      : 'Nenhum horário livre para este dia. Tente outro dia.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 p-3 bg-background border border-border rounded-lg">
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
            )}

            {step === 5 && (
              <div className="space-y-4">
                <div className="p-4 bg-background border border-border rounded-lg space-y-2 text-xs">
                  <div className="text-xs uppercase tracking-widest text-primary font-bold mb-1.5">Revisão do agendamento</div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Cliente</span><span className="font-bold text-right">{nomeCliente}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Telefone</span><span className="font-bold text-right">{telefoneCliente}</span></div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Barbeiro</span>
                    <span className="font-bold text-right">{profissionais.find(p => p.id === selectedProfissionalId)?.nome || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Serviço</span><span className="font-bold text-right">{selectedServices.map(s => s.nome).join(' + ')}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Dia</span><span className="font-bold text-right">{selectedDate.split('-').reverse().join('/')}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Horário</span><span className="font-bold text-right">{selectedSlot}h</span></div>
                  <div className="flex justify-between gap-3 border-t border-border pt-2">
                    <span className="text-muted-foreground">Valor</span>
                    <span className="font-bold text-primary text-sm">{formatBRL(totalPreco)}</span>
                  </div>
                  {criarConta && (
                    <div className="flex items-start gap-1.5 pt-1 text-[10px] text-sky-700 dark:text-sky-300 italic">
                      <KeyRound className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      Será criada conta de acesso (senha {SENHA_PADRAO}) para o cliente.
                    </div>
                  )}
                </div>

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
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border bg-card p-4 sm:px-6 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => (step > 1 ? setStep(s => s - 1) : onClose())}
              className="px-4 py-2 border border-border rounded-md text-xs font-bold hover:bg-muted text-muted-foreground cursor-pointer flex items-center gap-1.5"
            >
              {step > 1 ? <><ChevronLeft className="w-3.5 h-3.5" /> Voltar</> : 'Cancelar'}
            </button>
            {step < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canAdvance}
                className="px-5 py-2 bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider rounded-md shadow-md hover:bg-primary/90 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                Avançar <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider rounded-md shadow-md hover:bg-primary/90 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {submitting ? 'Salvando...' : <>Salvar Agendamento <CheckCircle className="w-4 h-4" /></>}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
