# Detalhes Barbearia

## Tech Stack
- **Frontend**: React 19 + Vite + Tailwind CSS 4 + Lucide React + Motion
- **Backend**: Express + tsx (dev) / esbuild (build)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **AI**: Gemini API (via @google/genai)
- **Validation**: Zod
- **Language**: TypeScript

## Key Files
- `server.ts` — Express backend entrypoint
- `vite.config.ts` — Vite config with React + Tailwind + path aliases
- `src/` — React frontend source
- `server/` — Backend source
- `supabase/` — Supabase migrations and config
- `scripts/` — DB migration and verification scripts
- `db.json` — Runtime API data (runtime, not git-tracked)
- `.env.local` — Local environment variables
- `.env.example` — Env template

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run start` — Start production
- `npm run lint` — TypeScript type check
- `npm run db:push` — Run DB migrations
- `npm run db:verify` — Verify DB schema

## Conventions
- React components in `src/`
- Server logic in `server/`
- Supabase migrations in `supabase/`
- Path alias `@/` maps to project root
- HMR disabled in AI Studio via DISABLE_HMR env var
- `db.json` excluded from HMR watch
