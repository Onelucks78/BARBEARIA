import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta as any).env?.VITE_SUPABASE_URL
  ?? (window as any).__SUPABASE_URL__
  ?? 'https://ghguwhclrlzdwaqhhnhq.supabase.co';

const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY
  ?? (window as any).__SUPABASE_ANON_KEY__
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoZ3V3aGNscmx6ZHdhcWhobmhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MDE0MDcsImV4cCI6MjA5NzQ3NzQwN30.A_yIW8NOtVZME_JeutJBu-NnfK1LyDPhV7rMuUUdOss';

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export const isSupabaseConfigured = Boolean(url && anonKey);

export interface FetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: any;
  headers?: Record<string, string>;
}

/**
 * Wrapper de fetch que adiciona automaticamente o JWT do Supabase
 * no header Authorization para o servidor Express.
 *
 * Uso:
 *   const res = await authedFetch('/api/admin/servicos');
 *   const res = await authedFetch('/api/admin/servicos/123', { method: 'PATCH', body: { ... } });
 */
export async function authedFetch(input: string, options: FetchOptions = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(input, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
}
