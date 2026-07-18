import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const url = process.env.SUPABASE_URL!;
const anon = createClient(url, process.env.SUPABASE_ANON_KEY!);
const svc = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false }
});

(async () => {
  console.log('--- ANON ---');
  const a1 = await anon.from('barbeiros').select('id, slug, ativo').eq('slug', 'imperial');
  console.log('barbeiros (anon):', a1.data, a1.error?.message);

  const a2 = await anon.from('servicos').select('id, nome, ativo, ordem').eq('ativo', true).order('ordem');
  console.log('servicos (anon):', a2.data?.length, 'rows', a2.error?.message);

  console.log('\n--- SERVICE ---');
  const s1 = await svc.from('barbeiros').select('id, slug, ativo').eq('slug', 'imperial');
  console.log('barbeiros (svc):', s1.data, s1.error?.message);

  const s2 = await svc.from('servicos').select('id, nome, ativo, ordem').eq('ativo', true).order('ordem');
  console.log('servicos (svc):', s2.data?.length, 'rows', s2.error?.message);

  console.log('\n--- STORAGE.LISTACTIVESERVICOS ---');
  const { listActiveServicos } = await import('../server/storage.ts');
  try {
    const list = await listActiveServicos('imperial');
    console.log('listActiveServicos(imperial):', list.length, list.map(s => s.nome).join(', '));
  } catch (e: any) {
    console.log('ERR:', e.message);
  }
})();
