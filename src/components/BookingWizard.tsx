import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, User, Phone, CheckCircle, ArrowRight, ArrowLeft, Scissors, Printer, FileText, X } from 'lucide-react';
import { Servico, Profissional } from '../types.ts';
import ClientAuthModal from './ClientAuthModal.tsx';
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
  popupMode?: boolean;
  onClosePopup?: () => void;
  preselectedService?: Servico | null;
}

interface SlotState {
  horario: string;
  disponivel: boolean;
  motivo?: 'ocupado' | 'intervalo' | 'bloqueado';
}

// MORPH-008: escape de HTML para o comprovante de impressão (document.write).
// Nome/serviços/profissional vêm de input do usuário ou do banco — sem escape,
// um nome como `<img src=x onerror=...>` executaria na janela de impressão.
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function BookingWizard({ 
  services, 
  onBookingSuccess,
  loggedClient,
  onClientLogin,
  popupMode = false,
  onClosePopup,
  preselectedService = null
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

  const clientPlan = React.useMemo(() => {
    if (loggedClient?.observacoes) {
      try {
        if (loggedClient.observacoes.trim().startsWith('{')) {
          const parsed = JSON.parse(loggedClient.observacoes);
          return (parsed.subscription?.plan || '').toLowerCase();
        }
      } catch {}
    }
    return '';
  }, [loggedClient]);

  // Espelha server/storage.ts (getPlanCategorias/getServiceCategorias/isServiceEligibleForPlan) —
  // preview client-side apenas; o preço cobrado de verdade é sempre calculado no servidor.
  const getPlanCategorias = (plan: string): string[] => {
    if (plan === 'exclusive') return ['corte', 'barba', 'sobrancelha', 'penteado'];
    if (plan === 'premium') return ['corte', 'barba'];
    if (plan === 'essential') return ['corte'];
    return [];
  };

  const getServiceCategorias = (nome: string): string[] => {
    const n = nome.toLowerCase();
    const isSpecial = n.includes('pintura') || n.includes('selagem') || n.includes('progressiva') || n.includes('quimica') || n.includes('luzes') || n.includes('colora');
    if (isSpecial) return [];
    const categorias: string[] = [];
    if (n.includes('corte') || n.includes('cabelo')) categorias.push('corte');
    if (n.includes('barba')) categorias.push('barba');
    if (n.includes('sobrancelha')) categorias.push('sobrancelha');
    if (n.includes('penteado')) categorias.push('penteado');
    return categorias;
  };

  const isServiceEligibleForPlan = (nome: string, plan: string) => {
    const categoriasServico = getServiceCategorias(nome);
    if (categoriasServico.length === 0) return false;
    const categoriasPlano = getPlanCategorias(plan);
    return categoriasServico.every(c => categoriasPlano.includes(c));
  };

  const getServicePrice = (s: Servico) => {
    if (isVip && isServiceEligibleForPlan(s.nome, clientPlan)) {
      return 0;
    }
    return s.preco;
  };

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<Servico[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [selectedProfissional, setSelectedProfissional] = useState<Profissional | null>(null);
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
  const [showTelefoneAuth, setShowTelefoneAuth] = useState(false);

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

  // Carrega os barbeiros da barbearia. Se só existe um, já deixa selecionado
  // para o cliente não ter que escolher numa lista de uma opção só.
  useEffect(() => {
    fetch('/api/profissionais')
      .then(res => res.ok ? res.json() : [])
      .then((data: Profissional[]) => {
        setProfissionais(data);
        if (data.length === 1) setSelectedProfissional(data[0]);
      })
      .catch(() => setProfissionais([]));
  }, []);

  // Fetch free slots on-the-fly when date, services or barber changes
  useEffect(() => {
    if (selectedServices.length > 0 && selectedDate && selectedProfissional) {
      setLoadingSlots(true);
      setErrorMsg('');
      const servicesIdParam = selectedServices.map(s => s.id).join(',');
      fetch(`/api/horarios-livres?data=${selectedDate}&servico_id=${servicesIdParam}&profissional_id=${selectedProfissional.id}&all=true`)
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
  }, [selectedServices, selectedDate, selectedProfissional]);

  // Prefill name & phone from Google account profile in step 4
  useEffect(() => {
    if (loggedClient) {
      setNomeCliente(loggedClient.nome || '');
      setTelefoneCliente(loggedClient.telefone || '');
    }
  }, [loggedClient]);

  // Auto-open mobile wizard on mount (popupMode)
  useEffect(() => {
    if (popupMode && window.innerWidth < 768) {
      setIsMobileOpen(true);
    }
  }, [popupMode]);

  // Auto-select preselectedService
  useEffect(() => {
    if (preselectedService) {
      setSelectedServices([preselectedService]);
      setStep(1);
    }
  }, [preselectedService]);

  // Listen to hashchange to open mobile full-screen wizard and register selectBarberService helper
  useEffect(() => {
    if (popupMode) return;

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
  }, [services, popupMode]);

  // Scroll to top of content of active step when step changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [step]);

  const handleCloseMobileWizard = () => {
    setIsMobileOpen(false);
    if (popupMode && onClosePopup) {
      resetWizard();
      onClosePopup();
      return;
    }
    if (window.location.hash === '#agendar-sessao' || window.location.hash === '#agendar-sessao-teaser') {
      window.history.pushState("", document.title, window.location.pathname + window.location.search);
    }
  };

  const handleNextStep = () => {
    if (step === 1 && selectedServices.length === 0) {
      setErrorMsg('Por favor, selecione pelo menos um serviço para continuar.');
      return;
    }
    if (step === 2 && !selectedProfissional) {
      setErrorMsg('Por favor, escolha com qual barbeiro você quer ser atendido.');
      return;
    }
    if (step === 3 && !selectedDate) {
      setErrorMsg('Por favor, selecione uma data válida.');
      return;
    }
    if (step === 4 && !selectedSlot) {
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

  const submitBooking = async (email?: string) => {
    setSubmitting(true);
    setErrorMsg('');

    try {
      const servicesIdParam = selectedServices.map(s => s.id).join(',');
      const response = await fetch('/api/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          servico_id: servicesIdParam,
          profissional_id: selectedProfissional?.id,
          data: selectedDate,
          horario: selectedSlot,
          nome_cliente: nomeCliente,
          telefone_cliente: telefoneCliente,
          observacao,
          cliente_email: email || undefined
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Não foi possível confirmar o agendamento.');
      }

      setSuccessBooking(resData);
      setStep(6);
      try { window.dispatchEvent(new CustomEvent('agendamento-criado')); } catch {}
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado na reserva.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookNow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCliente || !telefoneCliente) {
      setErrorMsg('Nome e telefone são campos fundamentais para o agendamento.');
      return;
    }

    if (loggedClient) {
      await submitBooking(loggedClient.email);
      return;
    }

    const servicesIdParam = selectedServices.map(s => s.id).join(',');
    localStorage.setItem('pending_booking', JSON.stringify({
      servico_id: servicesIdParam,
      profissional_id: selectedProfissional?.id,
      profissionalNome: selectedProfissional?.nome,
      data: selectedDate,
      horario: selectedSlot,
      nome_cliente: nomeCliente,
      telefone_cliente: telefoneCliente,
      observacao,
      servicesNames: selectedServices.map(s => s.nome),
      totalPreco,
      totalDuracao
    }));
    setShowGoogleLoginPopup(true);
  };

  const resetWizard = () => {
    setStep(1);
    setSelectedServices([]);
    // com um barbeiro só, mantém a escolha automática
    setSelectedProfissional(profissionais.length === 1 ? profissionais[0] : null);
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
            <title>Comprovante - ${esc(successBooking.id)}</title>
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
            <div class="voucher-id">VOUCHER: ${esc(successBooking.id)}</div>
            <div class="details">
              <div class="row">
                <span class="label">Cliente:</span>
                <span class="value">${esc(nomeCliente)}</span>
              </div>
              <div class="row">
                <span class="label">Profissional:</span>
                <span class="value">${esc(selectedProfissional?.nome ?? '-')}</span>
              </div>
              <div class="row">
                <span class="label">Serviços:</span>
                <span class="value" style="text-align: right; max-width: 220px;">${esc(selectedServices.map(s => s.nome).join(' + '))}</span>
              </div>
              <div class="row">
                <span class="label">Quando:</span>
                <span class="value">${esc(selectedDate.split('-').reverse().join('/'))} às ${esc(selectedSlot)}h</span>
              </div>
              <div class="row">
                <span class="label">Duração:</span>
                <span class="value">${esc(totalDuracao)} minutos</span>
              </div>
              <div class="row total">
                <span class="label" style="font-weight: bold; color: #1c1917;">Valor total:</span>
                <span class="value" style="color: #c5a059; font-size: 16px;">${esc(formatBRL(totalPreco))}</span>
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
      {/* 1. TEASER BANNER FOR MOBILE ONLY when wizard is closed - skip in popup mode */}
      {!popupMode && !isMobileOpen && (
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
        className={`text-slate-900 transition-all duration-300 bg-white border border-primary/20 md:rounded-xl md:shadow-2xl md:overflow-hidden ${
          popupMode
            ? 'flex flex-col h-full w-full overflow-hidden rounded-xl'
            : isMobileOpen
              ? 'max-md:fixed max-md:inset-0 max-md:z-[100] max-md:bg-white max-md:flex max-md:flex-col md:relative md:inset-auto md:z-0 md:flex md:flex-col md:h-auto md:w-full'
              : 'max-md:hidden md:flex flex-col md:relative md:inset-auto md:z-0 md:w-full'
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
              {step === 6 ? 'Concluído' : `Etapa ${step} de 5`}
            </div>
            
            {/* Close Button on Mobile Full Screen or Popup Mode */}
            {(isMobileOpen || popupMode) && (
              <button
                type="button"
                onClick={handleCloseMobileWizard}
                className={`${popupMode ? '' : 'md:hidden'} w-8 h-8 rounded-md border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition cursor-pointer shrink-0`}
                title="Fechar agendamento"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {step < 6 && (
          <div className="w-full bg-slate-100 h-1 shrink-0">
            <div 
              className="bg-gradient-to-r from-primary to-primary/70 h-full transition-all duration-300" 
              style={{ width: `${(step / 5) * 100}%` }}
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
                <div className="max-h-[45vh] sm:max-h-[380px] overflow-y-auto overscroll-contain pr-1.5 space-y-3 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
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


            </motion.div>
          )}

          {/* ETAPA 2 — escolha do barbeiro. Vem antes da data porque o
              horário livre depende de quem vai atender. */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-3 mb-4">
                  <p className="text-xs text-slate-500 text-left">Escolha seu barbeiro</p>
                </div>

                <div className="max-h-[45vh] sm:max-h-[380px] overflow-y-auto overscroll-contain pr-1.5 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                  {profissionais.length === 0 ? (
                    <p className="text-xs text-slate-500 py-8 text-center">
                      Nenhum barbeiro disponível no momento.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {profissionais.map((p) => {
                        const isSelected = selectedProfissional?.id === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedProfissional(p);
                              setSelectedSlot('');
                              setErrorMsg('');
                            }}
                            className={`text-left p-5 rounded-md border transition-all duration-300 relative flex items-start gap-4 cursor-pointer group/card ${
                              isSelected
                                ? 'bg-primary/15 border-primary shadow-md shadow-primary/20'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                            }`}
                          >
                            {p.avatar_url ? (
                              <img
                                src={p.avatar_url}
                                alt={p.nome}
                                className="w-14 h-14 rounded-md object-cover shrink-0 border border-slate-200"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-md bg-slate-200 flex items-center justify-center shrink-0">
                                <User className="w-6 h-6 text-slate-400" />
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-slate-900 text-sm group-hover/card:text-primary transition-colors">
                                {p.nome}
                              </h4>
                              {p.bio && (
                                <p className="text-slate-600 text-xs mt-1.5 leading-relaxed font-light line-clamp-3">
                                  {p.bio}
                                </p>
                              )}
                              <div className="mt-3 pt-3 border-t border-slate-200 text-xs uppercase tracking-wider">
                                {isSelected ? (
                                  <span className="bg-primary text-primary-foreground rounded-md px-2 py-0.5 text-xs font-black">
                                    ✓ Selecionado
                                  </span>
                                ) : (
                                  <span className="text-slate-500 group-hover/card:text-slate-700 transition text-xs font-bold">
                                    Escolher
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
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



            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
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



            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="step5"
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

                    <div>Barbeiro:</div>
                    <div className="font-semibold text-right text-slate-900">{selectedProfissional?.nome ?? '—'}</div>

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



              </form>
            </motion.div>
          )}

          {step === 6 && successBooking && (
            <motion.div
              key="step6"
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
                <div className="flex justify-between border-b border-slate-200/40 pb-1.5"><span className="text-slate-500">Código:</span> <span className="font-bold text-primary">{successBooking.codigo || successBooking.id}</span></div>
                <div className="flex justify-between border-b border-slate-200/40 pb-1.5"><span className="text-slate-500">Cliente:</span> <span className="font-semibold text-slate-900">{nomeCliente}</span></div>
                <div className="flex justify-between border-b border-slate-200/40 pb-1.5"><span className="text-slate-500">Profissional:</span> <span className="font-semibold text-slate-900">{selectedProfissional?.nome ?? '—'}</span></div>
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
                  onClick={() => {
                    resetWizard();
                    onBookingSuccess();
                  }}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white text-xs uppercase tracking-widest font-bold px-6 py-3.5 rounded-md transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/20"
                >
                  <CheckCircle className="w-4 h-4" /> Ver meus agendamentos
                </button>
                <button
                  type="button"
                  onClick={resetWizard}
                  className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/70 hover:from-primary/80 hover:to-primary text-black text-xs uppercase tracking-widest font-black px-6 py-3.5 rounded-md transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-primary/10 hover:scale-105 active:scale-95"
                >
                  Novo Agendamento
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

        {/* Global Wizard Navigation Footer (Always pinned at the bottom on all screen sizes) */}
        {step < 6 && (
          <div className="shrink-0 bg-slate-50 border-t border-slate-200 p-3.5 sm:px-6 sm:py-4 space-y-3 z-20 shadow-md">
            {/* Selected Services / Date / Time Summary Banner */}
            {selectedServices.length > 0 && step < 5 && (
              <div className="p-3 bg-white border border-slate-200 text-slate-800 rounded-md shadow-xs flex items-center justify-between text-xs">
                <div className="text-left font-sans truncate pr-2">
                  <span className="text-slate-400 uppercase text-[10px] font-bold block">Resumo:</span>
                  <span className="text-primary font-bold tracking-wide truncate">
                    {selectedServices.map(s => s.nome).join(' + ')}
                  </span>
                  <span className="text-slate-500 font-sans text-xs ml-1 font-normal">
                    ({totalDuracao}min)
                  </span>
                  {selectedDate && (
                    <span className="text-slate-600 font-sans text-xs ml-1 font-medium border-l border-slate-200 pl-1">
                      | {selectedDate.split('-').reverse().join('/')}
                    </span>
                  )}
                  {selectedSlot && (
                    <span className="text-slate-800 text-xs ml-1 font-bold border-l border-slate-200 pl-1">
                      às {selectedSlot}h
                    </span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-primary font-extrabold text-sm">{formatBRL(totalPreco)}</span>
                </div>
              </div>
            )}

            {/* Back & Continue Buttons Row */}
            <div className="flex items-center justify-between gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBackStep}
                  disabled={step === 5 && submitting}
                  className="flex-1 max-w-[140px] border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs uppercase tracking-widest font-bold py-3.5 px-4 rounded-md flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                </button>
              )}
              <button
                type={step === 5 ? "submit" : "button"}
                form={step === 5 ? "booking-wizard-form" : undefined}
                onClick={step === 5 ? undefined : handleNextStep}
                disabled={
                  (step === 1 && selectedServices.length === 0) ||
                  (step === 2 && !selectedProfissional) ||
                  (step === 3 && !selectedDate) ||
                  (step === 4 && !selectedSlot) ||
                  (step === 5 && submitting)
                }
                className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-black disabled:opacity-40 disabled:cursor-not-allowed text-xs uppercase tracking-widest font-black py-3.5 px-5 rounded-md flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition duration-200 active:scale-95"
              >
                {step === 5 ? (
                  submitting ? 'Reservando...' : <>Confirmar & Agendar <CheckCircle className="w-3.5 h-3.5 text-black" /></>
                ) : (
                  <>Continuar <ArrowRight className="w-3.5 h-3.5 text-black" /></>
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
              <h4 className="text-lg font-semibold text-slate-900 ">Salvar seu Agendamento</h4>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                Para confirmar seu horário e salvar na sua conta, faça login rápido com o Google de forma simples e segura.
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                disabled={isGoogleLoading}
                onClick={async () => {
                  setIsGoogleLoading(true);
                  try {
                    const { error } = await signInWithGoogle();
                    if (error) {
                      setErrorMsg(error.message || 'Falha no login com Google.');
                    }
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
                onClick={() => {
                  setShowGoogleLoginPopup(false);
                  setShowTelefoneAuth(true);
                }}
                className="w-full py-3 bg-transparent border border-slate-200 hover:border-primary/40 text-slate-900 text-xs font-bold uppercase tracking-widest rounded-sm transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4 shrink-0 text-primary" />
                Entrar com telefone
              </button>

              <button
                type="button"
                disabled={isGoogleLoading}
                onClick={() => {
                  setShowGoogleLoginPopup(false);
                  localStorage.removeItem('pending_booking');
                  submitBooking();
                }}
                className="w-full py-2.5 text-xs uppercase font-bold tracking-wider text-muted-foreground hover:text-muted-foreground transition cursor-pointer"
              >
                Continuar sem login
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {showTelefoneAuth && (
      <ClientAuthModal onClose={() => setShowTelefoneAuth(false)} />
    )}
  </>
  );
}
