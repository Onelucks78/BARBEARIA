import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured } from './supabase.ts';export interface AuthRequest extends Request {
  isAdmin?: boolean;
  userId?: string;
  barbeiroId?: string;
  userEmail?: string;
  userType?: 'admin' | 'cliente' | 'anon';
}

/**
 * Cria um client Supabase que repassa o JWT do usuário pra RLS funcionar.
 * IMPORTANTE: esse client tem as permissões do USUÁRIO, não do service role.
 */
export function getUserClient(authHeader?: string): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    token
      ? { global: { headers: { Authorization: `Bearer ${token}` } } }
      : {}
  );
}

/**
 * Middleware que substitui o antigo verifyAdminToken.
 * Espera JWT do Supabase Auth (Google pro admin, email/senha pro cliente).
 * Adiciona req.userId, req.barbeiroId, req.userType, req.isAdmin.
 *
 * Regras:
 *   - admin (Google): role='admin' em app_metadata → isAdmin=true
 *   - cliente autenticado: qualquer outro usuário logado → userType='cliente'
 *   - sem token: passa adiante como anon (rotas públicas decidem o que fazer)
 */
/**
 * Atalho de desenvolvimento local (token fixo vira admin).
 * NUNCA pode valer em produção: seria acesso de administrador sem senha para
 * qualquer um que enviasse o cabeçalho. Na Vercel, process.env.VERCEL é
 * embutido como true no build (ver script "build:api"), então o atalho morre lá.
 *
 * MORPH-003: além do NODE_ENV/VERCEL, exige ALLOW_MOCK_AUTH=true EXPLÍCITO.
 * Sem isso, um deploy Express standalone com NODE_ENV não-produção (ex: VPS com
 * `npm start` e NODE_ENV vazio) abriria admin total sem senha.
 */
const MOCK_AUTH_PERMITIDO =
  process.env.ALLOW_MOCK_AUTH === 'true' &&
  process.env.NODE_ENV !== 'production' &&
  !process.env.VERCEL;

export async function attachUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      req.userType = 'anon';
      return next();
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token === 'mock-token') {
      if (!MOCK_AUTH_PERMITIDO) {
        return res.status(401).json({ error: 'Token inválido ou expirado.' });
      }
      req.userId = 'mock-admin-id';
      req.userEmail = 'barbeiro@imperial.com';
      req.isAdmin = true;
      // Mesmo id semeado em 004_seed.sql — 'b-1' era herança do db.json e
      // fazia o painel de teste abrir vazio.
      req.barbeiroId = '00000000-0000-0000-0000-000000000001';
      req.userType = 'admin';
      return next();
    }

    const client = getUserClient(authHeader);
    if (!client) {
      return res.status(500).json({ error: 'Supabase não configurado no servidor.' });
    }

    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    req.userId = data.user.id;
    req.userEmail = data.user.email;

    const role = (data.user.app_metadata as any)?.role;
    const barbeiroId = (data.user.app_metadata as any)?.barbeiro_id;

    if (role === 'admin' && barbeiroId) {
      req.isAdmin = true;
      req.barbeiroId = barbeiroId;
      req.userType = 'admin';
    } else {
      req.userType = 'cliente';
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Bloqueia a rota se não for admin autenticado.
 * Substitui o antigo verifyAdminToken.
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.isAdmin || !req.barbeiroId) {
    return res.status(401).json({ error: 'Não autorizado. Faça o login administrativo.' });
  }
  next();
}

/**
 * Bloqueia se não for admin OU cliente logado.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userType === 'anon') {
    return res.status(401).json({ error: 'Login necessário.' });
  }
  next();
}
