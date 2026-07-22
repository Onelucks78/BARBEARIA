// scripts/test-foto-profissional.ts
// Verifica o upload de foto do barbeiro no Supabase Storage de ponta a ponta:
// sobe o arquivo, confere que a URL pública responde, grava no barbeiro e limpa tudo.

import { config } from 'dotenv';
config({ path: '.env.local' });

import { Client } from 'pg';
import { serviceClient } from '../server/supabase.ts';
import * as storage from '../server/storage.ts';

let falhas = 0;
function check(nome: string, ok: boolean, detalhe = '') {
  console.log(`${ok ? 'PASSA' : 'FALHA'}  ${nome}${detalhe ? ' — ' + detalhe : ''}`);
  if (!ok) falhas++;
}

// PNG 2x2 vermelho, menor imagem válida possível
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';

async function main() {
  const pg = new Client({
    connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${process.env.SUPABASE_PROJECT_REF}.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false }
  });
  await pg.connect();

  const sb = serviceClient();
  if (!sb) throw new Error('Supabase service client indisponível.');

  const shopId = (await pg.query(`select id from barbeiros where slug='imperial'`)).rows[0].id;
  let filePath: string | null = null;
  let profId: string | null = null;

  try {
    // ---------- 1. O bucket existe? ----------
    const { data: buckets } = await sb.storage.listBuckets();
    const bucket = buckets?.find(b => b.name === 'imagens');
    check('Bucket "imagens" existe', !!bucket, bucket ? `público: ${bucket.public}` : 'não encontrado');
    check('Bucket é público (URL abre sem token)', bucket?.public === true);

    // ---------- 2. Upload na pasta profissionais/ ----------
    filePath = `profissionais/${shopId}/zzteste-${Date.now()}.png`;
    const buffer = Buffer.from(PNG_B64, 'base64');
    const { error: upErr } = await sb.storage
      .from('imagens')
      .upload(filePath, buffer, { contentType: 'image/png', upsert: true });
    check('Upload para profissionais/ funciona', !upErr, upErr?.message ?? 'ok');

    // ---------- 3. URL pública responde de verdade ----------
    const { data: pub } = sb.storage.from('imagens').getPublicUrl(filePath);
    const url = pub.publicUrl;
    check('URL pública foi gerada', !!url && url.startsWith('http'), url);

    const resp = await fetch(url);
    check('URL pública responde 200', resp.status === 200,
      `HTTP ${resp.status}, content-type: ${resp.headers.get('content-type')}`);
    const bytes = Buffer.from(await resp.arrayBuffer());
    check('Arquivo baixado bate com o enviado', bytes.length === buffer.length,
      `${bytes.length} bytes vs ${buffer.length} enviados`);

    // ---------- 4. Foto persiste no barbeiro ----------
    const novo = await storage.createProfissional(shopId, {
      nome: 'ZZTESTE Foto Barbeiro',
      avatar_url: url
    });
    profId = novo.id;
    check('createProfissional grava a foto', novo.avatar_url === url);

    const daLista = (await storage.listProfissionais(shopId)).find(p => p.id === novo.id);
    check('Foto volta na listagem do admin', daLista?.avatar_url === url);

    const doPublico = (await storage.listProfissionais('imperial', true)).find(p => p.id === novo.id);
    check('Foto volta na listagem pública (wizard do cliente)', doPublico?.avatar_url === url);

    // ---------- 5. Trocar e remover a foto ----------
    const trocado = await storage.updateProfissional(novo.id, shopId, {
      avatar_url: 'https://example.com/outra.jpg'
    });
    check('Trocar a foto funciona', trocado?.avatar_url === 'https://example.com/outra.jpg');

    const limpo = await storage.updateProfissional(novo.id, shopId, { avatar_url: null });
    check('Remover a foto (null) funciona', limpo?.avatar_url === null);

  } finally {
    if (filePath) await sb.storage.from('imagens').remove([filePath]);
    if (profId) {
      await pg.query(`delete from expedientes where profissional_id=$1`, [profId]);
      await pg.query(`delete from profissionais where id=$1`, [profId]);
    }
    const sobra = await pg.query(`select count(*) from profissionais where nome like 'ZZTESTE%'`);
    check('Limpeza completa', sobra.rows[0].count === '0', `${sobra.rows[0].count} sobrando`);
    await pg.end();
  }

  console.log(falhas === 0 ? '\nTUDO PASSOU' : `\n${falhas} FALHA(S)`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
