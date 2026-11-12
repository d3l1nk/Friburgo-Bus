// ---------- Geral ----------
export type LatLng = { lat: number; lng: number };
export type DayCode = 'U' | 'S' | 'D' | 'C';
export type TabId = 'radar' | 'lines' | 'favorites' | 'diag';

export type RegionId =
  | 'circular'
  | 'centro-sul'
  | 'centro-norte'
  | 'norte'
  | 'leste'
  | 'sul'
  | 'oeste';

export interface FaolLine {
  code: string;
  name: string;
  region: RegionId;
}

// ---------- Merus Tracker (normalizado) ----------
export interface MerusStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lines: string[];
  distance?: number; // metros, calculado no cliente
}

export interface MerusArrival {
  key: string;
  lineLabel: string;
  lineKey: string;
  destination: string;
  prefix: string;
  etaMin: number | null;
  etaText: string;
  raw: unknown;
}

export interface MerusVehicle {
  id: string;
  lineLabel: string;
  lineName: string;
  lineKey: string;
  lat: number;
  lng: number;
  heading: number | null;
  direction: string;
  speed: number | null;
  updatedAt: string;
  raw: unknown;
}

export interface StopsCache {
  center: LatLng;
  radius: number;
  savedAt: number;
  stops: MerusStop[];
}

// ---------- HTTP / Debug ----------
export interface HttpResult<T = any> {
  ok: boolean;
  status: number;
  ms: number;
  url: string;
  data: T;
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

// ---------- FAOL ----------
export interface FaolAlert {
  lineKey: string;
  kind: 'ALTERAÇÃO' | 'ATENÇÃO';
  text: string;
}

/** Links reais da FAOL por linha (chave = lineKey) e dia. */
export type FaolLinks = Record<string, Partial<Record<DayCode, string>>>;

export interface AlertsCache {
  savedAt: number;
  alerts: FaolAlert[];
  links?: FaolLinks;
}

export interface Departure {
  time: string; // HH:MM
  minutes: number; // minutos desde 00:00
  ramal?: string; // ex.: A, B
}

export interface TimetableColumn {
  origin: string;
  isTerminal: boolean;
  departures: Departure[];
}

export interface Timetable {
  code: string;
  day: DayCode;
  fetchedAt: number;
  columns: TimetableColumn[];
  legend: { code: string; label: string }[];
  sourceUrl?: string; // página original da FAOL
  rawText?: string; // só guardado quando o parser não achou horários
}

export interface TimetableResult {
  table: Timetable | null;
  fromCache: boolean;
  error?: string;
}

// ---------- Favoritos ----------
export interface Favorites {
  lines: string[];
  stops: { id: string; name: string; lat: number; lng: number }[];
}
