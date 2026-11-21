import { useEffect, useState } from 'react';
import { getAlerts, getCachedAlerts } from '../services/faol';
import type { FaolAlert } from '../types';

/** Avisos de desvio da FAOL: mostra o cache na hora e atualiza pela rede em seguida. */
export function useAlerts() {
  const [alerts, setAlerts] = useState<FaolAlert[]>([]);
  useEffect(() => {
    let alive = true;
    getCachedAlerts().then((c) => {
      if (alive && c) setAlerts(c.alerts);
    });
    getAlerts().then((r) => {
      if (alive && !r.error) setAlerts(r.alerts);
    });
    return () => {
      alive = false;
    };
  }, []);
  return { alerts };
}
