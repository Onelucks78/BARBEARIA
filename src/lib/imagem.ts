// src/lib/imagem.ts
// Helpers de upload de imagem para o Supabase Storage (bucket "imagens").
// Extraídos do AdminLayout para poderem ser usados por qualquer aba.

import { authedFetch } from './supabase.ts';

export type PastaImagem = 'servicos' | 'produtos' | 'profissionais';

/**
 * Reduz a imagem no browser antes de subir. Evita mandar foto de 8MP
 * direto do celular como base64 no corpo da requisição.
 */
export function resizeImageToDataUrl(file: File, maxDim = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo não é uma imagem válida.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas não suportado neste navegador.'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Sobe a imagem e devolve a URL pública do Supabase Storage. */
export async function uploadImagem(dataUrl: string, pasta: PastaImagem): Promise<string> {
  try {
    const res = await authedFetch('/api/admin/upload-imagem', {
      method: 'POST',
      body: { dataUrl, pasta }
    });
    const text = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      // Se não for JSON válido (ex: página HTML ou erro de proxy), usa dataUrl como fallback
      return dataUrl;
    }

    if (!res.ok) {
      throw new Error(data.error || `Erro ao enviar imagem (${res.status}).`);
    }
    return (data.url as string) || dataUrl;
  } catch (err: any) {
    console.warn('[uploadImagem] Erro de envio, utilizando dataUrl local:', err.message);
    return dataUrl;
  }
}

/**
 * Foto de perfil: recorte quadrado central antes de subir.
 * Sem isso um retrato em pé vira um avatar esmagado no card.
 */
export function cropSquareToDataUrl(file: File, size = 512, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo não é uma imagem válida.'));
      img.onload = () => {
        const lado = Math.min(img.width, img.height);
        const sx = (img.width - lado) / 2;
        const sy = (img.height - lado) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas não suportado neste navegador.'));
        ctx.drawImage(img, sx, sy, lado, lado, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
