import { describe, expect, it } from 'vitest';
import {
  findArray,
  formatDirection,
  normalizeArrivals,
  normalizeStops,
  normalizeVehicles,
  parseEta,
  pick,
  pickCoords,
  toNum,
} from './normalize';
import panel from './__fixtures__/panel.json';
import stops from './__fixtures__/stops.json';
import vehicles from './__fixtures__/vehicles.json';

describe('pick / toNum', () => {
  it('ignora maiúsculas e pula valores vazios', () => {
    expect(pick({ Lat: 1 }, ['lat'])).toBe(1);
    expect(pick({ a: '', b: null, c: 3 }, ['a', 'b', 'c'])).toBe(3);
    expect(pick(null, ['a'])).toBeUndefined();
    expect(pick([1], ['0'])).toBeUndefined();
  });
  it('toNum aceita vírgula decimal e rejeita lixo', () => {
    expect(toNum('-22,5')).toBe(-22.5);
    expect(toNum(7)).toBe(7);
    expect(toNum('abc')).toBeNull();
    expect(toNum(NaN)).toBeNull();
    expect(toNum(undefined)).toBeNull();
  });
});

describe('pickCoords', () => {
  it('campos diretos, strings e vírgula', () => {
    expect(pickCoords({ latitude: '-22,28', longitude: '-42,53' })).toEqual({ lat: -22.28, lng: -42.53 });
  });
  it('objeto aninhado (coords.center) e posicao', () => {
    expect(pickCoords({ coords: { center: { lat: -22.1, lng: -42.1 } } })).toEqual({
      lat: -22.1,
      lng: -42.1,
    });
    expect(pickCoords({ posicao: { lat: -22.2, lng: -42.2 } })).toEqual({ lat: -22.2, lng: -42.2 });
  });
  it('GeoJSON [lng, lat] e string "lat,lng"', () => {
    expect(pickCoords({ geometry: { coordinates: [-42.5, -22.5] } })).toEqual({ lat: -22.5, lng: -42.5 });
    expect(pickCoords({ position: '-22.1, -42.2' })).toEqual({ lat: -22.1, lng: -42.2 });
  });
  it('rejeita zero, fora de faixa, vazio e profundidade excessiva', () => {
    expect(pickCoords({ lat: 0, lng: 0 })).toBeNull();
    expect(pickCoords({ lat: 99, lng: 10 })).toBeNull();
    expect(pickCoords({})).toBeNull();
    expect(pickCoords(null)).toBeNull();
    expect(pickCoords({ a: 1 })).toBeNull();
  });
});

describe('findArray', () => {
  it('lista na raiz, aninhada ou ausente', () => {
    expect(findArray([{ a: 1 }, 5])).toEqual([{ a: 1 }]);
    expect(findArray({ data: { itens: [{ a: 1 }] } })).toEqual([{ a: 1 }]);
    expect(findArray({ x: 1 })).toEqual([]);
    expect(findArray(null)).toEqual([]);
    expect(findArray('texto')).toEqual([]);
    expect(findArray({ lista: [] })).toEqual([]);
  });
});

describe('normalizeStops', () => {
  const out = normalizeStops(stops);
  it('junta linhas repetidas do mesmo ponto e descarta itens sem coordenadas válidas', () => {
    expect(out.map((s) => s.id)).toEqual(['1627', '900', '5']);
    const a = out.find((s) => s.id === '1627');
    expect(a).toMatchObject({ name: 'Rua A, 10', lat: -22.2833, lng: -42.5378 });
    expect(a?.lines.sort()).toEqual(['10 Olaria', '25', '58']);
  });
  it('aceita nomes de campo alternativos e coordenadas com vírgula', () => {
    expect(out.find((s) => s.id === '900')).toMatchObject({
      name: 'Praça B',
      lat: -22.29,
      lng: -42.54,
      lines: ['04C', '43'],
    });
  });
  it('sem nome vira "Ponto {id}"', () => {
    expect(out.find((s) => s.id === '5')?.name).toBe('GeoJSON');
    expect(normalizeStops([{ id: 9, lat: -22.1, lng: -42.1 }])[0].name).toBe('Ponto 9');
  });
  it('entradas vazias ou inválidas devolvem []', () => {
    for (const bad of [null, undefined, [], {}, 'x', 42, [null, 1]]) expect(normalizeStops(bad)).toEqual([]);
  });
});

describe('parseEta', () => {
  it('números: minutos, ou segundos quando > 600', () => {
    expect(parseEta(5)).toEqual({ min: 5, text: '5' });
    expect(parseEta(900).min).toBe(15);
    expect(parseEta(-3).min).toBe(0);
  });
  it('textos com min/h', () => {
    expect(parseEta('12 min').min).toBe(12);
    expect(parseEta('1h 05min').min).toBe(65);
    expect(parseEta('7').min).toBe(7);
    expect(parseEta('7,6').min).toBe(8);
  });
  it('hh:mm:ss é duração; hh:mm é horário previsto', () => {
    expect(parseEta('00:05:00').min).toBe(5);
    const now = new Date();
    const t = new Date(now.getTime() + 10 * 60000);
    const hhmm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    expect(Math.abs((parseEta(hhmm).min ?? 0) - 10)).toBeLessThanOrEqual(1);
  });
  it('vazio e texto livre', () => {
    expect(parseEta(undefined)).toEqual({ min: null, text: '' });
    expect(parseEta('')).toEqual({ min: null, text: '' });
    expect(parseEta('sem previsão')).toEqual({ min: null, text: 'sem previsão' });
  });
});

describe('normalizeArrivals', () => {
  const out = normalizeArrivals(panel);
  it('ordena por tempo, deixando sem previsão por último', () => {
    expect(out.map((a) => a.prefix)).toEqual(['B07', 'C01', 'A12', 'D99']);
    expect(out.map((a) => a.etaMin)).toEqual([3, 5, 12, null]);
  });
  it('resolve a chave da linha mesmo com nome junto ("10 - OLARIA…") e zero à esquerda', () => {
    expect(out.find((a) => a.prefix === 'B07')?.lineKey).toBe('10');
    expect(out.find((a) => a.prefix === 'C01')?.lineKey).toBe('4C');
    expect(out.find((a) => a.prefix === 'A12')).toMatchObject({
      lineKey: '58',
      destination: 'Estação Livre',
    });
  });
  it('vazio ou malformado devolve []', () => {
    expect(normalizeArrivals(null)).toEqual([]);
    expect(normalizeArrivals({ veiculos: [] })).toEqual([]);
    expect(normalizeArrivals('<html>erro</html>')).toEqual([]);
  });
});

describe('formatDirection', () => {
  it('prefixa "Sentido" e normaliza ida/volta', () => {
    expect(formatDirection('Rodoviária')).toBe('Sentido Rodoviária');
    expect(formatDirection('sentido: Cônego')).toBe('Sentido Cônego');
    expect(formatDirection('0')).toBe('Ida');
    expect(formatDirection('VOLTA')).toBe('Volta');
    expect(formatDirection('7')).toBe('');
    expect(formatDirection('  ')).toBe('');
  });
});

describe('normalizeVehicles', () => {
  const out = normalizeVehicles(vehicles);
  it('descarta veículos sem posição', () => {
    expect(out.map((v) => v.id)).toEqual(['A12', 'B07', 'C01']);
  });
  it('lê posição, linha, sentido, velocidade e rumo de variações de campo', () => {
    expect(out[0]).toMatchObject({
      lineKey: '58',
      lat: -22.283,
      lng: -42.535,
      direction: 'Sentido Rodoviária',
      speed: 31.5,
      heading: 90,
    });
    expect(out[1]).toMatchObject({ lineKey: '10', direction: 'Volta' });
    expect(out[2]).toMatchObject({ lineKey: '4C', lat: -22.29, direction: 'Sentido Cônego' });
  });
  it('lista vazia e JSON inesperado não quebram', () => {
    expect(normalizeVehicles([])).toEqual([]);
    expect(normalizeVehicles({ erro: 'x' })).toEqual([]);
    expect(normalizeVehicles(undefined)).toEqual([]);
  });
});
