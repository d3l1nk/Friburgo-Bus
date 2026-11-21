import { describe, expect, it } from 'vitest';
import { errMessage } from './errors';

describe('errMessage', () => {
  it('extrai a mensagem de Error e de string', () => {
    expect(errMessage(new Error('boom'))).toBe('boom');
    expect(errMessage('texto')).toBe('texto');
  });
  it('usa o fallback para qualquer outra coisa', () => {
    expect(errMessage(undefined, 'padrão')).toBe('padrão');
    expect(errMessage({ message: 'x' })).toBe('Erro desconhecido');
    expect(errMessage(new Error(''))).toBe('Erro desconhecido');
  });
});
