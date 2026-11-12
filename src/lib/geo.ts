import { Geolocation } from '@capacitor/geolocation';
import type { LatLng } from '../types';

export const ESTACAO_LIVRE: LatLng = { lat: -22.2818, lng: -42.5311 };

export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function formatDistance(m?: number): string {
  if (m === undefined) return '';
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

export interface GeoFix {
  pos: LatLng;
  usingFallback: boolean;
}

async function ensurePermission(): Promise<void> {
  try {
    const perm = await Geolocation.checkPermissions();
    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
      await Geolocation.requestPermissions();
    }
  } catch {
    /* web: sem checkPermissions */
  }
}

async function tryPosition(highAccuracy: boolean, timeout: number, maximumAge: number): Promise<LatLng | null> {
  try {
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: highAccuracy, timeout, maximumAge });
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  } catch {
    return null;
  }
}

/**
 * 1) Localização rápida por rede (até 3 s, aceita cache de 60 s) -> o app abre na hora.
 * 2) Em segundo plano, tenta o GPS de alta precisão e avisa via onRefine se andou > 30 m.
 */
export async function getPosition(onRefine?: (fix: GeoFix) => void): Promise<GeoFix> {
  await ensurePermission();
  const quick = await tryPosition(false, 3000, 60000);

  void (async () => {
    const hi = await tryPosition(true, 15000, 0);
    if (hi && (!quick || haversine(quick, hi) > 30)) onRefine?.({ pos: hi, usingFallback: false });
  })();

  return quick ? { pos: quick, usingFallback: false } : { pos: ESTACAO_LIVRE, usingFallback: true };
}
