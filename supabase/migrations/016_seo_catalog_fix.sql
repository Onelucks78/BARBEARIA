-- =====================================================================
-- 016_seo_catalog_fix.sql — Correção de IDs na migration 015
-- =====================================================================
-- A migration 015 usou IDs hexadecimais errados (…000a a …000f) para os
-- serviços criados na migration 005. Os IDs reais são decimais: …0010 a …0015.
-- Esta migration corrige o catálogo no banco onde a 015 já foi aplicada.
-- Idempotente: só atualiza nome/descricao dos 6 serviços.
-- =====================================================================

update public.servicos set
  nome = 'Platinado Nevou (Descoloração)',
  descricao = 'Descoloração global profissional com matização para atingir o tom platinado perfeito. Visual moderno e na moda, com proteção ao couro cabeludo.'
where id = '10000000-0000-0000-0000-000000000010';

update public.servicos set
  nome = 'Coloração de Cabelo',
  descricao = 'Cobertura de fios brancos ou mudança de tom com coloração profissional. Resultado natural, uniforme e duradouro com produtos de alta qualidade.'
where id = '10000000-0000-0000-0000-000000000011';

update public.servicos set
  nome = 'Relaxamento Capilar',
  descricao = 'Tratamento para relaxar e disciplinar os fios, reduzindo o volume e facilitando o penteado no dia a dia.'
where id = '10000000-0000-0000-0000-000000000012';

update public.servicos set
  nome = 'Luzes e Mechas',
  descricao = 'Luzes e mechas profissionais para iluminar e dar profundidade aos fios. Visual moderno com resultado natural e sob medida para você.'
where id = '10000000-0000-0000-0000-000000000013';

update public.servicos set
  nome = 'Penteado para Eventos',
  descricao = 'Penteado profissional com produtos de finalização para eventos especiais ou o dia a dia. Saia pronto para qualquer ocasião.'
where id = '10000000-0000-0000-0000-000000000014';

update public.servicos set
  nome = 'Matização Cabelo Nevou',
  descricao = 'Matização especializada para cabelos platinados ou nevados: elimina o amarelado e mantém o branco perfeito por mais tempo.'
where id = '10000000-0000-0000-0000-000000000015';
