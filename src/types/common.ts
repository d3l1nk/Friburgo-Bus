export interface LatLng {
  lat: number;
  lng: number;
}

export type DayCode = 'U' | 'S' | 'D' | 'C';
export type TabId = 'radar' | 'lines' | 'luiz' | 'favorites' | 'settings';
export type SettingsView = 'main' | 'about' | 'feedback' | 'alerts' | 'diag';

export type RegionId = 'circular' | 'centro-sul' | 'centro-norte' | 'norte' | 'leste' | 'sul' | 'oeste';

export interface FaolLine {
  code: string;
  name: string;
  region: RegionId;
}

// ---------- HTTP / Debug ----------
export interface HttpResult<T = unknown> {
  ok: boolean;
  status: number;
  ms: number;
  url: string;
  /** null quando a requisição falhou antes de haver resposta. */
  data: T | null;
  error?: string;
}

export interface DebugEntry {
  label: string;
  at: number;
  url: string;
  method: string;
  requestBody?: unknown;
  status: number;
  ms: number;
  ok: boolean;
  error?: string;
  data: unknown;
}

// ---------- Favoritos / feedback ----------
export interface FavoriteStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface Favorites {
  lines: string[];
  stops: FavoriteStop[];
}

export interface FeedbackItem {
  id: string;
  kind: 'reclamacao' | 'sugestao' | 'elogio';
  lineCode?: string;
  message: string;
  contact?: string;
  createdAt: number;
}
