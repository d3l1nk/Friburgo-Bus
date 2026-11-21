import { describe, expect, it } from 'vitest';
import { DAY_LABEL, dayTypeOf, etaParts, minutesOfDay } from './time';

describe('dayTypeOf', () => {
  it('segunda a sexta = dia útil (U)', () => {
    for (const d of [16, 17, 18, 19, 20]) expect(dayTypeOf(new Date(2026, 10, d))).toBe('U');
  });
  it('sábado = S e domingo = D', () => {
    expect(dayTypeOf(new Date(2026, 10, 21))).toBe('S');
    expect(dayTypeOf(new Date(2026, 10, 22))).toBe('D');
  });
  it('usa a data atual por padrão', () => {
    expect(['U', 'S', 'D']).toContain(dayTypeOf());
  });
});

describe('minutesOfDay', () => {
  it('converte horário em minutos desde 00:00, incluindo segundos', () => {
    expect(minutesOfDay(new Date(2026, 0, 1, 0, 0, 0))).toBe(0);
    expect(minutesOfDay(new Date(2026, 0, 1, 8, 15, 30))).toBeCloseTo(8 * 60 + 15.5);
    expect(minutesOfDay(new Date(2026, 0, 1, 23, 59, 0))).toBe(1439);
  });
});

describe('etaParts', () => {
  it('menos de 1 minuto = "Agora"', () => {
    expect(etaParts(0)).toEqual({ big: 'Agora', unit: '' });
    expect(etaParts(0.9)).toEqual({ big: 'Agora', unit: '' });
  });
  it('arredonda para cima abaixo de 1 hora', () => {
    expect(etaParts(1)).toEqual({ big: '1', unit: 'min' });
    expect(etaParts(12.2)).toEqual({ big: '13', unit: 'min' });
    expect(etaParts(59.1)).toEqual({ big: '60', unit: 'min' });
  });
  it('a partir de 1 hora usa o formato XhMM', () => {
    expect(etaParts(60)).toEqual({ big: '1h00', unit: '' });
    expect(etaParts(125)).toEqual({ big: '2h05', unit: '' });
  });
});

describe('DAY_LABEL', () => {
  it('tem rótulo para todos os tipos de dia', () => {
    expect(Object.keys(DAY_LABEL).sort()).toEqual(['C', 'D', 'S', 'U']);
  });
});
