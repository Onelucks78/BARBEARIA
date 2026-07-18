import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lê env vars em runtime (não em import-time) pra não depender
// da ordem de carregamento do dotenv.
function getEnv() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, anonKey, serviceKey };
}

let _anonClient: SupabaseClient | null | undefined;
let _serviceClient: SupabaseClient | null | undefined;

let _isSupabaseOffline = false;

export function setSupabaseOffline(offline: boolean) {
  _isSupabaseOffline = offline;
}

export function isSupabaseConfigured(): boolean {
  if (_isSupabaseOffline) return false;
  const { url, anonKey } = getEnv();
  return Boolean(url && anonKey);
}

// Cliente usado pelo front via /api/* — repassa o JWT do usuário pro Supabase
export function anonClient(): SupabaseClient | null {
  if (_anonClient !== undefined) return _anonClient;
  const { url, anonKey } = getEnv();
  _anonClient = url && anonKey ? createClient(url, anonKey) : null;
  return _anonClient;
}

// Cliente do servidor — SÓ pra bypass de RLS quando já verificamos o JWT manualmente
export function serviceClient(): SupabaseClient | null {
  if (_serviceClient !== undefined) return _serviceClient;
  const { url, serviceKey } = getEnv();
  _serviceClient = url && serviceKey ? createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  }) : null;
  return _serviceClient;
}
