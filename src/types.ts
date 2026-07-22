export interface Barbeiro {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  avatar_url: string;
  nome_barbearia: string;
  bio: string;
  slug: string;
  ativo: boolean;
  ultimo_acesso_em: string;
  created_at: string;
  updated_at: string;
}

// Quem corta o cabelo. Não confundir com Barbeiro, que é a CONTA/barbearia.
// Na interface o usuário lê sempre "Barbeiro"; o nome interno evita a colisão.
export interface Profissional {
  id: string;
  barbeiro_id: string; // a barbearia a que pertence
  nome: string;
  avatar_url: string | null;
  telefone: string;
  bio: string;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface Servico {
  id: string;
  barbeiro_id: string;
  nome: string;
  descricao: string;
  preco: number;
  duracao_minutos: number;
  imagem_url: string;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface Produto {
  id: string;
  barbeiro_id: string;
  nome: string;
  descricao: string;
  preco: number;
  imagem_url: string;
  estoque: number;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface Cliente {
  id: string;
  barbeiro_id: string;
  nome: string;
  telefone: string;
  email: string;
  data_nascimento: string | null; // YYYY-MM-DD
  observacoes: string;
  ativo: boolean;
  foto_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Agendamento {
  id: string;
  barbeiro_id: string;
  profissional_id: string; // quem vai atender
  servico_id: string;
  cliente_id: string | null; // Nullable if booked without registration
  nome_cliente: string;
  telefone_cliente: string;
  inicio_em: string; // ISO DateTime
  fim_em: string; // ISO DateTime
  status: 'agendado' | 'confirmado' | 'concluido' | 'cancelado' | 'faltou';
  preco_cobrado: number;
  observacao: string;
  created_at: string;
  updated_at: string;
}

export interface Expediente {
  id: string;
  barbeiro_id: string;
  profissional_id: string;
  dia_semana: number; // 0-6 (0 = Domingo)
  hora_inicio: string; // "HH:MM"
  hora_fim: string; // "HH:MM"
  intervalo_inicio: string | null; // "HH:MM"
  intervalo_fim: string | null; // "HH:MM"
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Bloqueio {
  id: string;
  barbeiro_id: string;
  profissional_id: string | null; // null = fecha a barbearia toda (feriado)
  data: string; // YYYY-MM-DD
  hora_inicio: string | null; // "HH:MM" (null means full day)
  hora_fim: string | null; // "HH:MM" (null means full day)
  motivo: string;
  created_at: string;
  updated_at: string;
}

export interface LancamentoFinanceiro {
  id: string;
  barbeiro_id: string;
  profissional_id: string | null; // null = da casa (produto, aluguel, despesa)
  tipo: 'entrada' | 'saida';
  descricao: string;
  valor: number;
  categoria: string;
  forma_pagamento: 'dinheiro' | 'pix' | 'cartao' | 'outro';
  agendamento_id: string | null;
  produto_id: string | null;
  data: string; // YYYY-MM-DD
  excluido?: boolean;
  created_at: string;
  updated_at: string;
}

// Assinatura recorrente do cliente, empacotada como JSON dentro de Cliente.observacoes
export interface ClienteSubscription {
  plan: string;
  status: string;
  price: number;
  renews_at: string; // ISO date
  card_last4?: string;
  card_brand?: string;
}

export interface CategoriaFinanceira {
  id: string;
  nome: string;
  tipo: 'entrada' | 'saida';
  created_at: string;
  updated_at: string;
}

// Stats response schema for our dashboard backend helper
export interface DashboardStats {
  faturamento: number;
  outrasEntradas: number;
  produtosVendidos: number;
  despesas: number;
  lucro: number;
  concluidosCount: number;
  agendadosCount: number;
  dailyChartData: { data: string; total: number; receitas: number; despesas: number; lucro: number }[];
  history: LancamentoFinanceiro[];
  // Quebra de faturamento por barbeiro no período. profissional_id null = da casa.
  porProfissional: {
    profissional_id: string | null;
    nome: string;
    receita: number;
    atendimentos: number;
  }[];
}
