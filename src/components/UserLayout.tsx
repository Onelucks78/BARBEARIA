import React, { useState, useEffect } from 'react';
import { 
  User, Calendar, CreditCard, LogOut, Scissors, 
  Settings, ShieldCheck, Sparkles, Clock, MapPin, 
  PhoneCall, Mail, ChevronRight, CheckCircle2,
  Camera, Check, Upload, X
} from 'lucide-react';
import { Servico, Produto } from '../types.ts';
import BookingWizard from './BookingWizard.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';

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

  // Credit Card Checkout States
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Profile Form States
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Synchronize profile inputs with loggedClient prop
  useEffect(() => {
    if (loggedClient) {
      setProfileName(loggedClient.nome);
      setProfilePhone(loggedClient.telefone);
      setProfilePhoto(loggedClient.foto_url || '');
    }
  }, [loggedClient]);

  // Drag and drop handlers
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
          setProfilePhoto(event.target.result as string);
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
          foto_url: profilePhoto,
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

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber || !cardName || !cardExpiry || !cardCvv) {
      setCheckoutError('Preencha todos os campos do cartão.');
      return;
    }
    setIsSubscribing(true);
    setCheckoutError('');
    try {
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);
      
      let currentObsText = '';
      if (loggedClient.observacoes) {
        try {
          if (loggedClient.observacoes.trim().startsWith('{')) {
            const parsed = JSON.parse(loggedClient.observacoes);
            currentObsText = parsed.observacoes_usuario || '';
          } else {
            currentObsText = loggedClient.observacoes;
          }
        } catch {
          currentObsText = loggedClient.observacoes;
        }
      }

      const packedData = JSON.stringify({
        observacoes_usuario: currentObsText,
        subscription: {
          plan: 'VIP',
          status: 'ativo',
          price: 120.00,
          renews_at: nextMonth.toISOString(),
          card_last4: cardNumber.slice(-4),
          card_brand: 'Mastercard'
        }
      });

      const res = await fetch('/api/cliente/perfil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loggedClient.email,
          nome: loggedClient.nome,
          telefone: loggedClient.telefone,
          foto_url: loggedClient.foto_url || '',
          observacoes: packedData
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.profile) {
          onProfileUpdate(data.profile);
          setCheckoutSuccess(true);
          // Limpa campos
          setCardNumber('');
          setCardName('');
          setCardExpiry('');
          setCardCvv('');
          setTimeout(() => {
            setCheckoutSuccess(false);
            setActiveTab('painel');
          }, 2000);
        }
      } else {
        setCheckoutError('Falha ao processar assinatura.');
      }
    } catch (err) {
      setCheckoutError('Erro de conexão ao assinar.');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Deseja realmente cancelar o seu Plano VIP?')) return;
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
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-64 bg-card border-b lg:border-b-0 lg:border-r border-border flex flex-col justify-between shrink-0 p-6 space-y-6 select-none">
        <div>
          {/* Logo */}
          <div className="flex items-center justify-between gap-3 mb-8">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-sm bg-primary rotate-45 flex items-center justify-center font-bold text-xs text-primary-foreground shrink-0">
                <span className="-rotate-45"><Scissors className="w-4 h-4 text-primary-foreground" /></span>
              </div>
              <div className="min-w-0">
                <span className="font-serif font-normal text-sm tracking-widest uppercase block text-primary">Área do</span>
                <span className="text-xs text-primary/70 font-mono uppercase block -mt-0.5">Cliente VIP</span>
              </div>
            </div>
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
              <span className={`text-xs font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-sm inline-block mt-0.5 ${subscription?.status === 'ativo' ? 'bg-amber-600/10 text-primary border border-primary/30 font-bold' : 'bg-muted text-muted-foreground'}`}>
                {subscription?.status === 'ativo' ? 'Cliente VIP' : 'Cliente Comum'}
              </span>
            </div>
          </div>

          <nav className="space-y-1.5">
            <button onClick={() => setActiveTab('painel')} className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider font-mono cursor-pointer ${activeTab === 'painel' ? 'bg-primary text-black shadow-lg font-black' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
              <User className="w-4 h-4" /> Meu Painel
            </button>
            <button onClick={() => setActiveTab('agendar')} className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider font-mono cursor-pointer ${activeTab === 'agendar' ? 'bg-primary text-black shadow-lg font-black' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
              <Calendar className="w-4 h-4" /> Novo Agendamento
            </button>
            <button onClick={() => setActiveTab('assinatura')} className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider font-mono cursor-pointer ${activeTab === 'assinatura' ? 'bg-primary text-black shadow-lg font-black' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
              <CreditCard className="w-4 h-4" /> Assinatura & Planos
            </button>
            <button onClick={() => setActiveTab('agendamentos')} className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider font-mono cursor-pointer ${activeTab === 'agendamentos' ? 'bg-primary text-black shadow-lg font-black' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
              <Clock className="w-4 h-4" /> Meus Agendamentos
            </button>
            <button onClick={() => setActiveTab('perfil')} className={`w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold flex items-center gap-2.5 transition uppercase tracking-wider font-mono cursor-pointer ${activeTab === 'perfil' ? 'bg-primary text-black shadow-lg font-black' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
              <Settings className="w-4 h-4" /> Meus Dados
            </button>
          </nav>
        </div>

        <button onClick={onLogout} className="w-full text-left px-3.5 py-2.5 rounded-sm text-xs font-semibold text-muted-foreground hover:text-red-600 dark:text-red-400 hover:bg-red-100 dark:bg-red-950/15 border border-border hover:border-red-200 dark:border-red-900/30 transition duration-150 flex items-center gap-2.5 font-mono uppercase tracking-wider cursor-pointer font-bold">
          <LogOut className="w-4 h-4" /> Sair da Conta
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto max-h-screen">
        {activeTab === 'painel' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-3xl font-normal text-white italic">Olá, {loggedClient.nome}!</h2>
              <p className="text-muted-foreground text-xs mt-1 font-mono uppercase tracking-wider">Seja bem-vindo de volta ao seu painel imperial</p>
            </div>

            {/* Overview cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* VIP Plan Status */}
              <div className="glass-panel-premium p-6 rounded-lg border border-border space-y-4 glass-panel-nested">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground block">Status da Assinatura</span>
                {subscription?.status === 'ativo' ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                      <span className="font-serif text-lg font-bold text-white uppercase tracking-wider">Plano VIP Imperial</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-light">Sua assinatura está ativa e renova automaticamente. Você possui cortes de cabelo, barba e sobrancelhas ilimitados.</p>
                    <div className="pt-2 flex items-center justify-between text-xs font-mono text-muted-foreground border-t border-border/60">
                      <span>Renovação automática</span>
                      <span className="text-primary font-bold">Renova em {new Date(subscription.renews_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CreditCard className="w-5 h-5" />
                      <span className="font-serif text-lg font-semibold text-muted-foreground">Nenhum plano ativo</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-light">Assine o Plano VIP da Detalhe Barbearia por apenas R$ 120,00/mês e tenha cortes de cabelo, barba e sobrancelhas ilimitados, sem taxas extras.</p>
                    <button onClick={() => setActiveTab('assinatura')} className="inline-flex bg-gradient-to-r from-primary to-primary/70 hover:from-primary/80 hover:to-primary text-black text-xs tracking-widest uppercase font-black px-4 py-2.5 rounded transition shadow-md cursor-pointer">
                      Assinar Plano VIP
                    </button>
                  </div>
                )}
              </div>

              {/* Next Session */}
              <div className="glass-panel-premium p-6 rounded-lg border border-border space-y-4 glass-panel-nested">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground block">Próxima Sessão</span>
                {clientBookings.length > 0 && new Date(clientBookings[0].inicio_em) > new Date() ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                      <Calendar className="w-5 h-5" />
                      <span className="font-serif text-lg font-semibold text-white">
                        {new Date(clientBookings[0].inicio_em).toLocaleDateString('pt-BR')} às {new Date(clientBookings[0].inicio_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">Código: <span className="font-mono text-primary">{clientBookings[0].id}</span></p>
                    <div className="pt-2 flex items-center justify-between text-xs font-mono text-muted-foreground border-t border-border/60">
                      <span>Status: <span className="text-primary font-bold">{clientBookings[0].status}</span></span>
                      <button onClick={() => setActiveTab('agendamentos')} className="text-primary hover:underline cursor-pointer">Ver detalhes</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Você não possui nenhum agendamento pendente para os próximos dias.</p>
                    <button onClick={() => setActiveTab('agendar')} className="inline-flex border border-primary/40 hover:border-primary text-primary text-xs tracking-widest uppercase font-mono px-4 py-2.5 rounded transition cursor-pointer">
                      Agendar Horário
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'assinatura' && (
          <div className="max-w-xl mx-auto space-y-6">
            <div>
              <h2 className="font-serif text-2xl font-normal text-white italic">Gerenciar Assinatura</h2>
              <p className="text-muted-foreground text-xs mt-1">Tenha cortes de cabelo, barba e sobrancelhas ilimitadas na poltrona do Carlos.</p>
            </div>

            {subscription?.status === 'ativo' ? (
              <div className="glass-panel-premium p-6 rounded-lg border border-border space-y-6 glass-panel-nested">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <span className="text-primary font-serif font-bold text-lg">PLANO VIP IMPERIAL</span>
                    <p className="text-xs font-mono text-muted-foreground uppercase mt-0.5">Assinatura Mensal Ativa</p>
                  </div>
                  <span className="bg-primary/10 text-primary border border-primary/30 text-xs font-mono font-bold px-2 py-1 rounded">VIP ACTIVATED</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground text-xs uppercase font-mono block">Valor Mensal</span>
                    <span className="text-white font-bold">R$ 120,00</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase font-mono block">Próxima Cobrança (Tempo Limite)</span>
                    <span className="text-white font-bold">{new Date(subscription.renews_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase font-mono block">Forma de Pagamento</span>
                    <span className="text-white font-mono">{subscription.card_brand} **** {subscription.card_last4}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase font-mono block">Tipo de Benefício</span>
                    <span className="text-white font-bold">Cabelo/Barba/Sobrancelha ilimitados</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex justify-end">
                  <button onClick={handleCancelSubscription} className="text-red-600 dark:text-red-400 hover:dark:text-red-300 font-mono text-xs uppercase tracking-widest font-bold py-2 px-4 border border-red-200 dark:border-red-900/30 hover:bg-red-100 dark:bg-red-950/15 rounded transition cursor-pointer">
                    Cancelar Assinatura
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-4">
                {checkoutSuccess && (
                  <div className="p-3 bg-primary/10 border border-primary/30 text-primary text-xs text-center rounded-md font-mono flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-primary" /> ASSINATURA REALIZADA COM SUCESSO!
                  </div>
                )}
                {checkoutError && (
                  <div className="p-3 bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs text-center rounded-md font-mono">
                    {checkoutError}
                  </div>
                )}

                <div className="glass-panel-premium p-6 rounded-lg border border-border space-y-4 glass-panel-nested">
                  <div className="text-center pb-2 border-b border-border/60">
                    <span className="text-primary font-serif text-lg font-bold">R$ 120,00 <span className="text-xs text-muted-foreground font-normal">/ mês</span></span>
                  </div>

                  {/* Simulated Card Design */}
                  <div className="w-full h-40 bg-gradient-to-br from-primary via-primary/70 to-card rounded-lg p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden select-none">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
                    <div className="flex justify-between items-start">
                      <span className="font-serif  font-black text-black tracking-wider text-sm">Imperial VIP</span>
                      <span className="font-mono text-xs text-black/70 font-bold">CRÉDITO</span>
                    </div>
                    <div className="font-mono text-base text-foreground tracking-[0.25em] font-black py-1">
                      {cardNumber ? cardNumber.replace(/(\d{4})/g, '$1 ').trim() : '•••• •••• •••• ••••'}
                    </div>
                    <div className="flex justify-between items-end text-black">
                      <div>
                        <span className="text-[7.5px] uppercase font-mono tracking-wider opacity-70 block">Titular</span>
                        <span className="font-mono text-xs uppercase font-bold tracking-wider truncate max-w-[120px]">{cardName || 'NOME NO CARTÃO'}</span>
                      </div>
                      <div>
                        <span className="text-[7.5px] uppercase font-mono tracking-wider opacity-70 block">Validade</span>
                        <span className="font-mono text-xs font-bold">{cardExpiry || 'MM/AA'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wider font-bold text-muted-foreground font-mono block">Número do Cartão:</label>
                      <input type="text" maxLength={16} required placeholder="5544 3322 1100 9988" value={cardNumber} onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ''))} className="w-full bg-background border border-border rounded px-3 py-2.5 text-foreground focus:outline-none focus:border-primary/80" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wider font-bold text-muted-foreground font-mono block">Nome Impresso:</label>
                      <input type="text" required placeholder="NOME DO TITULAR" value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())} className="w-full bg-background border border-border rounded px-3 py-2.5 text-foreground focus:outline-none focus:border-primary/80" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs uppercase tracking-wider font-bold text-muted-foreground font-mono block">Validade (MM/AA):</label>
                        <input type="text" maxLength={5} required placeholder="12/29" value={cardExpiry} onChange={(e) => {
                          let val = e.target.value.replace(/\D/g, '');
                          if (val.length > 2) val = val.substring(0,2) + '/' + val.substring(2,4);
                          setCardExpiry(val);
                        }} className="w-full bg-background border border-border rounded px-3 py-2.5 text-foreground focus:outline-none focus:border-primary/80" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs uppercase tracking-wider font-bold text-muted-foreground font-mono block">CVV:</label>
                        <input type="password" maxLength={3} required placeholder="123" value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))} className="w-full bg-background border border-border rounded px-3 py-2.5 text-foreground focus:outline-none focus:border-primary/80" />
                      </div>
                    </div>
                  </div>

                  <button type="submit" disabled={isSubscribing} className="w-full bg-gradient-to-r from-primary to-primary/70 hover:from-primary/80 hover:to-primary text-black font-sans text-xs uppercase tracking-widest font-black py-3.5 rounded transition shadow-md cursor-pointer">
                    {isSubscribing ? 'Processando Assinatura...' : 'Confirmar Assinatura VIP'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {activeTab === 'agendar' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="font-serif text-2xl font-normal text-white italic">Reservar Horário VIP</h2>
              <p className="text-muted-foreground text-xs mt-1 font-mono uppercase tracking-wider">Como assinante VIP, seus agendamentos elegíveis de corte e barba possuem valor zerado.</p>
            </div>
            <div className="glass-panel-premium p-6 rounded-lg border border-border glass-panel-nested">
              <BookingWizard
                services={services}
                onBookingSuccess={() => {
                  fetchBookings();
                  setActiveTab('painel');
                }}
                loggedClient={loggedClient}
                onClientLogin={onProfileUpdate}
              />
            </div>
          </div>
        )}

        {activeTab === 'agendamentos' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h2 className="font-serif text-2xl font-normal text-white italic">Meus Agendamentos</h2>
              <p className="text-muted-foreground text-xs mt-1 font-mono uppercase tracking-wider">Histórico de horários reservados na barbearia</p>
            </div>

            {loadingBookings ? (
              <div className="text-center py-12 text-muted-foreground font-mono text-xs uppercase">Carregando seus horários...</div>
            ) : clientBookings.length === 0 ? (
              <div className="glass-panel-premium p-8 text-center border border-border rounded-lg text-muted-foreground text-xs glass-panel-nested">
                Você não possui nenhum agendamento registrado. Clique em "Novo Agendamento" para marcar!
              </div>
            ) : (
              <div className="space-y-4">
                {clientBookings.map((b: any) => {
                  const dataInicio = new Date(b.inicio_em);
                  const isFuture = dataInicio > new Date();
                  return (
                    <div key={b.id} className="glass-panel-premium p-5 rounded-lg border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel-nested">
                      <div className="space-y-1">
                        <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 uppercase">
                          Código {b.id}
                        </span>
                        <h4 className="font-serif text-sm font-semibold text-white pt-1">
                          {dataInicio.toLocaleDateString('pt-BR')} às {dataInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}h
                        </h4>
                        <p className="text-xs text-muted-foreground font-light">
                          Valor Cobrado: {b.preco_cobrado === 0 ? <span className="text-primary font-bold">Incluso no Plano VIP</span> : `R$ ${Number(b.preco_cobrado).toFixed(2)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${
                          b.status === 'cancelado' 
                            ? 'bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/30' 
                            : b.status === 'concluido' 
                              ? 'bg-green-950/20 text-green-400 border-green-900/30' 
                              : 'bg-amber-600/10 text-primary border-primary/30'
                        }`}>
                          {b.status}
                        </span>
                        {isFuture && b.status !== 'cancelado' && (
                          <button onClick={() => handleCancelBooking(b.id)} className="text-red-600 dark:text-red-400 hover:dark:text-red-300 font-mono text-xs uppercase font-bold py-1 px-3 border border-red-200 dark:border-red-900/30 rounded-sm hover:bg-red-100 dark:bg-red-950/10 transition cursor-pointer">
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

        {activeTab === 'perfil' && (
          <div className="max-w-xl mx-auto space-y-6">
            <div>
              <h2 className="font-serif text-2xl font-normal text-white italic">Editar Perfil</h2>
              <p className="text-muted-foreground text-xs mt-1">Mantenha seus dados e foto de perfil atualizados no sistema.</p>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              {profileSaveSuccess && (
                <div className="p-3 bg-primary/10 border border-primary/30 text-primary text-xs text-center rounded-md font-mono flex items-center justify-center gap-1.5 animate-pulse">
                  <Check className="w-4 h-4" /> DADOS ATUALIZADOS COM SUCESSO!
                </div>
              )}
              {profileError && (
                <div className="p-3 bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs text-center rounded-md font-mono">
                  {profileError}
                </div>
              )}

              <div className="glass-panel-premium p-6 rounded-lg border border-border space-y-4 glass-panel-nested">
                <div className="space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider font-bold text-muted-foreground font-mono block">Nome:</label>
                    <input type="text" required value={profileName} onChange={(e) => setProfileName(e.target.value)} className="w-full bg-background border border-border rounded px-3 py-2.5 text-foreground focus:outline-none focus:border-primary/80" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider font-bold text-muted-foreground font-mono block">WhatsApp / Celular:</label>
                    <input type="text" required value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} className="w-full bg-background border border-border rounded px-3 py-2.5 text-foreground focus:outline-none focus:border-primary/80" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider font-bold text-muted-foreground font-mono block">Foto de Perfil (Arraste ou Selecione):</label>
                    <div 
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`relative w-full border border-dashed rounded-md p-5 text-center flex flex-col items-center justify-center transition cursor-pointer ${
                        isDragging ? 'border-primary bg-primary/5' : 'border-border bg-background/40 hover:border-primary/40'
                      }`}
                    >
                      <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" id="dashboard-photo-upload" />
                      <div className="flex flex-col items-center gap-1.5">
                        {profilePhoto ? (
                          <div className="relative w-12 h-12 rounded-full overflow-hidden border border-primary/40 mb-1.5">
                            <img src={profilePhoto} className="w-full h-full object-cover" alt="Preview" />
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition duration-150">
                              <Camera className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        ) : (
                          <Camera className="w-6 h-6 text-muted-foreground mb-1.5" />
                        )}
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">Arraste a foto ou clique para escolher</span>
                        <span className="text-[7.5px] text-muted-foreground font-mono">JPG, PNG ou WEBP</span>
                      </div>
                    </div>
                  </div>
                </div>

                <button type="submit" className="w-full bg-gradient-to-r from-primary to-primary/70 hover:from-primary/80 hover:to-primary text-black font-sans text-xs uppercase tracking-widest font-black py-3.5 rounded transition shadow-md cursor-pointer">
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
