import { useEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';

export interface FlyTarget {
  lat: number;
  lng: number;
  zoom?: number;
  /** muda a cada pedido, para repetir o mesmo destino */
  n: number;
}

export function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  useEffect(() => onZoom(map.getZoom()), [map, onZoom]);
  return null;
}

/** Mantém o tamanho do mapa correto (ResizeObserver) e voa até o destino pedido. */
export function MapController({ active, target }: { active: boolean; target: FlyTarget | null }) {
  const map = useMap();
  useEffect(() => {
    const c = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(c);
    if (c.parentElement) ro.observe(c.parentElement);
    const t = setTimeout(() => map.invalidateSize(), 120);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, [map]);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => clearTimeout(t);
  }, [active, map]);
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom ?? map.getZoom(), { duration: 0.6 });
  }, [target, map]);
  return null;
}
