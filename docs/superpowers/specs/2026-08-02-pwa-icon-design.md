# PWA Icon Fix — Design

## Problema

Clientes Android que usam "Instalar / criar atalho" no navegador veem o atalho com
apenas a letra "D" em vez da logo da barbearia. Causa: o site não possui
`manifest.webmanifest`, então o Chrome usa o favicon (`logo-light.png`, banner
1024x555, não quadrado) e acaba gerando um ícone padrão com a letra inicial do
domínio.

## Solução (escopo: só ícone)

Fornecer um manifest PWA com ícones quadrados próprios e as tags HTML
correspondentes, para Android e iOS (iOS "Adicionar à Tela de Início" usa
`apple-touch-icon`).

## Arquivos

| Arquivo | Ação |
|---|---|
| `public/icon-192.png` | novo — gerado do `logo.jpg` (192x192) |
| `public/icon-512.png` | novo — gerado do `logo.jpg` (512x512) |
| `public/icon-maskable-512.png` | novo — gerado do `logo.jpg` (512x512, purpose maskable) |
| `public/apple-touch-icon.png` | novo — gerado do `logo.jpg` (180x180) |
| `public/manifest.webmanifest` | novo — metadados + icons |
| `index.html` | editar — links para manifest, apple-touch-icon, icons, theme-color |

## Conteúdo do manifest

- `name` / `short_name`: "Detalhes Barbearia"
- `display`: `standalone`
- `start_url`: `/`
- `theme_color` / `background_color`: `#0a0a09` (stone-950 do tema)
- `icons`: 192x192 e 512x512 com `purpose: "any"` + 512x512 com `purpose: "maskable"`

## Geração dos ícones

PowerShell `System.Drawing` redimensiona `public/logo.jpg` (fonte quadrada
1024x1024) para os tamanhos acima, sem dependência nova.

## Fallback

Sem manifest ou falha de rede, o comportamento atual (letra "D") permanece — não
regride nada.

## Verificação

- `npm run lint` (typecheck)
- `npm run build` e conferir que `dist/` contém os PNGs e o manifest
- Deploy no Vercel (`vercel --prod`)

## Observação

Clientes que **já criaram** o atalho com o "D" precisam remover e recriar o
atalho para ver o novo ícone.
