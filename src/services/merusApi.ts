import { httpRequest } from '../lib/http';
import { recordDebug } from '../lib/debug';
import { getJSON, setJSON } from '../lib/storage';
import { haversine } from '../lib/geo';
import { isKnownKey, resolveLineKey } from '../data/faolLines';
import type { LatLng, MerusArrival, MerusStop, MerusVehicle, StopsCache } from '../types';

const BASE = 'https://friburgo.merustracker.com.br:8888/api/v1.0';

export const MERUS_HEADERS: Record<string, string> = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'pt-BR',
  'content-type': 'application/json;charset=UTF-8',
  Referer: 'https://friburgo.merustracker.com.br/',
  Origin: 'https://friburgo.merustracker.com.br',
};

export const STOPS_RADIUS = 1000;
export const STOPS_REFETCH_METERS = 400;
const STOPS_CACHE_KEY = 'merus:stops:v1';

// =====================================================================
// Chamada genérica + registro de debug
// =====================================================================
export interface MerusCall {
  ok: boolean;
  status: number;
  ms: number;
  raw: any;
  error?: string;
}

async function call(debugKey: string, endpoint: string, body: unknown): Promise<MerusCall> {
  const url = `${BASE}/${endpoint}`;
  const res = await httpRequest({ url, method: 'POST', headers: MERUS_HEADERS, body, responseType: 'json' });
  recordDebug(debugKey, {
    label: endpoint,
    at: Date.now(),
    url,
    method: 'POST',
    requestBody: body,
    status: res.status,
    ms: res.ms,
    ok: res.ok,
    error: res.error,
    data: res.data,
  });
  return { ok: res.ok, status: res.status, ms: res.ms, raw: res.data, error: res.error };
}

export const rawStops = (lat: number, lng: number, radius = STOPS_RADIUS) =>
  call('stops', 'getcercamaisproxima', { coords: { type: 'Circle', center: { lat, lng }, radius } });

export const rawPanel = (idCerca: number | string, lat: number, lng: number) =>
  call('panel', 'getveiculospainel', { id_cerca: isNaN(Number(idCerca)) ? idCerca : Number(idCerca), lat, lng });

export const rawVehicles = () => call('vehicles', 'getveiculosconsultapassageiro', { id: null, tipo: 1 });

// =====================================================================
// Normalizador resiliente
// =====================================================================
type Obj = Record<string, any>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Busca o valor por qualquer um dos nomes, ignorando maiúsculas/minúsculas. */
export function pick(o: unknown, names: string[]): any {
  if (!isObj(o)) return undefined;
  const lower = new Map<string, string>();
  Object.keys(o).forEach((k) => lower.set(k.toLowerCase(), k));
  for (const n of names) {
    const real = lower.get(n.toLowerCase());
    if (real !== undefined) {
      const v = o[real];
      if (v !== undefined && v !== null && v !== '') return v;
    }
  }
  return undefined;
}

const toNum = (v: unknown): number | null => {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  return null;
};

const validCoord = (lat: number | null, lng: number | null): LatLng | null =>
  lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)
    ? { lat, lng }
    : null;

const LAT_KEYS = ['lat', 'latitude', 'nr_lat', 'nr_latitude', 'lat_centro', 'y'];
const LNG_KEYS = ['lng', 'lon', 'long', 'longitude', 'nr_long', 'nr_lng', 'nr_longitude', 'lng_centro', 'x'];
const NESTED_KEYS = ['coords', 'center', 'centro', 'position', 'posicao', 'location', 'localizacao', 'ponto', 'coordenadas', 'geometry', 'cerca'];

export function pickCoords(o: unknown, depth = 0): LatLng | null {
  if (!isObj(o) || depth > 3) return null;
  const direct = validCoord(toNum(pick(o, LAT_KEYS)), toNum(pick(o, LNG_KEYS)));
  if (direct) return direct;
  for (const nk of NESTED_KEYS) {
    const v = pick(o, [nk]);
    if (typeof v === 'string' && v.includes(',')) {
      const [a, b] = v.split(',').map((s) => toNum(s.trim()));
      const c = validCoord(a, b);
      if (c) return c;
    }
    if (Array.isArray(v) && v.length >= 2 && typeof v[0] !== 'object') {
      const c = validCoord(toNum(v[1]), toNum(v[0]));
      if (c) return c;
    }
    if (isObj(v)) {
      const coordArr = pick(v, ['coordinates']);
      if (Array.isArray(coordArr) && coordArr.length >= 2 && typeof coordArr[0] === 'number') {
        const c = validCoord(toNum(coordArr[1]), toNum(coordArr[0]));
        if (c) return c;
      }
      const c = pickCoords(v, depth + 1);
      if (c) return c;
    }
  }
  return null;
}

/** Acha a primeira lista de objetos no JSON (raiz ou aninhada). */
export function findArray(raw: unknown): Obj[] {
  if (Array.isArray(raw)) return raw.filter(isObj);
  const queue: unknown[] = [raw];
  let guard = 0;
  while (queue.length && guard++ < 200) {
    const cur = queue.shift();
    if (Array.isArray(cur)) {
      if (cur.length && cur.every(isObj)) return cur as Obj[];
      continue;
    }
    if (isObj(cur)) queue.push(...Object.values(cur));
  }
  return [];
}

function labelOf(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
  if (isObj(v)) {
    const num = pick(v, ['numero', 'codigo', 'nr_linha', 'cd_linha', 'linha']);
    const name = pick(v, ['nome', 'ds_linha', 'descricao', 'name']);
    return [num, name].filter(Boolean).join(' ').trim();
  }
  return '';
}

const LINE_FIELDS = ['numero_linha', 'nr_linha', 'cd_linha', 'codigo_linha', 'linha', 'ds_linha', 'nome_linha', 'numero', 'nm_linha', 'rota'];

function extractLine(item: Obj): { label: string; name: string; key: string } {
  const cands = LINE_FIELDS.map((f) => labelOf(pick(item, [f]))).filter(Boolean);
  const uniq = [...new Set(cands)];
  const keys = uniq.map((c) => resolveLineKey(c)).filter(Boolean);
  const key = keys.find((k) => isKnownKey(k)) ?? keys[0] ?? '';
  return { label: uniq[0] ?? '', name: uniq[1] ?? '', key };
}

// ---------- Pontos (cercas) ----------
function normalizeLinesField(v: unknown): string[] {
  if (v === undefined || v === null) return [];
  if (typeof v === 'string') return v.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(v)) return v.map(labelOf).filter(Boolean);
  return [];
}

export function normalizeStops(raw: unknown): MerusStop[] {
  const map = new Map<string, MerusStop>();
  for (const item of findArray(raw)) {
    const coords = pickCoords(item);
    if (!coords) continue;
    const idRaw = pick(item, ['id_cerca', 'idcerca', 'id', 'codigo', 'cd_cerca']);
    const name =
      pick(item, ['nome', 'ds_cerca', 'descricao', 'ds_descricao', 'ds_nome', 'nm_cerca', 'nome_cerca', 'endereco', 'ds_ponto', 'name', 'titulo']) ?? '';
    const id = String(idRaw ?? `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`);
    const lines = [
      ...normalizeLinesField(pick(item, ['linhas', 'lines', 'ds_linhas', 'rotas'])),
      ...normalizeLinesField(pick(item, ['linha', 'ds_linha', 'numero_linha', 'nr_linha'])),
    ];
    const existing = map.get(id);
    if (existing) {
      existing.lines = [...new Set([...existing.lines, ...lines])];
    } else {
      map.set(id, { id, name: String(name || `Ponto ${id}`), lat: coords.lat, lng: coords.lng, lines: [...new Set(lines)] });
    }
  }
  return [...map.values()];
}

// ---------- Painel de chegadas ----------
export function parseEta(v: unknown): { min: number | null; text: string } {
  if (v === undefined || v === null || v === '') return { min: null, text: '' };
  if (typeof v === 'number') {
    const min = v > 600 ? v / 60 : v;
    return { min: Math.max(0, Math.round(min)), text: String(v) };
  }
  const s = String(v).trim();
  const parts = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (parts) {
    const a = +parts[1];
    const b = +parts[2];
    if (parts[3] !== undefined) return { min: Math.round(a * 60 + b + +parts[3] / 60), text: s }; // duração h:m:s
    const now = new Date();
    let diff = a * 60 + b - (now.getHours() * 60 + now.getMinutes());
    if (diff < -30) diff += 1440;
    return { min: Math.max(0, diff), text: s }; // horário previsto
  }
  const h = s.match(/(\d+)\s*h/i);
  const m = s.match(/(\d+)\s*(?:min|m\b)/i);
  if (h || m) return { min: (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0), text: s };
  if (/^\d+([.,]\d+)?$/.test(s)) return { min: Math.round(parseFloat(s.replace(',', '.'))), text: s };
  return { min: null, text: s };
}

const ETA_FIELDS = ['tempo', 'previsao', 'eta', 'minutos', 'tempo_chegada', 'previsao_chegada', 'tempo_estimado', 'tempoestimado', 'tempo_restante', 'previsao_minutos', 'chegada'];
const DEST_FIELDS = ['sentido', 'destino', 'ds_sentido', 'ds_destino', 'nome_destino', 'itinerario', 'ds_itinerario'];
const PREFIX_FIELDS = ['prefixo', 'veiculo', 'ds_veiculo', 'cd_veiculo', 'nr_veiculo', 'placa', 'id_veiculo', 'idveiculo', 'id'];

export function normalizeArrivals(raw: unknown): MerusArrival[] {
  const out = findArray(raw).map((item, i): MerusArrival => {
    const line = extractLine(item);
    const eta = parseEta(pick(item, ETA_FIELDS));
    return {
      key: `${i}-${labelOf(pick(item, PREFIX_FIELDS))}`,
      lineLabel: line.label,
      lineKey: line.key,
      destination: labelOf(pick(item, DEST_FIELDS)) || line.name,
      prefix: labelOf(pick(item, PREFIX_FIELDS)),
      etaMin: eta.min,
      etaText: eta.text,
      raw: item,
    };
  });
  return out.sort((a, b) => (a.etaMin ?? 9999) - (b.etaMin ?? 9999));
}

// ---------- Veículos ----------
export function normalizeVehicles(raw: unknown): MerusVehicle[] {
  const out: MerusVehicle[] = [];
  findArray(raw).forEach((item, i) => {
    const c = pickCoords(item);
    if (!c) return;
    const line = extractLine(item);
    out.push({
      id: labelOf(pick(item, PREFIX_FIELDS)) || `v${i}`,
      lineLabel: line.label,
      lineName: line.name,
      lineKey: line.key,
      lat: c.lat,
      lng: c.lng,
      heading: toNum(pick(item, ['heading', 'angulo', 'rumo', 'direcao_graus', 'nr_angulo', 'course', 'bearing'])),
      direction: labelOf(pick(item, ['sentido', 'ds_sentido', 'destino', 'direcao'])),
      speed: toNum(pick(item, ['velocidade', 'speed', 'nr_velocidade'])),
      updatedAt: labelOf(pick(item, ['datahora', 'data_hora', 'dt_posicao', 'dt_atualizacao', 'ultima_atualizacao', 'timestamp', 'data'])),
      raw: item,
    });
  });
  return out;
}

// =====================================================================
// API de alto nível
// =====================================================================
export interface StopsResult {
  stops: MerusStop[];
  fromCache: boolean;
  savedAt: number;
}

export async function getNearbyStops(center: LatLng, force = false): Promise<StopsResult> {
  const cache = await getJSON<StopsCache>(STOPS_CACHE_KEY);
  if (cache && !force && haversine(cache.center, center) <= STOPS_REFETCH_METERS) {
    return { stops: withDistance(cache.stops, center), fromCache: true, savedAt: cache.savedAt };
  }
  const res = await rawStops(center.lat, center.lng);
  if (!res.ok) {
    if (cache) return { stops: withDistance(cache.stops, center), fromCache: true, savedAt: cache.savedAt };
    throw new Error(res.error ?? 'Falha ao buscar pontos');
  }
  const stops = normalizeStops(res.raw);
  const entry: StopsCache = { center, radius: STOPS_RADIUS, savedAt: Date.now(), stops };
  await setJSON(STOPS_CACHE_KEY, entry);
  return { stops: withDistance(stops, center), fromCache: false, savedAt: entry.savedAt };
}

function withDistance(stops: MerusStop[], c: LatLng): MerusStop[] {
  return stops.map((s) => ({ ...s, distance: haversine(c, s) })).sort((a, b) => a.distance! - b.distance!);
}

export async function getStopArrivals(stopId: string, pos: LatLng): Promise<MerusArrival[]> {
  const res = await rawPanel(stopId, pos.lat, pos.lng);
  if (!res.ok) throw new Error(res.error ?? 'Falha ao buscar previsões');
  return normalizeArrivals(res.raw);
}

export async function getAllVehicles(): Promise<MerusVehicle[]> {
  const res = await rawVehicles();
  if (!res.ok) throw new Error(res.error ?? 'Falha ao buscar veículos');
  return normalizeVehicles(res.raw);
}
