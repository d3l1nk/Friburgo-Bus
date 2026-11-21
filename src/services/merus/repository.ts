import { haversine } from '../../lib/geo';
import { getJSON, setJSON } from '../../lib/storage';
import type { LatLng, MerusArrival, MerusStop, MerusVehicle, StopsCache } from '../../types';
import { rawPanel, rawStops, rawVehicles } from './client';
import { STOPS_CACHE_KEY, STOPS_RADIUS, STOPS_REFETCH_METERS } from './constants';
import { normalizeArrivals, normalizeStops, normalizeVehicles } from './normalize';

export interface StopsResult {
  stops: MerusStop[];
  fromCache: boolean;
  savedAt: number;
}

export function withDistance(stops: MerusStop[], center: LatLng): MerusStop[] {
  return stops
    .map((s) => ({ ...s, distance: haversine(center, s) }))
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}

/**
 * Pontos num raio de 1 km. A resposta pesa ~223 kB, então guardamos só os campos normalizados
 * e só refazemos a chamada se o usuário andou mais de 400 m (ou se `force`).
 */
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
