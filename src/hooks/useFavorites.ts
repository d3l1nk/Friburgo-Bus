import { useCallback, useEffect, useState } from 'react';
import { getJSON, setJSON } from '../lib/storage';
import type { FavoriteStop, Favorites } from '../types';

const FAV_KEY = 'favorites:v1';

export function useFavorites() {
  const [favs, setFavs] = useState<Favorites>({ lines: [], stops: [] });

  useEffect(() => {
    getJSON<Favorites>(FAV_KEY).then((f) => {
      if (f) setFavs({ lines: f.lines ?? [], stops: f.stops ?? [] });
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
      update((f) => ({
        ...f,
        lines: f.lines.includes(code) ? f.lines.filter((c) => c !== code) : [...f.lines, code],
      })),
    [update],
  );

  const toggleStop = useCallback(
    (s: FavoriteStop) =>
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
