import { useCallback, useEffect, useState } from 'react';
import { getPosition, type GeoFix } from '../lib/geo';

/** 1ª posição rápida (rede, até 3 s); o GPS preciso chega depois via onRefine. */
export function useGeoPosition() {
  const [geo, setGeo] = useState<GeoFix | null>(null);
  const relocate = useCallback(() => {
    void getPosition(setGeo).then(setGeo);
  }, []);
  useEffect(() => {
    relocate();
  }, [relocate]);
  return { geo, relocate };
}
