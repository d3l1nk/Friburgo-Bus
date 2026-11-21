import { describe, expect, it } from 'vitest';
import { MIN_STOP_ZOOM, STYLES, STYLE_ORDER, currentSource, isStopVisible, nextFallback } from './mapStyles';

describe('provedores de tiles', () => {
  it('todos os estilos têm ao menos uma fonte com URL https e atribuição', () => {
    for (const s of STYLE_ORDER) {
      expect(STYLES[s].sources.length).toBeGreaterThan(0);
      for (const src of STYLES[s].sources) {
        expect(src.url.startsWith('https://')).toBe(true);
        expect(src.attribution.length).toBeGreaterThan(0);
      }
    }
  });
  it('Ruas e Escuro usam a Esri como principal e o CARTO como reserva; satélite é só Esri', () => {
    expect(STYLES.ruas.sources[0].url).toContain('arcgisonline.com');
    expect(STYLES.ruas.sources[1].url).toContain('cartocdn.com');
    expect(STYLES.escuro.sources[1].url).toContain('dark_all');
    expect(STYLES.satelite.sources).toHaveLength(1);
  });
  it('currentSource limita o índice ao tamanho da lista', () => {
    expect(currentSource('satelite', 5)).toBe(STYLES.satelite.sources[0]);
    expect(currentSource('ruas', 1)).toBe(STYLES.ruas.sources[1]);
  });
});

describe('nextFallback', () => {
  it('primeiro tenta o próximo servidor do mesmo estilo', () => {
    expect(nextFallback('ruas', 0)).toMatchObject({ style: 'ruas', srcIdx: 1 });
  });
  it('esgotados os servidores, vai para outro estilo e volta ao índice 0', () => {
    expect(nextFallback('ruas', 1)).toMatchObject({ style: 'satelite', srcIdx: 0 });
    expect(nextFallback('satelite', 0)).toMatchObject({ style: 'escuro', srcIdx: 0 });
    expect(nextFallback('escuro', 1)).toMatchObject({ style: 'ruas', srcIdx: 0 });
    expect(nextFallback('ruas', 1).message).toContain('Ruas');
  });
});

describe('isStopVisible (sem clusters: aparece ou some)', () => {
  it('com zoom suficiente todos os pontos aparecem', () => {
    expect(isStopVisible('a', MIN_STOP_ZOOM, null)).toBe(true);
    expect(isStopVisible('a', 19, 'b')).toBe(true);
  });
  it('com zoom afastado só o ponto selecionado permanece', () => {
    expect(isStopVisible('a', MIN_STOP_ZOOM - 1, null)).toBe(false);
    expect(isStopVisible('a', MIN_STOP_ZOOM - 1, 'b')).toBe(false);
    expect(isStopVisible('b', MIN_STOP_ZOOM - 1, 'b')).toBe(true);
  });
});
