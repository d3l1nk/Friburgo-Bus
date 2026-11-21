import { describe, expect, it } from 'vitest';
import { FAOL_LINES, dayReplacement, findLine, isKnownKey, lineKey, resolveLineKey } from './faolLines';

describe('lineKey', () => {
  it('normaliza zeros à esquerda e sufixo', () => {
    expect(lineKey('04')).toBe('4');
    expect(lineKey('04C')).toBe('4C');
    expect(lineKey('58-A')).toBe('58');
    expect(lineKey('10 Olaria')).toBe('10');
    expect(lineKey(100)).toBe('100');
  });
  it('vazio para entradas sem número', () => {
    expect(lineKey('Olaria')).toBe('');
    expect(lineKey(null)).toBe('');
    expect(lineKey(undefined)).toBe('');
  });
});

describe('resolveLineKey', () => {
  it('ramal (58A) cai na linha-base do catálogo', () => {
    expect(resolveLineKey('58A')).toBe('58');
    expect(resolveLineKey('04C')).toBe('4C');
  });
  it('chave desconhecida é mantida', () => {
    expect(resolveLineKey('999')).toBe('999');
    expect(isKnownKey('999')).toBe(false);
  });
});

describe('catálogo', () => {
  it('tem 48 linhas, sem códigos repetidos', () => {
    expect(FAOL_LINES).toHaveLength(48);
    expect(new Set(FAOL_LINES.map((l) => l.code)).size).toBe(FAOL_LINES.length);
  });
  it('findLine aceita código com ou sem zero à esquerda', () => {
    expect(findLine('4')?.name).toContain('Vale dos Pinheiros');
    expect(findLine('04C')?.name).toBe('Eugênio Montechiari');
    expect(findLine('zzz')).toBeUndefined();
  });
});

describe('dayReplacement', () => {
  it('linha 54 aos domingos é atendida pelas linhas 53, 55 e 500', () => {
    expect(dayReplacement('54', 'D')?.related).toEqual(['53', '55', '500']);
  });
  it('demais combinações não têm substituição', () => {
    expect(dayReplacement('54', 'U')).toBeUndefined();
    expect(dayReplacement('58', 'D')).toBeUndefined();
  });
});
