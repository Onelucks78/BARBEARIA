import fs from 'fs';
import path from 'path';
import {
  Barbeiro,
  Servico,
  Produto,
  Cliente,
  Agendamento,
  Expediente,
  Bloqueio,
  LancamentoFinanceiro,
  CategoriaFinanceira
} from '../src/types.ts';

const DB_FILE = path.join(process.cwd(), 'db.json');

// Interface for database structure
export interface DBState {
  barbeiros: Barbeiro[];
  servicos: Servico[];
  produtos: Produto[];
  clientes: Cliente[];
  agendamentos: Agendamento[];
  expedientes: Expediente[];
  bloqueios: Bloqueio[];
  lancamentos_financeiros: LancamentoFinanceiro[];
  categorias_financeiras: CategoriaFinanceira[];
}

// Convert minutes past midnight to "HH:MM"
export function minutesToHHMM(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

// Convert "HH:MM" to minutes past midnight
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Check if two time intervals overlap: [s1, e1] and [s2, e2]
export function isOverlapping(s1: number, e1: number, s2: number, e2: number): boolean {
  return s1 < e2 && e1 > s2;
}

// Seed Initial Data
const INITIAL_DB: DBState = {
  barbeiros: [
    {
      id: 'b-1',
      nome: 'Emerson Santiago',
      email: '78787878one@gmail.com',
      telefone: '(11) 98765-4321',
      avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
      nome_barbearia: 'Detalhe Barbearia',
      bio: 'Especialista em cortes degradê modernos, barbas com toalha quente executadas na navalha tradicional, tratamentos pós-barba e design capilar personalizado.',
      slug: 'imperial',
      ativo: true,
      ultimo_acesso_em: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  servicos: [
    {
      id: 's-1',
      barbeiro_id: 'b-1',
      nome: 'Corte Premium',
      descricao: 'Corte moderno (degradê, social ou clássico), lavagem com shampoo refrescante, toalha aromática quente, massagem capilar e finalização com pomada matte de alta fixação.',
      preco: 60.00,
      duracao_minutos: 40,
      imagem_url: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=500&auto=format&fit=crop&q=80',
      ativo: true,
      ordem: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 's-2',
      barbeiro_id: 'b-1',
      nome: 'Barba Imperial',
      descricao: 'Barba alinhada com toalha de vapor quente para abertura dos poros, óleos essenciais de sândalo, barbear clássico com navalhete de aço e gel calmante pós-barba.',
      preco: 40.00,
      duracao_minutos: 30,
      imagem_url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=500&auto=format&fit=crop&q=80',
      ativo: true,
      ordem: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 's-3',
      barbeiro_id: 'b-1',
      nome: 'Combo Cabelo & Barba',
      descricao: 'O pacote completo da Detalhe Barbearia. Inclui o Corte Premium e a Barba Imperial para uma renovação visual completa com preço promocional.',
      preco: 90.00,
      duracao_minutos: 70,
      imagem_url: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=500&auto=format&fit=crop&q=80',
      ativo: true,
      ordem: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 's-4',
      barbeiro_id: 'b-1',
      nome: 'Sobrancelha Navalhada',
      descricao: 'Design e alinhamento de sobrancelhas com navalhete, trazendo simetria e limpeza para o visual facial.',
      preco: 20.00,
      duracao_minutos: 15,
      imagem_url: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=500&auto=format&fit=crop&q=80',
      ativo: true,
      ordem: 4,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 's-5',
      barbeiro_id: 'b-1',
      nome: 'Pezinho Navalhado',
      descricao: 'Apenas os contornos elegantes e o acabamento rente do pé do cabelo na navalha tradicional e espuma suave.',
      preco: 15.00,
      duracao_minutos: 15,
      imagem_url: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=500&auto=format&fit=crop&q=80',
      ativo: true,
      ordem: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 's-6',
      barbeiro_id: 'b-1',
      nome: 'Pigmentação Premium (Barba ou Cabelo)',
      descricao: 'Uso de tinta de alta precisão e técnica para cobrir falhas e definir traços mais marcantes e duradouros.',
      preco: 35.00,
      duracao_minutos: 25,
      imagem_url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=500&auto=format&fit=crop&q=80',
      ativo: true,
      ordem: 6,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 's-7',
      barbeiro_id: 'b-1',
      nome: 'Tratamento de Hidratação Mentolada',
      descricao: 'Creme condicionante refrescante e massagem capilar para revigorar as cutículas e acalmar o couro cabeludo.',
      preco: 25.00,
      duracao_minutos: 20,
      imagem_url: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500&auto=format&fit=crop&q=80',
      ativo: true,
      ordem: 7,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 's-8',
      barbeiro_id: 'b-1',
      nome: 'Selagem / Progressiva Reconstrutora',
      descricao: 'Tratamento químico para alinhar as cutículas capilares, reduzir volume, trazendo praticidade diária.',
      preco: 80.00,
      duracao_minutos: 60,
      imagem_url: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=500&auto=format&fit=crop&q=80',
      ativo: true,
      ordem: 8,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 's-9',
      barbeiro_id: 'b-1',
      nome: 'Barba Simples',
      descricao: 'Aparação rápida com máquina de acabamento e contorno preciso no barbeador elétrico para o dia a dia corrido.',
      preco: 30.00,
      duracao_minutos: 20,
      imagem_url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=500&auto=format&fit=crop&q=80',
      ativo: true,
      ordem: 9,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 's-10',
      barbeiro_id: 'b-1',
      nome: 'Platinado Imperial / Nevou',
      descricao: 'Descoloração global profissional protegendo o couro cabeludo, seguida de matização para atingir o tom branco/platinado perfeito da moda.',
      preco: 100.00,
      duracao_minutos: 90,
      imagem_url: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=500&auto=format&fit=crop&q=80',
      ativo: true,
      ordem: 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  produtos: [
    {
      id: 'p-1',
      barbeiro_id: 'b-1',
      nome: 'Pomada Modeladora Matte Imperial',
      descricao: 'Pomada de fixação forte com acabamento dry/matte (seco). Excelente para penteados estruturados, topetes e texturizações que precisam durar o dia inteiro sem brilho excessivo. 120g.',
      preco: 45.00,
      imagem_url: 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=500&auto=format&fit=crop&q=80',
      estoque: 15,
      ativo: true,
      ordem: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'p-2',
      barbeiro_id: 'b-1',
      nome: 'Óleo Nutritivo Premium 30ml',
      descricao: 'Enriquecido com óleos de argan, jojoba e sândalo. Hidrata profundamente os fios ásperos ou secos da barba, alivia coceiras na pele e deixa um aroma amadeirado clássico e agradável.',
      preco: 35.00,
      imagem_url: 'https://images.unsplash.com/photo-1617897903246-719242758050?w=500&auto=format&fit=crop&q=80',
      estoque: 10,
      ativo: true,
      ordem: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'p-3',
      barbeiro_id: 'b-1',
      nome: 'Shampoo Ice Refresh Mentol',
      descricao: 'Shampoo para cabelos e barbas com efeito gelado instantâneo. Desobstrui os poros do couro cabeludo, reduz a oleosidade e previne descamações. Sensação de frescor duradouro. 250ml.',
      preco: 48.00,
      imagem_url: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500&auto=format&fit=crop&q=80',
      estoque: 12,
      ativo: true,
      ordem: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  clientes: [
    {
      id: 'c-1',
      barbeiro_id: 'b-1',
      nome: 'Marcos Almeida',
      telefone: '(11) 99999-1111',
      email: 'marcos@email.com',
      data_nascimento: '1992-04-12',
      observacoes: 'Gosta de corte com disfarçado (degradê) bem alto na lateral, mantendo o topo maior. Usa a pomada de efeito seco.',
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'c-2',
      barbeiro_id: 'b-1',
      nome: 'André Santos',
      telefone: '(11) 98888-2222',
      email: 'andre@email.com',
      data_nascimento: '1985-09-24',
      observacoes: 'Pele muito sensível na região do pescoço, sempre utilizar óleo protetor e toalha bem quente antes do barbear. Gosta de barba espartana.',
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'c-3',
      barbeiro_id: 'b-1',
      nome: 'Roberto Antunes',
      telefone: '(11) 97777-3333',
      email: 'roberto@email.com',
      data_nascimento: '1998-01-05',
      observacoes: 'Corte social clássico na tesoura. Alinha as sobrancelhas a cada 2 cortes.',
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  // We'll generate a few past agendamentos and future ones
  agendamentos: [],
  // Expediente por dia da semana (0 = Domingo a 6 = Sábado)
  expedientes: [
    {
      id: 'ex-0',
      barbeiro_id: 'b-1',
      profissional_id: 'p-1',
      dia_semana: 0, // Domingo
      hora_inicio: '09:00',
      hora_fim: '13:00',
      intervalo_inicio: null,
      intervalo_fim: null,
      ativo: false, // Inativo no domingo por padrão!
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'ex-1',
      barbeiro_id: 'b-1',
      profissional_id: 'p-1',
      dia_semana: 1, // Segunda
      hora_inicio: '09:00',
      hora_fim: '19:00',
      intervalo_inicio: '12:00',
      intervalo_fim: '13:30',
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'ex-2',
      barbeiro_id: 'b-1',
      profissional_id: 'p-1',
      dia_semana: 2, // Terça
      hora_inicio: '09:00',
      hora_fim: '19:00',
      intervalo_inicio: '12:00',
      intervalo_fim: '13:30',
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'ex-3',
      barbeiro_id: 'b-1',
      profissional_id: 'p-1',
      dia_semana: 3, // Quarta
      hora_inicio: '09:00',
      hora_fim: '19:00',
      intervalo_inicio: '12:00',
      intervalo_fim: '13:30',
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'ex-4',
      barbeiro_id: 'b-1',
      profissional_id: 'p-1',
      dia_semana: 4, // Quinta
      hora_inicio: '09:00',
      hora_fim: '19:00',
      intervalo_inicio: '12:00',
      intervalo_fim: '13:30',
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'ex-5',
      barbeiro_id: 'b-1',
      profissional_id: 'p-1',
      dia_semana: 5, // Sexta
      hora_inicio: '09:00',
      hora_fim: '19:00',
      intervalo_inicio: '12:00',
      intervalo_fim: '13:30',
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'ex-6',
      barbeiro_id: 'b-1',
      profissional_id: 'p-1',
      dia_semana: 6, // Sábado
      hora_inicio: '08:00',
      hora_fim: '18:00',
      intervalo_inicio: '12:00',
      intervalo_fim: '13:00',
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  bloqueios: [
    {
      id: 'bl-1',
      barbeiro_id: 'b-1',
      profissional_id: 'p-1',
      data: '2026-06-15', // Exemplo de folga programada
      hora_inicio: null, // Dia inteiro
      hora_fim: null,
      motivo: 'Curso de Especialização em Barbering Avançado',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'bl-2',
      barbeiro_id: 'b-1',
      profissional_id: 'p-1',
      data: '2026-06-20',
      hora_inicio: '15:00', // Bloqueio parcial
      hora_fim: '17:00',
      motivo: 'Consulta Odontológica',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  lancamentos_financeiros: [],
  categorias_financeiras: [
    { id: 'cat-1', nome: 'Serviços', tipo: 'entrada', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cat-2', nome: 'Venda de Produtos', tipo: 'entrada', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cat-3', nome: 'Geral', tipo: 'entrada', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cat-4', nome: 'Insumos', tipo: 'saida', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cat-5', nome: 'Aluguel & Taxas', tipo: 'saida', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cat-6', nome: 'Marketing', tipo: 'saida', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'cat-7', nome: 'Outros', tipo: 'saida', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ]
};

// Generate some historical data in seed to make charts look beautiful right away
function populateSeedHistory() {
  const agendamentos: Agendamento[] = [];
  const lancamentos: LancamentoFinanceiro[] = [];
  
  const servicosInfo = INITIAL_DB.servicos;
  const clientesInfo = INITIAL_DB.clientes;
  
  // Create 15-20 past bookings over the last 10 days
  const today = new Date('2026-06-06T12:00:00Z');
  
  for (let i = 10; i >= 0; i--) {
    const activeDate = new Date(today);
    activeDate.setDate(today.getDate() - i);
    const dateStr = activeDate.toISOString().split('T')[0];
    const dayOfWeek = activeDate.getDay();
    
    // Weekday check - skip sundays (day 0) for completed booking generation
    if (dayOfWeek === 0) continue;
    
    // Day faturamento
    const times = ['09:30', '11:00', '14:30', '16:00', '17:30'];
    times.forEach((t, idx) => {
      // Randomly choose client, service and status
      const cli = clientesInfo[idx % clientesInfo.length];
      const srv = servicosInfo[(idx + i) % servicosInfo.length];
      
      const startIso = `${dateStr}T${t}:00`;
      const endMins = hhmmToMinutes(t) + srv.duracao_minutos;
      const endStr = minutesToHHMM(endMins);
      const endIso = `${dateStr}T${endStr}:00`;
      
      // mostly "concluido", but some "faltou" or "cancelado"
      let status: 'agendado' | 'confirmado' | 'concluido' | 'cancelado' | 'faltou' = 'concluido';
      if (i === 0 && idx > 2) {
        status = 'agendado'; // Future slots of today
      } else if (idx === 4 && i % 3 === 0) {
        status = 'faltou';
      } else if (idx === 1 && i % 4 === 0) {
        status = 'cancelado';
      }
      
      const booking: Agendamento = {
        id: `a-past-${i}-${idx}`,
        barbeiro_id: 'b-1',
        profissional_id: 'p-1',
        servico_id: srv.id,
        cliente_id: cli.id,
        nome_cliente: cli.nome,
        telefone_cliente: cli.telefone,
        inicio_em: startIso,
        fim_em: endIso,
        status,
        preco_cobrado: srv.preco,
        observacao: idx % 2 === 0 ? 'Corte de rotina rápida' : '',
        created_at: new Date(startIso).toISOString(),
        updated_at: new Date(startIso).toISOString()
      };
      agendamentos.push(booking);
      
      // If completed, add corresponding incoming financial launch
      if (status === 'concluido') {
        lancamentos.push({
          id: `lf-appt-${booking.id}`,
          barbeiro_id: 'b-1',
          profissional_id: 'p-1',
          tipo: 'entrada',
          descricao: `Serviço: ${srv.nome} - Cliente: ${cli.nome}`,
          valor: srv.preco,
          categoria: 'Serviço de Corte',
          forma_pagamento: idx % 3 === 0 ? 'pix' : (idx % 3 === 1 ? 'dinheiro' : 'cartao'),
          agendamento_id: booking.id,
          produto_id: null,
          data: dateStr,
          created_at: new Date(startIso).toISOString(),
          updated_at: new Date(startIso).toISOString()
        });
      }
    });
    
    // Add some random expense per day or every few days
    if (i % 3 === 0) {
      lancamentos.push({
        id: `lf-exp-${i}-1`,
        barbeiro_id: 'b-1',
        profissional_id: 'p-1',
        tipo: 'saida',
        descricao: 'Suprimentos da Barbearia (Gola higiênica e lâminas)',
        valor: 120.00,
        categoria: 'Insumos',
        forma_pagamento: 'pix',
        agendamento_id: null,
        produto_id: null,
        data: dateStr,
        created_at: new Date(`${dateStr}T12:00:00`).toISOString(),
        updated_at: new Date(`${dateStr}T12:00:00`).toISOString()
      });
    }
    
    if (i % 5 === 0) {
      lancamentos.push({
        id: `lf-prod-${i}`,
        barbeiro_id: 'b-1',
        profissional_id: 'p-1',
        tipo: 'entrada',
        descricao: 'Venda de Produto: Pomada Modeladora Matte',
        valor: 45.00,
        categoria: 'Venda de Produto',
        forma_pagamento: 'dinheiro',
        agendamento_id: null,
        produto_id: 'p-1',
        data: dateStr,
        created_at: new Date(`${dateStr}T14:00:00`).toISOString(),
        updated_at: new Date(`${dateStr}T14:00:00`).toISOString()
      });
    }
  }

  // Monthly fixed expenses
  lancamentos.push({
    id: 'lf-fixed-rent',
    barbeiro_id: 'b-1',
    profissional_id: 'p-1',
    tipo: 'saida',
    descricao: 'Aluguel Comercial do Ponto',
    valor: 1500.00,
    categoria: 'Aluguel',
    forma_pagamento: 'pix',
    agendamento_id: null,
    produto_id: null,
    data: '2026-06-01',
    created_at: new Date('2026-06-01T10:00:00Z').toISOString(),
    updated_at: new Date('2026-06-01T10:00:00Z').toISOString()
  });
  
  lancamentos.push({
    id: 'lf-fixed-energy',
    barbeiro_id: 'b-1',
    profissional_id: 'p-1',
    tipo: 'saida',
    descricao: 'Conta de Energia Elétrica e Água',
    valor: 350.00,
    categoria: 'Utilidades',
    forma_pagamento: 'pix',
    agendamento_id: null,
    produto_id: null,
    data: '2026-06-03',
    created_at: new Date('2026-06-03T10:00:00Z').toISOString(),
    updated_at: new Date('2026-06-03T10:00:00Z').toISOString()
  });

  INITIAL_DB.agendamentos = agendamentos;
  INITIAL_DB.lancamentos_financeiros = lancamentos;
}

populateSeedHistory();

// Read DB from disk or write initial
export function loadDB(): DBState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const db = JSON.parse(content) as DBState;
      let dirty = false;
      if (!db.categorias_financeiras) {
        db.categorias_financeiras = [
          { id: 'cat-1', nome: 'Serviços', tipo: 'entrada', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'cat-2', nome: 'Venda de Produtos', tipo: 'entrada', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'cat-3', nome: 'Geral', tipo: 'entrada', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'cat-4', nome: 'Insumos', tipo: 'saida', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'cat-5', nome: 'Aluguel & Taxas', tipo: 'saida', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'cat-6', nome: 'Marketing', tipo: 'saida', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'cat-7', nome: 'Outros', tipo: 'saida', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ];
        dirty = true;
      }
      if (dirty) {
        saveDB(db);
      }
      return db;
    }
  } catch (error) {
    console.error('Failed to read db.json, returning memory database instead:', error);
  }
  
  // Write initial and return
  saveDB(INITIAL_DB);
  return INITIAL_DB;
}

export function saveDB(data: DBState): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to write db.json:', error);
  }
}

// core algorithm: calculate raw free times
export function calculateAvailableSlots(dateStr: string, servicoId: string): string[] {
  const db = loadDB();
  
  // 1. Get the service to know duration_minutos
  let duration = 0;
  if (servicoId.includes(',')) {
    const ids = servicoId.split(',');
    const selected_servicos = db.servicos.filter(s => ids.includes(s.id) && s.ativo);
    duration = selected_servicos.reduce((sum, s) => sum + s.duracao_minutos, 0);
  } else {
    const servico = db.servicos.find(s => s.id === servicoId && s.ativo);
    if (!servico) return [];
    duration = servico.duracao_minutos;
  }
  if (duration === 0) return [];
  
  // 2. Get the day of the week correspondency (0-6)
  // Standard formatting of YYYY-MM-DD triggers local time construction if we avoid trailing Z
  const dateObj = new Date(`${dateStr}T12:00:00`); 
  const dayOfWeek = dateObj.getDay();
  
  // 3. Find expediente for this day_semana
  const expediente = db.expedientes.find(ex => ex.dia_semana === dayOfWeek && ex.ativo === true);
  if (!expediente) return []; // No schedule or not active (e.g. Barber closed)
  
  const startMin = hhmmToMinutes(expediente.hora_inicio);
  const endMin = hhmmToMinutes(expediente.hora_fim);
  
  // 4. Generate candidate windows. We step every 30 minutes to make the timeline fluent
  const step = 30; // standard slot booking step
  const candidates: { startMin: number; endMin: number; startStr: string }[] = [];
  
  for (let current = startMin; current + duration <= endMin; current += step) {
    const currentEnd = current + duration;
    candidates.push({
      startMin: current,
      endMin: currentEnd,
      startStr: minutesToHHMM(current)
    });
  }
  
  // 5. Filter out windows that lie within the lunch/interval
  let availableCandidates = candidates;
  if (expediente.intervalo_inicio && expediente.intervalo_fim) {
    const intStartMin = hhmmToMinutes(expediente.intervalo_inicio);
    const intEndMin = hhmmToMinutes(expediente.intervalo_fim);
    
    availableCandidates = availableCandidates.filter(slot => {
      // Should NOT overlap with interval
      const overlapsLunch = isOverlapping(slot.startMin, slot.endMin, intStartMin, intEndMin);
      return !overlapsLunch;
    });
  }
  
  // 6. Filter out windows covered by bloqueios on that date
  const blocksForDay = db.bloqueios.filter(b => b.data === dateStr);
  availableCandidates = availableCandidates.filter(slot => {
    for (const b of blocksForDay) {
      if (b.hora_inicio === null || b.hora_fim === null) {
        // Blocks the whole day
        return false;
      }
      const blockStart = hhmmToMinutes(b.hora_inicio);
      const blockEnd = hhmmToMinutes(b.hora_fim);
      if (isOverlapping(slot.startMin, slot.endMin, blockStart, blockEnd)) {
        return false; // Colision with partial day lock
      }
    }
    return true;
  });
  
  // 7. Filter out windows colliding with other overlapping appointments
  // (ignore cancelled bookings and skipped ones)
  const activeBookings = db.agendamentos.filter(a => {
    // Check if appointment is on that same date
    const bookingDateStr = a.inicio_em.split('T')[0];
    const isSameDate = bookingDateStr === dateStr;
    const isNotCancelled = a.status !== 'cancelado' && a.status !== 'faltou';
    return isSameDate && isNotCancelled;
  });
  
  availableCandidates = availableCandidates.filter(slot => {
    for (const app of activeBookings) {
      // Get HH:MM start and end of this booking
      const appStartHhmm = app.inicio_em.split('T')[1].substring(0, 5);
      const appEndHhmm = app.fim_em.split('T')[1].substring(0, 5);
      
      const appStart = hhmmToMinutes(appStartHhmm);
      const appEnd = hhmmToMinutes(appEndHhmm);
      
      if (isOverlapping(slot.startMin, slot.endMin, appStart, appEnd)) {
        return false; // Collision with booking
      }
    }
    return true;
  });
  
  // 8. Return remaining hours as HH:MM strings
  return availableCandidates.map(slot => slot.startStr);
}

export interface SlotState {
  horario: string;
  disponivel: boolean;
  motivo?: 'ocupado' | 'intervalo' | 'bloqueado';
}

export function calculateAllSlotsWithAvailability(dateStr: string, servicoId: string): SlotState[] {
  const db = loadDB();
  
  let duration = 0;
  if (servicoId.includes(',')) {
    const ids = servicoId.split(',');
    const selected_servicos = db.servicos.filter(s => ids.includes(s.id) && s.ativo);
    duration = selected_servicos.reduce((sum, s) => sum + s.duracao_minutos, 0);
  } else {
    const servico = db.servicos.find(s => s.id === servicoId && s.ativo);
    if (!servico) return [];
    duration = servico.duracao_minutos;
  }
  if (duration === 0) return [];
  
  const dateObj = new Date(`${dateStr}T12:00:00`); 
  const dayOfWeek = dateObj.getDay();
  
  const expediente = db.expedientes.find(ex => ex.dia_semana === dayOfWeek && ex.ativo === true);
  if (!expediente) return [];
  
  const startMin = hhmmToMinutes(expediente.hora_inicio);
  const endMin = hhmmToMinutes(expediente.hora_fim);
  
  const step = 30;
  const candidates: { startMin: number; endMin: number; startStr: string }[] = [];
  
  for (let current = startMin; current + duration <= endMin; current += step) {
    const currentEnd = current + duration;
    candidates.push({
      startMin: current,
      endMin: currentEnd,
      startStr: minutesToHHMM(current)
    });
  }
  
  const activeBookings = db.agendamentos.filter(a => {
    const bookingDateStr = a.inicio_em.split('T')[0];
    const isSameDate = bookingDateStr === dateStr;
    const isNotCancelled = a.status !== 'cancelado' && a.status !== 'faltou';
    return isSameDate && isNotCancelled;
  });
  
  const blocksForDay = db.bloqueios.filter(b => b.data === dateStr);
  
  const result: SlotState[] = [];
  
  for (const slot of candidates) {
    // 1. Check Lunch / Interval
    let overlapsLunch = false;
    if (expediente.intervalo_inicio && expediente.intervalo_fim) {
      const intStartMin = hhmmToMinutes(expediente.intervalo_inicio);
      const intEndMin = hhmmToMinutes(expediente.intervalo_fim);
      overlapsLunch = isOverlapping(slot.startMin, slot.endMin, intStartMin, intEndMin);
    }
    
    // 2. Check blocks (bloqueios)
    let overlapsBlock = false;
    for (const b of blocksForDay) {
      if (b.hora_inicio === null || b.hora_fim === null) {
        overlapsBlock = true;
        break;
      }
      const blockStart = hhmmToMinutes(b.hora_inicio);
      const blockEnd = hhmmToMinutes(b.hora_fim);
      if (isOverlapping(slot.startMin, slot.endMin, blockStart, blockEnd)) {
        overlapsBlock = true;
        break;
      }
    }
    
    // 3. Check active appointments (agendamentos)
    let overlapsBooking = false;
    for (const app of activeBookings) {
      const appStartHhmm = app.inicio_em.split('T')[1].substring(0, 5);
      const appEndHhmm = app.fim_em.split('T')[1].substring(0, 5);
      const appStart = hhmmToMinutes(appStartHhmm);
      const appEnd = hhmmToMinutes(appEndHhmm);
      if (isOverlapping(slot.startMin, slot.endMin, appStart, appEnd)) {
        overlapsBooking = true;
        break;
      }
    }
    
    if (overlapsLunch) {
      // Os horários que estiverem em intervalo não existirão, removendo-os totalmente das opções online
    } else if (overlapsBlock) {
      result.push({ horario: slot.startStr, disponivel: false, motivo: 'bloqueado' });
    } else if (overlapsBooking) {
      result.push({ horario: slot.startStr, disponivel: false, motivo: 'ocupado' });
    } else {
      result.push({ horario: slot.startStr, disponivel: true });
    }
  }
  
  return result;
}
