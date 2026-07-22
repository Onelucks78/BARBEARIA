import React, { useState, useEffect } from 'react';
import { 
  User, Calendar, CreditCard, LogOut,
  Settings, Sparkles, Clock, MapPin,
  ChevronRight, CheckCircle2,
  Check, X, Crown, ShoppingBag, Flame, ArrowRight
} from 'lucide-react';
import { Servico, Produto } from '../types.ts';
import BookingWizard from './BookingWizard.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';
import { WhatsAppFloatButton } from './WhatsAppFloatButton.tsx';
import Logo from './Logo.tsx';

interface PlanoAssinatura {
  key: string;
  nome: string;
  preco: number;
  descricao: string;
  beneficios: string[];
  destaque?: boolean;
}

// Planos de assinatura — chaves canônicas usadas em subscription.plan (essential | premium | exclusive)
const PLANOS: PlanoAssinatura[] = [
  {
    key: 'essential',
    nome: 'Essential',
    preco: 109.99,
    descricao: 'O essencial para manter seu visual sempre em dia. Ideal para quem deseja cortes ilimitados com praticidade e economia.',
    beneficios: ['Corte ilimitado']
  },
  {
    key: 'premium',
    nome: 'Premium',
    preco: 159.99,
    descricao: 'Mais estilo e cuidado em cada visita. Perfeito para quem gosta de manter o cabelo e a barba sempre impecáveis.',
    beneficios: ['Corte ilimitado', 'Barba ilimitada']
  },
  {
    key: 'exclusive',
    nome: 'Exclusive',
    preco: 199.99,
    descricao: 'A experiência mais completa da barbearia. O máximo em cuidado, estilo e exclusividade para quem busca um visual impecável em qualquer ocasião.',
    beneficios: ['Corte ilimitado', 'Barba ilimitada', 'Sobrancelha ilimitada', 'Penteado ilimitado'],
    destaque: true
  }
];

const formatPreco = (valor: number) => valor.toFixed(2).replace('.', ',');
const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

interface UserLayoutProps {
  loggedClient: {
    nome: string;
    email: string;
    telefone: string;
    foto_url?: string;
    observacoes?: string;
  };
  onLogout: () => void;
  onProfileUpdate: (client: any) => void;
  services: Servico[];
  products: Produto[];
}

export default function UserLayout({ 
  loggedClient, 
  onLogout, 
  onProfileUpdate, 
  services, 
  products 
}: UserLayoutProps) {
  const [activeTab, setActiveTab] = useState<'painel' | 'agendar' | 'assinatura' | 'agendamentos' | 'perfil'>('painel');
  const [clientBookings, setClientBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const currentPlano = PLANOS.find(p => p.key === (subscription?.plan || '').toLowerCase());
  const planoDisplayName = currentPlano ? currentPlano.nome : (subscription?.plan || 'VIP');

  const getClientPlanProgress = () => {
    if (!subscription || subscription.status !== 'ativo' || !subscription.renews_at) {
      return null;
    }
    const renewsDate = new Date(subscription.renews_at);
    const now = new Date();
    const startDate = new Date(renewsDate);
    startDate.setDate(startDate.getDate() - 30);

    const totalTime = renewsDate.getTime() - startDate.getTime();
    const elapsedTime = Math.max(0, now.getTime() - startDate.getTime());
    const percent = Math.min(100, Math.round((elapsedTime / totalTime) * 100)) || 10;
    const remainingDays = Math.max(0, Math.ceil((renewsDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    return {
      percent,
      remainingDays,
      cycleEnd: renewsDate.toLocaleDateString('pt-BR')
    };
  };

  const clientPlanStats = getClientPlanProgress();

  // Stripe Checkout & Portal States
  const [redirectingPlan, setRedirectingPlan] = useState<string | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Profile Form States
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Active Products & Services
  const activeProducts = Array.isArray(products) ? products.filter(p => p.ativo) : [];

  // Synchronize profile inputs with loggedClient prop
  useEffect(() => {
    if (loggedClient) {
      setProfileName(loggedClient.nome);
      setProfilePhone(loggedClient.telefone);
    }
  }, [loggedClient]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSaveSuccess(false);
    try {
      const res = await fetch('/api/cliente/perfil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loggedClient.email,
          nome: profileName,
          telefone: profilePhone.replace(/\D/g, ''),
          observacoes: loggedClient.observacoes
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.profile) {
          onProfileUpdate(data.profile);
          setProfileSaveSuccess(true);
          setTimeout(() => setProfileSaveSuccess(false), 2500);
        }
      } else {
        setProfileError('Erro ao atualizar perfil.');
      }
    } catch (err) {
      setProfileError('Erro de conexão ao salvar.');
    }
  };

  // Helper to parse packed subscription from client's observacoes
  useEffect(() => {
    if (loggedClient.observacoes) {
      try {
        if (loggedClient.observacoes.trim().startsWith('{')) {
          const parsed = JSON.parse(loggedClient.observacoes);
          if (parsed.subscription) {
            setSubscription(parsed.subscription);
            return;
          }
        }
      } catch (e) {
        console.error("Failed to parse packed subscription:", e);
      }
    }
    setSubscription(null);
  }, [loggedClient.observacoes]);

  // Load Bookings
  const fetchBookings = async () => {
    setLoadingBookings(true);
    try {
      const q = new URLSearchParams();
      if (loggedClient.email) q.append('email', loggedClient.email);
      if (loggedClient.telefone) q.append('telefone', loggedClient.telefone.replace(/\D/g, ''));
      const res = await fetch(`/api/agendamentos/cliente?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setClientBookings(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [loggedClient.email, loggedClient.telefone]);

  const handleCancelBooking = async (id: string) => {
    if (!confirm('Deseja realmente cancelar este agendamento?')) return;
    try {
      const res = await fetch(`/api/agendamentos/${encodeURIComponent(id)}/cancelar`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchBookings();
      } else {
        alert('Erro ao cancelar agendamento.');
      }
    } catch (e) {
      console.error(e);
      alert('Erro de rede ao cancelar.');
    }
  };

  const handleStartStripeCheckout = async (planoKey: string) => {
    setRedirectingPlan(planoKey);
    setCheckoutError('');
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: planoKey,
          email: loggedClient.email,
          nome: loggedClient.nome
        })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError(data.error || 'Erro ao gerar checkout seguro da Stripe.');
        setRedirectingPlan(null);
      }
    } catch (err) {
      setCheckoutError('Falha de conexão com a Stripe.');
      setRedirectingPlan(null);
    }
  };

  const handleOpenStripePortal = async () => {
    setIsOpeningPortal(true);
    try {
      const res = await fetch(`/api/stripe/portal?email=${encodeURIComponent(loggedClient.email)}`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Não foi possível acessar o portal de faturamento.');
        setIsOpeningPortal(false);
      }
    } catch {
      alert('Erro de conexão ao abrir portal Stripe.');
      setIsOpeningPortal(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm(`Deseja realmente cancelar o seu Plano ${planoDisplayName}?`)) return;
    try {
      let currentObsText = '';
      if (loggedClient.observacoes) {
        try {
          if (loggedClient.observacoes.trim().startsWith('{')) {
            const parsed = JSON.parse(loggedClient.observacoes);
            currentObsText = parsed.observacoes_usuario || '';
          } else {
            currentObsText = loggedClient.observacoes;
          }
        } catch {}
      }

      const packedData = JSON.stringify({
        observacoes_usuario: currentObsText,
        subscription: null
      });

      const res = await fetch('/api/cliente/perfil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loggedClient.email,
          nome: loggedClient.nome,
          telefone: loggedClient.telefone,
          observacoes: packedData
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          onProfileUpdate(data.profile);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row font-sans">
      <WhatsAppFloatButton />
      
      {/* Sidebar Navigation (MANTIDA E INTACTA) */}
      <aside className="w-full lg:w-56 xl:w-64 bg-card border-b lg:border-b-0 lg:border-r border-border flex flex-col justify-between shrink-0 p-4 xl:p-6 space-y-6 select-none">
        <div>
          {/* Logo */}
          <div className="flex items-center justify-between gap-3 mb-8">
            <Logo className="h-16 xl:h-20 w-auto object-contain shrink-0" />
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-3 p-3 bg-card/40 border border-border rounded-md mb-6">
            <div className="w-10 h-10 rounded-full border border-primary overflow-hidden bg-background shrink-0">
              {loggedClient.foto_url ? (
                <img src={loggedClient.foto_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-primary font-bold uppercase text-sm">
                  {loggedClient.nome.charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-xs text-foreground truncate">{loggedClient.nome}</h4>
              <span className={`text-xs uppercase tracking-wider px-1.5 py-0.5 rounded-sm inline-block mt-0.5 ${subscription?.status === 'ativo' ? 'bg-amber-600/10 text-primary border border-primary/30 font-bold' : 'bg-muted text-muted-foreground'}`}>
                {subscription?.status === 'ativo' ? `Cliente ${planoDisplayName}` : 'Cliente Comum'}
              </span>
            </div>
          </div>

          <nav className="space-y-1.5">
            <button onClick={() => setActiveTab('painel')} className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${activeTab === 'painel' ? 'bg-primary text-primary-foreground shadow-lg font-black' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
              <User className="w-4 h-4" /> Meu Painel
            </button>
            <button onClick={() => setActiveTab('agendar')} className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${activeTab === 'agendar' ? 'bg-primary text-primary-foreground shadow-lg font-black' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
              <Calendar className="w-4 h-4" /> Novo Agendamento
            </button>
            <button onClick={() => setActiveTab('assinatura')} className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${activeTab === 'assinatura' ? 'bg-primary text-primary-foreground shadow-lg font-black' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
              <Crown className="w-4 h-4" /> Meu Plano
            </button>
            <button onClick={() => setActiveTab('agendamentos')} className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${activeTab === 'agendamentos' ? 'bg-primary text-primary-foreground shadow-lg font-black' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
              <Clock className="w-4 h-4" /> Meus Agendamentos
            </button>
            <button onClick={() => setActiveTab('perfil')} className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider cursor-pointer ${activeTab === 'perfil' ? 'bg-primary text-primary-foreground shadow-lg font-black' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
              <Settings className="w-4 h-4" /> Meus Dados
            </button>
          </nav>
        </div>

        {/* Plan Info Widget na Sidebar do Cliente */}
        <div className="pt-4 border-t border-border space-y-3">
          <div 
            onClick={() => setActiveTab('assinatura')}
            className="p-3 bg-card/60 border border-border/70 hover:border-primary/40 rounded-xl transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs uppercase tracking-wider font-bold text-primary flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 animate-pulse text-primary" /> {subscription?.status === 'ativo' ? `Plano ${planoDisplayName}` : 'Sem Plano VIP'}
              </span>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${subscription?.status === 'ativo' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' : 'bg-muted text-muted-foreground'}`}>
                {subscription?.status === 'ativo' ? 'Ativo' : 'Comum'}
              </span>
            </div>
            
            {subscription?.status === 'ativo' && clientPlanStats ? (
              <>
                <div className="w-full bg-background h-1.5 rounded-full overflow-hidden my-2 border border-border/40">
                  <div 
                    className="bg-gradient-to-r from-primary/60 via-primary to-primary h-full rounded-full transition-all duration-500"
                    style={{ width: `${clientPlanStats.percent}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium">
                  <span>Renovação: {clientPlanStats.cycleEnd}</span>
                  <span className="text-primary font-bold">{clientPlanStats.remainingDays}d restantes</span>
                </div>
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                Clique para ver os benefícios dos planos mensais ilimitados.
              </p>
            )}
          </div>

          <button onClick={onLogout} className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-red-600 dark:text-red-400 hover:bg-red-100 dark:bg-red-950/15 border border-border hover:border-red-200 dark:border-red-900/30 transition duration-150 flex items-center gap-2.5 uppercase tracking-wider cursor-pointer font-bold">
            <LogOut className="w-4 h-4" /> Sair da Conta
          </button>
        </div>
      </aside>

      {/* Main Content Body Area (CORPO DA ABA CLIENTES MELHORADO) */}
      <main className="flex-1 min-w-0 p-6 lg:p-8 overflow-y-auto max-h-screen space-y-8">
        
        {/* ABA: MEU PAINEL */}
        {activeTab === 'painel' && (
          <div className="space-y-8 max-w-6xl mx-auto">
            {/* Header Welcome Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-card via-card to-background p-6 rounded-2xl border border-border/80 shadow-sm">
              <div className="space-y-1">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Olá, {loggedClient.nome}!
                </h2>
                <p className="text-muted-foreground text-xs font-medium">
                  Seja bem-vindo à sua área exclusiva na Detalhe Barbearia.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('agendar')}
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-xl shadow-md shadow-primary/20 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2 cursor-pointer text-gold-glow"
                >
                  <Calendar className="w-4 h-4" /> Agendar Sessão
                </button>
              </div>
            </div>

            {/* Status Grid Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* VIP Plan Status Card */}
              <div className="bg-card/80 border border-border/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-primary" /> Status da Assinatura
                  </span>
                  {subscription?.status === 'ativo' ? (
                    <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full">
                      Plano Ativo
                    </span>
                  ) : (
                    <span className="bg-muted text-muted-foreground border border-border text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full">
                      Sem Assinatura
                    </span>
                  )}
                </div>

                {subscription?.status === 'ativo' ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <span className="text-xl font-bold text-foreground">Plano {planoDisplayName}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Sua assinatura mensal está ativa com renovação automática. Benefícios inclusos: <strong className="text-foreground">{currentPlano ? currentPlano.beneficios.join(', ') : 'Serviços ilimitados'}</strong>.
                    </p>
                    <div className="pt-3 flex items-center justify-between text-xs border-t border-border/60">
                      <span className="text-muted-foreground">Renovação:</span>
                      <span className="text-primary font-bold">{new Date(subscription.renews_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CreditCard className="w-5 h-5 text-primary" />
                      <span className="text-lg font-bold text-foreground">Seja um Cliente VIP</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Assine um dos nossos planos a partir de R$ 109,99/mês e tenha cortes e barba ilimitados sem taxas adicionais.
                    </p>
                    <div className="pt-2">
                      <button 
                        onClick={() => setActiveTab('assinatura')} 
                        className="inline-flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition cursor-pointer"
                      >
                        <Crown className="w-3.5 h-3.5" /> Conhecer Planos Mensais
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Next Session Card */}
              <div className="bg-card/80 border border-border/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-primary" /> Próximo Atendimento
                  </span>
                  {clientBookings.length > 0 && new Date(clientBookings[0].inicio_em) > new Date() && (
                    <span className="bg-primary/10 text-primary border border-primary/30 text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full">
                      Confirmado
                    </span>
                  )}
                </div>

                {clientBookings.length > 0 && new Date(clientBookings[0].inicio_em) > new Date() ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-primary font-bold text-lg">
                      <Calendar className="w-5 h-5" />
                      <span className="text-foreground">
                        {new Date(clientBookings[0].inicio_em).toLocaleDateString('pt-BR')} às {new Date(clientBookings[0].inicio_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}h
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Código da reserva: <strong className="text-primary">{clientBookings[0].id}</strong>
                    </p>
                    <div className="pt-3 flex items-center justify-between text-xs border-t border-border/60">
                      <span className="text-muted-foreground">Status: <strong className="text-primary">{clientBookings[0].status}</strong></span>
                      <button onClick={() => setActiveTab('agendamentos')} className="text-primary hover:underline font-bold cursor-pointer">Ver todos os horários →</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Você não possui nenhuma sessão agendada nos próximos dias. Escolha o melhor dia e garanta o seu horário na cadeira.
                    </p>
                    <div className="pt-2">
                      <button 
                        onClick={() => setActiveTab('agendar')} 
                        className="inline-flex items-center gap-1.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-sm transition cursor-pointer text-gold-glow"
                      >
                        <Calendar className="w-3.5 h-3.5" /> Marcar Horário Agora
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Vitrine de Produtos no Painel do Cliente */}
            {activeProducts.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-primary" /> Vitrine de Produtos Recomendados
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Cosméticos de alta performance disponíveis para compra durante o seu atendimento
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {activeProducts.slice(0, 4).map((p) => (
                    <div 
                      key={p.id}
                      className="bg-card border border-border/70 hover:border-primary/40 rounded-xl p-3.5 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between group"
                    >
                      <div className="space-y-2.5">
                        <div className="h-32 bg-muted rounded-lg overflow-hidden border border-border/60 relative">
                          <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" referrerPolicy="no-referrer" />
                          {p.estoque > 0 ? (
                            <span className="absolute top-2 right-2 bg-primary/90 text-primary-foreground text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md shadow-sm">
                              Em Estoque
                            </span>
                          ) : (
                            <span className="absolute top-2 right-2 bg-red-500/90 text-white text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md shadow-sm">
                              Esgotado
                            </span>
                          )}
                        </div>

                        <div className="space-y-1">
                          <h4 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors line-clamp-1">{p.nome}</h4>
                          <p className="text-muted-foreground text-[11px] leading-relaxed line-clamp-2">{p.descricao}</p>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground">
                          {formatBRL(p.preco)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {p.estoque} dispon.
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resumo dos Planos VIP no Painel */}
            {subscription?.status !== 'ativo' && (
              <div className="space-y-4 pt-4 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                      <Crown className="w-5 h-5 text-primary" /> Nossos Planos VIP
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Economize e mantenha o estilo sempre em dia assinando um dos nossos planos mensais
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('assinatura')}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Ver detalhes dos planos <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {PLANOS.map((plano) => (
                    <div 
                      key={plano.key}
                      className={`p-5 rounded-2xl border bg-card/80 transition-all duration-300 flex flex-col justify-between space-y-3 ${plano.destaque ? 'border-primary/60 shadow-md' : 'border-border/80'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-base text-foreground">{plano.nome}</span>
                        {plano.destaque && (
                          <span className="bg-primary/10 text-primary border border-primary/30 text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full">
                            Mais Escolhido
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline text-foreground">
                        <span className="text-2xl font-bold text-primary">R$ {formatPreco(plano.preco)}</span>
                        <span className="text-xs text-muted-foreground ml-1 font-medium">/mês</span>
                      </div>

                      <ul className="space-y-1.5 text-xs text-muted-foreground pt-2 border-t border-border/60">
                        {plano.beneficios.map((b) => (
                          <li key={b} className="flex items-center gap-2 text-foreground font-medium">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" strokeWidth={3} /> {b}
                          </li>
                        ))}
                      </ul>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPlano(plano);
                          setActiveTab('assinatura');
                        }}
                        className="w-full py-2.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer border border-border mt-2"
                      >
                        Assinar {plano.nome}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ABA: MEU PLANO */}
        {activeTab === 'assinatura' && (
          <div className={`mx-auto space-y-6 ${subscription?.status !== 'ativo' ? 'max-w-5xl' : 'max-w-xl'}`}>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Meu Plano</h2>
              <p className="text-muted-foreground text-xs mt-1">Gerencie a sua assinatura mensal ou escolha o plano ideal para você.</p>
            </div>

            {subscription?.status === 'ativo' ? (
              <div className="bg-card/80 p-6 rounded-2xl border border-border/80 space-y-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <span className="text-primary font-bold text-lg">PLANO {planoDisplayName.toUpperCase()}</span>
                    <p className="text-xs text-muted-foreground uppercase mt-0.5">Assinatura Mensal Ativa</p>
                  </div>
                  <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-xs font-bold px-3 py-1 rounded-full">ATIVO</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground text-xs uppercase block">Valor Mensal</span>
                    <span className="text-foreground font-bold">R$ {formatPreco(Number(subscription.price ?? currentPlano?.preco ?? 0))}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase block">Próxima Cobrança</span>
                    <span className="text-foreground font-bold">{new Date(subscription.renews_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase block">Forma de Pagamento</span>
                    <span className="text-foreground">{subscription.card_brand} **** {subscription.card_last4}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase block">Benefícios Inclusos</span>
                    <span className="text-foreground font-bold">{currentPlano ? currentPlano.beneficios.join(' • ') : '—'}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-center">
                  <button
                    onClick={handleOpenStripePortal}
                    disabled={isOpeningPortal}
                    className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground font-bold text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl transition shadow-md cursor-pointer text-gold-glow flex items-center justify-center gap-2"
                  >
                    {isOpeningPortal ? 'Abrindo Portal Stripe...' : '💳 Gerenciar Assinatura, Cartão & Faturas (Stripe)'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {checkoutError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs text-center rounded-xl font-medium">
                    {checkoutError}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {PLANOS.map((plano) => (
                    <div key={plano.key} className={`flex flex-col p-6 rounded-2xl border space-y-4 bg-card/80 transition duration-300 ${plano.destaque ? 'border-primary/60 shadow-lg' : 'border-border/80'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-foreground">{plano.nome}</span>
                        {plano.destaque && <span className="bg-primary/10 text-primary border border-primary/30 text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full">Mais Escolhido</span>}
                      </div>
                      <div>
                        <span className="text-primary text-3xl font-bold">R$ {formatPreco(plano.preco)}</span>
                        <span className="text-xs text-muted-foreground font-normal"> / mês</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed font-light flex-1">{plano.descricao}</p>
                      <ul className="space-y-2 pt-3 border-t border-border/60">
                        {plano.beneficios.map((b) => (
                          <li key={b} className="flex items-center gap-2 text-xs text-foreground font-medium">
                            <Check className="w-4 h-4 text-emerald-500 shrink-0" strokeWidth={3} /> {b}
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        disabled={redirectingPlan === plano.key}
                        onClick={() => handleStartStripeCheckout(plano.key)}
                        className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground text-xs tracking-wider uppercase font-bold px-4 py-3 rounded-xl transition shadow-md cursor-pointer text-gold-glow mt-auto flex items-center justify-center gap-2"
                      >
                        {redirectingPlan === plano.key ? 'Redirecionando Stripe...' : `Assinar ${plano.nome}`}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA: AGENDAR */}
        {activeTab === 'agendar' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Reservar Horário</h2>
              <p className="text-muted-foreground text-xs mt-1 uppercase tracking-wider">Como assinante, seus agendamentos elegíveis dentro do seu plano possuem valor zerado.</p>
            </div>
            <div className="bg-card/80 p-6 rounded-2xl border border-border/80 shadow-sm">
              <BookingWizard
                services={services}
                onBookingSuccess={() => {
                  fetchBookings();
                  setActiveTab('agendamentos');
                }}
                loggedClient={loggedClient}
                onClientLogin={onProfileUpdate}
              />
            </div>
          </div>
        )}

        {/* ABA: MEUS AGENDAMENTOS */}
        {activeTab === 'agendamentos' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Meus Agendamentos</h2>
              <p className="text-muted-foreground text-xs mt-1 uppercase tracking-wider">Histórico de horários reservados na barbearia</p>
            </div>

            {loadingBookings ? (
              <div className="text-center py-12 text-muted-foreground text-xs uppercase">Carregando seus horários...</div>
            ) : clientBookings.length === 0 ? (
              <div className="bg-card/80 p-8 text-center border border-border/80 rounded-2xl text-muted-foreground text-xs">
                Você não possui nenhum agendamento registrado. Clique em "Novo Agendamento" para marcar!
              </div>
            ) : (
              <div className="space-y-4">
                {clientBookings.map((b: any) => {
                  const dataInicio = new Date(b.inicio_em);
                  const isFuture = dataInicio > new Date();
                  return (
                    <div key={b.id} className="bg-card/80 p-5 rounded-2xl border border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm hover:shadow-md transition">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-md border border-primary/20 uppercase">
                          Código {b.id}
                        </span>
                        <h4 className="text-sm font-bold text-foreground pt-1">
                          {dataInicio.toLocaleDateString('pt-BR')} às {dataInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}h
                        </h4>
                        <p className="text-xs text-muted-foreground font-light">
                          Valor Cobrado: {b.preco_cobrado === 0 ? <span className="text-primary font-bold">Incluso no Plano</span> : `R$ ${Number(b.preco_cobrado).toFixed(2)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs uppercase tracking-wider px-2.5 py-0.5 rounded-full font-bold border ${
                          b.status === 'cancelado' 
                            ? 'bg-red-500/10 text-red-500 border-red-500/30' 
                            : b.status === 'concluido' 
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' 
                              : 'bg-primary/10 text-primary border-primary/30'
                        }`}>
                          {b.status}
                        </span>
                        {isFuture && b.status !== 'cancelado' && (
                          <button onClick={() => handleCancelBooking(b.id)} className="text-red-500 hover:text-red-600 text-xs uppercase font-bold py-1.5 px-3 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition cursor-pointer">
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA: MEUS DADOS */}
        {activeTab === 'perfil' && (
          <div className="max-w-xl mx-auto space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Editar Perfil</h2>
              <p className="text-muted-foreground text-xs mt-1">Mantenha seus dados e contato de WhatsApp atualizados no sistema.</p>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              {profileSaveSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs text-center rounded-xl flex items-center justify-center gap-1.5 font-bold">
                  <Check className="w-4 h-4" /> DADOS ATUALIZADOS COM SUCESSO!
                </div>
              )}
              {profileError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs text-center rounded-xl font-medium">
                  {profileError}
                </div>
              )}

              <div className="bg-card/80 p-6 rounded-2xl border border-border/80 space-y-4 shadow-sm">
                <div className="space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider font-bold text-muted-foreground block">Nome Completo:</label>
                    <input type="text" required value={profileName} onChange={(e) => setProfileName(e.target.value)} className="w-full bg-background border border-border/80 rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider font-bold text-muted-foreground block">WhatsApp / Celular com DDD:</label>
                    <input type="text" required value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} className="w-full bg-background border border-border/80 rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary" />
                  </div>
                </div>

                <button type="submit" className="w-full bg-gradient-to-r from-primary via-primary/90 to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl transition shadow-md cursor-pointer text-gold-glow">
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        )}

      </main>
    </div>
  );
}
// End of UserLayout component
