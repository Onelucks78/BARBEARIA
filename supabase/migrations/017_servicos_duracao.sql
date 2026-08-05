-- =====================================================================
-- 017_servicos_duracao.sql — Padroniza a duração dos serviços
-- Todos os serviços passam a 30 minutos, exceto o combo
-- "Cabelo + Barba + Sobrancelha" que permanece com 90 minutos.
-- =====================================================================

-- 1. Todos os serviços ativos da barbearia vão para 30 min
UPDATE public.servicos
SET duracao_minutos = 30
WHERE barbeiro_id = '00000000-0000-0000-0000-000000000001'
  AND ativo = true;

-- 2. Combo Cabelo + Barba + Sobrancelha permanece com 90 min
UPDATE public.servicos
SET duracao_minutos = 90
WHERE id = '10000000-0000-0000-0000-000000000003';
