-- =====================================================================
-- 004_seed.sql — Dados iniciais da Barbearia Imperial
-- UTF-8 puro. Sem encoding Latin-1 (corrige o bug do db.json).
-- Idempotente: limpa seed anterior antes de inserir.
-- =====================================================================

-- Apaga seed da Barbearia Imperial (slug 'imperial') pra permitir re-rodar
delete from public.lancamentos_financeiros
  where barbeiro_id in (select id from public.barbeiros where slug = 'imperial');
delete from public.agendamentos
  where barbeiro_id in (select id from public.barbeiros where slug = 'imperial');
delete from public.bloqueios
  where barbeiro_id in (select id from public.barbeiros where slug = 'imperial');
delete from public.expedientes
  where barbeiro_id in (select id from public.barbeiros where slug = 'imperial');
delete from public.clientes
  where barbeiro_id in (select id from public.barbeiros where slug = 'imperial');
delete from public.produtos
  where barbeiro_id in (select id from public.barbeiros where slug = 'imperial');
delete from public.servicos
  where barbeiro_id in (select id from public.barbeiros where slug = 'imperial');
delete from public.categorias_financeiras
  where barbeiro_id in (select id from public.barbeiros where slug = 'imperial');
delete from public.barbeiros where slug = 'imperial';

-- Resetar sequence do código de agendamento
alter sequence public.agendamentos_codigo_seq restart with 1;

-- ---------- BARBEIRO ----------
insert into public.barbeiros (id, slug, nome, email, telefone, avatar_url,
  nome_barbearia, bio, ativo)
values (
  '00000000-0000-0000-0000-000000000001',
  'imperial',
  'Carlos Silva',
  '78787878one@gmail.com',
  '11987654321',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
  'Barbearia Imperial',
  'Especialista em cortes degradê modernos, barbas com toalha quente executadas na navalha tradicional, tratamentos pós-barba e design capilar personalizado.',
  true
);

-- ---------- SERVIÇOS ----------
insert into public.servicos (id, barbeiro_id, nome, descricao, preco, duracao_minutos,
  imagem_url, ativo, ordem) values
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
 'Corte Premium', 'Corte moderno (degradê, social ou clássico), lavagem com shampoo refrescante, toalha aromática quente, massagem capilar e finalização com pomada matte de alta fixação.',
 60.00, 40,
 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=500&auto=format&fit=crop&q=80',
 true, 1),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
 'Barba Imperial', 'Barba alinhada com toalha de vapor quente para abertura dos poros, óleos essenciais de sândalo, barbear clássico com navalhete de aço e gel calmante pós-barba.',
 40.00, 30,
 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=500&auto=format&fit=crop&q=80',
 true, 2),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
 'Combo Cabelo & Barba', 'O pacote completo da Barbearia Imperial. Inclui o Corte Premium e a Barba Imperial para uma renovação visual completa com preço promocional.',
 90.00, 70,
 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=500&auto=format&fit=crop&q=80',
 true, 3),
('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
 'Sobrancelha Navalhada', 'Design e alinhamento de sobrancelhas com navalhete, trazendo simetria e limpeza para o visual facial.',
 20.00, 15,
 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=500&auto=format&fit=crop&q=80',
 true, 4),
('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
 'Pezinho Navalhado', 'Apenas o contorno e alinhamento perfeito do pezinho do cabelo na navalha clássica, ideal para manter o visual limpo semanalmente.',
 15.00, 15,
 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=500&auto=format&fit=crop&q=80',
 true, 5),
('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001',
 'Pigmentação Premium (Barba ou Cabelo)', 'Aplicação técnica de pigmentação profissional de alta precisão para cobrir falhas, escurecer fios brancos e destacar os contornos do corte.',
 35.00, 25,
 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=500&auto=format&fit=crop&q=80',
 true, 6),
('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001',
 'Tratamento de Hidratação Mentolada', 'Higienização profunda com shampoo purificante e aplicação de creme nutritivo ultra refreshed com massagem relaxante no couro cabeludo.',
 25.00, 20,
 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500&auto=format&fit=crop&q=80',
 true, 7),
('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001',
 'Selagem / Progressiva Reconstrutora', 'Procedimento químico com ativos termo-selantes para redução de volume, controle do frizz intenso e facilitação e praticidade do penteado.',
 80.00, 60,
 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=500&auto=format&fit=crop&q=80',
 true, 8),
('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001',
 'Barba Simples', 'Aparação rápida com máquina de acabamento e contorno preciso no barbeador elétrico para o dia a dia corrido.',
 30.00, 20,
 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=500&auto=format&fit=crop&q=80',
 true, 9),
('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
 'Platinado Imperial / Nevou', 'Descoloração global profissional protegendo o couro cabeludo, seguida de matização para atingir o tom branco/platinado perfeito da moda.',
 100.00, 90,
 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=500&auto=format&fit=crop&q=80',
 true, 10);

-- ---------- PRODUTOS ----------
insert into public.produtos (id, barbeiro_id, nome, descricao, preco, imagem_url,
  estoque, ativo, ordem) values
('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
 'Pomada Modeladora Matte Imperial',
 'Pomada de fixação forte com acabamento dry/matte (seco). Excelente para penteados estruturados, topetes e texturizações que precisam durar o dia inteiro sem brilho excessivo. 120g.',
 45.00,
 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=500&auto=format&fit=crop&q=80',
 15, true, 1),
('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
 'Óleo Nutritivo Premium 30ml',
 'Enriquecido com óleos de argan, jojoba e sândalo. Hidrata profundamente os fios ásperos ou secos da barba, alivia coceiras na pele e deixa um aroma amadeirado clássico e agradável.',
 35.00,
 'https://images.unsplash.com/photo-1617897903246-719242758050?w=500&auto=format&fit=crop&q=80',
 10, true, 2),
('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
 'Shampoo Ice Refresh Mentol',
 'Shampoo para cabelos e barbas com efeito gelado instantâneo. Desobstrui os poros do couro cabeludo, reduz a oleosidade e previne descamações. Sensação de frescor duradouro. 250ml.',
 48.00,
 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500&auto=format&fit=crop&q=80',
 12, true, 3);

-- ---------- CLIENTES ----------
insert into public.clientes (id, barbeiro_id, nome, telefone, email,
  data_nascimento, observacoes, ativo) values
('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
 'Marcos Almeida', '11999991111', 'marcos@email.com', '1992-04-12',
 'Gosta de corte com disfarçado (degradê) bem alto na lateral, mantendo o topo maior. Usa a pomada de efeito seco.',
 true),
('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
 'André Santos', '11988882222', 'andre@email.com', '1985-09-24',
 'Pele muito sensível na região do pescoço, sempre utilizar óleo protetor e toalha bem quente antes do barbear. Gosta de barba espartana.',
 true),
('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
 'Roberto Antunes', '11977773333', 'roberto@email.com', '1998-01-05',
 'Corte social clássico na tesoura. Alinha as sobrancelhas a cada 2 cortes.',
 true);

-- ---------- EXPEDIENTE ----------
insert into public.expedientes (barbeiro_id, dia_semana, hora_inicio, hora_fim,
  intervalo_inicio, intervalo_fim, ativo) values
('00000000-0000-0000-0000-000000000001', 0, '09:00', '13:00', null,    null,    false), -- domingo fechado
('00000000-0000-0000-0000-000000000001', 1, '09:00', '19:00', '12:00', '13:30', true),
('00000000-0000-0000-0000-000000000001', 2, '09:00', '19:00', '12:00', '13:30', true),
('00000000-0000-0000-0000-000000000001', 3, '09:00', '19:00', '12:00', '13:30', true),
('00000000-0000-0000-0000-000000000001', 4, '09:00', '19:00', '12:00', '13:30', true),
('00000000-0000-0000-0000-000000000001', 5, '09:00', '19:00', '12:00', '13:30', true),
('00000000-0000-0000-0000-000000000001', 6, '08:00', '18:00', '12:00', '13:00', true);

-- ---------- BLOQUEIOS DE EXEMPLO ----------
insert into public.bloqueios (barbeiro_id, data, hora_inicio, hora_fim, motivo) values
('00000000-0000-0000-0000-000000000001', '2026-06-15', null,    null,    'Curso de Especialização em Barbering Avançado'),
('00000000-0000-0000-0000-000000000001', '2026-06-20', '15:00', '17:00', 'Consulta Odontológica');

-- ---------- CATEGORIAS FINANCEIRAS ----------
insert into public.categorias_financeiras (barbeiro_id, nome, tipo) values
('00000000-0000-0000-0000-000000000001', 'Serviços',          'entrada'),
('00000000-0000-0000-0000-000000000001', 'Venda de Produtos', 'entrada'),
('00000000-0000-0000-0000-000000000001', 'Geral',             'entrada'),
('00000000-0000-0000-0000-000000000001', 'Insumos',           'saida'),
('00000000-0000-0000-0000-000000000001', 'Aluguel & Taxas',   'saida'),
('00000000-0000-0000-0000-000000000001', 'Marketing',         'saida'),
('00000000-0000-0000-0000-000000000001', 'Outros',            'saida');
