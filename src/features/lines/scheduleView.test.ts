import { describe, expect, it } from 'vitest';
import type { NextByColumn } from '../../services/faol';
import type { Departure } from '../../types';
import { filterUpcoming, groupByHour, nextMinute, pickDepartureCards, ramalColor } from './scheduleView';

const row = (origin: string, isTerminal: boolean, left?: number): NextByColumn => ({
  origin,
  isTerminal,
  next: left === undefined ? undefined : { time: '08:00', minutes: 480 },
  minutesLeft: left,
});
const d = (minutes: number, ramal?: string): Departure => ({
  time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
  minutes,
  ramal,
});

describe('pickDepartureCards', () => {
  it('Estação Livre + bairro mais próximo, o resto vira chips', () => {
    const { cards, others } = pickDepartureCards([
      row('Saibreira', false, 20),
      row('Estação Livre', true, 5),
      row('M.Bonita', false, 8),
      row('Coelho', false),
    ]);
    expect(cards.map((c) => [c.tag, c.row.origin, c.tone])).toEqual([
      ['Saindo da Estação Livre', 'Estação Livre', 'route'],
      ['Saindo do bairro', 'M.Bonita', 'go'],
    ]);
    expect(others.map((o) => o.origin)).toEqual(['Saibreira']); // "Coelho" não tem saída
  });
  it('sem terminal: o bairro mais próximo vira "Próxima saída"; com 2+ bairros mostra dois', () => {
    expect(pickDepartureCards([row('A', false, 3)]).cards.map((c) => c.tag)).toEqual(['Próxima saída']);
    expect(
      pickDepartureCards([row('A', false, 3), row('B', false, 9)]).cards.map((c) => c.row.origin),
    ).toEqual(['A', 'B']);
  });
  it('só terminal: um cartão; sem colunas: nenhum', () => {
    expect(pickDepartureCards([row('Estação Livre', true, 1)]).cards).toHaveLength(1);
    expect(pickDepartureCards([])).toEqual({ cards: [], others: [] });
  });
  it('bairro sem mais saídas vai por último na ordenação', () => {
    const { cards } = pickDepartureCards([row('Fim', false), row('A', false, 40)]);
    expect(cards[0].row.origin).toBe('A');
  });
});

describe('filtros e agrupamento', () => {
  const deps = [d(480), d(495), d(510), d(600)];
  it('filterUpcoming mantém saídas a partir de 1 min atrás', () => {
    expect(filterUpcoming(deps, 495.5, true).map((x) => x.time)).toEqual(['08:15', '08:30', '10:00']);
    expect(filterUpcoming(deps, 496.5, true).map((x) => x.time)).toEqual(['08:30', '10:00']);
    expect(filterUpcoming(deps, 9999, true)).toEqual([]);
    expect(filterUpcoming(deps, 9999, false)).toHaveLength(4);
  });
  it('nextMinute', () => {
    expect(nextMinute(deps, 496)).toBe(510);
    expect(nextMinute(deps, 2000)).toBeUndefined();
  });
  it('groupByHour agrupa por hora cheia', () => {
    expect(groupByHour(deps).map(([h, l]) => [h, l.length])).toEqual([
      [8, 3],
      [10, 1],
    ]);
    expect(groupByHour([])).toEqual([]);
  });
  it('ramalColor é estável e indefinido sem ramal', () => {
    expect(ramalColor()).toBeUndefined();
    expect(ramalColor('A')).toBe(ramalColor('A'));
    expect(ramalColor('A')).not.toBe(ramalColor('B'));
  });
});
