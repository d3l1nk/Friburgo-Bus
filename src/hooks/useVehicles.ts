import { useCallback, useState } from 'react';
import { errMessage } from '../lib/errors';
import { getAllVehicles } from '../services/merus';
import type { MerusVehicle } from '../types';
import { usePolling } from './useTimers';

/** Posição de todos os ônibus, atualizada a cada 15 s enquanto `enabled`. */
export function useVehicles(enabled: boolean) {
  const [vehicles, setVehicles] = useState<MerusVehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [at, setAt] = useState(0);

  const load = useCallback(async () => {
    try {
      setVehicles(await getAllVehicles());
      setError(null);
      setAt(Date.now());
    } catch (e: unknown) {
      setError(errMessage(e, 'Erro'));
    }
  }, []);

  usePolling(load, 15000, enabled);
  return { vehicles, error, at, reload: load };
}
