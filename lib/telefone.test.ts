import { describe, it, expect } from 'vitest';
import {
  DOMINIO_CLIENTE,
  normalizarTelefone,
  telefoneEValido,
  telefoneParaEmail,
  emailEDeTelefone
} from './telefone';

describe('normalizarTelefone', () => {
  it('remove máscara e deixa só dígitos', () => {
    expect(normalizarTelefone('(11) 98765-4321')).toBe('11987654321');
  });

  it('devolve string vazia para entrada vazia', () => {
    expect(normalizarTelefone('')).toBe('');
  });
});

describe('telefoneEValido', () => {
  it('aceita celular de 11 dígitos', () => {
    expect(telefoneEValido('(11) 98765-4321')).toBe(true);
  });

  it('aceita fixo de 10 dígitos', () => {
    expect(telefoneEValido('1132654321')).toBe(true);
  });

  it('recusa telefone curto', () => {
    expect(telefoneEValido('11987')).toBe(false);
  });

  it('recusa string vazia', () => {
    expect(telefoneEValido('')).toBe(false);
  });
});

describe('telefoneParaEmail', () => {
  it('prefixa o DDI 55 e usa o domínio da barbearia', () => {
    expect(telefoneParaEmail('(11) 98765-4321')).toBe(`5511987654321@${DOMINIO_CLIENTE}`);
  });

  it('dá o mesmo resultado para o telefone com e sem máscara', () => {
    expect(telefoneParaEmail('(11) 98765-4321')).toBe(telefoneParaEmail('11987654321'));
  });

  it('usa o domínio "detalhe" no singular', () => {
    expect(DOMINIO_CLIENTE).toBe('cliente.detalhebarbearia.com.br');
  });

  it('lança erro para telefone inválido em vez de gerar e-mail quebrado', () => {
    expect(() => telefoneParaEmail('11987')).toThrow();
  });
});

describe('emailEDeTelefone', () => {
  it('reconhece e-mail sintético', () => {
    expect(emailEDeTelefone(`5511987654321@${DOMINIO_CLIENTE}`)).toBe(true);
  });

  it('não confunde com e-mail real do cliente', () => {
    expect(emailEDeTelefone('joao@gmail.com')).toBe(false);
  });

  it('trata undefined e null sem quebrar', () => {
    expect(emailEDeTelefone(undefined)).toBe(false);
    expect(emailEDeTelefone(null)).toBe(false);
  });
});
