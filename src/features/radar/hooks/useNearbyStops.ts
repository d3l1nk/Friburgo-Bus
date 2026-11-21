import { useCallback, useRef, useState } from 'react';
import { errMessage } from '../../../lib/errors';
import { getNearbyStops } from '../../../services/merus';
import type { LatLng, MerusStop } from '../../../types';

/** Pontos de parada perto de `pos` (cache local: só refaz a chamada se andou > 400 m ou se `force`). */
export function useNearbyStops(pos: LatLng) {
  const [stops, setStops] = useState<MerusStop[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const posRef = useRef(pos);
  posRef.current = pos;

  const reload = useCallback(async (force: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const r = await getNearbyStops(posRef.current, force);
      setStops(r.stops);
      setFromCache(r.fromCache);
    } catch (e: unknown) {
      setError(errMessage(e, 'Falha ao carregar pontos'));
    } finally {
      setLoading(false);
    }
  }, []);

  return { stops, fromCache, loading, error, reload };
}
