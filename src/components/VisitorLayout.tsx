import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Scissors,
  Sparkles,
  Clock,
  MapPin,
  PhoneCall,
  Mail,
  ShieldCheck,
  ArrowDown,
  UserPlus,
  Flame,
  ShoppingBag,
  Clock3,
  Lock,
  Menu,
  X,
  User,
  Settings,
  LogOut,
  Camera,
  Check,
  Calendar,
  Upload
} from 'lucide-react';
import { Servico, Produto } from '../types.ts';
import BookingWizard from './BookingWizard.tsx';
import { signInWithGoogle } from '../lib/useAdminSession.ts';
import { ThemeToggle } from './ThemeToggle.tsx';

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
  
  // Tabs for user profile popover
  const [activeProfileTab, setActiveProfileTab] = React.useState<'perfil' | 'agendamentos'>('perfil');
  const [clientBookings, setClientBookings] = React.useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = React.useState(false);
  
  // Drag and drop states for photo upload
  const [isDragging, setIsDragging] = React.useState(false);

  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);

  // Central registration popup for new users
  const [showRegistrationModal, setShowRegistrationModal] = React.useState(false);

  // Profile edit form fields
  const [editNome, setEditNome] = React.useState('');
  const [editTelefone, setEditTelefone] = React.useState('');
  const [editFoto, setEditFoto] = React.useState('');
  const [profileSaveSuccess, setProfileSaveSuccess] = React.useState(false);
  const [profileError, setProfileError] = React.useState('');

  // O modal de "concluir registro" não é mais auto-aberto:
  // com Supabase Auth, o telefone/telefone é coletado no signup.
  // Se faltar, o cliente pode editar pelo botão "Editar Perfil".

  // Fetch client bookings by email & phone
  const fetchClientBookings = React.useCallback(async () => {
    if (!loggedClient) return;
    setLoadingBookings(true);
    try {
      const q = new URLSearchParams();
      if (loggedClient.email) q.append('email', loggedClient.email);
      // Manda telefone SEM máscara pra match exato no banco
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
      setActiveProfileTab('perfil');
    }
  }, [loggedClient]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedClient) return;
    try {
      const telefoneDigits = editTelefone.replace(/\D/g, '');
      const res = await fetch('/api/cliente/perfil', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: loggedClient.email,
          nome: editNome,
          telefone: telefoneDigits,
          foto_url: editFoto
        })
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
          setProfileSaveSuccess(true);
          setTimeout(() => setProfileSaveSuccess(false), 2500);
        } else {
          setProfileError('Perfil não foi salvo: resposta inesperada do servidor.');
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setProfileError(err.error || `Erro HTTP ${res.status} ao salvar perfil.`);
      }
    } catch (err) {
      console.error("Error saving profile to server:", err);
      setProfileError('Falha de rede ao salvar perfil.');
    }
  };

  const handleSaveNewRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedClient) return;
    try {
      const telefoneDigits = editTelefone.replace(/\D/g, '');
      const res = await fetch('/api/cliente/perfil', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: loggedClient.email,
          nome: editNome,
          telefone: telefoneDigits,
          foto_url: editFoto
        })
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
        } else {
          setProfileError('Cadastro não foi salvo: resposta inesperada.');
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setProfileError(err.error || `Erro HTTP ${res.status} ao cadastrar.`);
      }
    } catch (err) {
      console.error("Error creating new registration on server:", err);
      setProfileError('Falha de rede ao cadastrar.');
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

  const renderServiceRow = (s: Servico) => (
    <div 
      key={s.id} 
      className="glass-panel-premium glass-panel-hover rounded-lg p-5 transition duration-300 shadow-xl flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between group"
    >
      <div className="flex gap-5 items-start">
        <div className="w-18 h-18 bg-background rounded-md overflow-hidden shrink-0 border border-border relative group-hover:border-primary/40 transition duration-300">
          <img src={s.imagem_url} alt={s.nome} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" referrerPolicy="no-referrer" />
        </div>
        <div className="space-y-1">
          <h3 className="font-serif font-semibold text-foreground text-lg group-hover:text-primary transition-colors tracking-wide">{s.nome}</h3>
          <p className="text-muted-foreground text-xs line-clamp-2 leading-relaxed max-w-xl">{s.descricao}</p>
          
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" /> {s.duracao_minutos} min
            </span>
            <span className="w-1 h-1 bg-muted rounded-full"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-md border border-primary/20 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary" /> Toalha quente inclusa
            </span>
          </div>
        </div>
      </div>

      <div className="sm:text-right w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-t-0 border-border flex sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0">
        <span className="font-serif font-semibold text-primary text-2xl text-gold-glow">
          {formatBRL(s.preco)}
        </span>
        <a 
          href="#agendar-sessao"
          onClick={(e) => {
            if ((window as any).selectBarberService) {
              e.preventDefault();
              (window as any).selectBarberService(s);
            }
          }}
          className="text-xs uppercase tracking-widest font-bold text-primary hover:bg-primary hover:text-black flex items-center gap-1 bg-primary/5 px-4 py-2.5 rounded-md border border-primary/30 transition-all duration-300 font-mono shadow-md hover:shadow-primary/10 hover:scale-105 active:scale-95"
        >
          Reservar corte
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background text-foreground relative font-sans">
      {/* Upper Navigation Bar */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md text-foreground border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-md rotate-45 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/15 shrink-0 hover:rotate-[225deg] transition-all duration-700">
              <span className="-rotate-45 font-serif text-primary-foreground font-bold text-xl flex items-center justify-center">
                <Scissors className="w-4.5 h-4.5 text-primary-foreground" />
              </span>
            </div>
            <div className="min-w-0">
              <span className="font-serif font-semibold text-base xs:text-lg sm:text-xl lg:text-2xl tracking-wider sm:tracking-widest uppercase block text-foreground text-gold-glow">Detalhe Barbearia</span>
              <span className="text-xs xs:text-xs text-primary uppercase tracking-[0.2em] sm:tracking-[0.28em] block font-mono">Style & Tradition</span>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-xs uppercase tracking-[0.25em] font-bold text-foreground">
            <a href="#servicos" className="hover:text-primary transition-colors relative py-1 group/nav">
              Serviços
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover/nav:w-full transition-all duration-300"></span>
            </a>
            <a href="#produtos" className="hover:text-primary transition-colors relative py-1 group/nav">
              Produtos
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover/nav:w-full transition-all duration-300"></span>
            </a>
            <a href="#informacoes" className="hover:text-primary transition-colors relative py-1 group/nav">
              Localização
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover/nav:w-full transition-all duration-300"></span>
            </a>
          </nav>

          <div className="flex items-center gap-2.5 md:gap-4 relative shrink-0">
            <ThemeToggle className="hidden sm:inline-flex" />

            <a
              href="#agendar-sessao"
              className="hidden md:inline-flex bg-gradient-to-r from-primary to-primary/70 hover:from-primary/80 hover:to-primary text-primary-foreground text-xs tracking-widest uppercase font-black px-5.5 py-3 rounded-md transition-all duration-300 shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-105 active:scale-95 shrink-0"
            >
              Agende Já
            </a>

            {/* Profile configuration popover (bolinha simples) */}
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
                  className="w-10 h-10 rounded-full border border-primary/30 flex items-center justify-center bg-primary/8 hover:bg-primary/20 transition text-primary hover:text-primary/80 cursor-pointer shrink-0 shadow-sm"
                  title="Acesse sua área de cliente"
                  id="perfil-guest-btn"
                >
                  <User className="w-4 h-4" />
                </button>
              )}

              {/* Pop de Perfil Modal / Dropdown */}
              <AnimatePresence>
                {showProfilePop && (
                  <>
                    {/* Backdrop to close click-outside - on mobile we dim and blur for premium modal feeling */}
                    <div className="fixed inset-0 bg-black/60 md:bg-transparent backdrop-blur-[2px] md:backdrop-blur-none z-50 cursor-default" onClick={() => setShowProfilePop(false)} />
                          <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="fixed top-24 left-1/2 -translate-x-1/2 md:translate-x-0 md:translate-y-0 md:absolute md:top-auto md:left-auto md:right-0 md:mt-3 w-[calc(100vw-32px)] max-w-[350px] md:w-80 glass-panel-premium rounded-lg shadow-2xl p-5 md:p-6 z-55 text-left max-h-[85vh] md:max-h-none overflow-y-auto md:overflow-visible [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    >
                      {/* Botão de Fechar (X) */}
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
                          {/* Header info */}
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
                              <h4 className="font-serif font-bold text-sm text-foreground">{loggedClient.nome}</h4>
                              <p className="text-xs text-muted-foreground font-mono">{loggedClient.email}</p>
                            </div>
                          </div>

                          <div className="py-1">
                            <button
                              type="button"
                              onClick={() => {
                                setShowProfilePop(false);
                              }}
                              className="w-full bg-gradient-to-r from-primary to-primary/70 hover:from-primary/80 hover:to-primary text-black font-sans text-xs uppercase tracking-widest font-black py-3 rounded-md text-center transition-all duration-300 cursor-pointer shadow-md"
                            >
                              Acessar Meu Painel VIP
                            </button>
                          </div>

                          <div className="pt-3 border-t border-border">
                            <button
                              type="button"
                              onClick={() => {
                                onClientLogout();
                                setShowProfilePop(false);
                              }}
                              className="w-full bg-background border border-border hover:border-red-200 dark:border-red-900/30 hover:bg-red-100 dark:bg-red-950/10 text-muted-foreground hover:text-red-600 dark:text-red-400 font-mono text-xs uppercase tracking-widest font-bold py-2 rounded-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
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
                            <h4 className="font-serif text-sm font-semibold text-foreground">Área do Cliente</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed max-w-[210px] mx-auto">
                              Conecte sua conta do Google de forma descomplicada para agendar sessões e manter seus contatos atualizados.
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={isGoogleLoading}
                            onClick={async () => {
                              setIsGoogleLoading(true);
                              try {
                                const { error } = await signInWithGoogle();
                                if (error) {
                                  console.error('Login Google:', error.message);
                                  return;
                                }
                                // signInWithOAuth redireciona — após o retorno,
                                // App.tsx atualiza loggedClient via onAuthStateChange
                                setShowProfilePop(false);
                              } finally {
                                setIsGoogleLoading(false);
                              }
                            }}
                            className="w-full py-2.5 bg-background hover:bg-accent border border-border hover:border-primary/40 text-muted-foreground disabled:opacity-50 text-xs font-bold uppercase tracking-widest rounded-sm transition duration-150 cursor-pointer flex items-center justify-center font-mono gap-1.5 shadow-md"
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

      {/* Hero Banner Section */}
      <section className="relative bg-zinc-950 text-muted-foreground overflow-hidden py-24 sm:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(197,160,89,0.08),transparent_55%)] animate-pulse-slow" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          <div className="lg:col-span-7 space-y-6 text-left animate-fade-in">
            <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-4 py-2 rounded-full border border-primary/20 text-xs font-bold uppercase tracking-[0.2em] shadow-inner">
              <Flame className="w-3.5 h-3.5 text-primary" /> Estilo Premium, Navalha & Tradição
            </div>
            
            <h1 className="font-serif font-normal text-4xl sm:text-5xl lg:text-6.5xl tracking-wide leading-[1.1] text-white italic">
              Corte Perfeito <br />
              <span className="text-primary not-italic text-gold-glow">Sem Cadastro</span> e Sem Burocracia
            </h1>
            
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-lg italic font-sans font-light">
              Bem-vindo à <strong className="text-foreground not-italic font-bold">Detalhe Barbearia</strong>. Conforto de alto nível, massagem capilar, toalha quente aromática e café premium inclusos. Seu horário assegurado em menos de 1 minuto!
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <a 
                href="#agendar-sessao"
                className="bg-gradient-to-r from-primary to-primary/70 hover:from-primary/80 hover:to-primary text-black text-xs uppercase tracking-[0.2em] font-black px-7 py-4.5 rounded-md text-center shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center gap-2.5 cursor-pointer font-mono"
              >
                Escolher Horário Imperial <ArrowDown className="w-4 h-4 text-black animate-bounce" />
              </a>
              <a 
                href="#servicos"
                className="bg-background/60 hover:bg-card text-foreground border border-border hover:border-primary/40 text-xs uppercase tracking-[0.18em] font-bold px-7 py-4.5 rounded-md text-center transition-all duration-300 flex items-center justify-center gap-2 shadow-md hover:scale-105"
              >
                Ver Serviços <Scissors className="w-4 h-4 text-primary" />
              </a>
            </div>

            {/* Quick value badges */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border/60 max-w-md text-xs">
              <div className="space-y-1">
                <span className="text-primary font-serif font-bold text-lg text-gold-glow">Carlos S.</span>
                <p className="text-muted-foreground text-[8.5px] uppercase tracking-widest font-mono">Barbeiro Único</p>
              </div>
              <div className="space-y-1">
                <span className="text-primary font-serif font-bold text-lg text-gold-glow">Toalha Quente</span>
                <p className="text-muted-foreground text-[8.5px] uppercase tracking-widest font-mono">Grátis no Corte</p>
              </div>
              <div className="space-y-1">
                <span className="text-primary font-serif font-bold text-lg text-gold-glow">Sem Senha</span>
                <p className="text-muted-foreground text-[8.5px] uppercase tracking-widest font-mono">Agende sem login</p>
              </div>
            </div>
          </div>

          {/* Master Barber Callout Card */}
          <div className="lg:col-span-5 relative">
            <div className="absolute -inset-1.5 bg-gradient-to-r from-primary to-primary/60 rounded-lg blur-md opacity-25" />
            <div className="relative glass-panel-premium p-8 rounded-lg space-y-4.5 shadow-2xl">
              <div className="flex items-center gap-4">
                <img 
                  src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80" 
                  alt="Emerson Santiago" 
                  className="w-16 h-16 rounded-md border border-primary/40 object-cover shrink-0 shadow-md shadow-primary/5"
                />
                <div>
                  <h3 className="font-serif font-bold text-lg text-white">Emerson Santiago</h3>
                  <p className="text-primary text-xs font-serif italic">Dono & Master Barber</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">12 anos de experiência</p>
                </div>
              </div>
              <p className="text-muted-foreground text-xs italic leading-relaxed font-light">
                "Aqui, cada cliente recebe um atendimento focado e de alta precisão. Não divido minha atenção e cuido de cada detalhe com navalha afiada e produtos de primeira linha."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Booking Section - full width blue background */}
      <section id="agendar-sessao-section" className="relative bg-zinc-950 py-16 sm:py-20 scroll-mt-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(59,130,246,0.07),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(197,160,89,0.04),transparent_50%)]" />
        <div className="max-w-7xl mx-auto px-2.5 xs:px-4 sm:px-6 lg:px-8 relative z-10 space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-8">
            <h2 className="font-serif font-normal text-3xl sm:text-4xl text-white tracking-tight italic">
              Agendar Horário Online
            </h2>
            <p className="text-blue-200/70 text-xs font-sans max-w-lg mx-auto leading-relaxed">
              Escolha seu serviço favorito, selecione o melhor dia e consulte os horários livres atualizados em tempo real para formalizar o atendimento.
            </p>
          </div>
          
          <div className="max-w-5xl mx-auto">
            <BookingWizard 
              services={services} 
              onBookingSuccess={() => {
                onBookingSuccess();
                fetchClientBookings();
              }} 
              loggedClient={loggedClient}
              onClientLogin={onClientLogin}
            />
          </div>
        </div>
      </section>

      {/* Dynamic Content Columns */}
      <main className="max-w-7xl mx-auto px-2.5 xs:px-4 sm:px-6 lg:px-8 py-16 space-y-16">

        {/* Info, Services, and Products Area below */}
        <div className="max-w-5xl mx-auto w-full space-y-16 pt-12 border-t border-border">
          {/* Services catalogue, Expediente, and product vitrine */}
          <div className="space-y-16">
            
            {/* Services Box with Cortes, Cuidados, Serviços Subsections */}
            <section id="servicos" className="space-y-12">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="font-serif font-normal text-3xl text-foreground tracking-tight italic">Cortes & Cuidados</h2>
                  <p className="text-muted-foreground text-xs mt-1">Serviços executados com toalha de vapor quente e lavagem final inclusas</p>
                </div>
                <span className="text-xs font-bold tracking-widest uppercase bg-muted text-primary border border-border px-3.5 py-1.5 rounded-sm">
                  {activeServices.length} serviços
                </span>
              </div>

              {/* Sub-section: Cortes */}
              {cortes.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <Scissors className="w-4 h-4 text-primary" />
                    <h3 className="font-serif font-semibold text-lg text-foreground italic tracking-wide">Cortes</h3>
                  </div>
                  <div className="space-y-4">
                    {cortes.map((s) => renderServiceRow(s))}
                  </div>
                </div>
              )}

              {/* Sub-section: Cuidados */}
              {cuidados.length > 0 && (
                <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="font-serif font-semibold text-lg text-foreground italic tracking-wide">Cuidados</h3>
                  </div>
                  <div className="space-y-4">
                    {cuidados.map((s) => renderServiceRow(s))}
                  </div>
                </div>
              )}

              {/* Sub-section: Serviços */}
              {outrosServicos.length > 0 && (
                <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <Clock3 className="w-4 h-4 text-primary" />
                    <h3 className="font-serif font-semibold text-lg text-foreground italic tracking-wide">Outros Serviços</h3>
                  </div>
                  <div className="space-y-4">
                    {outrosServicos.map((s) => renderServiceRow(s))}
                  </div>
                </div>
              )}
            </section>

            {/* Expediente Imperial Block below Cortes & Cuidados */}
            <section className="glass-panel-premium text-muted-foreground rounded-lg p-6 shadow-xl space-y-4">
              <h3 className="font-serif font-normal text-lg flex items-center gap-2 text-primary border-b border-border/40 pb-3 italic">
                <Clock3 className="w-5 h-5 text-primary" /> Expediente Imperial
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-muted-foreground">
                <div className="p-3 bg-background/40 border border-border/60 rounded-md space-y-1">
                  <span className="font-semibold text-muted-foreground uppercase tracking-widest text-xs block">Segunda a Sexta:</span>
                  <span className="font-mono text-foreground text-xs">09:00h às 19:00h</span>
                </div>
                <div className="p-3 bg-background/40 border border-border/60 rounded-md space-y-1">
                  <span className="font-semibold text-muted-foreground uppercase tracking-widest text-xs block">Intervalo Almoço:</span>
                  <span className="font-mono text-foreground text-xs">12:00h às 13:30h</span>
                </div>
                <div className="p-3 bg-background/40 border border-border/60 rounded-md space-y-1">
                  <span className="font-semibold text-muted-foreground uppercase tracking-widest text-xs block">Sábado:</span>
                  <span className="font-mono text-foreground text-xs">08:00h às 18:00h</span>
                </div>
                <div className="p-3 bg-background/40 border border-border/60 rounded-md space-y-1">
                  <span className="font-semibold text-muted-foreground uppercase tracking-widest text-xs block">Domingos e Feriados:</span>
                  <span className="text-muted-foreground italic text-xs">Fechado</span>
                </div>
              </div>
            </section>

            {/* Products Showroom */}
            <section id="produtos" className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="font-serif font-normal text-3xl text-foreground tracking-tight italic">Vitrine & Produtos</h2>
                  <p className="text-muted-foreground text-xs mt-1">Nossos cosméticos e finalizadores de uso profissional à venda na cadeira</p>
                </div>
                <span className="text-xs font-bold tracking-widest uppercase bg-muted text-primary border border-border px-3.5 py-1.5 rounded-md flex items-center gap-1">
                  <ShoppingBag className="w-3.5 h-3.5" /> {activeProducts.length} itens
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeProducts.map((p) => (
                  <div 
                    key={p.id} 
                    className="bg-card border border-border/10 hover:border-primary/30 hover:shadow-lg rounded-lg p-4 transition-all duration-300 shadow-md overflow-hidden flex flex-col justify-between group"
                  >
                    <div className="space-y-3">
                      <div className="h-40 bg-muted rounded-md overflow-hidden border border-border relative">
                        <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" />
                        {p.estoque > 0 ? (
                          <span className="absolute top-2 right-2 bg-primary/90 text-white border border-primary/50 text-xs uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm shadow-md">
                            Em Estoque
                          </span>
                        ) : (
                          <span className="absolute top-2 right-2 bg-red-50 text-red-600 border border-red-200 text-xs uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm shadow-sm">
                            Esgotado
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        <h3 className="font-serif font-bold text-foreground text-sm group-hover:text-primary transition-colors">{p.nome}</h3>
                        <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">{p.descricao}</p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                      <span className="font-serif font-semibold text-primary text-base text-gold-glow">
                        {formatBRL(p.preco)}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {p.estoque} restantes
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Bottom Footer block */}
      <footer className="bg-card text-muted-foreground py-12 border-t border-border mt-20 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-card rounded-sm flex items-center justify-center text-primary/60 border border-border">
              ✂
            </div>
            <div>
              <p className="text-foreground text-sm font-serif tracking-wide">Detalhe Barbearia</p>
              <p className="text-xs text-muted-foreground">© 2026 Emerson Santiago. Todos os direitos reservados.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <a href="#servicos" className="hover:text-primary transition">Serviços</a>
            <a href="#produtos" className="hover:text-primary transition">Vitrine</a>
          </div>
        </div>
      </footer>

      {/* Central User Registration Modal */}
      <AnimatePresence>
        {showRegistrationModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-card border border-border rounded-sm shadow-2xl p-6 md:p-8 z-10 text-left space-y-5"
            >
              <div className="text-center space-y-1.5 pb-1">
                <div className="w-12 h-12 rounded-full border border-primary overflow-hidden bg-background mx-auto flex items-center justify-center text-muted-foreground mb-1">
                  {editFoto ? (
                    <img src={editFoto} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <h3 className="font-serif font-normal text-lg text-foreground italic">Concluir seu Registro</h3>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest leading-relaxed">
                  Insira seus dados para salvar seu perfil
                </p>
              </div>

              <form onSubmit={handleSaveNewRegistration} className="space-y-4">
                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider font-bold text-muted-foreground font-mono block">Nome Completo:</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: Emerson Santiago"
                      value={editNome}
                      onChange={(e) => setEditNome(e.target.value)}
                      className="w-full bg-background border border-border rounded-sm px-3 py-2 text-foreground text-xs focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider font-bold text-muted-foreground font-mono block">WhatsApp / Celular com DDD:</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: (11) 98765-4321"
                      value={editTelefone}
                      onChange={(e) => setEditTelefone(e.target.value)}
                      className="w-full bg-background border border-border rounded-sm px-3 py-2 text-foreground text-xs focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider font-bold text-muted-foreground font-mono block">Foto de Perfil (Arraste ou Selecione):</label>
                    <div 
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`relative w-full border border-dashed rounded-sm p-4 text-center flex flex-col items-center justify-center transition cursor-pointer ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-background/60 hover:border-primary/40'}`}
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
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                          Arraste sua foto aqui ou Clique
                        </span>
                        <span className="text-[7.5px] text-muted-foreground font-mono italic">
                          JPG, PNG ou WEBP
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                <div className="pt-4 border-t border-border flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      onClientLogout();
                      setShowRegistrationModal(false);
                    }}
                    className="flex-1 bg-card border border-border hover:border-red-200 dark:border-red-900 hover:bg-red-100 dark:bg-red-950/20 text-muted-foreground hover:text-red-600 dark:text-red-400 font-mono text-xs uppercase tracking-widest font-bold px-3 py-3 rounded-sm transition cursor-pointer text-center"
                  >
                    Sair
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] bg-primary hover:bg-primary/80 text-black font-sans text-xs uppercase tracking-widest font-bold px-3 py-3 rounded-sm text-center transition cursor-pointer shadow-lg animate-pulse"
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
            {/* Backdrop to close modal */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBookingsModal(false)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-card border border-border rounded-sm shadow-2xl p-6 md:p-8 z-10 text-left space-y-5"
            >
              {/* Close Button X */}
              <button
                type="button"
                onClick={() => setShowBookingsModal(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-white transition cursor-pointer p-1.5 rounded-sm hover:bg-accent border border-transparent hover:border-border"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-1 pb-1">
                <h3 className="font-serif font-normal text-xl text-foreground italic flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" /> Meus Agendamentos
                </h3>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest leading-relaxed">
                  Confira suas sessões agendadas na Detalhe Barbearia
                </p>
              </div>

              <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-stone-850">
                {loadingBookings ? (
                  <div className="text-center py-8 space-y-2">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <span className="text-xs text-muted-foreground uppercase tracking-widest font-mono block">Buscando suas sessões...</span>
                  </div>
                ) : clientBookings.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground space-y-2">
                    <Clock className="w-8 h-8 mx-auto opacity-35 text-primary" />
                    <p className="font-serif italic text-xs text-muted-foreground">Nenhum agendamento ativo.</p>
                    <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Escolha um horário e garanta sua sessão!</p>
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
                        className="p-4 bg-background/90 border border-border rounded-sm hover:border-primary/40 transition space-y-3"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-1">
                            <span className="text-[8.5px] font-mono font-bold uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-sm">
                              Código: {b.id}
                            </span>
                            <h5 className="font-serif font-bold text-sm text-foreground mt-1">
                              {servicesNames}
                            </h5>
                          </div>
                          
                          <span className={`text-xs font-mono font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider ${
                            b.status === 'confirmado' ? 'bg-primary/20 text-primary border border-primary/35' :
                            b.status === 'agendado' ? 'bg-amber-100 dark:bg-amber-950/20 text-amber-500 border border-amber-200 dark:border-amber-900/40' :
                            b.status === 'concluido' ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40' :
                            'bg-card text-muted-foreground border border-border'
                          }`}>
                            {b.status}
                          </span>
                        </div>
                        
                        <div className="pt-2 text-xs text-muted-foreground border-t border-border/85 flex items-center justify-between font-mono">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            Data: <span className="text-foreground">{formattedDate}</span>
                          </span>
                          <span className="flex items-primary gap-1.5 font-bold">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            Horário: <span className="text-primary">{formattedTime}H</span>
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
                  className="w-full bg-background hover:bg-card border border-border hover:border-primary/40 text-muted-foreground font-mono text-xs uppercase tracking-widest font-bold py-3 rounded-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Fechar Janela
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
