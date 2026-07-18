import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scissors } from 'lucide-react';
import { Servico, Produto } from './types.ts';
import VisitorLayout from './components/VisitorLayout.tsx';
import AdminLayout from './components/AdminLayout.tsx';
import UserLayout from './components/UserLayout.tsx';
import AuthModal from './components/AuthModal.tsx';
import { useAdminSession, signOut } from './lib/useAdminSession.ts';
import { supabase } from './lib/supabase.ts';

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
  } | null>(null);

  // Sincroniza loggedClient com a sessão Supabase (cliente não-admin)
  // + puxa perfil do servidor pra pegar telefone persistido
  useEffect(() => {
    if (adminSession.loading) return;

    const session = adminSession.session;
    if (session && !session.isAdmin) {
      const meta = session.user.user_metadata as any;
      const email = session.user.email || '';
      const fromSession = {
        nome: meta?.nome || email.split('@')[0] || '',
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
                foto_url: data.profile.foto_url || prev?.foto_url
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

    </div>
  );
}
