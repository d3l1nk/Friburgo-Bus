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

export async function getPosition(): Promise<GeoFix> {
  try {
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
        await Geolocation.requestPermissions();
      }
    } catch {
      /* web: sem checkPermissions */
    }
    const p = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 15000,
    });
    return { pos: { lat: p.coords.latitude, lng: p.coords.longitude }, usingFallback: false };
  } catch {
    return { pos: ESTACAO_LIVRE, usingFallback: true };
  }
}
