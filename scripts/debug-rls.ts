import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const url = process.env.SUPABASE_URL!;
const anon = createClient(url, process.env.SUPABASE_ANON_KEY!);

(async () => {
  console.log('Testando insert anon...');
  const { data, error } = await anon.from('agendamentos').insert({
    barbeiro_id: '00000000-0000-0000-0000-000000000001',
    servico_id: '10000000-0000-0000-0000-000000000001',
    nome_cliente: 'Teste RLS',
    telefone_cliente: '11999990000',
    inicio_em: '2026-06-22T09:30:00',
    fim_em: '2026-06-22T10:10:00',
    status: 'agendado',
    preco_cobrado: 60
  }).select('id').single();
  console.log('Resultado:', { data, error });
  if (data) {
    await createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
      .from('agendamentos').delete().eq('id', data.id);
  }
})();
