import { useCallback, useEffect, useState } from 'react';
import { listCachedTables } from '../services/faol';

export function useCachedTables() {
  const [cached, setCached] = useState<Set<string>>(new Set());
  const refresh = useCallback(() => {
    void listCachedTables().then((k) => setCached(new Set(k)));
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { cached, refresh };
}
