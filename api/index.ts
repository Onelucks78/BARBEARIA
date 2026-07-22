// _app.mjs é gerado no build (script "build:api", chamado pelo buildCommand da Vercel):
// bundla server.ts + todos os imports internos num único arquivo ESM auto-contido.
// Isso evita o erro de resolução de módulos da Vercel, que compila por-arquivo em ESM
// e NÃO resolve imports extensionless ('../server') nem com extensão .ts ('./x.ts').
// @ts-ignore - arquivo gerado só no build; não existe durante o typecheck local.
import { createApp } from './_app.mjs';

let app: any = null;

export default async function handler(req: any, res: any) {
  if (!app) {
    app = await createApp();
  }
  return app(req, res);
}
