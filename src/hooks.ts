import { useCallback, useEffect, useRef, useState } from 'react';
import { getJSON, setJSON } from './lib/storage';
import { usePolling } from './lib/time';
import { getAllVehicles } from './services/merusApi';
import { getAlerts, getCachedAlerts } from './services/faolScraper';
import { lineKey } from './data/faolLines';
import type { FaolAlert, Favorites, MerusVehicle } from './types';

const FAV_KEY = 'favorites:v1';

export function useFavorites() {
  const [favs, setFavs] = useState<Favorites>({ lines: [], stops: [] });
  const loaded = useRef(false);

  useEffect(() => {
    getJSON<Favorites>(FAV_KEY).then((f) => {
      if (f) setFavs({ lines: f.lines ?? [], stops: f.stops ?? [] });
      loaded.current = true;
    });
  }, []);

  const update = useCallback((fn: (f: Favorites) => Favorites) => {
    setFavs((prev) => {
      const next = fn(prev);
      void setJSON(FAV_KEY, next);
      return next;
    });
  }, []);

  const toggleLine = useCallback(
    (code: string) =>
      update((f) => ({ ...f, lines: f.lines.includes(code) ? f.lines.filter((c) => c !== code) : [...f.lines, code] })),
    [update],
  );
  const toggleStop = useCallback(
    (s: { id: string; name: string; lat: number; lng: number }) =>
      update((f) => ({
        ...f,
        stops: f.stops.some((x) => x.id === s.id)
          ? f.stops.filter((x) => x.id !== s.id)
          : [...f.stops, { id: s.id, name: s.name, lat: s.lat, lng: s.lng }],
      })),
    [update],
  );
  return { favs, toggleLine, toggleStop };
}

export function useVehicles(enabled: boolean) {
  const [vehicles, setVehicles] = useState<MerusVehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [at, setAt] = useState(0);

  const load = useCallback(async () => {
    try {
      setVehicles(await getAllVehicles());
      setError(null);
      setAt(Date.now());
    } catch (e: any) {
      setError(e?.message ?? 'Erro');
    }
  }, []);

  usePolling(load, 15000, enabled);
  return { vehicles, error, at, reload: load };
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<FaolAlert[]>([]);
  useEffect(() => {
    let alive = true;
    getCachedAlerts().then((c) => alive && c && setAlerts(c.alerts));
    getAlerts().then((r) => alive && r.alerts.length >= 0 && !r.error && setAlerts(r.alerts));
    return () => {
      alive = false;
    };
  }, []);
  const byLine = (key: string) => alerts.filter((a) => a.lineKey === lineKey(key));
  return { alerts, byLine };
}
