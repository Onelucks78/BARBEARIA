import { serviceClient } from './supabase.ts';
import { telefoneParaEmail } from '../lib/telefone.ts';

export interface LoginClienteCriado {
  authUserId: string;
  clienteId: string;
  email: string;
}

/** Telefone já tem usuário no Supabase Auth. Vira 409 nas rotas. */
export class TelefoneJaCadastradoError extends Error {
  constructor() {
    super('Esse telefone já tem conta. Entre com sua senha.');
    this.name = 'TelefoneJaCadastradoError';
  }
}

/**
 * A Admin API do Supabase não expõe um código estável para "e-mail já registrado":
 * a resposta é 422 com uma mensagem em inglês. Checamos os dois sinais.
 */
function eErroDeEmailDuplicado(erro: any): boolean {
  if (!erro) return false;
  if (erro.status === 422) return true;
  const msg = String(erro.message || '').toLowerCase();
  return msg.includes('already registered') || msg.includes('already been registered');
}

/**
 * Cria o usuário no Supabase Auth com e-mail sintético e garante a ficha em `clientes`.
 *
 * `barbeiroId` vem preenchido quando é o painel que está cadastrando; no auto-cadastro
 * fica vazio e usamos a barbearia ativa, mesma regra do upsertClientProfile
 * (server/storage.ts:560).
 */
export async function criarLoginClienteTelefone(input: {
  nome: string;
  telefone: string; // só dígitos, já validado pelo schema Zod
  senha: string;
  barbeiroId?: string;
}): Promise<LoginClienteCriado> {
  const client = serviceClient();
  if (!client) throw new Error('Supabase não configurado no servidor.');

  const email = telefoneParaEmail(input.telefone);

  let barbeiroId = input.barbeiroId;
  if (!barbeiroId) {
    const { data: barb } = await client
      .from('barbeiros').select('id').eq('ativo', true).limit(1).single();
    if (!barb) throw new Error('Nenhum barbeiro ativo encontrado.');
    barbeiroId = barb.id as string;
  }

  const { data: criado, error: erroAuth } = await client.auth.admin.createUser({
    email,
    password: input.senha,
    // OBRIGATÓRIO: sem isso o Supabase fica esperando o clique num link de confirmação
    // enviado para uma caixa que não existe, e o cliente nunca consegue entrar.
    email_confirm: true,
    user_metadata: { nome: input.nome, telefone: input.telefone, role: 'cliente' }
  });

  if (erroAuth || !criado?.user) {
    if (eErroDeEmailDuplicado(erroAuth)) throw new TelefoneJaCadastradoError();
    throw erroAuth ?? new Error('Erro ao criar login do cliente.');
  }

  const authUserId = criado.user.id;

  try {
    const { data: existente } = await client
      .from('clientes')
      .select('id')
      .eq('barbeiro_id', barbeiroId)
      .eq('telefone', input.telefone)
      .maybeSingle();

    if (existente?.id) {
      // Ficha criada antes pelo barbeiro (sem senha): liga o login nela em vez de
      // criar uma segunda, senão o histórico de agendamentos do cliente se perde.
      // O `nome` NÃO é sobrescrito: o barbeiro pode ter anotado algo que o ajuda
      // a identificar o cliente.
      const { error } = await client
        .from('clientes')
        .update({ auth_user_id: authUserId, email })
        .eq('id', existente.id);
      if (error) throw error;
      return { authUserId, clienteId: existente.id as string, email };
    }

    const { data: nova, error } = await client.from('clientes').insert({
      barbeiro_id: barbeiroId,
      auth_user_id: authUserId,
      nome: input.nome,
      telefone: input.telefone,
      email,
      observacoes: ''
    }).select('id').single();
    if (error || !nova) throw error ?? new Error('Erro ao criar ficha do cliente.');

    return { authUserId, clienteId: nova.id as string, email };
  } catch (err) {
    // Sem este rollback sobra um login órfão: o cliente bateria em 409 para sempre
    // numa conta que não tem ficha e não dá para usar.
    await client.auth.admin.deleteUser(authUserId).catch(() => {});
    throw err;
  }
}

export async function redefinirSenhaCliente(authUserId: string, senha: string): Promise<void> {
  const client = serviceClient();
  if (!client) throw new Error('Supabase não configurado no servidor.');
  const { error } = await client.auth.admin.updateUserById(authUserId, { password: senha });
  if (error) throw error;
}
