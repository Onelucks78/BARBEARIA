import { z } from 'zod';
import { onlyDigits } from './validation.ts';

// Telefone só dígitos, 10 ou 11 caracteres (BR). Aceita formatado.
const phone = z.string()
  .transform(s => onlyDigits(s))
  .pipe(z.string()
    .refine(d => d.length === 0 || d.length === 10 || d.length === 11, 'Telefone deve ter 10 ou 11 dígitos.')
  );

const date = z.string()
  .refine(s => /^\d{4}-\d{2}-\d{2}/.test(s), 'Data deve começar com YYYY-MM-DD.')
  .transform(s => s.slice(0, 10)); // aceita "YYYY-MM-DD" e "YYYY-MM-DDTHH:MM:SS..." → normaliza
const time = z.string()
  .transform(s => {
    if (!s) return s;
    const parts = s.trim().split(':');
    if (parts.length >= 2) {
      const h = parts[0].padStart(2, '0');
      const m = parts[1].slice(0, 2).padStart(2, '0');
      return `${h}:${m}`;
    }
    return s;
  })
  .pipe(z.string().regex(/^\d{2}:\d{2}/, 'Horário deve ser no formato HH:MM.'));
const imageUrl = z.string().refine(
  val => !val || val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:image/') || val.startsWith('/'),
  { message: 'URL de imagem inválida.' }
).nullable().optional();

export const schemas = {
  // ---------- AUTH ----------
  adminGoogleLogin: z.object({
    id_token: z.string().min(10)
  }),
  clientLogin: z.object({
    email: z.string().email(),
    password: z.string().min(6)
  }),
  clientSignup: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    nome: z.string().min(2),
    telefone: phone
  }),

  // ---------- PÚBLICO ----------
  publicBySlug: z.object({
    slug: z.string().min(1)
  }),
  // Aceita UUID único ("uuid"), lista CSV ("uuid,uuid"), OU id legado ("s-1")
  freeSlotsQuery: z.object({
    data: date,
    servico_id: z.string().min(1),
    profissional_id: z.string().uuid('Selecione um barbeiro.'),
    all: z.enum(['true', 'false']).optional()
  }),

  // ---------- AGENDAMENTO (visitante) ----------
  createBooking: z.object({
    servico_id: z.string().min(1), // aceita UUID único, CSV ou id legado
    profissional_id: z.string().uuid('Selecione um barbeiro.'),
    data: date,
    horario: time,
    nome_cliente: z.string().min(2).max(120),
    telefone_cliente: phone,
    observacao: z.string().max(500).optional(),
    cliente_id: z.string().optional(), // legado aceita qualquer string
    cliente_email: z.string().email().optional()
  }),
  updateProfile: z.object({
    email: z.string().email(),
    nome: z.string().min(2).max(120).optional(),
    telefone: phone.optional(),
    foto_url: imageUrl
  }),

  // ---------- ADMIN: SERVIÇOS ----------
  createService: z.object({
    nome: z.string().min(2).max(120),
    descricao: z.string().max(500).default(''),
    preco: z.number().nonnegative(),
    duracao_minutos: z.number().int().positive().max(600),
    imagem_url: imageUrl
  }),
  patchService: z.object({
    nome: z.string().min(2).max(120).optional(),
    descricao: z.string().max(500).optional(),
    preco: z.number().nonnegative().optional(),
    duracao_minutos: z.number().int().positive().max(600).optional(),
    imagem_url: imageUrl,
    ativo: z.boolean().optional(),
    ordem: z.number().int().optional()
  }).refine(o => Object.keys(o).length > 0, 'Payload vazio.'),

  // ---------- ADMIN: PRODUTOS ----------
  createProduct: z.object({
    nome: z.string().min(2).max(120),
    descricao: z.string().max(500).default(''),
    preco: z.number().nonnegative(),
    estoque: z.number().int().nonnegative(),
    imagem_url: imageUrl
  }),
  patchProduct: z.object({
    nome: z.string().min(2).max(120).optional(),
    descricao: z.string().max(500).optional(),
    preco: z.number().nonnegative().optional(),
    estoque: z.number().int().nonnegative().optional(),
    imagem_url: imageUrl,
    ativo: z.boolean().optional(),
    ordem: z.number().int().optional()
  }).refine(o => Object.keys(o).length > 0, 'Payload vazio.'),

  // ---------- ADMIN: CLIENTES ----------
  createClient: z.object({
    nome: z.string().min(2).max(120),
    telefone: phone,
    email: z.string().email().optional().or(z.literal('')),
    data_nascimento: date.optional().or(z.literal('')),
    observacoes: z.string().max(1000).optional()
  }),
  patchClient: z.object({
    nome: z.string().min(2).max(120).optional(),
    telefone: phone.optional(),
    email: z.string().email().optional().or(z.literal('')),
    data_nascimento: date.optional().or(z.literal('')),
    observacoes: z.string().max(1000).optional(),
    ativo: z.boolean().optional()
  }).refine(o => Object.keys(o).length > 0, 'Payload vazio.'),

  // ---------- ADMIN: AGENDAMENTOS ----------
  patchBooking: z.object({
    status: z.enum(['agendado','confirmado','concluido','cancelado','faltou']).optional(),
    cliente_id: z.string().uuid().nullable().optional(),
    observacao: z.string().max(500).optional()
  }).refine(o => Object.keys(o).length > 0, 'Payload vazio.'),

  // ---------- ADMIN: FINANCEIRO ----------
  // profissional_id null/ausente = lançamento da casa (produto, aluguel, despesa)
  createLancamento: z.object({
    tipo: z.enum(['entrada','saida']),
    descricao: z.string().max(500).optional(),
    valor: z.number().nonnegative(),
    categoria: z.string().max(120).optional(),
    forma_pagamento: z.enum(['dinheiro','pix','cartao','outro']),
    data: date,
    produto_id: z.string().uuid().optional(),
    profissional_id: z.string().uuid().nullable().optional()
  }),
  patchLancamento: z.object({
    tipo: z.enum(['entrada','saida']).optional(),
    descricao: z.string().max(500).optional(),
    valor: z.number().nonnegative().optional(),
    categoria: z.string().max(120).optional(),
    forma_pagamento: z.enum(['dinheiro','pix','cartao','outro']).optional(),
    data: date.optional(),
    profissional_id: z.string().uuid().nullable().optional()
  }).refine(o => Object.keys(o).length > 0, 'Payload vazio.'),

  // ---------- ADMIN: CATEGORIAS FINANCEIRAS ----------
  createCategoria: z.object({
    nome: z.string().min(2).max(80),
    tipo: z.enum(['entrada','saida'])
  }),
  patchCategoria: z.object({
    nome: z.string().min(2).max(80).optional(),
    tipo: z.enum(['entrada','saida']).optional()
  }).refine(o => Object.keys(o).length > 0, 'Payload vazio.'),

  // ---------- ADMIN: EXPEDIENTE / BLOQUEIOS ----------
  patchExpediente: z.object({
    hora_inicio: time.optional(),
    hora_fim: time.optional(),
    intervalo_inicio: time.nullable().optional(),
    intervalo_fim: time.nullable().optional(),
    ativo: z.boolean().optional()
  }).refine(o => Object.keys(o).length > 0, 'Payload vazio.'),
  patchIntervaloPadrao: z.object({
    hora_inicio: time.optional(),
    hora_fim: time.optional(),
    intervalo_inicio: time.nullable().optional(),
    intervalo_fim: time.nullable().optional()
  }),
  // profissional_id null/ausente = fecha a barbearia toda (feriado)
  createBloqueio: z.object({
    data: date,
    hora_inicio: time.nullable().optional(),
    hora_fim: time.nullable().optional(),
    motivo: z.string().min(2).max(200),
    profissional_id: z.string().uuid().nullable().optional()
  }),

  // ---------- ADMIN: PROFISSIONAIS (equipe) ----------
  createProfissional: z.object({
    nome: z.string().min(2).max(120),
    telefone: phone.optional(),
    bio: z.string().max(500).optional(),
    avatar_url: imageUrl
  }),
  patchProfissional: z.object({
    nome: z.string().min(2).max(120).optional(),
    telefone: phone.optional(),
    bio: z.string().max(500).optional(),
    avatar_url: imageUrl,
    ativo: z.boolean().optional(),
    ordem: z.number().int().optional()
  }).refine(o => Object.keys(o).length > 0, 'Payload vazio.'),

  // ---------- DASHBOARD ----------
  dashboardQuery: z.object({
    start_date: date.optional(),
    end_date: date.optional(),
    is_today: z.enum(['true','false']).optional(),
    profissional_id: z.string().uuid().optional()
  })
};
