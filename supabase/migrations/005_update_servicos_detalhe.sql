-- =====================================================================
-- 005_update_servicos_detalhe.sql
-- Atualiza serviços e preços conforme tabela da Detalhe Barbearia
-- Usa UPSERT (INSERT ON CONFLICT DO UPDATE) para preservar FK de agendamentos
-- Novos serviços são inseridos; os existentes têm nome/preço/descrição atualizados
-- =====================================================================

INSERT INTO public.servicos (id, barbeiro_id, nome, descricao, preco, duracao_minutos, imagem_url, ativo, ordem)
VALUES
-- 1. Cabelo + Barba + Sobrancelha (era "Combo Cabelo & Barba")
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
 'Cabelo + Barba + Sobrancelha',
 'Pacote completo da Detalhe Barbearia: corte moderno, barba alinhada com toalha quente e design de sobrancelha com navalhete.',
 110.00, 90,
 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=500&auto=format&fit=crop&q=80',
 true, 1),

-- 2. Barba + Pigmentação (era "Pigmentação Premium")
('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001',
 'Barba + Pigmentação',
 'Barba alinhada com toalha de vapor quente combinada com pigmentação profissional para cobrir falhas e realçar contornos.',
 90.00, 60,
 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=500&auto=format&fit=crop&q=80',
 true, 2),

-- 3. Coloração (NOVO)
('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001',
 'Coloração',
 'Coloração profissional dos fios a partir de R$60. Cobertura de brancos ou mudança de tom com produtos de alta qualidade.',
 60.00, 60,
 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=500&auto=format&fit=crop&q=80',
 true, 3),

-- 4. Corte (era "Corte Premium")
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
 'Corte',
 'Corte moderno (degradê, social ou clássico) com lavagem e finalização profissional.',
 50.00, 40,
 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=500&auto=format&fit=crop&q=80',
 true, 4),

-- 5. Barba (era "Barba Imperial")
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
 'Barba',
 'Barba alinhada com toalha de vapor quente, óleos essenciais e barbear clássico com navalhete de aço.',
 40.00, 30,
 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=500&auto=format&fit=crop&q=80',
 true, 5),

-- 6. Sobrancelha (era "Sobrancelha Navalhada")
('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
 'Sobrancelha',
 'Design e alinhamento de sobrancelhas com navalhete, trazendo simetria e limpeza para o visual facial.',
 20.00, 15,
 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=500&auto=format&fit=crop&q=80',
 true, 6),

-- 7. Pé do Cabelo (era "Pezinho Navalhado")
('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
 'Pé do Cabelo',
 'Contorno e alinhamento perfeito do pezinho do cabelo na navalha clássica, ideal para manter o visual limpo.',
 15.00, 15,
 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=500&auto=format&fit=crop&q=80',
 true, 7),

-- 8. Relaxamento (NOVO)
('10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001',
 'Relaxamento',
 'Tratamento químico para relaxar e disciplinar os fios, reduzindo o volume e facilitando o penteado.',
 30.00, 45,
 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500&auto=format&fit=crop&q=80',
 true, 8),

-- 9. Selagem Capilar (era "Selagem / Progressiva Reconstrutora")
('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001',
 'Selagem Capilar',
 'Procedimento com ativos termo-selantes para redução de volume, controle do frizz e praticidade no penteado. A partir de R$90.',
 90.00, 60,
 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=500&auto=format&fit=crop&q=80',
 true, 9),

-- 10. Luzes (NOVO)
('10000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001',
 'Luzes',
 'Mechas e luzes profissionais para iluminar e realçar os fios. A partir de R$100.',
 100.00, 90,
 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=500&auto=format&fit=crop&q=80',
 true, 10),

-- 11. Platinado Nevou (era "Platinado Imperial / Nevou")
('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
 'Platinado Nevou',
 'Descoloração global profissional com matização para atingir o tom branco/platinado perfeito. A partir de R$150.',
 150.00, 120,
 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=500&auto=format&fit=crop&q=80',
 true, 11),

-- 12. Penteado (NOVO)
('10000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001',
 'Penteado',
 'Penteado profissional com produtos de finalização para eventos especiais ou uso diário.',
 30.00, 30,
 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=500&auto=format&fit=crop&q=80',
 true, 12),

-- 13. Matizar Cabelo Nevou (NOVO)
('10000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001',
 'Matizar Cabelo Nevou',
 'Matização especializada para cabelos platinados/nevados, eliminando tons amarelados e mantendo o branco perfeito.',
 35.00, 45,
 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=500&auto=format&fit=crop&q=80',
 true, 13)

ON CONFLICT (id) DO UPDATE SET
  nome            = EXCLUDED.nome,
  descricao       = EXCLUDED.descricao,
  preco           = EXCLUDED.preco,
  duracao_minutos = EXCLUDED.duracao_minutos,
  imagem_url      = EXCLUDED.imagem_url,
  ativo           = EXCLUDED.ativo,
  ordem           = EXCLUDED.ordem;

-- Desativa serviços antigos que não fazem mais parte da tabela
-- ("Barba Simples" e "Tratamento de Hidratação Mentolada" foram removidos)
UPDATE public.servicos SET ativo = false
WHERE barbeiro_id = '00000000-0000-0000-0000-000000000001'
  AND id IN (
    '10000000-0000-0000-0000-000000000007', -- Tratamento de Hidratação Mentolada
    '10000000-0000-0000-0000-000000000009'  -- Barba Simples
  );
