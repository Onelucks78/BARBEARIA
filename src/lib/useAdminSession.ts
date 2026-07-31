import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { telefoneParaEmail, telefoneEValido } from '../../lib/telefone';
import type { Session, User } from '@supabase/supabase-js';

export interface AdminSession {
  session: Session;
  user: User;
  isAdmin: boolean;
  barbeiroId?: string;
}

/**
 * Hook que observa a sessão do Supabase Auth e identifica se o usuário
 * é admin (tem role='admin' e barbeiro_id no app_metadata).
 */
export function useAdminSession() {
  const [state, setState] = useState<{
    loading: boolean;
    session: AdminSession | null;
  }>({ loading: true, session: null });

  useEffect(() => {
    let mounted = true;

    async function load() {
      const isOffline = localStorage.getItem('supabase_offline') === 'true';
      const isMockAdmin = localStorage.getItem('mock_admin_session') === 'true';

      if (isMockAdmin) {
        const mockAdmin: AdminSession = {
          session: { access_token: 'mock-token' } as any,
          user: { id: 'mock-admin-id', email: 'barbeiro@imperial.com' } as any,
          isAdmin: true,
          barbeiroId: '00000000-0000-0000-0000-000000000001'
        };
        setState({ loading: false, session: mockAdmin });
        return;
      }

      if (isOffline) {
        const savedClient = localStorage.getItem('logged_client');
        if (savedClient) {
          try {
            const parsed = JSON.parse(savedClient);
            const mockClient: AdminSession = {
              session: { access_token: 'mock-token' } as any,
              user: {
                id: 'mock-client-id',
                email: parsed.email || 'cliente@teste.com',
                user_metadata: {
                  nome: parsed.nome || '',
                  telefone: parsed.telefone || ''
                }
              } as any,
              isAdmin: false
            };
            setState({ loading: false, session: mockClient });
            return;
          } catch {}
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setState({ loading: false, session: session ? toAdminSession(session) : null });
    }

    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const isOffline = localStorage.getItem('supabase_offline') === 'true';
      const isMockAdmin = localStorage.getItem('mock_admin_session') === 'true';

      if (isMockAdmin) {
        const mockAdmin: AdminSession = {
          session: { access_token: 'mock-token' } as any,
          user: { id: 'mock-admin-id', email: 'barbeiro@imperial.com' } as any,
          isAdmin: true,
          barbeiroId: '00000000-0000-0000-0000-000000000001'
        };
        setState({ loading: false, session: mockAdmin });
        return;
      }

      if (isOffline) {
        const savedClient = localStorage.getItem('logged_client');
        if (savedClient) {
          try {
            const parsed = JSON.parse(savedClient);
            const mockClient: AdminSession = {
              session: { access_token: 'mock-token' } as any,
              user: {
                id: 'mock-client-id',
                email: parsed.email || 'cliente@teste.com',
                user_metadata: {
                  nome: parsed.nome || '',
                  telefone: parsed.telefone || ''
                }
              } as any,
              isAdmin: false
            };
            setState({ loading: false, session: mockClient });
            return;
          } catch {}
        }
      }

      setState({ loading: false, session: session ? toAdminSession(session) : null });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}

function toAdminSession(session: Session): AdminSession {
  const role = (session.user.app_metadata as any)?.role;
  const barbeiroId = (session.user.app_metadata as any)?.barbeiro_id;
  return {
    session,
    user: session.user,
    isAdmin: role === 'admin',
    barbeiroId
  };
}

/**
 * Login com Google — usado tanto pelo admin quanto pelo cliente.
 * A diferenciação admin/cliente é feita DEPOIS do login, checando app_metadata.role.
 */
export async function signInWithGoogle() {
  const isOffline = localStorage.getItem('supabase_offline') === 'true';
  if (isOffline) {
    const mockClient = {
      nome: 'Cliente de Teste (Offline)',
      email: 'cliente@teste.com',
      telefone: '11999999999'
    };
    localStorage.setItem('logged_client', JSON.stringify(mockClient));
    window.location.reload();
    return { data: { user: {} }, error: null };
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: { prompt: 'select_account' }
    }
  });
  return { data, error };
}

export async function signInAdminWithGoogle() {
  return signInWithGoogle();
}

/**
 * Login do cliente (visitante) via e-mail + senha.
 */
export async function signInClient(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpClient(email: string, password: string, nome: string, telefone: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nome, telefone, role: 'cliente' }
    }
  });
  return { data, error };
}

/**
 * Login do cliente por telefone. Por baixo é o mesmo signInWithPassword de sempre —
 * só o e-mail é derivado do telefone. O cliente nunca vê esse endereço.
 */
export async function signInClientTelefone(telefone: string, senha: string) {
  if (!telefoneEValido(telefone)) {
    return { data: null, error: { message: 'Telefone inválido. Use DDD + número.' } as any };
  }
  return supabase.auth.signInWithPassword({
    email: telefoneParaEmail(telefone),
    password: senha
  });
}

/**
 * Cadastro por telefone. O usuário é criado no servidor (Admin API, com o e-mail já
 * confirmado); aqui só entramos na conta em seguida para o cliente não precisar
 * digitar tudo de novo.
 */
export async function signUpClientTelefone(nome: string, telefone: string, senha: string) {
  if (!telefoneEValido(telefone)) {
    return { data: null, error: { message: 'Telefone inválido. Use DDD + número.' } as any };
  }

  const res = await fetch('/api/auth/cadastro-telefone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, telefone, senha })
  });
  const payload = await res.json().catch(() => ({} as any));

  if (!res.ok) {
    return {
      data: null,
      error: { message: payload.error || 'Não foi possível criar a conta.', code: payload.code } as any
    };
  }

  return signInClientTelefone(telefone, senha);
}

export async function signOut() {
  localStorage.removeItem('mock_admin_session');
  localStorage.removeItem('logged_client');
  return supabase.auth.signOut();
}
