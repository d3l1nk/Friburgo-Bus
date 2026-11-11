import { Geolocation } from '@capacitor/geolocation';
import type { LatLng } from '../types';

export const ESTACAO_LIVRE: LatLng = { lat: -22.2818, lng: -42.5311 };

export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function formatDistance(m?: number): string {
  if (m === undefined) return '';
  return m < 1000
    ? `${Math.max(10, Math.round(m / 10) * 10)} m`
    : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
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
      /* Navegador web sem checkPermissions nativo */
    }

    // 1) Tentativa rápida via rede/Wi-Fi (máx 3 segundos) para não travar a abertura do app
    try {
      const fast = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 3000,
        maximumAge: 60000,
      });
      return {
        pos: { lat: fast.coords.latitude, lng: fast.coords.longitude },
        usingFallback: false,
      };
    } catch {
      // 2) Tentativa com GPS de alta precisão (máx 6 segundos)
      const precise = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 30000,
      });
      return {
        pos: { lat: precise.coords.latitude, lng: precise.coords.longitude },
        usingFallback: false,
      };
    }
  } catch {
    return { pos: ESTACAO_LIVRE, usingFallback: true };
  }
}
