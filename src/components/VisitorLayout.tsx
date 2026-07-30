import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Scissors,
  Sparkles,
  Clock,
  MapPin,
  Flame,
  ShoppingBag,
  Clock3,
  X,
  Menu,
  User,
  LogOut,
  Camera,
  Check,
  Calendar,
  CalendarCheck,
  Star,
  Crown,
  ChevronDown,
  ChevronUp,
  Instagram,
  ArrowRight
} from 'lucide-react';
import { Servico, Produto } from '../types.ts';
import Logo from './Logo.tsx';
import BookingWizard from './BookingWizard.tsx';
import { signInWithGoogle } from '../lib/useAdminSession.ts';
import { authedFetch } from '../lib/supabase.ts';
import { ThemeToggle } from './ThemeToggle.tsx';
import { Button } from '@/components/ui/button.tsx';
import { WhatsAppFloatButton } from './WhatsAppFloatButton.tsx';

interface VisitorLayoutProps {
  services: Servico[];
  products: Produto[];
  onAdminLoginClick: () => void;
  onBookingSuccess: () => void;
  loggedClient: {
    nome: string;
    email: string;
    telefone: string;
    foto_url?: string;
  } | null;
  onClientLogin: (client: any) => void;
  onClientLogout: () => void;
}

export default function VisitorLayout({ 
  services, 
  products, 
  onAdminLoginClick,
  onBookingSuccess,
  loggedClient,
  onClientLogin,
  onClientLogout
}: VisitorLayoutProps) {
  const [showProfilePop, setShowProfilePop] = React.useState(false);
  const [showBookingsModal, setShowBookingsModal] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Booking popup modal state
  const [showBookingPopup, setShowBookingPopup] = React.useState(false);
  const [preselectedService, setPreselectedService] = React.useState<Servico | null>(null);
  
  // Display limits state for Services and Products
  const [showAllServices, setShowAllServices] = React.useState(false);
  const [showAllProducts, setShowAllProducts] = React.useState(false);

  // Tabs for user profile popover
  const [clientBookings, setClientBookings] = React.useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = React.useState(false);
  
  // Drag and drop states for photo upload
  const [isDragging, setIsDragging] = React.useState(false);

  // Register global service selector for direct service card clicks
  React.useEffect(() => {
    (window as any).selectBarberService = (s: Servico) => {
      setPreselectedService(s);
      setShowBookingPopup(true);
    };
    return () => {
      delete (window as any).selectBarberService;
    };
  }, []);

  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);

  // Central registration popup for new users
  const [showRegistrationModal, setShowRegistrationModal] = React.useState(false);

  // Profile edit form fields
  const [editNome, setEditNome] = React.useState('');
  const [editTelefone, setEditTelefone] = React.useState('');
  const [editFoto, setEditFoto] = React.useState('');

  // Fetch client bookings by email & phone
  const fetchClientBookings = React.useCallback(async () => {
    if (!loggedClient) return;
    setLoadingBookings(true);
    try {
      const q = new URLSearchParams();
      if (loggedClient.email) q.append('email', loggedClient.email);
      if (loggedClient.telefone) q.append('telefone', loggedClient.telefone.replace(/\D/g, ''));

      const res = await fetch(`/api/agendamentos/cliente?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setClientBookings(data);
      } else {
        console.error('Erro ao buscar agendamentos:', res.status);
        setClientBookings([]);
      }
    } catch (err) {
      console.error("Error fetching client agendamentos:", err);
      setClientBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  }, [loggedClient]);

  // Load bookings when popup or central modal is opened or updated
  React.useEffect(() => {
    if (loggedClient && (showProfilePop || showBookingsModal)) {
      fetchClientBookings();
    }
  }, [loggedClient, showProfilePop, showBookingsModal, fetchClientBookings]);

  // Drag-and-drop mechanics
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setEditFoto(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  React.useEffect(() => {
    if (loggedClient) {
      setEditNome(loggedClient.nome);
      setEditTelefone(loggedClient.telefone);
      setEditFoto(loggedClient.foto_url || '');
    } else {
      setEditNome('');
      setEditTelefone('');
      setEditFoto('');
      setClientBookings([]);
    }
  }, [loggedClient]);

  const handleSaveNewRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedClient) return;
    try {
      const telefoneDigits = editTelefone.replace(/\D/g, '');
      // O servidor identifica o cliente pelo JWT — não enviamos e-mail.
      const res = await authedFetch('/api/cliente/perfil', {
        method: 'POST',
        body: {
          nome: editNome,
          telefone: telefoneDigits,
          foto_url: editFoto
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.profile) {
          const updated = {
            nome: data.profile.nome,
            email: data.profile.email,
            telefone: data.profile.telefone,
            foto_url: data.profile.foto_url || ''
          };
          onClientLogin(updated);
          try { localStorage.setItem('logged_client', JSON.stringify(updated)); } catch {}
          setShowRegistrationModal(false);
        }
      }
    } catch (err) {
      console.error("Error creating new registration on server:", err);
    }
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const activeServices = Array.isArray(services) ? services.filter(s => s.ativo) : [];
  const activeProducts = Array.isArray(products) ? products.filter(p => p.ativo) : [];

  const cortes = activeServices.filter(s => {
    const nomeLower = s.nome.toLowerCase();
    return nomeLower.includes('corte') || nomeLower.includes('degradê') || nomeLower.includes('cabelo') || nomeLower.includes('máquina') || nomeLower.includes('tesoura') || nomeLower.includes('social');
  });

  const cuidados = activeServices.filter(s => {
    const nomeLower = s.nome.toLowerCase();
    const isCorte = nomeLower.includes('corte') || nomeLower.includes('cabelo') || nomeLower.includes('máquina');
    return (nomeLower.includes('barba') || nomeLower.includes('toalha') || nomeLower.includes('terapia') || nomeLower.includes('pele') || nomeLower.includes('sobrancelha') || nomeLower.includes('massagem') || nomeLower.includes('hidrat')) && !isCorte;
  });

  const outrosServicos = activeServices.filter(s => {
    return !cortes.some(c => c.id === s.id) && !cuidados.some(c => c.id === s.id);
  });

  // Services to render based on toggle limit
  const displayedServices = showAllServices ? activeServices : activeServices.slice(0, 4);
  const displayedProducts = showAllProducts ? activeProducts : activeProducts.slice(0, 4);

  const reviews = [
    {
      name: "Carlos Eduardo",
      text: "Melhor atendimento de Rio Verde! Encontrei meu barbeiro de confiança. Ambiente climatizado, pontualidade e o corte sempre fica exatamente como eu peço.",
      role: "Empresário"
    },
    {
      name: "Felipe Mendes",
      text: "Atendimento diferenciado. Não é só um corte de cabelo, é toda uma experiência. A toalha quente na barba faz toda a diferença para quem tem pele sensível.",
      role: "Advogado"
    },
    {
      name: "Ricardo Alves",
      text: "Eu tinha dificuldade em achar um lugar que acertasse o meu estilo. Na Detalhe, eles me deram uma consultoria antes de cortar. Resultado 100% aprovado.",
      role: "Engenheiro"
    }
  ];

  const steps = [
    {
      icon: <CalendarCheck className="w-7 h-7 text-primary" />,
      title: "1. Agende online",
      description: "Escolha o melhor dia e horário pelo nosso sistema de agendamento rápido em menos de 1 minuto."
    },
    {
      icon: <Scissors className="w-7 h-7 text-primary" />,
      title: "2. Chegue e relaxe",
      description: "Seja atendido no horário marcado, tome uma bebida gelada e deixe o visual nas mãos de especialistas."
    },
    {
      icon: <Star className="w-7 h-7 text-primary fill-primary/20" />,
      title: "3. Saia renovado",
      description: "Volte para a sua rotina com a confiança lá em cima e a aparência impecável que você merece."
    }
  ];

  const renderServiceRow = (s: Servico) => (
    <div 
      key={s.id} 
      className="glass-panel-premium glass-panel-hover rounded-xl p-5 transition-all duration-300 shadow-lg flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between group border border-border/60 hover:border-primary/40 bg-card/60 backdrop-blur-sm"
    >
      <div className="flex gap-4 items-start">
        <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden shrink-0 border border-border/80 relative group-hover:border-primary/50 transition duration-300 shadow-sm">
          <img src={s.imagem_url} alt={s.nome} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" referrerPolicy="no-referrer" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground text-lg group-hover:text-primary transition-colors tracking-wide">{s.nome}</h3>
          <p className="text-muted-foreground text-xs line-clamp-2 leading-relaxed max-w-xl">{s.descricao}</p>
          
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-primary" /> {s.duracao_minutos} min
            </span>
            <span className="w-1 h-1 bg-muted-foreground/30 rounded-full"></span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-md border border-primary/20 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary" /> Toalha quente inclusa
            </span>
          </div>
        </div>
      </div>

      <div className="sm:text-right w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-border/60 flex sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0">
        <span className="font-bold text-foreground text-xl">
          {formatBRL(s.preco)}
        </span>
        <button 
          type="button"
          onClick={() => {
            setPreselectedService(s);
            setShowBookingPopup(true);
          }}
          className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground font-bold text-xs uppercase tracking-widest px-4 py-2.5 rounded-lg shadow-md shadow-primary/20 hover:shadow-primary/35 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-1.5 cursor-pointer text-gold-glow"
        >
          Reservar corte
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground relative font-sans transition-colors duration-300 selection:bg-primary/20 selection:text-primary">
      <WhatsAppFloatButton />
      
      {/* Upper Navigation Bar (Header Original mantido & aprimorado) */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md text-foreground border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center min-w-0">
            <a href="#" className="flex items-center">
              <Logo className="h-14 sm:h-16 md:h-20 lg:h-22 max-h-[72px] w-auto object-contain shrink-0 hover:scale-105 transition-transform duration-300" />
            </a>
          </div>
          
          <nav className="hidden md:flex items-center gap-7 text-xs uppercase tracking-[0.2em] font-bold text-foreground">
            <a href="#como-funciona" className="hover:text-primary transition-colors relative py-1 group/nav">
              Como Funciona
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover/nav:w-full transition-all duration-300"></span>
            </a>
            <a href="#planos" className="hover:text-primary transition-colors relative py-1 group/nav">
              Planos
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover/nav:w-full transition-all duration-300"></span>
            </a>
            <a href="#servicos" className="hover:text-primary transition-colors relative py-1 group/nav">
              Serviços
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover/nav:w-full transition-all duration-300"></span>
            </a>
            <a href="#produtos" className="hover:text-primary transition-colors relative py-1 group/nav">
              Vitrine
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover/nav:w-full transition-all duration-300"></span>
            </a>
            <a href="#depoimentos" className="hover:text-primary transition-colors relative py-1 group/nav">
              Clientes
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover/nav:w-full transition-all duration-300"></span>
            </a>
            <a href="#localizacao" className="hover:text-primary transition-colors relative py-1 group/nav">
              Localização
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover/nav:w-full transition-all duration-300"></span>
            </a>
          </nav>

          <div className="flex items-center gap-2.5 md:gap-4 relative shrink-0">
            <ThemeToggle className="hidden sm:inline-flex" />

            <button
              type="button"
              onClick={() => { setPreselectedService(null); setShowBookingPopup(true); }}
              className="hidden md:inline-flex bg-gradient-to-r from-primary via-primary/90 to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground font-bold text-xs uppercase tracking-[0.18em] px-5 py-2.5 rounded-lg shadow-md shadow-primary/20 hover:shadow-primary/35 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer text-gold-glow"
            >
              Agende Já
            </button>

            {/* Hamburger Button for Mobile */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-foreground hover:bg-accent border border-border/80 transition cursor-pointer flex items-center justify-center bg-card shadow-sm"
              aria-label="Menu principal"
              title="Abrir menu de navegação"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-primary" /> : <Menu className="w-5 h-5 text-primary" />}
            </button>

            {/* Profile configuration popover */}
            <div className="relative shrink-0">
              {loggedClient ? (
                <button
                  type="button"
                  onClick={() => setShowProfilePop(!showProfilePop)}
                  className="w-10 h-10 rounded-full border border-primary/40 overflow-hidden flex items-center justify-center bg-muted transition hover:scale-105 cursor-pointer shrink-0 shadow-sm hover:shadow-md"
                  title="Configurar seu perfil"
                  id="perfil-avatar-btn"
                >
                  {loggedClient.foto_url ? (
                    <img 
                      src={loggedClient.foto_url} 
                      alt={loggedClient.nome} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="text-primary text-xs sm:text-sm font-bold font-sans uppercase">
                      {loggedClient.nome.charAt(0)}
                    </div>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onAdminLoginClick}
                  className="w-10 h-10 rounded-full border border-primary/30 flex items-center justify-center bg-primary/10 hover:bg-primary/20 transition text-primary hover:text-primary/80 cursor-pointer shrink-0 shadow-sm"
                  title="Acesse sua área de cliente"
                  id="perfil-guest-btn"
                >
                  <User className="w-4 h-4" />
                </button>
              )}

              {/* Pop de Perfil Modal */}
              <AnimatePresence>
                {showProfilePop && (
                  <>
                    <div className="fixed inset-0 bg-black/60 md:bg-transparent backdrop-blur-[2px] md:backdrop-blur-none z-50 cursor-default" onClick={() => setShowProfilePop(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="fixed top-24 left-1/2 -translate-x-1/2 md:translate-x-0 md:translate-y-0 md:absolute md:top-auto md:left-auto md:right-0 md:mt-3 w-[calc(100vw-32px)] max-w-[350px] md:w-80 glass-panel-premium rounded-xl shadow-2xl p-5 md:p-6 z-55 text-left max-h-[85vh] md:max-h-none overflow-y-auto"
                    >
                      <button
                        type="button"
                        onClick={() => setShowProfilePop(false)}
                        className="absolute top-3.5 right-3.5 text-muted-foreground hover:text-primary transition cursor-pointer p-1 z-10"
                        title="Fechar menu"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      {loggedClient ? (
                        <div className="space-y-4 text-center">
                          <div className="flex items-center gap-3 border-b border-border pb-3.5">
                            <div className="w-12 h-12 rounded-full border border-primary overflow-hidden bg-background shrink-0 shadow-md">
                              {loggedClient.foto_url ? (
                                <img src={loggedClient.foto_url} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-primary font-bold uppercase text-sm bg-card">
                                  {loggedClient.nome.charAt(0) || 'U'}
                                </div>
                              )}
                            </div>
                            <div className="text-left">
                              <h4 className="font-bold text-sm text-foreground">{loggedClient.nome}</h4>
                              <p className="text-xs text-muted-foreground">{loggedClient.email}</p>
                            </div>
                          </div>

                          <div className="py-1">
                            <button
                              type="button"
                              onClick={() => {
                                setShowProfilePop(false);
                                setShowBookingsModal(true);
                              }}
                              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground font-sans text-xs uppercase tracking-widest font-bold py-3 rounded-lg text-center transition-all duration-300 cursor-pointer shadow-md text-gold-glow"
                            >
                              Ver Meus Agendamentos
                            </button>
                          </div>

                          <div className="pt-3 border-t border-border">
                            <button
                              type="button"
                              onClick={() => {
                                onClientLogout();
                                setShowProfilePop(false);
                              }}
                              className="w-full bg-background border border-border hover:border-red-400/40 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 text-xs uppercase tracking-widest font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                            >
                              <LogOut className="w-3.5 h-3.5" /> Sair da conta
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 space-y-4">
                          <div className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center mx-auto text-muted-foreground">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-semibold text-foreground">Área do Cliente</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed max-w-[210px] mx-auto">
                              Conecte sua conta do Google para agendar sessões e consultar seus horários.
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={isGoogleLoading}
                            onClick={async () => {
                              setIsGoogleLoading(true);
                              try {
                                const { error } = await signInWithGoogle();
                                if (error) console.error('Login Google:', error.message);
                                setShowProfilePop(false);
                              } finally {
                                setIsGoogleLoading(false);
                              }
                            }}
                            className="w-full py-2.5 bg-background hover:bg-accent border border-border hover:border-primary/40 text-foreground disabled:opacity-50 text-xs font-bold uppercase tracking-widest rounded-lg transition duration-150 cursor-pointer flex items-center justify-center gap-2 shadow-md"
                          >
                            {isGoogleLoading ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                Autenticando...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                                </svg>
                                Logar com o Google
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.div
              initial={{ y: "-100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-20 left-0 right-0 bg-card/95 backdrop-blur-xl border-b border-border shadow-2xl p-6 z-50 md:hidden flex flex-col space-y-4 max-h-[calc(100vh-80px)] overflow-y-auto"
            >
              <nav className="flex flex-col space-y-2 text-sm font-bold uppercase tracking-wider text-foreground">
                <a 
                  href="#como-funciona" 
                  onClick={() => setMobileMenuOpen(false)} 
                  className="p-3 rounded-xl hover:bg-accent hover:text-primary transition flex items-center justify-between border border-border/40 bg-card/40"
                >
                  <span>Como Funciona</span>
                  <ChevronDown className="w-4 h-4 -rotate-90 text-primary" />
                </a>
                <a 
                  href="#planos" 
                  onClick={() => setMobileMenuOpen(false)} 
                  className="p-3 rounded-xl hover:bg-accent hover:text-primary transition flex items-center justify-between border border-border/40 bg-card/40"
                >
                  <span className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-primary" /> Planos VIP
                  </span>
                  <ChevronDown className="w-4 h-4 -rotate-90 text-primary" />
                </a>
                <a 
                  href="#servicos" 
                  onClick={() => setMobileMenuOpen(false)} 
                  className="p-3 rounded-xl hover:bg-accent hover:text-primary transition flex items-center justify-between border border-border/40 bg-card/40"
                >
                  <span>Serviços</span>
                  <ChevronDown className="w-4 h-4 -rotate-90 text-primary" />
                </a>
                <a 
                  href="#produtos" 
                  onClick={() => setMobileMenuOpen(false)} 
                  className="p-3 rounded-xl hover:bg-accent hover:text-primary transition flex items-center justify-between border border-border/40 bg-card/40"
                >
                  <span>Vitrine de Produtos</span>
                  <ChevronDown className="w-4 h-4 -rotate-90 text-primary" />
                </a>
                <a 
                  href="#depoimentos" 
                  onClick={() => setMobileMenuOpen(false)} 
                  className="p-3 rounded-xl hover:bg-accent hover:text-primary transition flex items-center justify-between border border-border/40 bg-card/40"
                >
                  <span>Avaliações dos Clientes</span>
                  <ChevronDown className="w-4 h-4 -rotate-90 text-primary" />
                </a>
                <a 
                  href="#localizacao" 
                  onClick={() => setMobileMenuOpen(false)} 
                  className="p-3 rounded-xl hover:bg-accent hover:text-primary transition flex items-center justify-between border border-border/40 bg-card/40"
                >
                  <span>Nossa Localização</span>
                  <ChevronDown className="w-4 h-4 -rotate-90 text-primary" />
                </a>
              </nav>

              <div className="pt-3 border-t border-border/80 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); setPreselectedService(null); setShowBookingPopup(true); }}
                  className="w-full bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-primary-foreground font-bold text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-md cursor-pointer text-gold-glow flex items-center justify-center gap-2"
                >
                  <Calendar className="w-4 h-4" /> Agende Já seu Horário
                </button>

                <div className="flex items-center justify-between px-2 pt-1">
                  <span className="text-xs text-muted-foreground font-medium">Alternar Tema Visual:</span>
                  <ThemeToggle />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 1º Bloco: HERO SECTION (Integrada do Google AI Studio + Glow & Dark/Light) */}
      <section className="relative min-h-0 sm:min-h-[75vh] flex items-center justify-center overflow-hidden bg-background py-10 sm:py-20 border-b border-border">
        {/* Decorative ambient lighting */}
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_30%,rgba(0,97,194,0.12),transparent_65%)] dark:bg-[radial-gradient(circle_at_50%_30%,rgba(41,155,255,0.14),transparent_65%)] pointer-events-none" />
        <div className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
             style={{ backgroundImage: "url('https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=2070&q=80')" }} />
        
        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-4 sm:space-y-6 max-w-4xl mx-auto"
          >
            {/* Rating Stars Badge (Acima do título) */}
            <div className="inline-flex items-center gap-2 bg-muted/60 dark:bg-zinc-900/80 px-4 py-2 rounded-full border border-border/80 text-xs font-semibold shadow-sm">
              <div className="flex space-x-1 text-amber-400">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-muted-foreground font-medium text-xs">
                Avaliação 5 estrelas no Google Maps
              </span>
            </div>

            {/* Main Headline (Fonte Serif Elegante) */}
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-serif font-bold leading-[1.1] text-foreground tracking-tight">
              Conquiste um <span className="text-primary text-gold-glow">visual impecável</span> sem abrir mão do conforto.
            </h1>
            
            {/* Subtitle */}
            <p className="text-sm sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
              Cortes modernos, alinhamento perfeito e um atendimento premium que renova não apenas sua imagem, mas sua confiança.
            </p>
            
            {/* CTA Buttons with Gold Glow effect */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-2 sm:pt-4">
              <motion.button
                type="button"
                onClick={() => { setPreselectedService(null); setShowBookingPopup(true); }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 sm:py-4 bg-gradient-to-r from-primary via-primary/90 to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground font-bold text-sm sm:text-base rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 text-gold-glow cursor-pointer"
              >
                <Calendar className="w-5 h-5 mr-2.5 text-primary-foreground" />
                Agendar meu horário agora
              </motion.button>

              <a
                href="#planos"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 sm:py-4 bg-card hover:bg-accent text-foreground font-semibold text-sm sm:text-base rounded-xl border border-border hover:border-primary/40 transition-all duration-300 shadow-sm hover:scale-105"
              >
                <Crown className="w-5 h-5 mr-2 text-primary" />
                Ver Planos Mensais
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2º Bloco: COMO FUNCIONA (Integrado do Google AI Studio + Dark/Light) */}
      <section id="como-funciona" className="py-12 sm:py-24 bg-card/40 border-b border-border scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-foreground">
              Como funciona
            </h2>
            <p className="text-muted-foreground text-base max-w-xl mx-auto font-light">
              Três passos simples para você transformar a sua imagem.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 relative">
            {/* Connector line for desktop */}
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-border/60 z-0" />

            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="relative z-10 flex flex-col items-center text-center glass-panel-premium rounded-2xl p-8 border border-border/60 bg-card/80 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group"
              >
                <div className="w-20 h-20 bg-background border-2 border-primary/30 rounded-full flex items-center justify-center mb-6 shadow-md group-hover:border-primary group-hover:scale-110 transition duration-300">
                  {step.icon}
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3 font-serif">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs font-light">{step.description}</p>
              </motion.div>
            ))}
          </div>
          
          <div className="mt-16 text-center">
            <motion.button
              type="button"
              onClick={() => { setPreselectedService(null); setShowBookingPopup(true); }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-primary via-primary/90 to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground font-bold text-base rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/35 transition-all duration-300 text-gold-glow cursor-pointer"
            >
              Quero agendar meu horário
            </motion.button>
          </div>
        </div>
      </section>

      {/* 3º Bloco: PLANOS MENSAIS (Integrado do Google AI Studio + Dark/Light) */}
      <section id="planos" className="py-24 bg-background border-b border-border scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-3">
            <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <Crown className="w-3.5 h-3.5" /> Clube VIP
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-foreground">
              Nossos Planos Mensais
            </h2>
            <p className="text-muted-foreground text-base max-w-2xl mx-auto font-light">
              Assine um de nossos planos e mantenha seu visual sempre impecável pagando um valor fixo por mês.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {/* Plan 1: Essential */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="relative flex flex-col bg-card/80 border border-border/80 rounded-2xl p-8 shadow-md hover:shadow-xl transition duration-300"
            >
              <div className="mb-4">
                <h3 className="text-2xl font-serif font-bold text-foreground">Essential</h3>
                <p className="text-xs text-muted-foreground mt-1">Cortes com frequência livre</p>
              </div>
              
              <div className="my-4">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Por apenas</span>
                <div className="flex items-baseline text-foreground">
                  <span className="text-xl font-bold">R$</span>
                  <span className="text-4xl sm:text-5xl font-extrabold tracking-tight mx-1">109</span>
                  <span className="text-lg font-bold text-muted-foreground">,99</span>
                  <span className="text-muted-foreground ml-1 text-xs font-medium">/mês</span>
                </div>
              </div>
              
              <p className="text-muted-foreground text-xs leading-relaxed mb-6 min-h-[60px]">
                O essencial para manter seu visual sempre em dia. Ideal para quem deseja cortes ilimitados com praticidade e economia.
              </p>
              
              <div className="flex-1 border-t border-border/60 pt-6">
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center text-foreground text-sm">
                    <Check className="w-4 h-4 text-emerald-500 mr-2.5 shrink-0" strokeWidth={3} />
                    <span className="font-medium">Corte ilimitado</span>
                  </li>
                </ul>
              </div>
              
              <button 
                type="button"
                onClick={onAdminLoginClick}
                className="w-full py-3.5 px-6 rounded-xl font-bold text-xs uppercase tracking-wider bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-all duration-300 mt-auto cursor-pointer border border-border"
              >
                Assinar Essential
              </button>
            </motion.div>

            {/* Plan 2: Premium (Mais Escolhido) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative flex flex-col bg-card border-2 border-primary/60 rounded-2xl p-8 shadow-xl shadow-primary/10 hover:shadow-primary/20 transition duration-300 md:-mt-2 md:mb-[-0.5rem]"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold px-4 py-1 rounded-full text-xs uppercase tracking-wider shadow-md text-gold-glow">
                Mais Escolhido
              </div>
              
              <div className="mb-4 pt-2">
                <h3 className="text-2xl font-serif font-bold text-primary flex items-center gap-1.5">
                  Premium
                </h3>
                <p className="text-xs text-muted-foreground mt-1">Cabelo e barba sempre perfeitos</p>
              </div>
              
              <div className="my-4">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Por apenas</span>
                <div className="flex items-baseline text-foreground">
                  <span className="text-xl font-bold">R$</span>
                  <span className="text-4xl sm:text-5xl font-extrabold tracking-tight mx-1 text-primary">159</span>
                  <span className="text-lg font-bold text-muted-foreground">,99</span>
                  <span className="text-muted-foreground ml-1 text-xs font-medium">/mês</span>
                </div>
              </div>
              
              <p className="text-muted-foreground text-xs leading-relaxed mb-6 min-h-[60px]">
                Mais estilo e cuidado em cada visita. Perfeito para quem gosta de manter o cabelo e a barba sempre impecáveis.
              </p>
              
              <div className="flex-1 border-t border-border/60 pt-6">
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center text-foreground text-sm">
                    <Check className="w-4 h-4 text-emerald-500 mr-2.5 shrink-0" strokeWidth={3} />
                    <span className="font-medium">Corte ilimitado</span>
                  </li>
                  <li className="flex items-center text-foreground text-sm">
                    <Check className="w-4 h-4 text-emerald-500 mr-2.5 shrink-0" strokeWidth={3} />
                    <span className="font-medium">Barba ilimitada</span>
                  </li>
                </ul>
              </div>
              
              <button 
                type="button"
                onClick={onAdminLoginClick}
                className="w-full py-3.5 px-6 rounded-xl font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-primary via-primary/90 to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground transition-all duration-300 shadow-md shadow-primary/20 text-gold-glow cursor-pointer"
              >
                Assinar Premium
              </button>
            </motion.div>

            {/* Plan 3: Exclusive */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative flex flex-col bg-card/80 border border-border/80 rounded-2xl p-8 shadow-md hover:shadow-xl transition duration-300"
            >
              <div className="mb-4">
                <h3 className="text-2xl font-serif font-bold text-foreground flex items-center justify-between">
                  Exclusive
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                </h3>
                <p className="text-xs text-muted-foreground mt-1">Experiência VIP completa</p>
              </div>
              
              <div className="my-4">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Por apenas</span>
                <div className="flex items-baseline text-foreground">
                  <span className="text-xl font-bold">R$</span>
                  <span className="text-4xl sm:text-5xl font-extrabold tracking-tight mx-1">199</span>
                  <span className="text-lg font-bold text-muted-foreground">,99</span>
                  <span className="text-muted-foreground ml-1 text-xs font-medium">/mês</span>
                </div>
              </div>
              
              <p className="text-muted-foreground text-xs leading-relaxed mb-6 min-h-[60px]">
                A experiência mais completa da barbearia. O máximo em cuidado, estilo e exclusividade para qualquer ocasião.
              </p>
              
              <div className="flex-1 border-t border-border/60 pt-6">
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center text-foreground text-sm">
                    <Check className="w-4 h-4 text-emerald-500 mr-2.5 shrink-0" strokeWidth={3} />
                    <span className="font-medium">Corte ilimitado</span>
                  </li>
                  <li className="flex items-center text-foreground text-sm">
                    <Check className="w-4 h-4 text-emerald-500 mr-2.5 shrink-0" strokeWidth={3} />
                    <span className="font-medium">Barba ilimitada</span>
                  </li>
                  <li className="flex items-center text-foreground text-sm">
                    <Check className="w-4 h-4 text-emerald-500 mr-2.5 shrink-0" strokeWidth={3} />
                    <span className="font-medium">Sobrancelha ilimitada</span>
                  </li>
                  <li className="flex items-center text-foreground text-sm">
                    <Check className="w-4 h-4 text-emerald-500 mr-2.5 shrink-0" strokeWidth={3} />
                    <span className="font-medium">Penteado ilimitado</span>
                  </li>
                </ul>
              </div>
              
              <button 
                type="button"
                onClick={onAdminLoginClick}
                className="w-full py-3.5 px-6 rounded-xl font-bold text-xs uppercase tracking-wider bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-all duration-300 mt-auto cursor-pointer border border-border"
              >
                Assinar Exclusive
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Main Dynamic Content Container: Services & Products (com limite configurável) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-20">
        
        {/* Services Box with Limited items view */}
        <section id="servicos" className="space-y-8 scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-4 gap-2">
            <div>
              <h2 className="font-serif font-bold text-3xl text-foreground tracking-tight">Cortes & Cuidados</h2>
              <p className="text-muted-foreground text-xs mt-1">Serviços executados com toalha de vapor quente e lavagem final inclusas</p>
            </div>
            <span className="text-xs font-bold tracking-widest uppercase bg-muted text-primary border border-border px-3.5 py-1.5 rounded-lg shrink-0 self-start sm:self-auto">
              {activeServices.length} opções disponíveis
            </span>
          </div>

          <div className="space-y-4">
            {displayedServices.map((s) => renderServiceRow(s))}
          </div>

          {/* Toggle button if activeServices count exceeds displayed limit */}
          {activeServices.length > 4 && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setShowAllServices(!showAllServices)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-card hover:bg-accent border border-border hover:border-primary/40 rounded-xl text-xs font-bold uppercase tracking-wider text-foreground transition duration-300 shadow-sm cursor-pointer"
              >
                {showAllServices ? (
                  <>Ver menos opções <ChevronUp className="w-4 h-4 text-primary" /></>
                ) : (
                  <>Ver catálogo completo ({activeServices.length} serviços) <ChevronDown className="w-4 h-4 text-primary" /></>
                )}
              </button>
            </div>
          )}
        </section>

        {/* Expediente Imperial Block */}
        <section className="glass-panel-premium text-muted-foreground rounded-2xl p-6 sm:p-8 shadow-xl space-y-4 border border-border bg-card/60">
          <h3 className="font-serif font-bold text-xl flex items-center gap-2.5 text-primary border-b border-border/60 pb-3">
            <Clock3 className="w-5 h-5 text-primary" /> Expediente Imperial
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 bg-background/50 border border-border/60 rounded-xl space-y-1">
              <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] block">Segunda a Sexta:</span>
              <span className="text-foreground font-semibold">09:00h às 19:00h</span>
            </div>
            <div className="p-3.5 bg-background/50 border border-border/60 rounded-xl space-y-1">
              <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] block">Intervalo Almoço:</span>
              <span className="text-foreground font-semibold">12:00h às 13:30h</span>
            </div>
            <div className="p-3.5 bg-background/50 border border-border/60 rounded-xl space-y-1">
              <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] block">Sábado:</span>
              <span className="text-foreground font-semibold">08:00h às 18:00h</span>
            </div>
            <div className="p-3.5 bg-background/50 border border-border/60 rounded-xl space-y-1">
              <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] block">Domingos e Feriados:</span>
              <span className="text-muted-foreground font-semibold">Fechado</span>
            </div>
          </div>
        </section>

        {/* Products Showroom with Limited items view */}
        <section id="produtos" className="space-y-8 scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-4 gap-2">
            <div>
              <h2 className="font-serif font-bold text-3xl text-foreground tracking-tight">Vitrine & Produtos</h2>
              <p className="text-muted-foreground text-xs mt-1">Cosméticos e finalizadores de uso profissional</p>
            </div>
            <span className="text-xs font-bold tracking-widest uppercase bg-muted text-primary border border-border px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
              <ShoppingBag className="w-3.5 h-3.5" /> {activeProducts.length} itens
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {displayedProducts.map((p) => (
              <div 
                key={p.id} 
                className="bg-card border border-border/70 hover:border-primary/40 rounded-2xl p-4 transition-all duration-300 shadow-md hover:shadow-xl flex flex-col justify-between group overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="h-44 bg-muted rounded-xl overflow-hidden border border-border/60 relative">
                    <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" referrerPolicy="no-referrer" />
                    {p.estoque > 0 ? (
                      <span className="absolute top-2.5 right-2.5 bg-primary/90 text-primary-foreground border border-primary/50 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md shadow-md">
                        Em Estoque
                      </span>
                    ) : (
                      <span className="absolute top-2.5 right-2.5 bg-red-500/90 text-white border border-red-400 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md shadow-md">
                        Esgotado
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="font-bold text-foreground text-base group-hover:text-primary transition-colors">{p.nome}</h3>
                    <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">{p.descricao}</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                  <span className="font-bold text-foreground text-lg">
                    {formatBRL(p.preco)}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {p.estoque} unidades
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Toggle button for Products */}
          {activeProducts.length > 4 && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setShowAllProducts(!showAllProducts)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-card hover:bg-accent border border-border hover:border-primary/40 rounded-xl text-xs font-bold uppercase tracking-wider text-foreground transition duration-300 shadow-sm cursor-pointer"
              >
                {showAllProducts ? (
                  <>Ver menos produtos <ChevronUp className="w-4 h-4 text-primary" /></>
                ) : (
                  <>Ver todos os produtos ({activeProducts.length} itens) <ChevronDown className="w-4 h-4 text-primary" /></>
                )}
              </button>
            </div>
          )}
        </section>

      </main>

      {/* 4º Bloco: O QUE NOSSOS CLIENTES DIZEM (Integrado do Google AI Studio) */}
      <section id="depoimentos" className="py-24 bg-card/40 border-y border-border scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-foreground">
              O que nossos clientes dizem
            </h2>
            <p className="text-muted-foreground text-base max-w-xl mx-auto font-light">
              Não acredite apenas em nós. Veja quem já transformou o visual conosco.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {reviews.map((review, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-card p-8 rounded-2xl border border-border/80 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex space-x-1 mb-6 text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-muted-foreground italic mb-8 leading-relaxed text-sm">
                    "{review.text}"
                  </p>
                </div>

                <div className="flex items-center pt-4 border-t border-border/60">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-serif font-bold text-xl border border-primary/30 shrink-0">
                    {review.name.charAt(0)}
                  </div>
                  <div className="ml-4">
                    <h4 className="text-foreground font-bold text-sm">{review.name}</h4>
                    <span className="text-muted-foreground text-xs font-medium">{review.role}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 5º Bloco: LOCALIZAÇÃO */}
      <section id="localizacao" className="py-20 bg-background scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2 mb-8">
            <h2 className="font-serif font-bold text-3xl sm:text-4xl text-foreground">Localização</h2>
            <p className="text-muted-foreground text-xs">Venha nos visitar, estamos te esperando em Rio Verde - GO</p>
          </div>

          <div className="glass-panel-premium rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6 border border-border bg-card/60">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 text-primary">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-base">Detalhe Barbearia</h3>
                <p className="text-muted-foreground text-xs mt-1 leading-relaxed max-w-md">
                  R. Osório Coelho de Moraes, 1745 - Jardim Goiás, Rio Verde - GO, 75901-020, Brasil
                </p>
              </div>
            </div>
            <a
              href="https://maps.app.goo.gl/89FiBkKVk3f4rxQa8"
              target="_blank"
              rel="noreferrer"
              className="shrink-0 bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-primary-foreground text-xs uppercase tracking-widest font-bold px-6 py-3.5 rounded-xl flex items-center gap-2 shadow-md hover:shadow-primary/30 transition text-gold-glow"
            >
              <MapPin className="w-4 h-4" /> Ver no Google Maps <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* 6º Bloco: FINAL CTA (Integrado do Google AI Studio + Glow) */}
      <section className="relative py-24 overflow-hidden bg-card/60 border-t border-border">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,97,194,0.1),transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-foreground">
              Chegou a hora de dar um <span className="text-primary text-gold-glow">upgrade</span> no visual.
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto font-light">
              Não deixe sua imagem para depois. Agende agora e experimente o padrão Detalhe Barbearia.
            </p>
            
            <motion.button
              type="button"
              onClick={() => { setPreselectedService(null); setShowBookingPopup(true); }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center justify-center px-10 py-5 bg-gradient-to-r from-primary via-primary/90 to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground font-bold rounded-xl text-lg shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 text-gold-glow cursor-pointer"
            >
              <Calendar className="w-6 h-6 mr-3" />
              Agendar meu horário agora
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* FOOTER OFICIAL (Integrado do Google AI Studio + Responsivo) */}
      <footer className="bg-card border-t border-border py-12 text-center text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col items-center justify-center">
            <span className="text-2xl font-serif font-bold text-foreground tracking-widest uppercase mb-4 text-gold-glow">
              Detalhe <span className="text-primary">Barbearia</span>
            </span>
            
            <div className="flex space-x-6 my-4">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors p-2 rounded-full hover:bg-muted">
                <span className="sr-only">Instagram</span>
                <Instagram className="w-5 h-5" />
              </a>
              <a 
                href="https://maps.app.goo.gl/89FiBkKVk3f4rxQa8" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-muted-foreground hover:text-primary transition-colors p-2 rounded-full hover:bg-muted"
              >
                <span className="sr-only">Localização</span>
                <MapPin className="w-5 h-5" />
              </a>
            </div>
            
            <p className="flex items-center justify-center text-xs text-muted-foreground font-medium">
              <MapPin className="w-3.5 h-3.5 mr-1.5 text-primary" />
              Rio Verde, GO - Brasil
            </p>
          </div>
          
          <div className="pt-6 border-t border-border/60 text-xs text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Detalhe Barbearia. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>

      {/* Modals & Registration Popups */}

      {/* Central User Registration Modal */}
      <AnimatePresence>
        {showRegistrationModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl p-6 md:p-8 z-10 text-left space-y-5"
            >
              <div className="text-center space-y-1.5 pb-1">
                <div className="w-12 h-12 rounded-full border border-primary overflow-hidden bg-background mx-auto flex items-center justify-center text-muted-foreground mb-1">
                  {editFoto ? (
                    <img src={editFoto} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <h3 className="font-semibold text-lg text-foreground">Concluir seu Registro</h3>
                <p className="text-xs text-muted-foreground uppercase tracking-widest leading-relaxed">
                  Insira seus dados para salvar seu perfil
                </p>
              </div>

              <form onSubmit={handleSaveNewRegistration} className="space-y-4">
                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider font-bold text-muted-foreground block">Nome Completo:</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: Emerson Santiago"
                      value={editNome}
                      onChange={(e) => setEditNome(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-xs focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider font-bold text-muted-foreground block">WhatsApp / Celular com DDD:</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: (64) 98765-4321"
                      value={editTelefone}
                      onChange={(e) => setEditTelefone(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-xs focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider font-bold text-muted-foreground block">Foto de Perfil:</label>
                    <div 
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`relative w-full border border-dashed rounded-lg p-4 text-center flex flex-col items-center justify-center transition cursor-pointer ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-background/60 hover:border-primary/40'}`}
                    >
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        id="registration-upload-input"
                      />
                      <div className="flex flex-col items-center gap-1">
                        {editFoto ? (
                          <div className="relative w-11 h-11 rounded-full overflow-hidden border border-primary/40 mb-1">
                            <img src={editFoto} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 hover:opacity-100 transition duration-155">
                              <Camera className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        ) : (
                          <Camera className="w-6 h-6 text-muted-foreground mb-1" />
                        )}
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Arraste sua foto aqui ou Clique
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      onClientLogout();
                      setShowRegistrationModal(false);
                    }}
                    className="flex-1 bg-card border border-border hover:border-red-400/40 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 text-xs uppercase tracking-widest font-bold px-3 py-3 rounded-lg transition cursor-pointer text-center"
                  >
                    Sair
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] bg-primary hover:bg-primary/90 text-primary-foreground text-xs uppercase tracking-widest font-bold px-3 py-3 rounded-lg text-center transition cursor-pointer shadow-lg"
                  >
                    Salvar e Avançar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Central Bookings Modal */}
        {showBookingsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBookingsModal(false)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6 md:p-8 z-10 text-left space-y-5"
            >
              <button
                type="button"
                onClick={() => setShowBookingsModal(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition cursor-pointer p-1.5 rounded-lg hover:bg-accent border border-transparent hover:border-border"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-1 pb-1">
                <h3 className="font-semibold text-xl text-foreground flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" /> Meus Agendamentos
                </h3>
                <p className="text-xs text-muted-foreground uppercase tracking-widest leading-relaxed">
                  Confira suas sessões agendadas na Detalhe Barbearia
                </p>
              </div>

              <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                {loadingBookings ? (
                  <div className="text-center py-8 space-y-2">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <span className="text-xs text-muted-foreground uppercase tracking-widest block">Buscando suas sessões...</span>
                  </div>
                ) : clientBookings.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground space-y-2">
                    <Clock className="w-8 h-8 mx-auto opacity-35 text-primary" />
                    <p className="text-xs text-muted-foreground">Nenhum agendamento ativo.</p>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Escolha um horário e garanta sua sessão!</p>
                  </div>
                ) : (
                  clientBookings.map((b) => {
                    const bSrvIds = b.servico_id.includes(',') ? b.servico_id.split(',') : [b.servico_id];
                    const bServices = services.filter(s => bSrvIds.includes(s.id));
                    const servicesNames = bServices.length > 0 
                      ? bServices.map(s => s.nome).join(', ') 
                      : 'Serviço Personalizado';
                    
                    const [dayDate, timePart] = b.inicio_em.split('T');
                    const formattedDate = dayDate.split('-').reverse().join('/');
                    const formattedTime = timePart ? timePart.slice(0, 5) : '00:00';
                    
                    return (
                      <div 
                        key={b.id} 
                        className="p-4 bg-background border border-border/80 rounded-xl hover:border-primary/40 transition space-y-3"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                              Código: {b.id}
                            </span>
                            <h5 className="font-bold text-sm text-foreground mt-1">
                              {servicesNames}
                            </h5>
                          </div>
                          
                          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full tracking-wider ${
                            b.status === 'confirmado' ? 'bg-primary/20 text-primary border border-primary/35' :
                            b.status === 'agendado' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' :
                            b.status === 'concluido' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' :
                            'bg-card text-muted-foreground border border-border'
                          }`}>
                            {b.status}
                          </span>
                        </div>
                        
                        <div className="pt-2 text-xs text-muted-foreground border-t border-border/60 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            Data: <span className="text-foreground font-medium">{formattedDate}</span>
                          </span>
                          <span className="flex items-center gap-1.5 font-bold">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            Horário: <span className="text-primary">{formattedTime}h</span>
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowBookingsModal(false)}
                  className="w-full bg-background hover:bg-card border border-border hover:border-primary/40 text-muted-foreground text-xs uppercase tracking-widest font-bold py-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Fechar Janela
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Booking Popup Modal */}
      <AnimatePresence>
        {showBookingPopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowBookingPopup(false);
                setPreselectedService(null);
              }}
              className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full h-[95dvh] max-h-[820px] md:w-[95vw] md:max-w-4xl rounded-xl overflow-hidden shadow-2xl flex flex-col my-auto"
            >
              <BookingWizard
                services={services}
                onBookingSuccess={() => {
                  onBookingSuccess();
                  fetchClientBookings();
                  setShowBookingPopup(false);
                  setPreselectedService(null);
                }}
                loggedClient={loggedClient}
                onClientLogin={onClientLogin}
                popupMode
                onClosePopup={() => {
                  setShowBookingPopup(false);
                  setPreselectedService(null);
                }}
                preselectedService={preselectedService}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
