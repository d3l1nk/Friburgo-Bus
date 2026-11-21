import { useCallback, useState } from 'react';
import { usePolling } from '../../../hooks/useTimers';
import { errMessage } from '../../../lib/errors';
import { getStopArrivals } from '../../../services/merus';
import type { LatLng, MerusArrival, MerusStop } from '../../../types';

/** Ponto selecionado + previsões de chegada (atualiza a cada 15 s enquanto `active`). */
export function useStopArrivals(pos: LatLng, active: boolean) {
  const [selected, setSelected] = useState<MerusStop | null>(null);
  const [arrivals, setArrivals] = useState<MerusArrival[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const select = useCallback((s: MerusStop) => {
    setSelected(s);
    setArrivals([]);
    setError(null);
    setLoading(true);
  }, []);
  const clear = useCallback(() => setSelected(null), []);

  const refresh = async () => {
    if (!selected) return;
    try {
      setArrivals(await getStopArrivals(selected.id, pos));
      setError(null);
    } catch (e: unknown) {
      setError(errMessage(e, 'Falha ao buscar previsões'));
    } finally {
      setLoading(false);
    }
  };
  usePolling(refresh, 15000, active && !!selected, [selected?.id]);

  return { selected, arrivals, error, loading, select, clear, refresh };
}
