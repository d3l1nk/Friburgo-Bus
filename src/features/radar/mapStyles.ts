// Provedores de tiles (nenhum exige chave e todos funcionam no WebView Android).
export type MapStyle = 'ruas' | 'escuro' | 'satelite';

export interface TileSource {
  url: string;
  /** camada de rótulos por cima */
  overlay?: string;
  attribution: string;
  subdomains?: string;
  maxNativeZoom: number;
}

// A Esri é a fonte principal (funciona no WebView Android); CARTO fica como reserva.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';

export const STYLES: Record<MapStyle, { label: string; sources: TileSource[] }> = {
  ruas: {
    label: 'Ruas',
    sources: [
      {
        url: `${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`,
        attribution: 'Tiles &copy; Esri',
        maxNativeZoom: 19,
      },
      {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxNativeZoom: 20,
      },
    ],
  },
  escuro: {
    label: 'Escuro',
    sources: [
      {
        url: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
        overlay: `${ESRI}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
        attribution: 'Tiles &copy; Esri',
        maxNativeZoom: 16,
      },
      {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxNativeZoom: 20,
      },
    ],
  },
  satelite: {
    label: 'Satélite',
    sources: [
      {
        url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
        attribution: 'Tiles &copy; Esri',
        maxNativeZoom: 19,
      },
    ],
  },
};

export const STYLE_ORDER: MapStyle[] = ['ruas', 'escuro', 'satelite'];
export const STYLE_KEY = 'map:style:v2';

/** Abaixo deste zoom os marcadores de pontos somem para manter o mapa limpo (sem clusters). */
export const MIN_STOP_ZOOM = 15;
export const TILE_ERRORS_BEFORE_FALLBACK = 4;
export const MAX_FALLBACK_SWITCHES = 4;

const NEXT_STYLE: Record<MapStyle, MapStyle> = { ruas: 'satelite', satelite: 'escuro', escuro: 'ruas' };

export function currentSource(style: MapStyle, srcIdx: number): TileSource {
  const list = STYLES[style].sources;
  return list[Math.min(srcIdx, list.length - 1)];
}

export interface Fallback {
  style: MapStyle;
  srcIdx: number;
  message: string;
}

/** Próximo servidor do mesmo estilo; esgotados os servidores, passa para o próximo estilo. */
export function nextFallback(style: MapStyle, srcIdx: number): Fallback {
  if (srcIdx + 1 < STYLES[style].sources.length) {
    return { style, srcIdx: srcIdx + 1, message: 'Trocando o servidor do mapa…' };
  }
  const next = NEXT_STYLE[style];
  return {
    style: next,
    srcIdx: 0,
    message: `O mapa "${STYLES[style].label}" não carregou. Usando "${STYLES[next].label}".`,
  };
}

/** De perto todos os pontos aparecem; de longe só o selecionado (sem agrupar em clusters). */
export function isStopVisible(id: string, zoom: number, selectedId: string | null): boolean {
  return zoom >= MIN_STOP_ZOOM || id === selectedId;
}
