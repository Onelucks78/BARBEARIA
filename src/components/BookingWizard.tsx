import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, User, Phone, CheckCircle, ArrowRight, ArrowLeft, Scissors, Printer, FileText, X } from 'lucide-react';
import { Servico } from '../types.ts';
import { signInWithGoogle } from '../lib/useAdminSession.ts';

interface BookingWizardProps {
  services: Servico[];
  onBookingSuccess: () => void;
  loggedClient: {
    nome: string;
    email: string;
    telefone: string;
    foto_url?: string;
    observacoes?: string;
  } | null;
  onClientLogin: (client: any) => void;
}

interface SlotState {
  horario: string;
  disponivel: boolean;
  motivo?: 'ocupado' | 'intervalo' | 'bloqueado';
}

export default function BookingWizard({ 
  services, 
  onBookingSuccess,
  loggedClient,
  onClientLogin
}: BookingWizardProps) {
  const isVip = React.useMemo(() => {
    if (loggedClient?.observacoes) {
      try {
        if (loggedClient.observacoes.trim().startsWith('{')) {
          const parsed = JSON.parse(loggedClient.observacoes);
          return parsed.subscription?.status === 'ativo';
        }
      } catch {}
    }
    return false;
  }, [loggedClient]);

  const isServiceEligibleForVip = (nome: string) => {
    const n = nome.toLowerCase();
    const isSpecial = n.includes('pintura') || n.includes('selagem') || n.includes('progressiva') || n.includes('quimica') || n.includes('luzes') || n.includes('colora');
    const isEligible = n.includes('corte') || n.includes('cabelo') || n.includes('barba') || n.includes('sobrancelha');
    return isEligible && !isSpecial;
  };

  const getServicePrice = (s: Servico) => {
    if (isVip && isServiceEligibleForVip(s.nome)) {
      return 0;
    }
    return s.preco;
  };

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<Servico[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<SlotState[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [observacao, setObservacao] = useState('');
  
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successBooking, setSuccessBooking] = useState<any>(null);

  const [currentCalendarMonth, setCurrentCalendarMonth] = useState<number>(new Date().getMonth());
  const [currentCalendarYear, setCurrentCalendarYear] = useState<number>(new Date().getFullYear());

  // Google authentication states
  const [showGoogleLoginPopup, setShowGoogleLoginPopup] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const MONTHS_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay(); // 0 is Sunday, 6 is Saturday
  };

  const handlePrevMonth = () => {
    const today = new Date();
    const minMonth = today.getMonth();
    const minYear = today.getFullYear();
    
    if (currentCalendarYear > minYear || (currentCalendarYear === minYear && currentCalendarMonth > minMonth)) {
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

  const isDateInPast = (day: number, month: number, year: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateToCheck = new Date(year, month, day);
    return dateToCheck < today;
  };

  const handleSelectDay = (day: number) => {
    const yyyy = currentCalendarYear;
    const mm = String(currentCalendarMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  // Generate calendar grid structure dynamically
  const firstDayIndex = getFirstDayOfMonth(currentCalendarMonth, currentCalendarYear);
  const totalDays = getDaysInMonth(currentCalendarMonth, currentCalendarYear);
  const calendarCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    calendarCells.push(d);
  }

  // Sync calendar picker month view
  useEffect(() => {
    if (selectedDate) {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (y !== currentCalendarYear || m !== currentCalendarMonth) {
          setCurrentCalendarMonth(m);
          setCurrentCalendarYear(y);
        }
      }
    }
  }, [selectedDate]);

  // Set default date to today
  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  // Fetch free slots on-the-fly when date or services changes
  useEffect(() => {
    if (selectedServices.length > 0 && selectedDate) {
      setLoadingSlots(true);
      setErrorMsg('');
      const servicesIdParam = selectedServices.map(s => s.id).join(',');
      fetch(`/api/horarios-livres?data=${selectedDate}&servico_id=${servicesIdParam}&all=true`)
        .then((res) => {
          if (!res.ok) throw new Error('Falha ao buscar horários.');
          return res.json();
        })
        .then((data) => {
          setAvailableSlots(data);
          setSelectedSlot(''); // reset slot
        })
        .catch((err) => {
          console.error(err);
          setErrorMsg('Não foi possível carregar os horários para esta data.');
        })
        .finally(() => setLoadingSlots(false));
    }
  }, [selectedServices, selectedDate]);

  // Prefill name & phone from Google account profile in step 4
  useEffect(() => {
    if (loggedClient) {
      setNomeCliente(loggedClient.nome || '');
      setTelefoneCliente(loggedClient.telefone || '');
    }
  }, [loggedClient]);

  // Listen to hashchange to open mobile full-screen wizard and register selectBarberService helper
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#agendar-sessao' || hash === '#agendar-sessao-teaser') {
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
          setIsMobileOpen(true);
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    // Register simple window helper for direct service clicks
    (window as any).selectBarberService = (s: Servico) => {
      setSelectedServices([s]);
      
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        setIsMobileOpen(true);
      }
      
      setStep(1); // Reset to services step with preselected service, but let user see it
      
      const element = document.getElementById('agendar-sessao');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      delete (window as any).selectBarberService;
    };
  }, [services]);

  // Scroll to top of content of active step when step changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [step]);

  const handleCloseMobileWizard = () => {
    setIsMobileOpen(false);
    if (window.location.hash === '#agendar-sessao' || window.location.hash === '#agendar-sessao-teaser') {
      window.history.pushState("", document.title, window.location.pathname + window.location.search);
    }
  };

  const handleNextStep = () => {
    if (step === 1 && selectedServices.length === 0) {
      setErrorMsg('Por favor, selecione pelo menos um serviço para continuar.');
      return;
    }
    // Intercept with google login popup if guest is booking and not signed in
    if (step === 1 && !loggedClient) {
      setShowGoogleLoginPopup(true);
      return;
    }
    if (step === 2 && !selectedDate) {
      setErrorMsg('Por favor, selecione uma data válida.');
      return;
    }
    if (step === 3 && !selectedSlot) {
      setErrorMsg('Por favor, selecione um horário disponível.');
      return;
    }
    
    setErrorMsg('');
    setStep((prev) => prev + 1);
  };

  const handleBackStep = () => {
    setErrorMsg('');
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleToggleService = (s: Servico) => {
    setSelectedServices(prev => {
      const exists = prev.some(item => item.id === s.id);
      if (exists) {
        return prev.filter(item => item.id !== s.id);
      } else {
        return [...prev, s];
      }
    });
    setSelectedSlot('');
    setErrorMsg('');
  };

  const handleBookNow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCliente || !telefoneCliente) {
      setErrorMsg('Nome e telefone são campos fundamentais para o agendamento.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const servicesIdParam = selectedServices.map(s => s.id).join(',');
      const response = await fetch('/api/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          servico_id: servicesIdParam,
          data: selectedDate,
          horario: selectedSlot,
          nome_cliente: nomeCliente,
          telefone_cliente: telefoneCliente,
          observacao,
          cliente_email: loggedClient?.email || undefined
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Não foi possível confirmar o agendamento.');
      }

      setSuccessBooking(resData);
      setStep(5);
      onBookingSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado na reserva.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setSelectedServices([]);
    setSelectedSlot('');
    setNomeCliente('');
    setTelefoneCliente('');
    setObservacao('');
    setSuccessBooking(null);
  };

  const getWeekDayName = (dateStr: string) => {
    if (!dateStr) return '';
    const dateObj = new Date(`${dateStr}T12:00:00`);
    return dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
  };

  // Formatter for currency
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handlePrintPDF = () => {
    if (!successBooking) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Comprovante - ${successBooking.id}</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                background-color: #ffffff;
                color: #1c1917;
                padding: 40px 24px;
                max-width: 420px;
                margin: 0 auto;
                border: 1px solid #e7e5e4;
                border-radius: 4px;
              }
              .header {
                text-align: center;
                border-bottom: 2px solid #c5a059;
                padding-bottom: 16px;
                margin-bottom: 20px;
              }
              .header h1 {
                font-family: Georgia, serif;
                font-size: 22px;
                font-style: ;
                margin: 0 0 4px 0;
                color: #0c0a09;
                font-weight: normal;
              }
              .header p {
                font-size: 10px;
                color: #78716c;
                margin: 0;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                font-weight: bold;
              }
              .voucher-id {
                font-family: monospace;
                text-align: center;
                font-size: 13px;
                font-weight: bold;
                background: #fafaf9;
                border: 1px dashed #d6b472;
                padding: 8px;
                margin-bottom: 24px;
                color: #c5a059;
                border-radius: 2px;
              }
              .details {
                font-size: 13px;
                line-height: 1.5;
              }
              .row {
                display: flex;
                justify-content: space-between;
                border-bottom: 1px solid #f5f5f4;
                padding: 8px 0;
              }
              .label {
                color: #78716c;
              }
              .value {
                font-weight: 600;
                color: #1c1917;
              }
              .total {
                border-top: 1.5px solid #1c1917;
                border-bottom: none;
                padding-top: 12px;
                font-size: 14px;
                margin-top: 8px;
              }
              .footer {
                text-align: center;
                margin-top: 32px;
                font-size: 11px;
                color: #a8a29e;
                font-style: ;
                line-height: 1.4;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Detalhe Barbearia</h1>
              <p>Comprovante de Agendamento</p>
            </div>
            <div class="voucher-id">VOUCHER: ${successBooking.id}</div>
            <div class="details">
              <div class="row">
                <span class="label">Cliente:</span>
                <span class="value">${nomeCliente}</span>
              </div>
              <div class="row">
                <span class="label">Profissional:</span>
                <span class="value">Emerson Santiago</span>
              </div>
              <div class="row">
                <span class="label">Serviços:</span>
                <span class="value" style="text-align: right; max-width: 220px;">${selectedServices.map(s => s.nome).join(' + ')}</span>
              </div>
              <div class="row">
                <span class="label">Quando:</span>
                <span class="value">${selectedDate.split('-').reverse().join('/')} às ${selectedSlot}h</span>
              </div>
              <div class="row">
                <span class="label">Duração:</span>
                <span class="value">${totalDuracao} minutos</span>
              </div>
              <div class="row total">
                <span class="label" style="font-weight: bold; color: #1c1917;">Valor total:</span>
                <span class="value" style="color: #c5a059; font-size: 16px;">${formatBRL(totalPreco)}</span>
              </div>
            </div>
            <div class="footer">
              Agradecemos a sua preferência.<br>Nos vemos em livre na Detalhe Barbearia.
            </div>
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      window.print();
    }
  };

  const totalPreco = selectedServices.reduce((sum, s) => sum + getServicePrice(s), 0);
  const totalDuracao = selectedServices.reduce((sum, s) => sum + s.duracao_minutos, 0);

  return (
    <>
      {/* 1. TEASER BANNER FOR MOBILE ONLY when wizard is closed */}
      {!isMobileOpen && (
        <div className="md:hidden text-center max-w-sm mx-auto px-4" id="agendar-sessao-teaser">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="w-full bg-primary hover:bg-primary/80 text-black text-xs font-bold uppercase tracking-widest py-4 rounded-sm shadow-xl cursor-pointer flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Calendar className="w-4 h-4 text-black animate-pulse" /> Iniciar Agendamento Online
          </button>
        </div>
      )}

      {/* 2. THE MAIN WIZARD CONTAINER */}
      <div
        id="agendar-sessao"
        style={{ scrollMarginTop: '120px' }}
        className={`text-slate-900 transition-all duration-300 md:relative md:inset-auto md:z-0 md:flex md:flex-col md:h-auto md:w-full bg-white border border-primary/20 md:rounded-xl md:shadow-2xl md:overflow-hidden ${
          isMobileOpen
            ? 'max-md:fixed max-md:inset-0 max-md:z-[100] max-md:bg-white max-md:flex max-md:flex-col md:h-auto md:w-screen md:overflow-hidden'
            : 'max-md:hidden md:flex flex-col'
        }`}
      >
        {/* Header Info */}
        <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="text-left">
            <h3 className="text-base sm:text-lg font-normal tracking-wide text-slate-900">Agendar Horário Online</h3>
            <p className="text-slate-500 text-xs sm:text-xs mt-0.5 sm:mt-1 leading-tight text-left">Escolha seus serviços, marque o melhor dia e defina o horário</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden xs:flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/25 text-xs sm:text-xs uppercase tracking-wider shrink-0 font-bold">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
              {step === 5 ? 'Concluído' : `Etapa ${step} de 4`}
            </div>
            
            {/* Close Button on Mobile Full Screen */}
            {isMobileOpen && (
              <button
                type="button"
                onClick={handleCloseMobileWizard}
                className="md:hidden w-8 h-8 rounded-md border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition cursor-pointer shrink-0"
                title="Fechar agendamento"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {step < 5 && (
          <div className="w-full bg-slate-100 h-1 shrink-0">
            <div 
              className="bg-gradient-to-r from-primary to-primary/70 h-full transition-all duration-300" 
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        )}

        <div 
          ref={contentRef}
          className="flex-1 overflow-y-auto overscroll-contain p-4 xs:p-5 sm:p-6 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent space-y-4"
        >
        {errorMsg && (
          <div className="mb-4 p-3.5 bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-sm text-xs flex items-center gap-2">
            <span className="font-bold uppercase text-xs tracking-wider bg-red-100 dark:bg-red-900/30 px-1 py-0.5 rounded-sm">Aviso:</span> {errorMsg}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-3 mb-4">
                  <p className="text-xs text-slate-500 text-left">Selecione seu corte</p>
                </div>
                
                {/* Scrollable Container with Subtle Styled Native Scrollbar */}
                <div className="max-md:h-auto max-md:max-h-none h-[210px] xs:h-[250px] sm:h-[310px] md:h-[400px] md:max-h-[48vh] overflow-y-auto overscroll-contain pr-1.5 space-y-3 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(Array.isArray(services) ? services : []).map((s) => {
                      const isSelected = selectedServices.some(item => item.id === s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleToggleService(s)}
                          className={`text-left p-5 rounded-md border transition-all duration-300 relative flex flex-col justify-between cursor-pointer group/card ${
                            isSelected 
                              ? 'bg-primary/15 border-primary shadow-md shadow-primary/20' 
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                          }`}
                        >
                          <div className="w-full">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-2 group-hover/card:text-primary transition-colors">
                                <Scissors className="w-3.5 h-3.5 text-primary shrink-0" />
                                {s.nome}
                              </h4>
                              <span className="text-xs font-bold text-primary text-gold-glow">
                                {getServicePrice(s) === 0 ? (
                                  <span className="text-xs uppercase bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded-sm font-bold tracking-wider animate-pulse">Grátis (VIP)</span>
                                ) : (
                                  formatBRL(s.preco)
                                )}
                              </span>
                            </div>
                            <p className="text-slate-600 text-xs mt-1.5 leading-relaxed font-light">
                              {s.descricao}
                            </p>
                          </div>
                          
                          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs uppercase tracking-wider text-slate-500 w-full">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {s.duracao_minutos} minutos
                            </span>
                            <div className="flex items-center gap-1.5">
                              {isSelected ? (
                                <span className="bg-primary text-primary-foreground rounded-md px-2 py-0.5 text-xs font-black flex items-center gap-0.5">
                                  ✓ Selecionado
                                </span>
                              ) : (
                                <span className="text-slate-500 group-hover/card:text-slate-700 transition text-xs font-bold">
                                  + Adicionar
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Desktop-only Total Summary Footer inside selection step */}
              <div className="hidden md:block space-y-4 mt-6">
                {selectedServices.length > 0 && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between text-xs text-slate-700">
                    <span className="text-slate-500 text-xs uppercase">Pacote Selecionado:</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">{totalDuracao} min</span>
                      <span className="text-primary font-bold font-sans text-sm">{formatBRL(totalPreco)}</span>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={selectedServices.length === 0}
                    className="bg-gradient-to-r from-primary to-primary/70 hover:from-primary/80 hover:to-primary text-black disabled:opacity-50 text-xs uppercase tracking-widest font-black px-6 py-3.5 rounded-md flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary/10 transition-all duration-300 hover:scale-105 active:scale-95"
                  >
                    Continuar <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div>
                <p className="text-xs text-slate-500 mb-3 text-left">Escolha seu dia</p>
                {/* Dynamically expand to full-width of the wizard card with negative margin */}
                <div className="bg-slate-50/80 border-y border-slate-200 -mx-3 xs:-mx-5 sm:-mx-6 px-3 xs:px-5 sm:px-6 py-4 md:py-6 space-y-4 shadow-inner w-auto">
                  {/* Calendar Month Selector Header */}
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-2 rounded-md hover:bg-accent border border-slate-200 hover:border-slate-200 hover:text-primary transition-all text-slate-500 cursor-pointer text-xs font-bold"
                      title="Mês Anterior"
                    >
                      &larr;
                    </button>
                    <span className="text-sm text-primary font-semibold tracking-wide text-gold-glow">
                      {MONTHS_PT[currentCalendarMonth]} {currentCalendarYear}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-2 rounded-md hover:bg-accent border border-slate-200 hover:border-slate-200 hover:text-primary transition-all text-slate-500 cursor-pointer text-xs font-bold"
                      title="Próximo Mês"
                    >
                      &rarr;
                    </button>
                  </div>

                  {/* Days of the Week Header */}
                  <div className="grid grid-cols-7 gap-1 text-center font-sans text-xs font-bold tracking-widest uppercase text-slate-500">
                    {DAYS_SHORT.map((day, idx) => (
                      <div key={idx} className="py-1">{day}</div>
                    ))}
                  </div>

                  {/* Calendar Grid Cells with proportional wide sizing instead of aspect-square */}
                  <div className="grid grid-cols-7 gap-1.5 text-center">
                    {calendarCells.map((cell, idx) => {
                      if (cell === null) {
                        return <div key={`empty-${idx}`} />;
                      }
                      
                      const isPast = isDateInPast(cell, currentCalendarMonth, currentCalendarYear);
                      
                      // Construct date string YYYY-MM-DD
                      const cellDateStr = `${currentCalendarYear}-${String(currentCalendarMonth + 1).padStart(2, '0')}-${String(cell).padStart(2, '0')}`;
                      const isSelected = selectedDate === cellDateStr;
                      
                      const today = new Date();
                      const isToday = today.getDate() === cell && 
                                      today.getMonth() === currentCalendarMonth && 
                                      today.getFullYear() === currentCalendarYear;

                      return (
                        <button
                          key={`day-${cell}`}
                          type="button"
                          disabled={isPast}
                          onClick={() => handleSelectDay(cell)}
                          className={`w-full py-3 md:py-5 text-xs font-sans rounded-md transition-all flex flex-col items-center justify-center relative cursor-pointer group/day ${
                            isSelected
                              ? 'bg-primary/15 border border-primary shadow-md shadow-primary/20 scale-105 z-10'
                              : isPast
                                ? 'text-slate-400 font-normal line-through opacity-50 cursor-not-allowed'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                          }`}
                        >
                          <span>{cell}</span>
                          {isToday && !isSelected && (
                            <span className="absolute bottom-1.5 w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>


              </div>

              {/* Desktop-only Footer inside step 2 */}
              <div className="hidden md:block space-y-4 mt-6">
                {selectedServices.length > 0 && (
                  <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-1 text-slate-700 leading-normal">
                    <span className="text-slate-500 text-xs uppercase">Serviços Escolhidos:</span>
                    <span className="font-semibold text-slate-900 text-right ml-auto">
                      {selectedServices.map(s => s.nome).join(' + ')} ({totalDuracao}min)
                    </span>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200 flex flex-row items-center justify-between gap-3 w-full">
                  <button
                    type="button"
                    onClick={handleBackStep}
                    className="flex-1 md:flex-none border border-slate-200 text-slate-500 hover:bg-accent hover:text-slate-900 text-xs uppercase tracking-wider font-bold py-3.5 md:px-6 rounded-md flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={!selectedDate}
                    className="flex-1 md:flex-none bg-gradient-to-r from-primary to-primary/70 hover:from-primary/80 hover:to-primary text-black disabled:opacity-50 text-xs uppercase tracking-widest font-black py-3.5 md:px-6 rounded-md flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary/10 transition-all duration-300 hover:scale-105 active:scale-95"
                  >
                    Continuar <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div>
                <p className="text-xs text-slate-500 mb-3 text-left">Selecione o seu horário</p>

                {loadingSlots ? (
                  <div className="py-12 text-center space-y-3 bg-slate-50 rounded-sm border border-slate-200">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Buscando horários livres com o barbeiro...</p>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="py-8 bg-slate-100 border border-border/80 p-5 rounded-sm text-center">
                    <p className="text-xs text-primary leading-relaxed">
                      Lamentamos, mas não há horários de expediente livres para esta data. <br />
                      Isso pode ocorrer devido ao domingo de folga, bloqueios (férias, cursos) ou agenda cheia desse dia.
                    </p>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mt-3">Dica: Tente escolher outro dia ou fale conosco.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                      {availableSlots.map((slotObj) => {
                        const isSelected = selectedSlot === slotObj.horario;
                        const isFree = slotObj.disponivel;
                        
                        return (
                          <button
                            key={slotObj.horario}
                            type="button"
                            disabled={!isFree}
                            onClick={() => {
                              if (isFree) {
                                setSelectedSlot(slotObj.horario);
                                setErrorMsg('');
                              }
                            }}
                            className={`py-3 px-2.5 rounded-md border text-xs font-sans font-bold transition-all duration-200 relative flex flex-col items-center justify-center cursor-pointer ${
                              isSelected
                                ? 'bg-primary/15 border-primary shadow-md shadow-primary/20 scale-[1.04] z-10'
                                : isFree
                                  ? 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                                  : slotObj.motivo === 'ocupado'
                                    ? 'bg-red-100 dark:bg-red-950/5 text-muted-foreground border-red-200 dark:border-red-950/15 line-through cursor-not-allowed opacity-40'
                                    : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-30'
                            }`}
                          >
                            <span className="font-semibold">{slotObj.horario}</span>
                            {!isFree && (
                              <span className="text-xs tracking-tight uppercase font-sans mt-0.5 opacity-80 block truncate text-muted-foreground">
                                {slotObj.motivo === 'ocupado' ? 'Reservado' : slotObj.motivo === 'intervalo' ? 'Intervalo' : 'Bloqueado'}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>


                  </div>
                )}
              </div>

              {/* Desktop-only Footer inside step 3 */}
              <div className="hidden md:block space-y-4 mt-6">
                {selectedServices.length > 0 && selectedDate && (
                  <div className="bg-slate-50 p-3.5 rounded-sm border border-slate-200 text-xs space-y-1.5">
                    <div className="flex justify-between md:items-center flex-col md:flex-row gap-1">
                      <span className="text-slate-500 text-xs uppercase">Serviços Selecionados:</span>
                      <span className="font-semibold text-slate-900">{selectedServices.map(s => s.nome).join(' + ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-xs uppercase">Data selecionada:</span>
                      <span className="font-semibold text-slate-900 capitalize">{getWeekDayName(selectedDate)} ({selectedDate.split('-').reverse().join('/')})</span>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-border/80 flex flex-row items-center justify-between gap-3 w-full">
                  <button
                    type="button"
                    onClick={handleBackStep}
                    className="flex-1 md:flex-none border border-border text-slate-500 hover:bg-accent hover:text-slate-900 text-xs uppercase tracking-wider font-bold py-3 md:px-5 rounded-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={!selectedSlot}
                    className="flex-1 md:flex-none bg-primary hover:bg-primary/80 text-black disabled:opacity-50 text-xs uppercase tracking-widest font-bold py-3 md:px-5 rounded-sm flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    Continuar <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <form id="booking-wizard-form" onSubmit={handleBookNow} className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 mb-3 text-left">Preencha seus dados</p>
                  
                  <div className="space-y-3.5">
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                      <input
                        type="text"
                        placeholder="Nome Completo"
                        required
                        value={nomeCliente}
                        onChange={(e) => setNomeCliente(e.target.value)}
                        className="w-full pl-10 pr-4 py-3.5 bg-white border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary text-slate-900 placeholder:text-slate-400 transition"
                      />
                    </div>

                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                      <input
                        type="tel"
                        placeholder="Telefone / Celular (Ex: 11 98765-4321)"
                        required
                        value={telefoneCliente}
                        onChange={(e) => setTelefoneCliente(e.target.value)}
                        className="w-full pl-10 pr-4 py-3.5 bg-white border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary text-slate-900 placeholder:text-slate-400 transition"
                      />
                    </div>

                    <div>
                      <textarea
                        placeholder="Observações ou solicitações especiais (opcional)"
                        rows={2}
                        value={observacao}
                        onChange={(e) => setObservacao(e.target.value)}
                        className="w-full p-3.5 bg-white border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary text-slate-900 placeholder:text-slate-400 transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Booking Summary Box */}
                <div className="bg-slate-50 p-5 rounded-md border border-slate-200 text-xs space-y-3.5 shadow-md">
                  <h5 className="font-bold text-primary text-xs tracking-widest uppercase">Resumo da Reserva:</h5>
                  <div className="grid grid-cols-2 gap-y-2.5 text-slate-500">
                    <div>Serviços Selecionados:</div>
                    <div className="font-semibold text-right text-slate-900">{selectedServices.map(s => s.nome).join(' + ')}</div>
                    
                    <div>Duração Total:</div>
                    <div className="font-semibold text-right text-slate-900">{totalDuracao} minutos</div>

                    <div>Data:</div>
                    <div className="font-semibold text-right text-slate-900">{selectedDate.split('-').reverse().join('/')}</div>

                    <div>Horário:</div>
                    <div className="font-semibold text-right text-primary text-sm">{selectedSlot}h</div>

                    <div className="pt-2.5 border-t border-slate-200 font-bold text-primary uppercase tracking-wider text-xs">Preço Total:</div>
                    <div className="pt-2.5 border-t border-slate-200 text-right font-bold text-primary text-lg text-gold-glow">
                      {formatBRL(totalPreco)}
                    </div>
                  </div>
                </div>

                <div className="hidden md:block pt-4 border-t border-slate-200">
                  <div className="flex flex-row items-center justify-between gap-3 w-full">
                    <button
                      type="button"
                      onClick={handleBackStep}
                      disabled={submitting}
                      className="flex-1 md:flex-none border border-slate-200 text-slate-500 hover:bg-accent hover:text-slate-900 text-xs uppercase tracking-wider font-bold py-3.5 md:px-6 rounded-md flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 md:flex-none bg-gradient-to-r from-primary to-primary/70 hover:from-primary/80 hover:to-primary text-black disabled:opacity-50 text-xs uppercase tracking-widest font-black py-3.5 md:px-6 rounded-md flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary/10 transition-all duration-300 hover:scale-105 active:scale-95"
                    >
                      {submitting ? (
                        <>Reservando...</>
                      ) : (
                        <>
                          Confirmar & Agendar <CheckCircle className="w-3.5 h-3.5 text-black" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </form>
            </motion.div>
          )}

          {step === 5 && successBooking && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6 space-y-5 animate-fade-in"
            >
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/30 rounded-md flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto border border-emerald-200 dark:border-emerald-900/50 shadow-lg animate-bounce">
                <CheckCircle className="w-6 h-6" />
              </div>
              
              <div className="space-y-1.5">
                <h4 className="text-xl font-normal text-slate-900 tracking-wide text-gold-glow">Agendamento Confirmado!</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Perfeito, {nomeCliente}! Seu compromisso com o barbeiro foi agendado de forma definitiva no sistema.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-5 rounded-lg max-w-sm mx-auto text-xs space-y-2.5 text-left shadow-md">
                <div className="text-xs uppercase tracking-widest text-primary font-bold mb-1.5">Detalhes do Voucher:</div>
                <div className="flex justify-between border-b border-slate-200/40 pb-1.5"><span className="text-slate-500">Código:</span> <span className="font-bold text-primary">{successBooking.id}</span></div>
                <div className="flex justify-between border-b border-slate-200/40 pb-1.5"><span className="text-slate-500">Cliente:</span> <span className="font-semibold text-slate-900">{nomeCliente}</span></div>
                <div className="flex justify-between border-b border-slate-200/40 pb-1.5"><span className="text-slate-500">Profissional:</span> <span className="font-semibold text-slate-900">Emerson Santiago</span></div>
                <div className="flex justify-between border-b border-slate-200/40 pb-1.5"><span className="text-slate-500">Serviços:</span> <span className="font-semibold text-slate-900 text-right max-w-[170px] break-words">{selectedServices.map(s => s.nome).join(' + ')}</span></div>
                <div className="flex justify-between border-b border-slate-200/40 pb-1.5"><span className="text-slate-500">Quando:</span> <span className="font-bold text-primary">{selectedDate.split('-').reverse().join('/')} às {selectedSlot}h</span></div>
                <div className="flex justify-between pb-0.5"><span className="text-slate-500">Duração Total:</span> <span className="font-semibold text-slate-900">{totalDuracao} minutos</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold"><span className="text-slate-500 text-xs">Valor fixado total:</span> <span className="font-bold text-primary text-base text-gold-glow">{formatBRL(totalPreco)}</span></div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handlePrintPDF}
                  className="w-full sm:w-auto bg-background hover:bg-background text-primary border border-slate-200 hover:border-slate-200 text-xs uppercase tracking-wider font-bold px-6 py-3.5 rounded-md transition duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-md"
                >
                  <Printer className="w-4 h-4 text-primary" /> Imprimir PDF
                </button>
                <button
                  type="button"
                  onClick={resetWizard}
                  className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/70 hover:from-primary/80 hover:to-primary text-black text-xs uppercase tracking-widest font-black px-6 py-3.5 rounded-md transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-primary/10 hover:scale-105 active:scale-95"
                >
                  Fazer outro agendamento
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

        {/* Global Wizard Navigation Footer (Always pinned at the bottom) */}
        {step < 5 && (
          <div className="md:hidden shrink-0 bg-slate-100/90 border-t border-slate-200/80 p-4 xs:p-5 sm:px-6 sm:py-5 space-y-3.5 z-20 backdrop-blur-md">
            {/* The Luxury Selected Services Banner */}
            {selectedServices.length > 0 && step < 4 && (
              <div className="p-4 bg-slate-50 border border-slate-200 text-slate-800 rounded-md">
                <span className="text-slate-500 text-xs uppercase tracking-wider block text-left">
                  SERVIÇOS ESCOLHIDOS:
                </span>
                <p className="text-primary text-xs sm:text-sm font-semibold tracking-wide text-left mt-1.5 leading-relaxed text-gold-glow">
                  {selectedServices.map(s => s.nome).join(' + ')} 
                  <span className="text-slate-500 font-sans text-xs ml-1.5">({totalDuracao}min)</span>
                  {selectedDate && (
                    <span className="text-slate-500 font-sans text-xs ml-1.5 capitalize border-l border-slate-200/40 pl-1.5">
                      | {selectedDate.split('-').reverse().join('/')}
                    </span>
                  )}
                  {selectedSlot && (
                    <span className="text-slate-700 text-xs ml-1.5 border-l border-slate-200/40 pl-1.5">
                      às {selectedSlot}h
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Back & Continue Buttons Row */}
            <div className="flex items-center justify-between gap-4">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBackStep}
                  disabled={step === 4 && submitting}
                  className="flex-1 border border-slate-200 text-slate-500 hover:bg-accent hover:text-white text-xs uppercase tracking-widest font-bold py-3.5 px-5 rounded-md flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                </button>
              )}
              <button
                type={step === 4 ? "submit" : "button"}
                form={step === 4 ? "booking-wizard-form" : undefined}
                onClick={step === 4 ? undefined : handleNextStep}
                disabled={
                  (step === 1 && selectedServices.length === 0) ||
                  (step === 2 && !selectedDate) ||
                  (step === 3 && !selectedSlot) ||
                  (step === 4 && submitting)
                }
                className="flex-1 bg-gradient-to-r from-primary to-primary/70 hover:from-primary/80 hover:to-primary text-black disabled:opacity-40 disabled:cursor-not-allowed text-xs uppercase tracking-widest font-black py-3.5 px-5 rounded-md flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-primary/10 transition duration-350 active:scale-95"
              >
                {step === 4 ? (
                  submitting ? 'Reservando...' : <>Confirmar & Agendar <CheckCircle className="w-3.5 h-3.5 text-black" /></>
                ) : (
                  <>Continuar <ArrowRight className="w-3.5 h-3.5" /></>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

    {/* Pop-up Google Account Login (Booking trigger) */}
    <AnimatePresence>
      {showGoogleLoginPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowGoogleLoginPopup(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          
          {/* Dialog Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative bg-card border border-border rounded-sm w-full max-w-sm p-6 text-center space-y-5 shadow-2xl overflow-hidden"
          >
            <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center mx-auto text-slate-700">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
              </svg>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-lg font-semibold text-slate-900 ">Identificação de Cliente</h4>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                Para selecionar o melhor dia e agendar seu horário, faça login com a sua conta do Google de forma simples e segura.
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                disabled={isGoogleLoading}
                onClick={async () => {
                  setIsGoogleLoading(true);
                  try {
                    // Login Google real via Supabase Auth
                    const { error } = await signInWithGoogle();
                    if (error) {
                      setErrorMsg(error.message || 'Falha no login com Google.');
                      return;
                    }
                    // signInWithOAuth redireciona — após o retorno,
                    // App.tsx atualiza loggedClient via onAuthStateChange.
                    setShowGoogleLoginPopup(false);
                    setStep(2);
                  } catch (err: any) {
                    setErrorMsg(err.message || 'Erro no login.');
                  } finally {
                    setIsGoogleLoading(false);
                  }
                }}
                className="w-full py-3 bg-slate-100 hover:bg-accent border border-slate-200 text-slate-900 text-xs font-bold uppercase tracking-widest rounded-sm transition cursor-pointer flex items-center justify-center gap-2 relative shadow-md"
              >
                {isGoogleLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0"></div>
                    Autenticando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                    </svg>
                    Entrar com o Google
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isGoogleLoading}
                onClick={() => setShowGoogleLoginPopup(false)}
                className="w-full py-2.5 text-xs uppercase font-bold tracking-wider text-muted-foreground hover:text-muted-foreground transition cursor-pointer"
              >
                Continuar sem login
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </>
  );
}
