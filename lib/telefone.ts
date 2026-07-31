// Conversão telefone -> e-mail sintético.
//
// O app identifica o cliente por e-mail em toda a cadeia do Stripe (checkout, webhook,
// portal, cancelamento). Cliente que se cadastra só com telefone não tem e-mail, então
// derivamos um endereço estável a partir do número. Ele nunca é exibido nem digitado
// pelo usuário — serve só para o Supabase Auth e o Stripe terem uma chave válida.
//
// Este módulo é importado pelo front E pelo servidor de propósito: os dois lados
// PRECISAM gerar exatamente o mesmo e-mail para o mesmo telefone, senão o cliente
// cadastra por um endereço e tenta entrar por outro.

// Subdomínio do domínio real da barbearia (detalhebarbearia.com.br — "detalhe",
// singular). Não tem registro MX e nunca recebe e-mail: é só um identificador.
export const DOMINIO_CLIENTE = 'cliente.detalhebarbearia.com.br';

/** Só dígitos. Mesma regra do `onlyDigits` de server/validation.ts. */
export function normalizarTelefone(telefone: string): string {
  return (telefone || '').replace(/\D/g, '');
}

/** 10 dígitos (fixo) ou 11 (celular) — o mesmo que o schema `phone` do servidor aceita. */
export function telefoneEValido(telefone: string): boolean {
  const digitos = normalizarTelefone(telefone);
  return digitos.length === 10 || digitos.length === 11;
}

/**
 * Telefone -> e-mail sintético.
 * O DDI 55 entra SÓ aqui: a coluna clientes.telefone continua com 10 ou 11 dígitos,
 * como toda a base já faz. Mudar isso quebraria o índice único e os agendamentos.
 * Lança erro em vez de gerar um endereço quebrado que só falharia lá na frente.
 */
export function telefoneParaEmail(telefone: string): string {
  const digitos = normalizarTelefone(telefone);
  if (digitos.length !== 10 && digitos.length !== 11) {
    throw new Error('Telefone precisa ter 10 ou 11 dígitos.');
  }
  return `55${digitos}@${DOMINIO_CLIENTE}`;
}

/** Usado pela interface para nunca exibir o e-mail sintético ao usuário. */
export function emailEDeTelefone(email?: string | null): boolean {
  return !!email && email.toLowerCase().endsWith(`@${DOMINIO_CLIENTE}`);
}
