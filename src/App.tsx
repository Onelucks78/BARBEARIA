import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scissors } from 'lucide-react';
import { Servico, Produto } from './types.ts';
import VisitorLayout from './components/VisitorLayout.tsx';
import AdminLayout from './components/AdminLayout.tsx';
import UserLayout from './components/UserLayout.tsx';
import AuthModal from './components/AuthModal.tsx';
import { useAdminSession, signOut } from './lib/useAdminSession.ts';
import { supabase } from './lib/supabase.ts';

function formatNameFromEmail(email: string): string {
  if (!email) return 'Cliente';
  const rawPart = email.split('@')[0] || '';
  const cleaned = rawPart.replace(/[0-9]+/g, ' ').replace(/[\._\-]+/g, ' ');
  const words = cleaned.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'Cliente';
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function cleanClientName(name: string | undefined, email: string): string {
  if (!name || name.includes('@') || name.includes('.com') || name.includes('.') || name.includes('_') || name.includes('-')) {
    const raw = (name && !name.includes('@')) ? name : email;
    return formatNameFromEmail(raw);
  }
  return name;
}

export default function App() {
  const adminSession = useAdminSession();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [services, setServices] = useState<Servico[]>([]);
  const [products, setProducts] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);

  // Cliente user state (sessão Supabase do cliente logado)
  const [loggedClient, setLoggedClient] = useState<{
    nome: string;
    email: string;
    telefone: string;
    foto_url?: string;
    observacoes?: string;
  } | null>(null);

  // Pending booking auto-submit after Google login
  const [pendingBookingSuccess, setPendingBookingSuccess] = useState<any>(null);
  const pendingBookedRef = useRef(false);

  // Sincroniza loggedClient com a sessão Supabase (cliente não-admin)
  // + puxa perfil do servidor pra pegar telefone persistido
  useEffect(() => {
    if (adminSession.loading) return;

    const session = adminSession.session;
    if (session && !session.isAdmin) {
      const meta = session.user.user_metadata as any;
      const email = session.user.email || '';
      const fromSession = {
        nome: cleanClientName(meta?.nome || meta?.full_name, email),
        email,
        telefone: meta?.telefone || '',
        foto_url: meta?.avatar_url || meta?.picture
      };
      setLoggedClient(fromSession);
      try { localStorage.setItem('logged_client', JSON.stringify(fromSession)); } catch {}

      // Mescla com perfil do servidor (telefone persistido, observações, etc)
      fetch(`/api/cliente/perfil?email=${encodeURIComponent(email)}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.found && data.profile) {
            setLoggedClient(prev => {
              const merged = {
                nome: data.profile.nome || prev?.nome || '',
                email: data.profile.email || prev?.email || '',
                telefone: data.profile.telefone || prev?.telefone || '',
                foto_url: data.profile.foto_url || prev?.foto_url,
                observacoes: data.profile.observacoes || prev?.observacoes
              };
              try { localStorage.setItem('logged_client', JSON.stringify(merged)); } catch {}
              return merged;
            });
          }
        })
        .catch(err => console.error('Erro ao sincronizar perfil:', err));
    } else if (!session) {
      // Sem sessão: limpa localStorage
      try { localStorage.removeItem('logged_client'); } catch {}
      setLoggedClient(null);
    }
  }, [adminSession.session, adminSession.loading]);

  // Auto-submit pending booking when loggedClient becomes available after Google login
  useEffect(() => {
    if (!loggedClient || pendingBookedRef.current) return;
    const pendingJson = localStorage.getItem('pending_booking');
    if (!pendingJson) return;
    let pending: any;
    try { pending = JSON.parse(pendingJson); } catch { return; }
    pendingBookedRef.current = true;

    fetch('/api/agendamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        servico_id: pending.servico_id,
        profissional_id: pending.profissional_id,
        data: pending.data,
        horario: pending.horario,
        nome_cliente: loggedClient.nome || pending.nome_cliente,
        telefone_cliente: loggedClient.telefone || pending.telefone_cliente || '',
        observacao: pending.observacao || '',
        cliente_email: loggedClient.email
      })
    }).then(async res => {
      if (res.ok) {
        localStorage.removeItem('pending_booking');
        const data = await res.json();
        setPendingBookingSuccess({
          ...data,
          profissionalNome: pending.profissionalNome,
          servicesNames: pending.servicesNames,
          totalPreco: pending.totalPreco,
          totalDuracao: pending.totalDuracao
        });
        try { window.dispatchEvent(new CustomEvent('agendamento-criado')); } catch {}
      } else {
        pendingBookedRef.current = false;
      }
    }).catch(() => {
      pendingBookedRef.current = false;
    });
  }, [loggedClient]);

  // Hidrata loggedClient do localStorage no boot (sobrevive a reload)
  useEffect(() => {
    if (adminSession.loading) return;
    if (adminSession.session) return; // useEffect acima cuida
    try {
      const saved = localStorage.getItem('logged_client');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.email) setLoggedClient(parsed);
      }
    } catch {}
  }, [adminSession.loading, adminSession.session]);

  const handleClientLogin = async (client: any) => {
    setLoggedClient(client);
  };

  const handleClientLogout = async () => {
    setLoggedClient(null);
    await signOut();
  };

  // Sync load public catalog and client profile from database
  const loadCatalogData = () => {
    Promise.all([
      fetch('/api/servicos').then(res => res.json()),
      fetch('/api/produtos').then(res => res.json())
    ])
    .then(([servicesData, productsData]) => {
      setServices(servicesData);
      setProducts(productsData);
    })
    .catch((err) => {
      console.error('Falha ao carregar catálogo público:', err);
    })
    .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.supabaseOffline) {
          localStorage.setItem('supabase_offline', 'true');
        } else {
          localStorage.removeItem('supabase_offline');
        }
      })
      .catch(() => {
        localStorage.setItem('supabase_offline', 'true');
      });

    loadCatalogData();
  }, []);

  const handleBookingSuccess = () => {
    loadCatalogData();
  };

  if (loading || adminSession.loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-white/95 space-y-4">
        <div className="w-12 h-12 bg-amber-600 rounded-2xl flex items-center justify-center text-white border border-amber-500/20 animate-spin">
          <Scissors className="w-6 h-6" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="font-black text-xl tracking-tight uppercase text-white">Detalhe Barbearia</h2>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Carregando poltronas e navalhas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#faf9f6]/95 min-h-screen selection:bg-amber-600/20">

      {/* Route-like split based on admin session */}
      {adminSession.session?.isAdmin ? (
        <AdminLayout
          session={adminSession.session}
          onLogout={async () => {
            await signOut();
            loadCatalogData();
          }}
        />
      ) : loggedClient ? (
        <UserLayout
          loggedClient={loggedClient}
          onLogout={handleClientLogout}
          onProfileUpdate={handleClientLogin}
          services={services}
          products={products}
        />
      ) : (
        <VisitorLayout
          services={services}
          products={products}
          onAdminLoginClick={() => setShowAuthModal(true)}
          onBookingSuccess={handleBookingSuccess}
          loggedClient={loggedClient}
          onClientLogin={handleClientLogin}
          onClientLogout={handleClientLogout}
        />
      )}

      {/* Auth Modal Overlay */}
      <AnimatePresence>
        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onLoginSuccess={() => {
              // Sessão Supabase atualiza via onAuthStateChange automaticamente
            }}
          />
        )}
      </AnimatePresence>

      {/* Pending Booking Success Popup */}
      <AnimatePresence>
        {pendingBookingSuccess && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
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
              className="relative z-10 w-full max-w-sm bg-card border border-border rounded-sm shadow-2xl p-8 text-center space-y-5"
            >
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto border border-emerald-200 dark:border-emerald-900/50 shadow-lg">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-normal text-foreground tracking-wide">Agendamento Confirmado!</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Seu horário foi reservado com sucesso na <strong className="text-primary">Detalhe Barbearia</strong>.
                </p>
              </div>

              <div className="bg-muted/40 border border-border rounded-sm p-4 text-xs space-y-2 text-left">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Código:</span>
                  <span className="font-bold text-primary">{pendingBookingSuccess.codigo || pendingBookingSuccess.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-semibold text-foreground">{loggedClient?.nome || pendingBookingSuccess.nome_cliente}</span>
                </div>
                {pendingBookingSuccess.profissionalNome && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profissional:</span>
                    <span className="font-semibold text-foreground">{pendingBookingSuccess.profissionalNome}</span>
                  </div>
                )}
                {pendingBookingSuccess.servicesNames && pendingBookingSuccess.servicesNames.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Serviço(s):</span>
                    <span className="font-semibold text-foreground text-right max-w-[180px] break-words">
                      {pendingBookingSuccess.servicesNames.join(' + ')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quando:</span>
                  <span className="font-bold text-foreground">
                    {(() => {
                      try {
                        const [d, t] = pendingBookingSuccess.inicio_em?.split('T') || [];
                        return `${d?.split('-').reverse().join('/')} às ${t?.slice(0, 5)}h`;
                      } catch { return ''; }
                    })()}
                  </span>
                </div>
                {pendingBookingSuccess.totalPreco !== undefined && (
                  <div className="flex justify-between border-t border-border/50 pt-2 font-bold">
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="text-primary font-bold">
                      {pendingBookingSuccess.totalPreco === 0 ? 'Grátis (Plano VIP)' : `R$ ${Number(pendingBookingSuccess.totalPreco).toFixed(2).replace('.', ',')}`}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setPendingBookingSuccess(null);
                  pendingBookedRef.current = false;
                }}
                className="w-full bg-gradient-to-r from-primary to-primary/70 hover:from-primary/80 hover:to-primary text-black text-xs uppercase tracking-widest font-black py-3.5 rounded-sm transition-all cursor-pointer shadow-md"
              >
                Fechar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
