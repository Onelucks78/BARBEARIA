-- =====================================================================
-- 015_seo_catalog.sql — SEO + conversão do catálogo Detalhe Barbearia
-- =====================================================================
-- Renomeia serviços e produtos para nomes descritivos ricos em palavras-chave
-- locais (Rio Verde-GO, corte de cabelo masculino, barba, degradê, etc.) e
-- reescreve as descrições orientadas a benefício e conversão.
--
-- ATENÇÃO (não quebrar a elegibilidade VIP):
--   server/storage.ts getServiceCategorias() e BookingWizard.tsx categorizam
--   o serviço PELO NOME (keywords). Nomes abaixo PRESERVAM os termos que a
--   lógica espera: corte/cabelo, barba, sobrancelha, penteado, e os especiais
--   selagem/luzes/colora. Nomes de produtos não afetam a elegibilidade.
--
-- Idempotente: só atualiza nome/descricao; preserva preço, duração, imagem,
-- estoque, ordem e status de cada item.
-- =====================================================================

-- ---------- SERVIÇOS ----------
update public.servicos set
  nome = 'Corte de Cabelo Masculino',
  descricao = 'Corte de cabelo masculino em Rio Verde-GO: degradê, social ou clássico, com lavagem e finalização profissional. Toalha quente inclusa para um acabamento impecável.'
where id = '10000000-0000-0000-0000-000000000001';

update public.servicos set
  nome = 'Barba na Navalha',
  descricao = 'Barba alinhada com toalha de vapor quente, óleos essenciais e barbear clássico na navalha de aço. Acabamento preciso e pele cuidada em Rio Verde-GO.'
where id = '10000000-0000-0000-0000-000000000002';

update public.servicos set
  nome = 'Combo Cabelo + Barba + Sobrancelha',
  descricao = 'Pacote completo da Detalhe Barbearia em Rio Verde: corte moderno, barba na toalha quente e design de sobrancelha. Visual renovado em uma única visita com preço promocional.'
where id = '10000000-0000-0000-0000-000000000003';

update public.servicos set
  nome = 'Design de Sobrancelha',
  descricao = 'Design e alinhamento de sobrancelhas com navalhete para dar simetria e limpeza ao seu olhar. Rápido, preciso e com acabamento profissional.'
where id = '10000000-0000-0000-0000-000000000004';

update public.servicos set
  nome = 'Pezinho do Cabelo (Contorno)',
  descricao = 'Contorno e alinhamento do pezinho do cabelo na navalha clássica. Ideal para manter o visual limpo e alinhado entre um corte e outro.'
where id = '10000000-0000-0000-0000-000000000005';

update public.servicos set
  nome = 'Barba + Pigmentação',
  descricao = 'Barba alinhada com toalha de vapor quente + pigmentação profissional para cobrir falhas e realçar contornos. Visual cheio, definido e duradouro.'
where id = '10000000-0000-0000-0000-000000000006';

update public.servicos set
  nome = 'Selagem Capilar',
  descricao = 'Selagem capilar para reduzir volume, controlar o frizz e deixar o cabelo disciplinado por mais tempo. Fios alinhados e fáceis de pentear.'
where id = '10000000-0000-0000-0000-000000000008';

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

-- ---------- PRODUTOS ----------
update public.produtos set
  nome = 'Pomada Modeladora Matte',
  descricao = 'Pomada de fixação forte com acabamento seco (matte). Ideal para topetes e texturizações que precisam durar o dia inteiro sem brilho excessivo. 120g.'
where id = '20000000-0000-0000-0000-000000000001';

update public.produtos set
  nome = 'Óleo Nutritivo para Barba',
  descricao = 'Óleo para barba com argan, jojoba e sândalo. Hidrata fios ásperos, alivia coceiras e deixa um aroma amadeirado clássico. 30ml.'
where id = '20000000-0000-0000-0000-000000000002';

update public.produtos set
  nome = 'Shampoo Ice Refresh Mentol',
  descricao = 'Shampoo para cabelo e barba com efeito gelado instantâneo. Desobstrui os poros, reduz a oleosidade e previne descamações. 250ml.'
where id = '20000000-0000-0000-0000-000000000003';
