import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não encontrados em .env.local');
  }

  const client = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: existing, error: listError } = await client.storage.listBuckets();
  if (listError) throw listError;

  if (existing?.some(b => b.name === 'imagens')) {
    console.log('Bucket "imagens" já existe, nada a fazer.');
    return;
  }

  const { error } = await client.storage.createBucket('imagens', {
    public: true,
    fileSizeLimit: '5MB',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
  });
  if (error) throw error;

  console.log('Bucket "imagens" criado com sucesso (público).');
}

main().catch(e => { console.error(e); process.exit(1); });
